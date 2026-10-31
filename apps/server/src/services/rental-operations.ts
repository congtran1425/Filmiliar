import crypto from 'node:crypto';
import { BookingStatus, DepositStatus, ItemStatus, PaymentAttemptStatus, Prisma, PrismaClient, RefundStatus } from '@prisma/client';
import type { ZaloPayGateway } from './zalopay.service.js';
import { lockBooking, lockUnit, refreshUnitStatus } from './rental-availability.js';
import { PaymentFlowError, dateKey, parseDay, vietnamDate } from './rental-domain.js';

export type RentalActor = { id: string; role: string };
type OperationInput = { requestId: string; note: string };
export type HandoverInput = OperationInput & { accessories: string; shutterCount: number | null; condition: string; receiptReference: string };
export type InspectionInput = OperationInput & { shutterCount: number | null; condition: string; deductionAmount: number; deductionReason: string; releaseToStock: boolean };
const bookingInclude = {
  user: { select: { id: true, fullName: true, email: true, phone: true } },
  cameraItem: { include: { product: { select: { modelName: true, slug: true, brand: true } } } },
  paymentAttempt: true,
  refunds: { orderBy: { submittedAt: 'desc' as const }, take: 10 },
  events: { orderBy: { createdAt: 'asc' as const } }
} satisfies Prisma.RentalBookingInclude;
type Booking = Prisma.RentalBookingGetPayload<{ include: typeof bookingInclude }>;

function assertAdmin(actor: RentalActor) { if (actor.role !== 'ADMIN') throw new PaymentFlowError('Không có quyền thực hiện thao tác này', 403); }
function snapshot(booking: Booking) { return (booking.policySnapshot || {}) as { cancellationRefund?: string; version?: number; terms?: string }; }

export class RentalOperations {
  constructor(private readonly prisma: PrismaClient, private readonly gateway: ZaloPayGateway) {}

  async detail(bookingId: string, actor: RentalActor) {
    const booking = await this.prisma.rentalBooking.findUnique({ where: { id: bookingId }, include: bookingInclude });
    if (!booking || (actor.role !== 'ADMIN' && booking.userId !== actor.id)) throw new PaymentFlowError('Không tìm thấy đơn thuê', 404);
    return booking;
  }

  private async operate<T extends OperationInput>(bookingId: string, actor: RentalActor, action: string, input: T,
    apply: (tx: Prisma.TransactionClient, booking: Booking) => Promise<void>) {
    const initial = await this.prisma.rentalBooking.findUnique({ where: { id: bookingId }, select: { cameraItemId: true, userId: true } });
    if (!initial || (actor.role !== 'ADMIN' && initial.userId !== actor.id)) throw new PaymentFlowError('Không tìm thấy đơn thuê', 404);
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return this.prisma.$transaction(async tx => {
      await lockUnit(tx, initial.cameraItemId);
      await lockBooking(tx, bookingId);
      const existing = await tx.rentalEvent.findUnique({ where: { requestId: input.requestId } });
      if (existing) {
        if (existing.bookingId !== bookingId || existing.actorId !== actor.id || existing.action !== action || existing.payloadHash !== payloadHash) throw new PaymentFlowError('Mã thao tác đã được dùng cho nội dung khác', 409);
      } else {
        const booking = await tx.rentalBooking.findUnique({ where: { id: bookingId }, include: bookingInclude });
        if (!booking) throw new PaymentFlowError('Không tìm thấy đơn thuê', 404);
        await apply(tx, booking);
        await tx.rentalEvent.create({ data: { bookingId, actorId: actor.id, action, detail: input.note, requestId: input.requestId, payloadHash } });
      }
      return tx.rentalBooking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
    }, { timeout: 15_000 });
  }

