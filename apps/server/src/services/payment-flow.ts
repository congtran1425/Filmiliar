import crypto from 'node:crypto';
import { BookingStatus, DepositStatus, ItemStatus, PaymentAttemptStatus, PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { ZaloPayCallbackData, ZaloPayGateway } from './zalopay.service.js';
import { PaymentFlowError, parseRentalDates, vietnamDate, isAllocationConflict } from './rental-domain.js';
import { lockBooking, lockUnit, quoteRental, refreshUnitStatus } from './rental-availability.js';
import { scheduledRental } from './approved-policy.js';
import { quoteBundle, sortedUnitIds, type BundleSelection } from './bundle-quote.js';
export { PaymentFlowError, parseRentalDates } from './rental-domain.js';

const ATTEMPT_LIFETIME_MS = 15 * 60 * 1000;
const FINAL_QUERY_GRACE_MS = 2 * 60 * 1000;
const QUERY_THROTTLE_MS = 6 * 1000;

const attemptInclude = {
  booking: {
    include: {
      cameraItem: { include: { product: true } },
      bundle: {
        include: {
          bookings: {
            include: { cameraItem: { include: { product: true } } },
            orderBy: { cameraItemId: 'asc' as const },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentAttemptInclude;
type AttemptViewSource = Prisma.PaymentAttemptGetPayload<{ include: typeof attemptInclude }>;

export interface CreateRentalPaymentInput {
  cameraItemId: number;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  clientRequestId: string;
  quoteHash?: string;
  termsAccepted?: boolean;
}

function newAppTransId(): string {
  return `${vietnamDate().slice(2).replace(/-/g, '')}_${crypto.randomBytes(10).toString('hex')}`;
}

function toClientView(attempt: AttemptViewSource) {
  const booking = attempt.booking;
  const members = booking.bundle?.bookings || [booking];
  return {
    bookingId: booking.id,
    bookingCode: booking.bundle?.code || booking.bookingCode,
    bundleId: booking.bundleId,
    items: members.map((item) => ({
      bookingId: item.id,
      cameraItemId: item.cameraItemId,
      serialNumber: item.cameraItem.serialNumber,
      name: item.cameraItem.product.modelName,
      rentalFee: item.totalRentalFee,
      depositAmount: item.depositAmount,
    })),
    paymentStatus: attempt.status,
    bookingStatus: booking.status,
    appTransId: attempt.appTransId,
    qrCode: attempt.status === PaymentAttemptStatus.WAITING ? attempt.qrCode : null,
    orderUrl: attempt.status === PaymentAttemptStatus.WAITING ? attempt.orderUrl : null,
    expiresAt: attempt.expiresAt.toISOString(),
    cameraName: booking.bundleId
      ? `Bộ thuê ${members.length} thiết bị`
      : booking.cameraItem.product.modelName,
    serialNumber: booking.cameraItem.serialNumber,
    startDate: booking.startDate.toISOString().slice(0, 10),
    endDate: booking.endDate.toISOString().slice(0, 10),
    pickupAt: booking.pickupAt?.toISOString() || null,
    dueAt: booking.dueAt?.toISOString() || null,
    totalDays: booking.totalDays,
    rentalFee: members.reduce((sum, member) => sum + member.totalRentalFee, 0),
    depositAmount: members.reduce((sum, member) => sum + member.depositAmount, 0),
    totalAmount: attempt.amount,
    sandbox: true,
  };
}

export class SandboxPaymentFlow {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly gateway: ZaloPayGateway,
  ) {}

  async getForUser(userId: string, bookingId: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { bookingId },
      include: attemptInclude,
    });
    if (!attempt || attempt.userId !== userId)
      throw new PaymentFlowError('Không tìm thấy lần thanh toán', 404);
    return toClientView(attempt);
  }

  async getActiveForUnit(
    userId: string,
    cameraItemId: number,
    startDate?: string,
    endDate?: string,
    startTime?: string,
    endTime?: string,
  ) {
    const dates = startDate && endDate ? parseRentalDates(startDate, endDate) : null;
    const schedule =
      startDate && endDate && (startTime || endTime)
        ? scheduledRental(startDate, endDate, startTime, endTime)
        : null;
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        userId,
        booking: {
          AND: [{ OR: [{ cameraItemId }, { bundle: { bookings: { some: { cameraItemId } } } }] }],
          status: { notIn: [BookingStatus.COMPLETED, BookingStatus.CANCELLED] },
          ...(dates ? { startDate: dates.start, endDate: dates.end } : {}),
          ...(schedule
            ? {
                OR: [
                  { pickupAt: schedule.pickupAt, dueAt: schedule.dueAt },
                  ...(schedule.startTime === '08:00' && schedule.endTime === '08:00'
                    ? [{ pickupAt: null, dueAt: null }]
                    : []),
                ],
              }
            : {}),
        },
        status: {
          in: [
            PaymentAttemptStatus.CREATING,
            PaymentAttemptStatus.WAITING,
            PaymentAttemptStatus.PAID,
            PaymentAttemptStatus.REVIEW,
          ],
        },
      },
      include: attemptInclude,
      orderBy: { createdAt: 'desc' },
    });
    return attempt ? toClientView(attempt) : null;
  }

  async getActiveBundle(userId: string, input: BundleSelection) {
    const ids = sortedUnitIds(input.cameraItemIds),
      dates = scheduledRental(input.startDate, input.endDate, input.startTime, input.endTime);
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        userId,
        status: {
          in: [
            PaymentAttemptStatus.CREATING,
            PaymentAttemptStatus.WAITING,
            PaymentAttemptStatus.PAID,
            PaymentAttemptStatus.REVIEW,
          ],
        },
        booking: {
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.COMPLETED] },
          pickupAt: dates.pickupAt,
          dueAt: dates.dueAt,
          bundle: {
            bookings: { every: { cameraItemId: { in: ids } } },
            AND: ids.map((id) => ({ bookings: { some: { cameraItemId: id } } })),
          },
        },
      },
      include: attemptInclude,
      orderBy: { createdAt: 'desc' },
    });
    return attempt ? toClientView(attempt) : null;
  }

  async create(userId: string, input: CreateRentalPaymentInput) {
    return this.createSelection(userId, input, [input.cameraItemId], false);
  }

  async createBundle(
    userId: string,
    input: BundleSelection & { clientRequestId: string; quoteHash: string; termsAccepted: boolean },
  ) {
    if (!input.termsAccepted || !input.quoteHash)
      throw new PaymentFlowError('Cần xác nhận báo giá và điều kiện thuê');
    return this.createSelection(userId, input, input.cameraItemIds, true);
  }

  private async createSelection(
    userId: string,
    input: Omit<CreateRentalPaymentInput, 'cameraItemId'>,
    unitIds: number[],
    grouped: boolean,
  ) {
    const ids = sortedUnitIds(unitIds),
      dates = scheduledRental(input.startDate, input.endDate, input.startTime, input.endTime);
    const validateExisting = (attempt: AttemptViewSource) => {
      const members = attempt.booking.bundle?.bookings || [attempt.booking];
      if (
        Boolean(attempt.booking.bundleId) !== grouped ||
        JSON.stringify(members.map((b) => b.cameraItemId).sort((a, b) => a - b)) !== JSON.stringify(ids) ||
        members.some(
          (b) =>
            b.startDate.getTime() !== dates.start.getTime() ||
            b.endDate.getTime() !== dates.end.getTime() ||
            (b.pickupAt && b.pickupAt.getTime() !== dates.pickupAt.getTime()) ||
            (b.dueAt && b.dueAt.getTime() !== dates.dueAt.getTime()),
        )
      )
        throw new PaymentFlowError('Mã yêu cầu đã dùng cho thông tin thuê khác', 409);
      return toClientView(attempt);
    };
    const previous = await this.prisma.paymentAttempt.findUnique({
      where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
      include: attemptInclude,
    });
    if (previous) return validateExisting(previous);
    let created: {
      attemptId: string;
      bookingId: string;
      appTransId: string;
      amount: number;
      cameraName: string;
    };
    try {
      created = await this.prisma.$transaction(
        async (tx) => {
          for (const id of ids) await lockUnit(tx, id);
          const quote = grouped
            ? await quoteBundle(tx, { ...input, cameraItemIds: ids })
            : await (async () => {
                const q = await quoteRental(
                  tx,
                  ids[0],
                  input.startDate,
                  input.endDate,
                  input.startTime,
                  input.endTime,
                );
                return { quotes: [q], dates: q.dates, policy: q.policy, view: q.view };
              })();
          if (!quote.view.available)
            throw new PaymentFlowError(quote.view.unavailableReason || 'Bộ thuê không còn lịch trống', 409);
          if (input.quoteHash && input.quoteHash !== quote.view.quoteHash)
            throw new PaymentFlowError(
              'Giá hoặc chính sách vừa thay đổi. Vui lòng xem lại trước khi thanh toán.',
              409,
            );
          const bundle = grouped
            ? await tx.rentalBundle.create({
                data: {
                  userId,
                  code:
                    'BO-' +
                    vietnamDate().replaceAll('-', '').slice(2) +
                    '-' +
                    crypto.randomBytes(5).toString('hex'),
                },
              })
            : null;
          const bookings = [];
          for (const q of quote.quotes) {
            const booking = await tx.rentalBooking.create({
              data: {
                bookingCode:
                  'BK-SB-' +
                  vietnamDate().replaceAll('-', '').slice(2) +
                  '-' +
                  crypto.randomBytes(5).toString('hex'),
                userId,
                cameraItemId: q.unit.id,
                bundleId: bundle?.id,
                startDate: dates.start,
                endDate: dates.end,
                pickupAt: dates.pickupAt,
                dueAt: dates.dueAt,
                totalDays: dates.days,
                dailyRate: q.unit.product.dailyRentalRate,
                totalRentalFee: q.view.rentalFee,
                depositAmount: q.view.depositAmount,
                depositStatus: DepositStatus.PENDING,
                status: BookingStatus.PENDING_PAYMENT,
                deliveryMethod: 'STORE_PICKUP',
                returnBufferDays: q.policy.returnBufferDays,
                termsAcceptedAt: input.termsAccepted ? new Date() : null,
                policySnapshot: {
                  version: q.policy.version,
                  terms: q.policy.terms,
                  cancellationRefund: q.policy.cancellationRefund,
                  returnBufferDays: q.policy.returnBufferDays,
                  rules: q.policy.rules,
                },
              },
            });
            bookings.push(booking);
            await tx.rentalEvent.create({
              data: {
                bookingId: booking.id,
                actorId: userId,
                action: 'BOOKED',
                detail: bundle
                  ? 'Đã giữ thiết bị trong bộ ' + bundle.code + '.'
                  : 'Đã giữ đúng chiếc máy theo khoảng ngày thuê.',
              },
            });
            await refreshUnitStatus(tx, q.unit.id);
          }
          const transId = newAppTransId();
          const attempt = await tx.paymentAttempt.create({
            data: {
              bookingId: bookings[0].id,
              userId,
              clientRequestId: input.clientRequestId,
              appTransId: transId,
              amount: quote.view.totalAmount,
              expiresAt: new Date(Date.now() + ATTEMPT_LIFETIME_MS),
              merchantAppId: this.gateway.appId,
            },
          });
          return {
            attemptId: attempt.id,
            bookingId: bookings[0].id,
            appTransId: transId,
            amount: attempt.amount,
            cameraName: grouped ? 'bo ' + ids.length + ' thiet bi' : quote.quotes[0].unit.product.modelName,
          };
        },
        { timeout: 15000 },
      );
    } catch (error) {
      const raced = await this.prisma.paymentAttempt.findUnique({
        where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
        include: attemptInclude,
      });
      if (raced) return validateExisting(raced);
      if (isAllocationConflict(error))
        throw new PaymentFlowError('Một thiết bị vừa có lịch khác. Chưa tạo giao dịch cho bộ thuê.', 409);
      throw error;
    }
    try {
      const provider = await this.gateway.createPayment({
        appTransId: created.appTransId,
        appUser: userId.slice(0, 50),
        amount: created.amount,
        bookingId: created.bookingId,
        description: ('Filmiliar - thue ' + created.cameraName).slice(0, 256),
      });
      if (provider.return_code === 1 && (provider.qr_code || provider.order_url))
        await this.prisma.paymentAttempt.updateMany({
          where: { id: created.attemptId, status: PaymentAttemptStatus.CREATING },
          data: {
            status: PaymentAttemptStatus.WAITING,
            qrCode: provider.qr_code || null,
            orderUrl: provider.order_url || null,
          },
        });
      else if (provider.return_code === 2 && [-401, -402].includes(provider.sub_return_code ?? 0))
        await this.markFailed(created.attemptId);
    } catch {
      /* Preserve the entire reservation and query the same provider transaction. */
    }
    return this.getForUser(userId, created.bookingId);
  }

  private async lockedAttempt(tx: Prisma.TransactionClient, id: string) {
    const include = { booking: { include: { bundle: { include: { bookings: true } } } } } as const;
    const initial = await tx.paymentAttempt.findUnique({ where: { id }, include });
    if (!initial) return null;
    const members = initial.booking.bundle?.bookings || [initial.booking];
    for (const unitId of [...members].map((b) => b.cameraItemId).sort((a, b) => a - b))
      await lockUnit(tx, unitId);
    for (const bookingId of members.map((b) => b.id).sort()) await lockBooking(tx, bookingId);
    return tx.paymentAttempt.findUnique({ where: { id }, include });
  }

  private async markReview(attemptId: string, reason: string, providerTxnId?: string) {
    await this.prisma.paymentAttempt.updateMany({
      where: { id: attemptId, status: { not: PaymentAttemptStatus.PAID } },
      data: {
        status: PaymentAttemptStatus.REVIEW,
        reviewReason: reason,
        ...(providerTxnId ? { providerTxnId } : {}),
      },
    });
  }

  private async markPaid(attemptId: string, amount: number, providerTxnId?: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const attempt = await this.lockedAttempt(tx, attemptId);
        if (!attempt) return;
        const members = attempt.booking.bundle?.bookings || [attempt.booking];
        if (attempt.status === PaymentAttemptStatus.PAID) {
          if (attempt.amount !== amount || attempt.providerTxnId !== providerTxnId)
            await tx.paymentAttempt.update({
              where: { id: attemptId },
              data: { status: PaymentAttemptStatus.REVIEW, reviewReason: 'DUPLICATE_PAYMENT_CONFLICT' },
            });
          return;
        }
        const validTxn = !!providerTxnId && /^[0-9]+$/.test(providerTxnId);
        const duplicate = validTxn
          ? await tx.paymentAttempt.findFirst({
              where: { providerTxnId, id: { not: attemptId } },
              select: { id: true },
            })
          : null;
        if (duplicate) {
          await tx.paymentAttempt.update({
            where: { id: attemptId },
            data: { status: PaymentAttemptStatus.REVIEW, reviewReason: 'PROVIDER_TRANSACTION_CONFLICT' },
          });
          return;
        }
        if (
          attempt.amount !== amount ||
          !validTxn ||
          ![PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING].includes(attempt.status as never)
        ) {
          await tx.paymentAttempt.update({
            where: { id: attemptId },
            data: {
              status: PaymentAttemptStatus.REVIEW,
              reviewReason: 'PAID_RESULT_REQUIRES_REVIEW',
              ...(validTxn ? { providerTxnId } : {}),
            },
          });
          return;
        }
        const allocations = await tx.rentalAllocation.count({
          where: { bookingId: { in: members.map((b) => b.id) }, releasedAt: null },
        });
        const invalid = await tx.cameraItem.count({
          where: {
            id: { in: members.map((b) => b.cameraItemId) },
            status: { in: [ItemStatus.MAINTENANCE, ItemStatus.SOLD] },
          },
        });
        if (
          allocations !== members.length ||
          invalid ||
          members.some((b) => b.status !== BookingStatus.PENDING_PAYMENT)
        ) {
          await tx.paymentAttempt.update({
            where: { id: attemptId },
            data: { status: PaymentAttemptStatus.REVIEW, reviewReason: 'RESERVATION_MISSING', providerTxnId },
          });
          return;
        }
        await tx.paymentAttempt.update({
          where: { id: attemptId },
          data: { status: PaymentAttemptStatus.PAID, providerTxnId },
        });
        await tx.rentalBooking.updateMany({
          where: { id: { in: members.map((b) => b.id) } },
          data: { status: BookingStatus.CONFIRMED, depositStatus: DepositStatus.HELD },
        });
        for (const member of members) {
          await tx.rentalEvent.create({
            data: {
              bookingId: member.id,
              action: 'PAYMENT_CONFIRMED',
              detail: 'ZaloPay xác nhận thanh toán phí thuê và cọc.',
            },
          });
          await refreshUnitStatus(tx, member.cameraItemId);
        }
      },
      { timeout: 15000 },
    );
  }

  private async markFailed(attemptId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const attempt = await this.lockedAttempt(tx, attemptId);
        if (!attempt) return;
        const members = attempt.booking.bundle?.bookings || [attempt.booking];
        const claimed = await tx.paymentAttempt.updateMany({
          where: {
            id: attemptId,
            status: { in: [PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING] },
          },
          data: { status: PaymentAttemptStatus.FAILED },
        });
        if (!claimed.count) return;
        await tx.rentalBooking.updateMany({
          where: { id: { in: members.map((b) => b.id) } },
          data: { status: BookingStatus.CANCELLED },
        });
        for (const member of members) await refreshUnitStatus(tx, member.cameraItemId);
      },
      { timeout: 15000 },
    );
  }

  async reconcile(attemptId: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { id: attemptId } });
    if (
      !attempt ||
      (attempt.status !== PaymentAttemptStatus.CREATING && attempt.status !== PaymentAttemptStatus.WAITING)
    )
      return;
    const cutoff = new Date(Date.now() - QUERY_THROTTLE_MS);
    const claimed = await this.prisma.paymentAttempt.updateMany({
      where: {
        id: attemptId,
        status: { in: [PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING] },
        OR: [{ lastQueriedAt: null }, { lastQueriedAt: { lt: cutoff } }],
      },
      data: { lastQueriedAt: new Date() },
    });
    if (claimed.count !== 1) return;
    let provider;
    try {
      provider = await this.gateway.checkOrderStatus(attempt.appTransId);
    } catch {
      return;
    }
    if (provider.return_code === 1) {
      if (typeof provider.amount !== 'number' || !Number.isSafeInteger(provider.amount)) {
        await this.markReview(attempt.id, 'PROVIDER_AMOUNT_MISSING', provider.zp_trans_id);
      } else {
        await this.markPaid(attempt.id, provider.amount, provider.zp_trans_id);
      }
    } else if (
      provider.return_code === 2 &&
      (provider.sub_return_code === undefined ||
        [-54, -63, -101, -217, -332, -333].includes(provider.sub_return_code)) &&
      Date.now() > attempt.expiresAt.getTime() + FINAL_QUERY_GRACE_MS
    ) {
      await this.markFailed(attempt.id);
    } else if (Date.now() > attempt.expiresAt.getTime() + 24 * 60 * 60 * 1000) {
      await this.markReview(attempt.id, 'PROVIDER_RESULT_UNRESOLVED_24H');
    }
  }

  async reconcileForUser(userId: string, bookingId: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { bookingId } });
    if (!attempt || attempt.userId !== userId)
      throw new PaymentFlowError('Không tìm thấy lần thanh toán', 404);
    await this.reconcile(attempt.id);
    return this.getForUser(userId, bookingId);
  }

  async handleCallback(data: ZaloPayCallbackData): Promise<boolean> {
    if (data.app_id !== this.gateway.appId) return false;
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { appTransId: data.app_trans_id } });
    if (!attempt) return false;
    if (data.embed_data) {
      try {
        const embedded = JSON.parse(data.embed_data) as { bookingId?: string };
        if (embedded.bookingId !== attempt.bookingId) {
          await this.markReview(attempt.id, 'BOOKING_ID_MISMATCH', data.zp_trans_id);
          return true;
        }
      } catch {
        await this.markReview(attempt.id, 'INVALID_EMBED_DATA', data.zp_trans_id);
        return true;
      }
    }
    await this.markPaid(attempt.id, data.amount, data.zp_trans_id);
    return true;
  }

  async reconcileOverdue() {
    const overdue = await this.prisma.paymentAttempt.findMany({
      where: {
        status: { in: [PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING] },
        expiresAt: { lte: new Date() },
      },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: 20,
    });
    for (const attempt of overdue) await this.reconcile(attempt.id);
  }
}
