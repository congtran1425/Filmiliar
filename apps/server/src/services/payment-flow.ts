import crypto from 'node:crypto';
import {
  BookingStatus, DepositStatus, ItemStatus, PaymentAttemptStatus,
  PrismaClient
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { ZaloPayCallbackData, ZaloPayGateway } from './zalopay.service.js';
import { PaymentFlowError, parseRentalDates, vietnamDate, isAllocationConflict } from './rental-domain.js';
import { lockBooking, lockUnit, quoteRental, refreshUnitStatus } from './rental-availability.js';
export { PaymentFlowError, parseRentalDates } from './rental-domain.js';

const ATTEMPT_LIFETIME_MS = 15 * 60 * 1000;
const FINAL_QUERY_GRACE_MS = 2 * 60 * 1000;
const QUERY_THROTTLE_MS = 6 * 1000;

const attemptInclude = {
  booking: { include: { cameraItem: { include: { product: true } } } }
} satisfies Prisma.PaymentAttemptInclude;
type AttemptViewSource = Prisma.PaymentAttemptGetPayload<{ include: typeof attemptInclude }>;

export interface CreateRentalPaymentInput {
  cameraItemId: number;
  startDate: string;
  endDate: string;
  clientRequestId: string;
  quoteHash?: string;
  termsAccepted?: boolean;
}

function newAppTransId(): string {
  return `${vietnamDate().slice(2).replace(/-/g, '')}_${crypto.randomBytes(10).toString('hex')}`;
}

function toClientView(attempt: AttemptViewSource) {
  const booking = attempt.booking;
  return {
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    paymentStatus: attempt.status,
    bookingStatus: booking.status,
    appTransId: attempt.appTransId,
    qrCode: attempt.status === PaymentAttemptStatus.WAITING ? attempt.qrCode : null,
    orderUrl: attempt.status === PaymentAttemptStatus.WAITING ? attempt.orderUrl : null,
    expiresAt: attempt.expiresAt.toISOString(),
    cameraName: booking.cameraItem.product.modelName,
    serialNumber: booking.cameraItem.serialNumber,
    startDate: booking.startDate.toISOString().slice(0, 10),
    endDate: booking.endDate.toISOString().slice(0, 10),
    totalDays: booking.totalDays,
    rentalFee: booking.totalRentalFee,
    depositAmount: booking.depositAmount,
    totalAmount: attempt.amount,
    sandbox: true
  };
}

export class SandboxPaymentFlow {
  constructor(private readonly prisma: PrismaClient, private readonly gateway: ZaloPayGateway) {}

  async getForUser(userId: string, bookingId: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { bookingId }, include: attemptInclude });
    if (!attempt || attempt.userId !== userId) throw new PaymentFlowError('Không tìm thấy lần thanh toán', 404);
    return toClientView(attempt);
  }

  async getActiveForUnit(userId: string, cameraItemId: number, startDate?: string, endDate?: string) {
    const dates = startDate && endDate ? parseRentalDates(startDate, endDate) : null;
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        userId, booking: { cameraItemId, status: { notIn: [BookingStatus.COMPLETED, BookingStatus.CANCELLED] },
          ...(dates ? { startDate: dates.start, endDate: dates.end } : {}) },
        status: { in: [PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING, PaymentAttemptStatus.PAID, PaymentAttemptStatus.REVIEW] }
      }, include: attemptInclude, orderBy: { createdAt: 'desc' }
    });
    return attempt ? toClientView(attempt) : null;
  }

  async create(userId: string, input: CreateRentalPaymentInput) {
    const { start, end, days } = parseRentalDates(input.startDate, input.endDate);
    const existing = await this.prisma.paymentAttempt.findUnique({
      where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
      include: attemptInclude
    });
    if (existing) {
      if (existing.booking.cameraItemId !== input.cameraItemId ||
          existing.booking.startDate.getTime() !== start.getTime() ||
          existing.booking.endDate.getTime() !== end.getTime()) {
        throw new PaymentFlowError('Mã yêu cầu đã dùng cho thông tin thuê khác', 409);
      }
      return toClientView(existing);
    }

    let attemptId: string;
    let bookingId: string;
    let appTransId: string;
    let amount: number;
    let cameraName: string;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await lockUnit(tx, input.cameraItemId);
        const quote = await quoteRental(tx, input.cameraItemId, input.startDate, input.endDate);
        const item = quote.unit;
        if (!quote.view.available) throw new PaymentFlowError(quote.view.unavailableReason || 'Lịch thuê không còn trống', 409);
        if (input.quoteHash && input.quoteHash !== quote.view.quoteHash) throw new PaymentFlowError('Giá hoặc chính sách vừa thay đổi. Vui lòng xem lại trước khi thanh toán.', 409);
        const fee = quote.view.rentalFee;
        const total = quote.view.totalAmount;
        const booking = await tx.rentalBooking.create({
          data: {
            bookingCode: `BK-SB-${vietnamDate().replace(/-/g, '').slice(2)}-${crypto.randomBytes(5).toString('hex')}`,
            userId, cameraItemId: item.id, startDate: start, endDate: end,
            totalDays: days, dailyRate: item.product.dailyRentalRate, totalRentalFee: fee,
            depositAmount: item.depositAmount, depositStatus: DepositStatus.PENDING,
            status: BookingStatus.PENDING_PAYMENT, deliveryMethod: 'STORE_PICKUP',
            returnBufferDays: quote.policy.returnBufferDays,
            termsAcceptedAt: input.termsAccepted ? new Date() : null,
            policySnapshot: { version: quote.policy.version, terms: quote.policy.terms, cancellationRefund: quote.policy.cancellationRefund, returnBufferDays: quote.policy.returnBufferDays }
          }
        });
        const transId = newAppTransId();
        const attempt = await tx.paymentAttempt.create({
          data: {
            bookingId: booking.id, userId, clientRequestId: input.clientRequestId,
            appTransId: transId, amount: total,
            expiresAt: new Date(Date.now() + ATTEMPT_LIFETIME_MS), merchantAppId: this.gateway.appId
          }
        });
        await tx.rentalEvent.create({ data: { bookingId: booking.id, actorId: userId, action: 'BOOKED', detail: 'Đã giữ đúng chiếc máy theo khoảng ngày thuê.' } });
        await refreshUnitStatus(tx, item.id);
        return { attemptId: attempt.id, bookingId: booking.id, appTransId: transId, amount: total, cameraName: item.product.modelName };
      });
      ({ attemptId, bookingId, appTransId, amount, cameraName } = created);
    } catch (error) {
      const raced = await this.prisma.paymentAttempt.findUnique({
        where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } }, include: attemptInclude
      });
      if (raced) {
        if (raced.booking.cameraItemId !== input.cameraItemId ||
            raced.booking.startDate.getTime() !== start.getTime() ||
            raced.booking.endDate.getTime() !== end.getTime()) {
          throw new PaymentFlowError('Mã yêu cầu đã dùng cho thông tin thuê khác', 409);
        }
        return toClientView(raced);
      }
      if (isAllocationConflict(error)) throw new PaymentFlowError('Chiếc máy vừa có lịch khác trong khoảng ngày này', 409);
      throw error;
    }

    try {
      const provider = await this.gateway.createPayment({
        appTransId, appUser: userId.slice(0, 50), amount, bookingId,
        description: `Filmiliar Sandbox - thue ${cameraName}`.slice(0, 256)
      });
      if (provider.return_code === 1 && (provider.qr_code || provider.order_url)) {
        await this.prisma.paymentAttempt.updateMany({
          where: { id: attemptId, status: PaymentAttemptStatus.CREATING },
          data: { status: PaymentAttemptStatus.WAITING, qrCode: provider.qr_code || null, orderUrl: provider.order_url || null }
        });
      } else if (provider.return_code === 2 && [-401, -402].includes(provider.sub_return_code ?? 0)) {
        await this.markFailed(attemptId);
      }
    } catch {
      // The create request may have reached Zalopay. Keep the reservation and reconcile the same appTransId.
    }
    return this.getForUser(userId, bookingId);
  }

  private async markReview(attemptId: string, reason: string, providerTxnId?: string) {
    await this.prisma.paymentAttempt.updateMany({
      where: { id: attemptId, status: { not: PaymentAttemptStatus.PAID } },
      data: { status: PaymentAttemptStatus.REVIEW, reviewReason: reason, ...(providerTxnId ? { providerTxnId } : {}) }
    });
  }

  private async markPaid(attemptId: string, amount: number, providerTxnId?: string) {
    await this.prisma.$transaction(async (tx) => {
      let attempt = await tx.paymentAttempt.findUnique({ where: { id: attemptId }, include: { booking: true } });
      if (!attempt) return;
      await lockUnit(tx, attempt.booking.cameraItemId);
      await lockBooking(tx, attempt.bookingId);
      attempt = await tx.paymentAttempt.findUnique({ where: { id: attemptId }, include: { booking: true } });
      if (!attempt) return;
      if (attempt.status === PaymentAttemptStatus.PAID) {
        if (attempt.amount !== amount || attempt.providerTxnId !== providerTxnId) {
          await tx.paymentAttempt.update({
            where: { id: attemptId },
            data: { status: PaymentAttemptStatus.REVIEW, reviewReason: 'DUPLICATE_PAYMENT_CONFLICT' }
          });
        }
        return;
      }
      if (attempt.amount !== amount || !providerTxnId || !/^\d+$/.test(providerTxnId) ||
          attempt.status === PaymentAttemptStatus.FAILED || attempt.status === PaymentAttemptStatus.REVIEW) {
        await tx.paymentAttempt.updateMany({
          where: { id: attemptId, status: { not: PaymentAttemptStatus.PAID } },
          data: { status: PaymentAttemptStatus.REVIEW, reviewReason: 'PAID_RESULT_REQUIRES_REVIEW', ...(providerTxnId ? { providerTxnId } : {}) }
        });
        return;
      }
      const claimed = await tx.paymentAttempt.updateMany({
        where: { id: attemptId, status: { in: [PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING] } },
        data: { status: PaymentAttemptStatus.PAID, providerTxnId }
      });
      if (claimed.count !== 1) return;
      const [allocation, unit] = await Promise.all([
        tx.rentalAllocation.findUnique({ where: { bookingId: attempt.bookingId } }),
        tx.cameraItem.findUnique({ where: { id: attempt.booking.cameraItemId } })
      ]);
      if (!allocation || allocation.releasedAt || !unit || unit.status === ItemStatus.MAINTENANCE || unit.status === ItemStatus.SOLD) {
        await tx.paymentAttempt.update({ where: { id: attemptId }, data: { status: PaymentAttemptStatus.REVIEW, reviewReason: 'RESERVATION_MISSING' } });
        return;
      }
      await tx.rentalBooking.update({
        where: { id: attempt.bookingId },
        data: { status: BookingStatus.CONFIRMED, depositStatus: DepositStatus.HELD }
      });
      await tx.rentalEvent.create({ data: { bookingId: attempt.bookingId, action: 'PAYMENT_CONFIRMED', detail: 'ZaloPay xác nhận thanh toán phí thuê và cọc.' } });
      await refreshUnitStatus(tx, attempt.booking.cameraItemId);
    });
  }

  private async markFailed(attemptId: string) {
    await this.prisma.$transaction(async (tx) => {
      let attempt = await tx.paymentAttempt.findUnique({ where: { id: attemptId }, include: { booking: true } });
      if (!attempt) return;
      await lockUnit(tx, attempt.booking.cameraItemId);
      await lockBooking(tx, attempt.bookingId);
      attempt = await tx.paymentAttempt.findUnique({ where: { id: attemptId }, include: { booking: true } });
      if (!attempt) return;
      const claimed = await tx.paymentAttempt.updateMany({
        where: { id: attemptId, status: { in: [PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING] } },
        data: { status: PaymentAttemptStatus.FAILED }
      });
      if (claimed.count !== 1) return;
      await tx.rentalBooking.update({ where: { id: attempt.bookingId }, data: { status: BookingStatus.CANCELLED } });
      await refreshUnitStatus(tx, attempt.booking.cameraItemId);
    });
  }

  async reconcile(attemptId: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || (attempt.status !== PaymentAttemptStatus.CREATING && attempt.status !== PaymentAttemptStatus.WAITING)) return;
    const cutoff = new Date(Date.now() - QUERY_THROTTLE_MS);
    const claimed = await this.prisma.paymentAttempt.updateMany({
      where: { id: attemptId, status: { in: [PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING] },
        OR: [{ lastQueriedAt: null }, { lastQueriedAt: { lt: cutoff } }] },
      data: { lastQueriedAt: new Date() }
    });
    if (claimed.count !== 1) return;
    let provider;
    try { provider = await this.gateway.checkOrderStatus(attempt.appTransId); }
    catch { return; }
    if (provider.return_code === 1) {
      if (typeof provider.amount !== 'number' || !Number.isSafeInteger(provider.amount)) {
        await this.markReview(attempt.id, 'PROVIDER_AMOUNT_MISSING', provider.zp_trans_id);
      } else {
        await this.markPaid(attempt.id, provider.amount, provider.zp_trans_id);
      }
    } else if (provider.return_code === 2 && (provider.sub_return_code === undefined || [-54, -63, -101, -217, -332, -333].includes(provider.sub_return_code)) && Date.now() > attempt.expiresAt.getTime() + FINAL_QUERY_GRACE_MS) {
      await this.markFailed(attempt.id);
    } else if (Date.now() > attempt.expiresAt.getTime() + 24 * 60 * 60 * 1000) {
      await this.markReview(attempt.id, 'PROVIDER_RESULT_UNRESOLVED_24H');
    }
  }

  async reconcileForUser(userId: string, bookingId: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { bookingId } });
    if (!attempt || attempt.userId !== userId) throw new PaymentFlowError('Không tìm thấy lần thanh toán', 404);
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
      where: { status: { in: [PaymentAttemptStatus.CREATING, PaymentAttemptStatus.WAITING] }, expiresAt: { lte: new Date() } },
      select: { id: true }, orderBy: { expiresAt: 'asc' }, take: 20
    });
    for (const attempt of overdue) await this.reconcile(attempt.id);
  }
}