  async handover(bookingId: string, actor: RentalActor, input: HandoverInput) {
    assertAdmin(actor);
    return this.operate(bookingId, actor, 'HANDOVER', input, async (tx, booking) => {
      if (booking.status !== BookingStatus.CONFIRMED || booking.paymentAttempt?.status !== PaymentAttemptStatus.PAID) throw new PaymentFlowError('Chỉ bàn giao đơn đã được ZaloPay xác nhận thanh toán', 409);
      if (dateKey(booking.startDate) !== vietnamDate()) throw new PaymentFlowError('Chỉ bàn giao vào ngày nhận máy đã đặt; cần đổi lịch trước nếu nhận sớm hoặc muộn', 409);
      if (booking.cameraItem.status === ItemStatus.SOLD || booking.cameraItem.status === ItemStatus.MAINTENANCE) throw new PaymentFlowError('Chiếc máy chưa sẵn sàng để bàn giao', 409);
      const outstanding = await tx.rentalBooking.count({ where: { cameraItemId: booking.cameraItemId, id: { not: bookingId }, status: { in: [BookingStatus.ACTIVE_RENTAL, BookingStatus.RETURNED_PENDING_INSPECTION] } } });
      if (outstanding) throw new PaymentFlowError('Chiếc máy chưa hoàn tất lượt thuê trước', 409);
      if (input.shutterCount !== null && booking.cameraItem.shutterCount !== null && input.shutterCount < booking.cameraItem.shutterCount) throw new PaymentFlowError('Số shot bàn giao không thể thấp hơn hồ sơ hiện tại');
      await tx.rentalBooking.update({ where: { id: bookingId }, data: {
        status: BookingStatus.ACTIVE_RENTAL, handoverAt: new Date(),
        handoverRecord: { accessories: input.accessories, shutterCount: input.shutterCount, condition: input.condition, receiptReference: input.receiptReference, note: input.note }
      } });
      await tx.cameraItem.update({ where: { id: booking.cameraItemId }, data: { status: ItemStatus.RENTED, ...(input.shutterCount !== null ? { shutterCount: input.shutterCount } : {}) } });
    });
  }

  async receiveReturn(bookingId: string, actor: RentalActor, input: OperationInput) {
    assertAdmin(actor);
    return this.operate(bookingId, actor, 'RETURN_RECEIVED', input, async (tx, booking) => {
      if (booking.status !== BookingStatus.ACTIVE_RENTAL) throw new PaymentFlowError('Đơn chưa ở trạng thái đang thuê', 409);
      await tx.rentalBooking.update({ where: { id: bookingId }, data: { status: BookingStatus.RETURNED_PENDING_INSPECTION, returnedAt: new Date() } });
      await tx.cameraItem.update({ where: { id: booking.cameraItemId }, data: { status: ItemStatus.MAINTENANCE } });
    });
  }

  async inspect(bookingId: string, actor: RentalActor, input: InspectionInput) {
    assertAdmin(actor);
    return this.operate(bookingId, actor, 'INSPECTION', input, async (tx, booking) => {
      const revising = booking.status === BookingStatus.COMPLETED && booking.deductionDecision === 'REJECTED';
      if (booking.status !== BookingStatus.RETURNED_PENDING_INSPECTION && !revising) throw new PaymentFlowError('Cần nhận lại máy trước khi nghiệm thu', 409);
      if (booking.refunds.some(r => r.status !== RefundStatus.FAILED)) throw new PaymentFlowError('Đã có yêu cầu hoàn tiền; không thể sửa kết quả nghiệm thu', 409);
      if (input.deductionAmount > booking.depositAmount) throw new PaymentFlowError('Khấu trừ không được vượt quá cọc của đơn');
      if (input.deductionAmount > 0 && input.deductionReason.trim().length < 10) throw new PaymentFlowError('Cần ghi rõ căn cứ khấu trừ');
      const previous = (booking.handoverRecord || {}) as { shutterCount?: number | null };
      if (input.shutterCount !== null && previous.shutterCount != null && input.shutterCount < previous.shutterCount) throw new PaymentFlowError('Số shot trả máy không thể thấp hơn lúc bàn giao');
      await tx.rentalBooking.update({ where: { id: bookingId }, data: {
        status: BookingStatus.COMPLETED, inspectedAt: new Date(), returnInspectionNote: input.note,
        returnRecord: { shutterCount: input.shutterCount, condition: input.condition, releaseToStock: input.releaseToStock, note: input.note },
        deductionAmount: input.deductionAmount, deductionReason: input.deductionAmount ? input.deductionReason : null,
        deductionDecision: input.deductionAmount ? 'PENDING' : 'NONE', deductionAcceptedAt: null
      } });
      // A disputed financial record may be revised after this unit has been rented again.
      // Keep its current physical condition and availability in that case.
      if (!revising) {
        await tx.cameraItem.update({ where: { id: booking.cameraItemId }, data: {
          status: input.releaseToStock ? ItemStatus.AVAILABLE : ItemStatus.MAINTENANCE,
          scratchNotes: input.condition, ...(input.shutterCount !== null ? { shutterCount: input.shutterCount } : {})
        } });
        if (input.releaseToStock) await refreshUnitStatus(tx, booking.cameraItemId);
      }
    });
  }

