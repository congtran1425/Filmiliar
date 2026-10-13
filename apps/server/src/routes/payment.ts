import type { Express, Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { PaymentFlowError, SandboxPaymentFlow } from '../services/payment-flow.js';
import { ZaloPayService } from '../services/zalopay.service.js';

const createSchema = z.object({
  cameraItemId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientRequestId: z.string().uuid()
}).strict();
const statusSchema = z.object({ bookingId: z.string().uuid() }).strict();

function sendError(error: unknown, res: Response) {
  if (error instanceof PaymentFlowError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
  } else {
    res.status(500).json({ success: false, message: 'Không thể xử lý thanh toán Sandbox lúc này' });
  }
}

export function registerPaymentRoutes(app: Express, prisma: PrismaClient, requireUser: RequestHandler, requireAdmin: RequestHandler) {
  const gateway = new ZaloPayService();
  const enabled = process.env.PAYMENT_MODE === 'sandbox';
  if (enabled && !gateway.isConfigured()) throw new Error('PAYMENT_MODE=sandbox requires a complete ZaloPay Sandbox configuration');
  const flow = new SandboxPaymentFlow(prisma, gateway);
  const requireSandbox: RequestHandler = (_req, res, next) => {
    if (!enabled) return res.status(503).json({ success: false, message: 'Thanh toán trực tuyến chưa mở' });
    next();
  };
  const pollLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

  app.get('/api/payment/capabilities', requireUser, (req: Request, res: Response) => {
    res.json({ success: true, sandboxEnabled: enabled && res.locals.user.role === 'ADMIN' });
  });

  app.get('/api/payment/active/:unitId', requireUser, requireAdmin, requireSandbox, async (req: Request, res: Response) => {
    const unitId = Number(req.params.unitId);
    if (!Number.isSafeInteger(unitId) || unitId <= 0) return res.status(400).json({ success: false, message: 'Mã máy không hợp lệ' });
    try { res.json({ success: true, data: await flow.getActiveForUnit(res.locals.user.id, unitId) }); }
    catch (error) { sendError(error, res); }
  });

  app.post('/api/payment/create', requireUser, requireAdmin, requireSandbox, async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Thông tin đặt thử không hợp lệ' });
    try {
      const data = await flow.create(res.locals.user.id, parsed.data);
      res.status(data.paymentStatus === 'CREATING' ? 202 : 200).json({ success: true, data });
    } catch (error) { sendError(error, res); }
  });

  app.post('/api/payment/check-status', requireUser, requireAdmin, requireSandbox, pollLimit, async (req: Request, res: Response) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Mã đơn không hợp lệ' });
    try { res.json({ success: true, data: await flow.reconcileForUser(res.locals.user.id, parsed.data.bookingId) }); }
    catch (error) { sendError(error, res); }
  });

  app.post('/api/payment/callback', requireSandbox, async (req: Request, res: Response) => {
    const data = req.body?.data;
    const mac = req.body?.mac;
    if (typeof data !== 'string' || typeof mac !== 'string' || data.length > 20_000 || !gateway.verifyCallback(data, mac)) {
      return res.json({ return_code: 2, return_message: 'Invalid' });
    }
    try {
      const accepted = await flow.handleCallback(gateway.parseCallback(data));
      res.json({ return_code: accepted ? 1 : 0, return_message: accepted ? 'Success' : 'Order not found' });
    } catch {
      res.json({ return_code: 0, return_message: 'Processing' });
    }
  });

  if (enabled) {
    let reconciling = false;
    const timer = setInterval(async () => {
      if (reconciling) return;
      reconciling = true;
      try { await flow.reconcileOverdue(); }
      catch { console.error('Sandbox payment reconciliation failed'); }
      finally { reconciling = false; }
    }, 60_000);
    timer.unref();
  }
}
