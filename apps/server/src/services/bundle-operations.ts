import crypto from 'node:crypto';
import {
  BookingStatus,
  DepositStatus,
  ItemStatus,
  PaymentAttemptStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import type { ZaloPayGateway } from './zalopay.service.js';
import {
  RentalOperations,
  type RentalActor,
  type HandoverInput,
  type InspectionInput,
} from './rental-operations.js';
import { lockBooking, lockUnit, refreshUnitStatus } from './rental-availability.js';
import { quoteBundle, type BundleSelection } from './bundle-quote.js';
import { cancellationRefundAmount, suggestedLateFee } from './approved-policy.js';
import { PaymentFlowError, dateKey, vietnamDate } from './rental-domain.js';

const include = {
  user: { select: { id: true, fullName: true, email: true, phone: true } },
  bookings: {
    include: {
      cameraItem: { include: { product: { select: { modelName: true, slug: true, brand: true } } } },
      paymentAttempt: true,
      refunds: { orderBy: { submittedAt: 'desc' as const }, take: 10 },
      events: { orderBy: { createdAt: 'asc' as const } },
    },
    orderBy: { cameraItemId: 'asc' as const },
  },
} satisfies Prisma.RentalBundleInclude;
type Bundle = Prisma.RentalBundleGetPayload<{ include: typeof include }>;
type Input = { requestId: string; note: string };
function admin(actor: RentalActor) {
  if (actor.role !== 'ADMIN') throw new PaymentFlowError('Không có quyền thực hiện thao tác này', 403);
}
function primary(bundle: Bundle) {
  const item = bundle.bookings.find((b) => b.paymentAttempt);
  if (!item) throw new PaymentFlowError('Bộ thuê chưa có giao dịch để đối soát', 409);
  return item;
}
function view(bundle: Bundle) {
  const first = bundle.bookings[0],
    main = primary(bundle);
  const same = bundle.bookings.every((b) => b.status === first.status);
  const status = same
    ? first.status
    : bundle.bookings.every((b) =>
          [BookingStatus.COMPLETED, BookingStatus.RETURNED_PENDING_INSPECTION].includes(b.status as never),
        )
      ? BookingStatus.RETURNED_PENDING_INSPECTION
      : 'REVIEW';
  const cancelling = bundle.bookings.every((b) => b.status === BookingStatus.CANCELLED && !b.handoverAt);
  const settled = bundle.bookings.every(
    (b) =>
      b.status === BookingStatus.COMPLETED &&
      b.inspectedAt &&
      (!b.deductionAmount || b.deductionDecision === 'ACCEPTED'),
  );
  const totalRentalFee = bundle.bookings.reduce((n, b) => n + b.totalRentalFee, 0),
    depositAmount = bundle.bookings.reduce((n, b) => n + b.depositAmount, 0);
  return {
    ...bundle,
    status,
    primaryBookingId: main.id,
    paymentAttempt: main.paymentAttempt,
    refunds: main.refunds,
    events: bundle.bookings
      .flatMap((b) => b.events)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    bookings: bundle.bookings.map((b) => ({
      ...b,
      suggestedLateFee: suggestedLateFee(b.dueAt, b.returnedAt, b.dailyRate),
    })),
    totalRentalFee,
    depositAmount,
    totalAmount: totalRentalFee + depositAmount,
    deductionAmount: bundle.bookings.reduce((n, b) => n + b.deductionAmount, 0),
    totalDays: first.totalDays,
    startDate: first.startDate,
    endDate: first.endDate,
    pickupAt: first.pickupAt,
    dueAt: first.dueAt,
    policySnapshot: first.policySnapshot,
    rescheduleCount: first.rescheduleCount,
    cancellationRefundAmount: bundle.bookings.reduce((n, b) => n + cancellationRefundAmount(b), 0),
    canRefund:
      main.paymentAttempt?.status === 'PAID' &&
      (cancelling || settled) &&
      !main.refunds.some((r) => r.status !== 'FAILED') &&
      !bundle.bookings.every((b) => ['REFUNDED', 'DEDUCTED'].includes(b.depositStatus)),
  };
}

export class BundleOperations {
  private refunds: RentalOperations;
  constructor(
    private prisma: PrismaClient,
    private gateway: ZaloPayGateway,
  ) {
    this.refunds = new RentalOperations(prisma, gateway);
  }

  async detail(id: string, actor: RentalActor) {
    const bundle = await this.prisma.rentalBundle.findUnique({ where: { id }, include });
    if (!bundle || (actor.role !== 'ADMIN' && bundle.userId !== actor.id))
      throw new PaymentFlowError('Không tìm thấy bộ thuê', 404);
    return view(bundle);
  }

  private async operate<T extends Input>(
    id: string,
    actor: RentalActor,
    action: string,
    input: T,
    apply: (tx: Prisma.TransactionClient, bundle: Bundle) => Promise<void>,
  ) {
    const initial = await this.prisma.rentalBundle.findUnique({
      where: { id },
      select: { userId: true, bookings: { select: { id: true, cameraItemId: true } } },
    });
    if (!initial || (actor.role !== 'ADMIN' && initial.userId !== actor.id))
      throw new PaymentFlowError('Không tìm thấy bộ thuê', 404);
    const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return this.prisma.$transaction(
      async (tx) => {
        for (const unitId of initial.bookings.map((b) => b.cameraItemId).sort((a, b) => a - b))
          await lockUnit(tx, unitId);
        for (const bookingId of initial.bookings.map((b) => b.id).sort()) await lockBooking(tx, bookingId);
        const bundle = await tx.rentalBundle.findUniqueOrThrow({ where: { id }, include });
        const main = primary(bundle),
          event = await tx.rentalEvent.findUnique({ where: { requestId: input.requestId } });
        if (event) {
          if (
            event.bookingId !== main.id ||
            event.actorId !== actor.id ||
            event.action !== action ||
            event.payloadHash !== hash
          )
            throw new PaymentFlowError('Mã thao tác đã dùng cho nội dung khác', 409);
        } else {
          await apply(tx, bundle);
          await tx.rentalEvent.create({
            data: {
              bookingId: main.id,
              actorId: actor.id,
              action,
              detail: input.note,
              requestId: input.requestId,
              payloadHash: hash,
            },
          });
        }
        return view(await tx.rentalBundle.findUniqueOrThrow({ where: { id }, include }));
      },
      { timeout: 15000 },
    );
  }

  async handover(
    id: string,
    actor: RentalActor,
    input: Input & { records: (Omit<HandoverInput, 'requestId' | 'note'> & { bookingId: string })[] },
  ) {
    admin(actor);
    return this.operate(id, actor, 'BUNDLE_HANDOVER', input, async (tx, bundle) => {
      if (
        primary(bundle).paymentAttempt?.status !== PaymentAttemptStatus.PAID ||
        bundle.bookings.some((b) => b.status !== BookingStatus.CONFIRMED)
      )
        throw new PaymentFlowError('Chỉ bàn giao cả bộ đã xác nhận thanh toán', 409);
      if (dateKey(bundle.bookings[0].startDate) !== vietnamDate())
        throw new PaymentFlowError(
          'Bàn giao vào ngày nhận đã hẹn; cần đổi lịch trước nếu nhận ngày khác',
          409,
        );
      if (
        input.records.length !== bundle.bookings.length ||
        new Set(input.records.map((r) => r.bookingId)).size !== bundle.bookings.length
      )
        throw new PaymentFlowError('Cần biên bản cho đầy đủ thiết bị trong bộ');
      const now = new Date();
      for (const booking of bundle.bookings) {
        const record = input.records.find((r) => r.bookingId === booking.id);
        if (!record || [ItemStatus.SOLD, ItemStatus.MAINTENANCE].includes(booking.cameraItem.status as never))
          throw new PaymentFlowError('Thiết bị hoặc biên bản chưa sẵn sàng bàn giao', 409);
        if (
          await tx.rentalBooking.count({
            where: {
              cameraItemId: booking.cameraItemId,
              id: { not: booking.id },
              status: { in: [BookingStatus.ACTIVE_RENTAL, BookingStatus.RETURNED_PENDING_INSPECTION] },
            },
          })
        )
          throw new PaymentFlowError('Một thiết bị chưa kết thúc lượt thuê trước', 409);
        if (
          record.shutterCount !== null &&
          booking.cameraItem.shutterCount !== null &&
          record.shutterCount < booking.cameraItem.shutterCount
        )
          throw new PaymentFlowError('Số shot bàn giao không thể thấp hơn hồ sơ');
        const { bookingId, ...data } = record;
        await tx.rentalBooking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.ACTIVE_RENTAL,
            handoverAt: now,
            handoverRecord: { ...data, note: input.note },
          },
        });
        await tx.cameraItem.update({
          where: { id: booking.cameraItemId },
          data: {
            status: ItemStatus.RENTED,
            ...(record.shutterCount !== null ? { shutterCount: record.shutterCount } : {}),
          },
        });
      }
    });
  }

  async receiveReturn(id: string, actor: RentalActor, input: Input) {
    admin(actor);
    return this.operate(id, actor, 'BUNDLE_RETURN', input, async (tx, bundle) => {
      if (bundle.bookings.some((b) => b.status !== BookingStatus.ACTIVE_RENTAL))
        throw new PaymentFlowError('Cần bàn giao cả bộ trước khi nhận lại', 409);
      await tx.rentalBooking.updateMany({
        where: { bundleId: id },
        data: { status: BookingStatus.RETURNED_PENDING_INSPECTION, returnedAt: new Date() },
      });
      await tx.cameraItem.updateMany({
        where: { id: { in: bundle.bookings.map((b) => b.cameraItemId) } },
        data: { status: ItemStatus.MAINTENANCE },
      });
    });
  }

  async inspect(id: string, actor: RentalActor, input: InspectionInput & { bookingId: string }) {
    admin(actor);
    return this.operate(id, actor, 'BUNDLE_INSPECTION', input, async (tx, bundle) => {
      const booking = bundle.bookings.find((b) => b.id === input.bookingId);
      if (!booking) throw new PaymentFlowError('Không tìm thấy thiết bị trong bộ', 404);
      const revising = booking.status === BookingStatus.COMPLETED && booking.deductionDecision === 'REJECTED';
      if (booking.status !== BookingStatus.RETURNED_PENDING_INSPECTION && !revising)
        throw new PaymentFlowError('Cần nhận lại cả bộ trước khi nghiệm thu', 409);
      if (primary(bundle).refunds.some((r) => r.status !== 'FAILED'))
        throw new PaymentFlowError('Đã gửi yêu cầu hoàn, không sửa biên bản', 409);
      if (
        input.deductionAmount > booking.depositAmount ||
        (input.deductionAmount > 0 && input.deductionReason.trim().length < 10)
      )
        throw new PaymentFlowError('Kiểm tra mức khấu trừ và ghi rõ căn cứ');
      const handover = booking.handoverRecord as { shutterCount?: number | null } | null;
      if (
        input.shutterCount !== null &&
        handover?.shutterCount != null &&
        input.shutterCount < handover.shutterCount
      )
        throw new PaymentFlowError('Số shot không thể thấp hơn khi bàn giao');
      await tx.rentalBooking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.COMPLETED,
          inspectedAt: new Date(),
          returnInspectionNote: input.note,
          returnRecord: {
            shutterCount: input.shutterCount,
            condition: input.condition,
            releaseToStock: input.releaseToStock,
            note: input.note,
          },
          deductionAmount: input.deductionAmount,
          deductionReason: input.deductionAmount ? input.deductionReason : null,
          deductionDecision: input.deductionAmount ? 'PENDING' : 'NONE',
          deductionAcceptedAt: null,
        },
      });
      if (!revising) {
        await tx.cameraItem.update({
          where: { id: booking.cameraItemId },
          data: {
            status: input.releaseToStock ? ItemStatus.AVAILABLE : ItemStatus.MAINTENANCE,
            scratchNotes: input.condition,
            ...(input.shutterCount !== null ? { shutterCount: input.shutterCount } : {}),
          },
        });
        if (input.releaseToStock) await refreshUnitStatus(tx, booking.cameraItemId);
      }
    });
  }

  async decideDeduction(
    id: string,
    actor: RentalActor,
    input: Input & { bookingId: string; accept: boolean; expectedAmount: number; inspectedAt: string },
  ) {
    return this.operate(
      id,
      actor,
      input.accept ? 'BUNDLE_DEDUCTION_ACCEPTED' : 'BUNDLE_DEDUCTION_REJECTED',
      input,
      async (tx, bundle) => {
        if (bundle.userId !== actor.id)
          throw new PaymentFlowError('Chỉ khách của đơn được xác nhận khấu trừ', 403);
        const booking = bundle.bookings.find((b) => b.id === input.bookingId);
        if (
          !booking ||
          booking.deductionDecision !== 'PENDING' ||
          booking.deductionAmount !== input.expectedAmount ||
          booking.inspectedAt?.toISOString() !== input.inspectedAt
        )
          throw new PaymentFlowError('Biên bản vừa thay đổi. Vui lòng tải lại.', 409);
        if (primary(bundle).refunds.some((r) => r.status !== 'FAILED'))
          throw new PaymentFlowError('Yêu cầu hoàn đã được gửi', 409);
        await tx.rentalBooking.update({
          where: { id: booking.id },
          data: {
            deductionDecision: input.accept ? 'ACCEPTED' : 'REJECTED',
            deductionAcceptedAt: input.accept ? new Date() : null,
          },
        });
      },
    );
  }

  async cancel(id: string, actor: RentalActor, input: Input & { storeFault?: boolean }) {
    if (input.storeFault) admin(actor);
    return this.operate(id, actor, 'BUNDLE_CANCELLED', input, async (tx, bundle) => {
      if (bundle.bookings.every((b) => b.status === BookingStatus.CANCELLED)) return;
      if (
        primary(bundle).paymentAttempt?.status !== PaymentAttemptStatus.PAID ||
        bundle.bookings.some((b) => b.status !== BookingStatus.CONFIRMED || b.handoverAt)
      )
        throw new PaymentFlowError('Chỉ hủy cả bộ đã thanh toán và chưa bàn giao', 409);
      await tx.rentalBooking.updateMany({
        where: { bundleId: id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationCause: input.storeFault ? 'STORE' : 'CUSTOMER',
          cancellationNote: input.note,
        },
      });
      for (const booking of bundle.bookings) await refreshUnitStatus(tx, booking.cameraItemId);
    });
  }

  async reschedule(id: string, actor: RentalActor, input: Input & Omit<BundleSelection, 'cameraItemIds'>) {
    return this.operate(id, actor, 'BUNDLE_RESCHEDULED', input, async (tx, bundle) => {
      const first = bundle.bookings[0];
      if (
        primary(bundle).paymentAttempt?.status !== PaymentAttemptStatus.PAID ||
        bundle.bookings.some((b) => b.status !== BookingStatus.CONFIRMED) ||
        !first.pickupAt ||
        !first.dueAt
      )
        throw new PaymentFlowError('Chỉ đổi lịch cả bộ đã thanh toán và chưa bàn giao', 409);
      if (first.rescheduleCount >= 1 || first.pickupAt.getTime() - Date.now() < 24 * 3600000)
        throw new PaymentFlowError('Đổi tối đa một lần, trước giờ nhận ít nhất 24 giờ', 409);
      const quote = await quoteBundle(
        tx,
        { ...input, cameraItemIds: bundle.bookings.map((b) => b.cameraItemId) },
        Object.fromEntries(bundle.bookings.map((b) => [b.cameraItemId, b.id])),
      );
      if (!quote.view.available)
        throw new PaymentFlowError(quote.view.unavailableReason || 'Bộ thuê không trống lịch mới', 409);
      if (
        quote.dates.days !== first.totalDays ||
        quote.dates.dueAt.getTime() - quote.dates.pickupAt.getTime() !==
          first.dueAt.getTime() - first.pickupAt.getTime() ||
        quote.quotes.some(
          (q) =>
            q.view.rentalFee !== bundle.bookings.find((b) => b.cameraItemId === q.unit.id)!.totalRentalFee,
        )
      )
        throw new PaymentFlowError('Đổi miễn phí giữ nguyên thời lượng và tiền thuê', 409);
      await tx.rentalBooking.updateMany({
        where: { bundleId: id },
        data: {
          startDate: quote.dates.start,
          endDate: quote.dates.end,
          pickupAt: quote.dates.pickupAt,
          dueAt: quote.dates.dueAt,
          rescheduleCount: { increment: 1 },
        },
      });
      for (const b of bundle.bookings) await refreshUnitStatus(tx, b.cameraItemId);
    });
  }

  async requestRefund(id: string, actor: RentalActor, clientRequestId: string) {
    const bundle = await this.detail(id, actor);
    await this.refunds.requestRefund(bundle.primaryBookingId, actor, clientRequestId, true);
    return this.detail(id, actor);
  }
  async checkRefund(id: string, actor: RentalActor) {
    const bundle = await this.detail(id, actor);
    for (const refund of bundle.refunds.filter((r) => r.activeBookingId).slice(0, 1))
      await this.refunds.reconcileRefund(refund.id, true);
    return this.detail(id, actor);
  }
}