  async decideDeduction(bookingId: string, actor: RentalActor, input: OperationInput & { accept: boolean; expectedAmount: number; inspectedAt: string }) {
    return this.operate(bookingId, actor, input.accept ? 'DEDUCTION_ACCEPTED' : 'DEDUCTION_REJECTED', input, async (tx, booking) => {
      if (booking.userId !== actor.id) throw new PaymentFlowError('Chỉ khách của đơn được xác nhận khoản khấu trừ', 403);
      if (booking.deductionDecision !== 'PENDING' || booking.deductionAmount !== input.expectedAmount || booking.inspectedAt?.toISOString() !== input.inspectedAt) throw new PaymentFlowError('Biên bản đã thay đổi; vui lòng tải lại', 409);
      await tx.rentalBooking.update({ where: { id: bookingId }, data: { deductionDecision: input.accept ? 'ACCEPTED' : 'REJECTED', deductionAcceptedAt: input.accept ? new Date() : null } });
    });
  }

  async cancel(bookingId: string, actor: RentalActor, input: OperationInput) {
    return this.operate(bookingId, actor, 'CANCELLED', input, async (tx, booking) => {
      if (booking.handoverAt || booking.status === BookingStatus.ACTIVE_RENTAL || booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.RETURNED_PENDING_INSPECTION) throw new PaymentFlowError('Sau bàn giao cần nhận lại và nghiệm thu máy', 409);
      if (booking.status === BookingStatus.CANCELLED) return;
      if (booking.paymentAttempt && [PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING, PaymentAttemptStatus.REVIEW].includes(booking.paymentAttempt.status as never)) throw new PaymentFlowError('Thanh toán đang đối soát. Giữ nguyên giao dịch và kiểm tra lại trước khi hủy.', 409);
      await tx.rentalBooking.update({ where: { id: bookingId }, data: { status: BookingStatus.CANCELLED, cancellationNote: input.note } });
      await refreshUnitStatus(tx, booking.cameraItemId);
    });
  }

