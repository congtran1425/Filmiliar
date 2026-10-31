import type { Express, Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ZaloPayService } from '../services/zalopay.service.js';
import { RentalOperations } from '../services/rental-operations.js';
import { getRentalPolicy, getUnitCalendar, lockUnit, quoteRental } from '../services/rental-availability.js';
import { DAY_MS, PaymentFlowError, dateKey, isAllocationConflict, parseDay, vietnamDate } from '../services/rental-domain.js';

const operation = z.object({ requestId: z.string().uuid(), note: z.string().trim().min(5).max(1000) });
const count = z.number().int().min(0).max(10_000_000).nullable();
const handover = operation.extend({ accessories: z.string().trim().min(2).max(1000), shutterCount: count,
  condition: z.string().trim().min(5).max(1000), receiptReference: z.string().trim().min(3).max(120) }).strict();
const inspection = operation.extend({ shutterCount: count, condition: z.string().trim().min(5).max(1000),
  deductionAmount: z.number().int().min(0).max(50_000_000), deductionReason: z.string().trim().max(1000), releaseToStock: z.boolean() }).strict();
const decision = operation.extend({ accept: z.boolean(), expectedAmount: z.number().int().min(0), inspectedAt: z.string().datetime() }).strict();
const refundInput = z.object({ clientRequestId: z.string().uuid() }).strict();
const policyInput = z.object({ version: z.number().int().positive(), returnBufferDays: z.number().int().min(0).max(3),
  cancellationRefund: z.enum(['FULL_PAYMENT', 'DEPOSIT_ONLY']), terms: z.string().trim().min(40).max(8000) }).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new PaymentFlowError(result.error.issues[0]?.message || 'Thông tin không hợp lệ');
  return result.data;
}
function unitId(req: Request): number {
  const value = Number(req.params.unitId);
  if (!Number.isSafeInteger(value) || value <= 0) throw new PaymentFlowError('Mã chiếc máy không hợp lệ');
  return value;
}

