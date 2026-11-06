import type { Express, Request, RequestHandler, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { BundleOperations } from '../services/bundle-operations.js';
import { quoteBundle } from '../services/bundle-quote.js';
import { SandboxPaymentFlow } from '../services/payment-flow.js';
import { PaymentFlowError, isAllocationConflict } from '../services/rental-domain.js';
import { ZaloPayService } from '../services/zalopay.service.js';
import { normalizePhone } from '../phone.js';

const selection = {
  cameraItemIds: z.array(z.number().int().positive()).min(1).max(8),
  startDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  endDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
};
const operation = z.object({ requestId: z.string().uuid(), note: z.string().trim().min(5).max(1000) });
const id = z.string().uuid();
function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new PaymentFlowError(result.error.issues[0]?.message || 'Thông tin không hợp lệ');
  return result.data;
}

export function registerBundleRoutes(
  app: Express,
  prisma: PrismaClient,
  requireUser: RequestHandler,
  requireAdmin: RequestHandler,
) {
  const gateway = new ZaloPayService(),
    flow = new SandboxPaymentFlow(prisma, gateway),
    ops = new BundleOperations(prisma, gateway);
  const limit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  const handle =
    (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req, res) => {
      try {
        res.json({ success: true, data: await fn(req, res) });
      } catch (error) {
        res
          .status(
            error instanceof PaymentFlowError ? error.statusCode : isAllocationConflict(error) ? 409 : 500,
          )
          .json({
            success: false,
            message:
              error instanceof PaymentFlowError
                ? error.message
                : isAllocationConflict(error)
                  ? 'Một thiết bị vừa có lịch khác'
                  : 'Không xử lý được bộ thuê lúc này',
          });
      }
    };
  const enabled: RequestHandler = (_req, res, next) => {
    if (process.env.PAYMENT_MODE !== 'sandbox' || !gateway.isConfigured())
      return res.status(503).json({ success: false, message: 'Thanh toán trực tuyến chưa sẵn sàng' });
    next();
  };
  const readSelection = (req: Request) => {
    const { unitIds, ...rest } = req.query;
    return parse(
      z
        .object({
          ...selection,
          cameraItemIds: z
            .string()
            .max(120)
            .transform((v) => v.split(',').map(Number)),
        })
        .strict(),
      { ...rest, cameraItemIds: unitIds },
    );
  };
  app.get(
    '/api/rental/bundle-quote',
    limit,
    handle(async (req) => (await quoteBundle(prisma, readSelection(req))).view),
  );
  app.get(
    '/api/payment/bundle/active',
    requireUser,
    enabled,
    limit,
    handle(async (req, res) => flow.getActiveBundle(res.locals.user.id, readSelection(req))),
  );
  app.post(
    '/api/payment/bundle/create',
    requireUser,
    enabled,
    limit,
    handle(async (req, res) => {
      const input = parse(
        z
          .object({
            ...selection,
            clientRequestId: z.string().uuid(),
            quoteHash: z.string().regex(/^[a-f0-9]{64}$/),
            termsAccepted: z.literal(true),
          })
          .strict(),
        req.body,
      );
      if (
        !normalizePhone(res.locals.user.phone) &&
        !(await prisma.paymentAttempt.findUnique({
          where: {
            userId_clientRequestId: { userId: res.locals.user.id, clientRequestId: input.clientRequestId },
          },
          select: { id: true },
        }))
      )
        throw new PaymentFlowError('Bổ sung số điện thoại trong hồ sơ trước khi đặt thuê', 409);
      return flow.createBundle(res.locals.user.id, input);
    }),
  );
  app.get(
    '/api/rental/bundles/:id',
    requireUser,
    limit,
    handle(async (req, res) => {
      const bundle = await ops.detail(parse(id, req.params.id), res.locals.user);
      if (bundle.paymentAttempt && ['CREATING', 'WAITING'].includes(bundle.paymentAttempt.status)) {
        await flow.reconcileForUser(bundle.userId, bundle.primaryBookingId);
        return ops.detail(bundle.id, res.locals.user);
      }
      return bundle;
    }),
  );
  app.post(
    '/api/rental/bundles/:id/cancel',
    requireUser,
    limit,
    handle(async (req, res) => {
      const input = parse(operation.extend({ storeFault: z.boolean().optional() }).strict(), req.body);
      const bundle = await ops.cancel(parse(id, req.params.id), res.locals.user, input);
      return gateway.isConfigured() && bundle.canRefund
        ? ops.requestRefund(bundle.id, res.locals.user, input.requestId)
        : bundle;
    }),
  );
  app.post(
    '/api/rental/bundles/:id/reschedule',
    requireUser,
    limit,
    handle(async (req, res) =>
      ops.reschedule(
        parse(id, req.params.id),
        res.locals.user,
        parse(
          operation
            .extend({
              startDate: selection.startDate,
              endDate: selection.endDate,
              startTime: selection.startTime,
              endTime: selection.endTime,
            })
            .strict(),
          req.body,
        ),
      ),
    ),
  );
  app.post(
    '/api/rental/bundles/:id/deduction-decision',
    requireUser,
    limit,
    handle(async (req, res) => {
      const input = parse(
        operation
          .extend({
            bookingId: id,
            accept: z.boolean(),
            expectedAmount: z.number().int().min(0),
            inspectedAt: z.string().datetime(),
          })
          .strict(),
        req.body,
      );
      const bundle = await ops.decideDeduction(parse(id, req.params.id), res.locals.user, input);
      return gateway.isConfigured() && bundle.canRefund
        ? ops.requestRefund(bundle.id, res.locals.user, input.requestId)
        : bundle;
    }),
  );
  app.post(
    '/api/rental/bundles/:id/refund',
    requireUser,
    enabled,
    limit,
    handle(async (req, res) =>
      ops.requestRefund(
        parse(id, req.params.id),
        res.locals.user,
        parse(z.object({ clientRequestId: id }).strict(), req.body).clientRequestId,
      ),
    ),
  );
  app.post(
    '/api/rental/bundles/:id/check-refund',
    requireUser,
    enabled,
    limit,
    handle(async (req, res) => ops.checkRefund(parse(id, req.params.id), res.locals.user)),
  );
  app.post(
    '/api/admin/rental-bundles/:id/handover',
    requireUser,
    requireAdmin,
    limit,
    handle(async (req, res) =>
      ops.handover(
        parse(id, req.params.id),
        res.locals.user,
        parse(
          operation
            .extend({
              records: z
                .array(
                  z
                    .object({
                      bookingId: id,
                      accessories: z.string().trim().min(2).max(1000),
                      condition: z.string().trim().min(5).max(1000),
                      shutterCount: z.number().int().min(0).max(10000000).nullable(),
                      receiptReference: z.string().trim().min(3).max(120),
                    })
                    .strict(),
                )
                .min(1)
                .max(8),
            })
            .strict(),
          req.body,
        ),
      ),
    ),
  );
  app.post(
    '/api/admin/rental-bundles/:id/receive-return',
    requireUser,
    requireAdmin,
    limit,
    handle(async (req, res) =>
      ops.receiveReturn(parse(id, req.params.id), res.locals.user, parse(operation.strict(), req.body)),
    ),
  );
  app.post(
    '/api/admin/rental-bundles/:id/inspect',
    requireUser,
    requireAdmin,
    limit,
    handle(async (req, res) => {
      const input = parse(
        operation
          .extend({
            bookingId: id,
            shutterCount: z.number().int().min(0).max(10000000).nullable(),
            condition: z.string().trim().min(5).max(1000),
            deductionAmount: z.number().int().min(0).max(50000000),
            deductionReason: z.string().max(1000),
            releaseToStock: z.boolean(),
          })
          .strict(),
        req.body,
      );
      const bundle = await ops.inspect(parse(id, req.params.id), res.locals.user, input);
      return gateway.isConfigured() && bundle.canRefund
        ? ops.requestRefund(bundle.id, res.locals.user, input.requestId)
        : bundle;
    }),
  );
}