  async requestRefund(bookingId: string, actor: RentalActor, clientRequestId: string) {
    const refund = await this.prisma.$transaction(async tx => {
      await lockBooking(tx, bookingId);
      const booking = await tx.rentalBooking.findUnique({ where: { id: bookingId }, include: bookingInclude });
      if (!booking || (actor.role !== 'ADMIN' && booking.userId !== actor.id)) throw new PaymentFlowError('Không tìm thấy đơn thuê', 404);
      const existing = await tx.refundAttempt.findUnique({ where: { bookingId_clientRequestId: { bookingId, clientRequestId } } });
      if (existing) return existing;
      const active = await tx.refundAttempt.findUnique({ where: { activeBookingId: bookingId } });
      if (active) return active;
      const payment = booking.paymentAttempt;
      if (payment?.status !== PaymentAttemptStatus.PAID || !payment.providerTxnId || !/^\d+$/.test(payment.providerTxnId)) throw new PaymentFlowError('Chưa có giao dịch ZaloPay đã thanh toán hợp lệ để hoàn', 409);
      if (payment.merchantAppId !== this.gateway.appId) throw new PaymentFlowError('Merchant của giao dịch không khớp cấu hình hiện tại; cần đối soát', 409);
      const cancelling = booking.status === BookingStatus.CANCELLED && !booking.handoverAt;
      if (!cancelling && (booking.status !== BookingStatus.COMPLETED || !booking.inspectedAt)) throw new PaymentFlowError('Cần nghiệm thu hoặc hủy trước bàn giao trước khi hoàn tiền', 409);
      if (!cancelling && booking.deductionAmount > 0 && booking.deductionDecision !== 'ACCEPTED') throw new PaymentFlowError('Cần khách đồng ý khoản khấu trừ trước khi hoàn phần còn lại', 409);
      const amount = cancelling && snapshot(booking).cancellationRefund !== 'DEPOSIT_ONLY' ? payment.amount : booking.depositAmount - (cancelling ? 0 : booking.deductionAmount);
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > payment.amount) throw new PaymentFlowError('Số tiền hoàn không hợp lệ', 409);
      if (amount === 0) {
        if (booking.depositStatus !== DepositStatus.DEDUCTED && booking.depositStatus !== DepositStatus.REFUNDED) {
          await tx.rentalBooking.update({ where: { id: bookingId }, data: { depositStatus: booking.deductionAmount ? DepositStatus.DEDUCTED : DepositStatus.REFUNDED } });
          await tx.rentalEvent.create({ data: { bookingId, actorId: actor.id, action: 'DEPOSIT_SETTLED', detail: 'Không phát sinh khoản hoàn: không thu cọc hoặc khoản khấu trừ đã được khách chấp thuận.' } });
        }
        return null;
      }
      const created = await tx.refundAttempt.create({ data: {
        bookingId, activeBookingId: bookingId, clientRequestId,
        mRefundId: `${vietnamDate().replace(/-/g, '').slice(2)}_${this.gateway.appId}_${crypto.randomBytes(8).toString('hex')}`,
        providerTxnId: payment.providerTxnId, merchantAppId: this.gateway.appId, amount,
        purpose: cancelling ? 'CANCELLATION' : 'DEPOSIT', description: cancelling ? `Filmiliar huy don ${booking.bookingCode}` : `Filmiliar hoan coc ${booking.bookingCode}`,
        requestedById: actor.id
      } });
      await tx.rentalBooking.update({ where: { id: bookingId }, data: { depositStatus: DepositStatus.REFUND_PENDING } });
      await tx.rentalEvent.create({ data: { bookingId, actorId: actor.id, action: 'REFUND_REQUESTED', detail: `Yêu cầu hoàn ${amount.toLocaleString('vi-VN')} đ về giao dịch ban đầu.` } });
      return created;
    });
    if (refund?.status === RefundStatus.CREATING && !refund.lastQueriedAt) {
      // Claim exactly one submission, including concurrent retries of the same request.
      const claimed = await this.prisma.refundAttempt.updateMany({ where: { id: refund.id, status: RefundStatus.CREATING, lastQueriedAt: null }, data: { lastQueriedAt: new Date() } });
      if (claimed.count === 1) {
        try {
          const response = await this.gateway.createRefund({ mRefundId: refund.mRefundId, providerTxnId: refund.providerTxnId, amount: refund.amount, description: refund.description, timestamp: refund.submittedAt.getTime() });
          const refused = response.return_code === 2 && [-14, -13, -101, -401, -402, -32].includes(response.sub_return_code ?? 0);
          await this.prisma.$transaction(async tx => {
            await lockBooking(tx, bookingId);
            const changed = await tx.refundAttempt.updateMany({ where: { id: refund.id, status: { in: [RefundStatus.CREATING, RefundStatus.PENDING] } }, data: {
              status: refused ? RefundStatus.FAILED : RefundStatus.PENDING,
              ...(refused ? { activeBookingId: null } : {}), providerRefundId: response.refund_id,
              lastReturnCode: response.return_code, lastSubReturnCode: response.sub_return_code,
              reviewReason: refused ? `PROVIDER_REJECTED_${response.sub_return_code}` : null
            } });
            if (changed.count === 1 && refused) await tx.rentalBooking.update({ where: { id: bookingId }, data: { depositStatus: DepositStatus.HELD } });
          });
        } catch {
          await this.prisma.refundAttempt.updateMany({ where: { id: refund.id, status: RefundStatus.CREATING }, data: { reviewReason: 'CREATE_RESULT_UNKNOWN' } });
        }
        await this.reconcileRefund(refund.id, true);
      }
    }
    return this.detail(bookingId, actor);
  }

  async reconcileRefund(refundId: string, force = false) {
    const refund = await this.prisma.refundAttempt.findUnique({ where: { id: refundId } });
    if (!refund || refund.status === RefundStatus.SUCCEEDED || refund.status === RefundStatus.FAILED || refund.merchantAppId !== this.gateway.appId) return;
    // A request without a submission claim must be dispatched, not queried first.
    // Querying here could consume its one-time claim before createRefund runs.
    if (refund.status === RefundStatus.CREATING && !refund.lastQueriedAt) return;
    const throttle = refund.status === RefundStatus.REVIEW ? 600_000 : 10_000;
    const claimed = await this.prisma.refundAttempt.updateMany({
      where: { id: refundId, status: { in: [RefundStatus.CREATING, RefundStatus.PENDING, RefundStatus.REVIEW] },
        ...(!force ? { OR: [{ lastQueriedAt: null }, { lastQueriedAt: { lt: new Date(Date.now() - throttle) } }] } : {}) },
      data: { lastQueriedAt: new Date() }
    });
    if (claimed.count !== 1) return;
    let result;
    try { result = await this.gateway.queryRefund(refund.mRefundId); } catch { return; }
    await this.prisma.$transaction(async tx => {
      await lockBooking(tx, refund.bookingId);
      const current = await tx.refundAttempt.findUnique({ where: { id: refundId } });
      if (!current || current.status === RefundStatus.SUCCEEDED || current.status === RefundStatus.FAILED) return;
      const completed = result.return_code === 1;
      const failed = result.return_code === 2 && [-2, -13, -14, -32].includes(result.sub_return_code ?? 0);
      const stale = Date.now() - current.submittedAt.getTime() > 24 * 60 * 60_000;
      await tx.refundAttempt.update({ where: { id: refundId }, data: {
        status: completed ? RefundStatus.SUCCEEDED : failed ? RefundStatus.FAILED : stale ? RefundStatus.REVIEW : RefundStatus.PENDING,
        ...(failed ? { activeBookingId: null } : {}), confirmedAt: completed ? new Date() : null,
        lastReturnCode: result.return_code, lastSubReturnCode: result.sub_return_code,
        providerRefundId: result.refund_id ?? current.providerRefundId,
        reviewReason: failed ? `PROVIDER_REJECTED_${result.sub_return_code}` : stale ? 'UNRESOLVED_24H' : current.reviewReason
      } });
      if (completed) {
        const booking = await tx.rentalBooking.findUniqueOrThrow({ where: { id: current.bookingId } });
        await tx.rentalBooking.update({ where: { id: current.bookingId }, data: { depositStatus: booking.deductionAmount > 0 ? DepositStatus.DEDUCTED : DepositStatus.REFUNDED } });
        await tx.rentalEvent.create({ data: { bookingId: current.bookingId, action: 'REFUND_CONFIRMED', detail: `ZaloPay xác nhận hoàn ${current.amount.toLocaleString('vi-VN')} đ. Mã ${current.mRefundId}.` } });
      } else if (failed) {
        await tx.rentalBooking.update({ where: { id: current.bookingId }, data: { depositStatus: DepositStatus.HELD } });
      }
    });
  }

  async pollRefunds() {
    const pending = await this.prisma.refundAttempt.findMany({ where: { status: { in: [RefundStatus.CREATING, RefundStatus.PENDING, RefundStatus.REVIEW] } }, orderBy: { lastQueriedAt: 'asc' }, take: 20, select: { id: true, status: true, lastQueriedAt: true, bookingId: true, requestedById: true, clientRequestId: true } });
    for (const refund of pending) {
      if (refund.status === RefundStatus.CREATING && !refund.lastQueriedAt) {
        await this.requestRefund(refund.bookingId, { id: refund.requestedById, role: 'ADMIN' }, refund.clientRequestId);
      } else await this.reconcileRefund(refund.id);
    }
  }
}