export function registerRentalRoutes(app: Express, prisma: PrismaClient, requireUser: RequestHandler, requireAdmin: RequestHandler) {
  const gateway = new ZaloPayService();
  const ops = new RentalOperations(prisma, gateway);
  const financialLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
  const providerReady: RequestHandler = (_req, res, next) => {
    if (!gateway.isConfigured()) return res.status(503).json({ success: false, message: 'Chưa kết nối được dịch vụ hoàn tiền' });
    next();
  };
  const handle = (action: (req: Request, res: Response) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { res.json({ success: true, data: await action(req, res) }); }
    catch (error) {
      const overlap = isAllocationConflict(error);
      res.status(error instanceof PaymentFlowError ? error.statusCode : overlap ? 409 : 500).json({ success: false,
        message: error instanceof PaymentFlowError ? error.message : overlap ? 'Khoảng ngày này đã có lịch khác. Vui lòng chọn lại.' : 'Không thể xử lý thao tác thuê máy lúc này' });
    }
  };
  const bookingId = (req: Request) => parse(z.string().uuid(), req.params.id);

  app.get('/api/rental-policy', handle(async () => {
    const { id, version, returnBufferDays, cancellationRefund, terms, updatedAt } = await getRentalPolicy(prisma);
    return { id, version, returnBufferDays, cancellationRefund, terms, updatedAt };
  }));
  app.get('/api/rental/quote/:unitId', handle(async req => {
    const dates = parse(z.object({ startDate: z.string(), endDate: z.string() }).strict(), req.query);
    return (await quoteRental(prisma, unitId(req), dates.startDate, dates.endDate)).view;
  }));
  app.get('/api/rental/calendar/:unitId', handle(async req => {
    const from = typeof req.query.from === 'string' ? req.query.from : vietnamDate();
    const to = typeof req.query.to === 'string' ? req.query.to : dateKey(new Date(parseDay(from).getTime() + 100 * DAY_MS));
    return getUnitCalendar(prisma, unitId(req), from, to);
  }));

  app.get('/api/admin/rental-policy', requireUser, requireAdmin, handle(async () => getRentalPolicy(prisma)));
  app.patch('/api/admin/rental-policy', requireUser, requireAdmin, handle(async (req, res) => {
    const input = parse(policyInput, req.body);
    const saved = await prisma.rentalPolicy.updateMany({ where: { id: 'rental', version: input.version }, data: {
      returnBufferDays: input.returnBufferDays, cancellationRefund: input.cancellationRefund,
      terms: input.terms, version: { increment: 1 }, updatedById: res.locals.user.id
    } });
    if (saved.count !== 1) throw new PaymentFlowError('Chính sách vừa được người khác cập nhật. Vui lòng tải lại.', 409);
    return getRentalPolicy(prisma);
  }));
  app.get('/api/admin/rental-units', requireUser, requireAdmin, handle(async () => prisma.cameraItem.findMany({
    select: { id: true, serialNumber: true, status: true, depositAmount: true, product: { select: { modelName: true, isPublished: true } } }, orderBy: { id: 'asc' }
  })));
  app.patch('/api/admin/rental-units/:unitId/deposit', requireUser, requireAdmin, handle(async req => {
    const input = parse(z.object({ depositAmount: z.number().int().min(0).max(50_000_000) }).strict(), req.body);
    return prisma.$transaction(async tx => {
      await lockUnit(tx, unitId(req));
      const unit = await tx.cameraItem.findUnique({ where: { id: unitId(req) } });
      if (!unit) throw new PaymentFlowError('Không tìm thấy chiếc máy', 404);
      return tx.cameraItem.update({ where: { id: unit.id }, data: input, select: { id: true, serialNumber: true, depositAmount: true } });
    });
  }));
  app.get('/api/admin/rental-calendar/:unitId', requireUser, requireAdmin, handle(async req => {
    const from = typeof req.query.from === 'string' ? req.query.from : vietnamDate();
    const to = typeof req.query.to === 'string' ? req.query.to : dateKey(new Date(parseDay(from).getTime() + 100 * DAY_MS));
    await getUnitCalendar(prisma, unitId(req), from, to);
    return prisma.rentalAllocation.findMany({ where: { cameraItemId: unitId(req), releasedAt: null, startDate: { lt: parseDay(to) }, endDate: { gt: parseDay(from) } },
      include: { booking: { select: { bookingCode: true, status: true, user: { select: { fullName: true } } } } }, orderBy: { startDate: 'asc' } });
  }));
  app.post('/api/admin/rental-calendar/:unitId/blocks', requireUser, requireAdmin, handle(async (req, res) => {
    const input = parse(z.object({ requestId: z.string().uuid(), startDate: z.string(), endDate: z.string(), reason: z.string().trim().min(5).max(500) }).strict(), req.body);
    const start = parseDay(input.startDate), end = parseDay(input.endDate), today = parseDay(vietnamDate());
    if (start < today || end <= start || end.getTime() - start.getTime() > 120 * DAY_MS) throw new PaymentFlowError('Lịch khóa cần bắt đầu từ hôm nay và kéo dài tối đa 120 ngày');
    return prisma.$transaction(async tx => {
      await lockUnit(tx, unitId(req));
      const existing = await tx.rentalAllocation.findUnique({ where: { id: input.requestId } });
      if (existing) {
        if (existing.cameraItemId !== unitId(req) || existing.kind !== 'BLOCK' || existing.actorId !== res.locals.user.id || existing.startDate.getTime() !== start.getTime() || existing.endDate.getTime() !== end.getTime() || existing.reason !== input.reason) throw new PaymentFlowError('Mã thao tác đã dùng cho lịch khác', 409);
        return existing;
      }
      if (!await tx.cameraItem.findUnique({ where: { id: unitId(req) } })) throw new PaymentFlowError('Không tìm thấy chiếc máy', 404);
      return tx.rentalAllocation.create({ data: { id: input.requestId, cameraItemId: unitId(req), kind: 'BLOCK', startDate: start, endDate: end, reason: input.reason, actorId: res.locals.user.id } });
    });
  }));
  app.patch('/api/admin/rental-blocks/:id/release', requireUser, requireAdmin, handle(async req => {
    const id = parse(z.string().uuid(), req.params.id);
    const block = await prisma.rentalAllocation.findUnique({ where: { id } });
    if (!block || block.kind !== 'BLOCK') throw new PaymentFlowError('Không tìm thấy lịch khóa thủ công', 404);
    return prisma.$transaction(async tx => {
      await lockUnit(tx, block.cameraItemId);
      const current = await tx.rentalAllocation.findUniqueOrThrow({ where: { id } });
      return current.releasedAt ? current : tx.rentalAllocation.update({ where: { id }, data: { releasedAt: new Date() } });
    });
  }));

  app.get('/api/rental/bookings/:id', requireUser, handle(async (req, res) => ops.detail(bookingId(req), res.locals.user)));
  app.post('/api/admin/rentals/:id/handover', requireUser, requireAdmin, handle(async (req, res) => ops.handover(bookingId(req), res.locals.user, parse(handover, req.body))));
  app.post('/api/admin/rentals/:id/receive-return', requireUser, requireAdmin, handle(async (req, res) => ops.receiveReturn(bookingId(req), res.locals.user, parse(operation.strict(), req.body))));
  app.post('/api/admin/rentals/:id/inspect', requireUser, requireAdmin, handle(async (req, res) => {
    const input = parse(inspection, req.body);
    const booking = await ops.inspect(bookingId(req), res.locals.user, input);
    return input.deductionAmount === 0 && gateway.isConfigured() ? ops.requestRefund(booking.id, res.locals.user, input.requestId) : booking;
  }));
  app.post('/api/rental/bookings/:id/deduction-decision', requireUser, handle(async (req, res) => {
    const input = parse(decision, req.body);
    const booking = await ops.decideDeduction(bookingId(req), res.locals.user, input);
    return input.accept && gateway.isConfigured() ? ops.requestRefund(booking.id, res.locals.user, input.requestId) : booking;
  }));
  app.post('/api/rental/bookings/:id/cancel', requireUser, financialLimit, handle(async (req, res) => {
    const input = parse(operation.strict(), req.body);
    const booking = await ops.cancel(bookingId(req), res.locals.user, input);
    return booking.paymentAttempt?.status === 'PAID' && gateway.isConfigured() ? ops.requestRefund(booking.id, res.locals.user, input.requestId) : booking;
  }));
  app.post('/api/rental/bookings/:id/refund', requireUser, providerReady, financialLimit, handle(async (req, res) => ops.requestRefund(bookingId(req), res.locals.user, parse(refundInput, req.body).clientRequestId)));
  app.post('/api/rental/bookings/:id/check-refund', requireUser, providerReady, financialLimit, handle(async (req, res) => {
    const booking = await ops.detail(bookingId(req), res.locals.user);
    for (const refund of booking.refunds.filter(r => r.activeBookingId).slice(0, 1)) await ops.reconcileRefund(refund.id, true);
    return ops.detail(booking.id, res.locals.user);
  }));

  if (gateway.isConfigured()) {
    let running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try { await ops.pollRefunds(); } catch { /* Keep persisted requests for the next reconciliation. */ }
      finally { running = false; }
    }, 30_000);
    timer.unref();
  }
}
