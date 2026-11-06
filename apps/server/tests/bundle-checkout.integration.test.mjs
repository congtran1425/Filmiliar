import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient, Prisma } from '@prisma/client';
import { quoteBundle } from '../dist/services/bundle-quote.js';
import { SandboxPaymentFlow } from '../dist/services/payment-flow.js';
import { RentalOperations } from '../dist/services/rental-operations.js';
import { BundleOperations } from '../dist/services/bundle-operations.js';
import { APPROVED_RULES, APPROVED_TERMS } from '../dist/services/approved-policy.js';

const url = process.env.PAYMENT_TEST_DATABASE_URL;
test(
  'bundle checkout keeps one provider payment and atomic inventory through cancellation, inspection and refund',
  { skip: !url },
  async (t) => {
    assert.equal(new URL(url).pathname, '/filmiliar_payment_test');
    const db = new PrismaClient({ datasources: { db: { url } } });
    const original = await db.rentalPolicy.findUniqueOrThrow({ where: { id: 'rental' } }),
      suffix = crypto.randomBytes(6).toString('hex');
    const gateway = {
      appId: 123456,
      created: [],
      refunds: [],
      query: { return_code: 3 },
      refundQuery: { return_code: 3 },
      async createPayment(input) {
        this.created.push(input);
        if (this.timeout) throw new Error('lost response');
        return { return_code: 1, qr_code: 'isolated-qr' };
      },
      async checkOrderStatus() {
        if (this.queryError) throw new Error('unreachable');
        return this.query;
      },
      async createRefund(input) {
        this.refunds.push(input);
        return { return_code: 1, refund_id: '1234567890123456789' };
      },
      async queryRefund() {
        return this.refundQuery;
      },
      verifyCallback() {
        return true;
      },
      parseCallback() {
        throw new Error('unused');
      },
    };
    const flow = new SandboxPaymentFlow(db, gateway),
      ops = new BundleOperations(db, gateway),
      single = new RentalOperations(db, gateway);
    const users = [],
      models = [];
    let seq = 0,
      txn = 0,
      customer,
      admin,
      other;
    const day = (n) => new Date(Date.now() + 7 * 3600000 + n * 86400000).toISOString().slice(0, 10),
      op = () => ({ requestId: crypto.randomUUID(), note: 'Đối chiếu bộ thuê trong kiểm thử tách biệt.' });
    const unit = (model) =>
      db.cameraItem.create({
        data: {
          modelId: model.id,
          serialNumber: `BUNDLE-${suffix}-${++seq}`,
          conditionGrade: '96%',
          opticsCondition: 'Checked',
          scratchNotes: 'Recorded',
          depositAmount: model.categoryName === 'Lens' ? 800000 : 1500000,
        },
      });
    const pair = async () => [await unit(models[0]), await unit(models[1])];
    const selection = (items, offset = 3) => ({
      cameraItemIds: items.map((i) => i.id),
      startDate: day(offset),
      endDate: day(offset + 1),
      startTime: '08:00',
      endTime: '08:00',
    });
    const create = async (items, offset = 3, requestId = crypto.randomUUID()) => {
      const input = selection(items, offset),
        q = await quoteBundle(db, input);
      return flow.createBundle(customer.id, {
        ...input,
        clientRequestId: requestId,
        quoteHash: q.view.quoteHash,
        termsAccepted: true,
      });
    };
    const paid = async (items, offset = 3) => {
      const p = await create(items, offset);
      await flow.handleCallback({
        app_id: gateway.appId,
        app_trans_id: p.appTransId,
        amount: p.totalAmount,
        zp_trans_id: '777777777777' + String(++txn).padStart(6, '0'),
        embed_data: JSON.stringify({ bookingId: p.bookingId }),
      });
      assert.equal((await flow.getForUser(customer.id, p.bookingId)).paymentStatus, 'PAID');
      return p;
    };
    try {
      for (const role of ['CUSTOMER', 'ADMIN', 'CUSTOMER'])
        users.push(
          await db.user.create({
            data: {
              email: `bundle-${users.length}-${suffix}@example.test`,
              fullName: 'Bundle test',
              passwordHash: 'isolated',
              phone: '0912345678',
              role,
            },
          }),
        );
      [customer, admin, other] = users;
      for (const [slug, categoryName, dailyRentalRate] of [
        ['sony-zv-e10', 'Mirrorless', 170000],
        ['sony-fe-50mm-f1-8', 'Lens', 70000],
        ['canon-rf-50mm-f1-8-stm', 'Lens', 80000],
      ])
        models.push(
          await db.product.create({
            data: {
              slug,
              categoryName,
              dailyRentalRate,
              modelName: slug,
              brand: 'Fixture',
              weightGrams: 400,
              recommendedPurpose: 'Isolated test',
              referenceUsedPrice: 10000000,
            },
          }),
        );
      await db.rentalPolicy.update({
        where: { id: 'rental' },
        data: {
          terms: APPROVED_TERMS,
          rules: APPROVED_RULES,
          cancellationRefund: 'TIMED',
          returnBufferDays: 0,
          version: { increment: 1 },
        },
      });
      await t.test(
        'quote totals include every exact unit and reject incompatible mounts, duplicates and stale prices',
        async () => {
          const items = await pair(),
            input = selection(items),
            q = await quoteBundle(db, input);
          assert.equal(q.view.rentalFee, 240000);
          assert.equal(q.view.depositAmount, 2300000);
          assert.equal(q.view.totalAmount, 2540000);
          assert.equal(q.view.items.length, 2);
          await assert.rejects(quoteBundle(db, { ...input, cameraItemIds: [items[0].id, items[0].id] }));
          await assert.rejects(
            quoteBundle(db, { ...input, cameraItemIds: [items[0].id, (await unit(models[2])).id] }),
          );
          await db.cameraItem.update({ where: { id: items[1].id }, data: { depositAmount: 900000 } });
          const calls = gateway.created.length;
          await assert.rejects(
            flow.createBundle(customer.id, {
              ...input,
              clientRequestId: crypto.randomUUID(),
              quoteHash: q.view.quoteHash,
              termsAccepted: true,
            }),
            { statusCode: 409 },
          );
          assert.equal(gateway.created.length, calls);
          assert.equal(
            await db.rentalAllocation.count({ where: { cameraItemId: items[0].id, releasedAt: null } }),
            0,
          );
        },
      );
      await t.test(
        'a single-item reservation blocks the entire bundle without a partial hold or provider call',
        async () => {
          const items = await pair(),
            input = selection(items);
          await flow.create(other.id, {
            cameraItemId: items[1].id,
            startDate: input.startDate,
            endDate: input.endDate,
            clientRequestId: crypto.randomUUID(),
          });
          const before = await db.rentalBundle.count(),
            calls = gateway.created.length;
          await assert.rejects(create(items), { statusCode: 409 });
          assert.equal(await db.rentalBundle.count(), before);
          assert.equal(gateway.created.length, calls);
          assert.equal(
            await db.rentalAllocation.count({ where: { cameraItemId: items[0].id, releasedAt: null } }),
            0,
          );
        },
      );
      await t.test(
        'concurrent retries make one QR, ownership is enforced and a changed item set cannot reuse the request',
        async () => {
          const items = await pair(),
            requestId = crypto.randomUUID(),
            calls = gateway.created.length;
          const [a, b] = await Promise.all([create(items, 3, requestId), create(items, 3, requestId)]);
          assert.equal(a.bookingId, b.bookingId);
          assert.equal(gateway.created.length, calls + 1);
          assert.equal(a.items.length, 2);
          assert.equal(a.totalAmount, 2540000);
          assert.equal((await flow.getActiveBundle(customer.id, selection(items))).bookingId, a.bookingId);
          const q = await quoteBundle(db, selection([items[0]]));
          await assert.rejects(
            flow.createBundle(customer.id, {
              ...selection([items[0]]),
              clientRequestId: requestId,
              quoteHash: q.view.quoteHash,
              termsAccepted: true,
            }),
            { statusCode: 409 },
          );
          await assert.rejects(ops.detail(a.bundleId, other), { statusCode: 404 });
          await assert.rejects(single.cancel(a.bookingId, customer, op()), { statusCode: 409 });
          await assert.rejects(single.requestRefund(a.bookingId, customer, crypto.randomUUID()), {
            statusCode: 409,
          });
        },
      );
      await t.test('a race over one shared lens only reserves one complete bundle', async () => {
        const a = await unit(models[0]),
          b = await unit(models[0]),
          lens = await unit(models[1]),
          calls = gateway.created.length;
        const results = await Promise.allSettled([create([a, lens]), create([b, lens])]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal(gateway.created.length, calls + 1);
        assert.equal(
          await db.rentalAllocation.count({
            where: { cameraItemId: { in: [a.id, b.id, lens.id] }, releasedAt: null },
          }),
          2,
        );
      });
      await t.test(
        'wrong payment totals never confirm any line and unknown provider responses preserve every hold',
        async () => {
          const items = await pair(),
            p = await create(items);
          await flow.handleCallback({
            app_id: gateway.appId,
            app_trans_id: p.appTransId,
            amount: p.totalAmount - 1,
            zp_trans_id: '333333333333333333',
          });
          assert.equal((await ops.detail(p.bundleId, customer)).paymentAttempt.status, 'REVIEW');
          assert.ok(
            (await db.rentalBooking.findMany({ where: { bundleId: p.bundleId } })).every(
              (b) => b.status === 'PENDING_PAYMENT',
            ),
          );
          gateway.timeout = true;
          const unknown = await create(await pair());
          gateway.timeout = false;
          assert.equal(unknown.paymentStatus, 'CREATING');
          gateway.queryError = true;
          await db.paymentAttempt.update({
            where: { bookingId: unknown.bookingId },
            data: { expiresAt: new Date(Date.now() - 3600000) },
          });
          await flow.reconcileForUser(customer.id, unknown.bookingId);
          gateway.queryError = false;
          assert.equal(
            await db.rentalAllocation.count({
              where: { booking: { bundleId: unknown.bundleId }, releasedAt: null },
            }),
            2,
          );
          const failed = await create(await pair());
          gateway.query = { return_code: 2, sub_return_code: -54 };
          await db.paymentAttempt.update({
            where: { bookingId: failed.bookingId },
            data: { expiresAt: new Date(Date.now() - 3600000) },
          });
          await flow.reconcileForUser(customer.id, failed.bookingId);
          gateway.query = { return_code: 3 };
          assert.ok(
            (await db.rentalBooking.findMany({ where: { bundleId: failed.bundleId } })).every(
              (b) => b.status === 'CANCELLED',
            ),
          );
          assert.equal(
            await db.rentalAllocation.count({
              where: { booking: { bundleId: failed.bundleId }, releasedAt: null },
            }),
            0,
          );
        },
      );
      await t.test(
        'the whole bundle can reschedule once and cancellation freezes a combined partial refund',
        async () => {
          const p = await paid(await pair());
          await ops.reschedule(p.bundleId, customer, {
            ...op(),
            startDate: day(5),
            endDate: day(6),
            startTime: '08:00',
            endTime: '08:00',
          });
          await assert.rejects(
            ops.reschedule(p.bundleId, customer, { ...op(), startDate: day(7), endDate: day(8) }),
            { statusCode: 409 },
          );
          assert.ok(
            (await db.rentalBooking.findMany({ where: { bundleId: p.bundleId } })).every(
              (b) => b.rescheduleCount === 1,
            ),
          );
          const pickupAt = new Date(Date.now() + 36 * 3600000),
            dueAt = new Date(pickupAt.getTime() + 86400000);
          await db.rentalBooking.updateMany({ where: { bundleId: p.bundleId }, data: { pickupAt, dueAt } });
          await assert.rejects(ops.cancel(p.bundleId, customer, { ...op(), storeFault: true }), {
            statusCode: 403,
          });
          const cancelled = await ops.cancel(p.bundleId, customer, op());
          assert.equal(cancelled.cancellationRefundAmount, 2420000);
          const calls = gateway.refunds.length;
          await ops.requestRefund(p.bundleId, customer, crypto.randomUUID());
          assert.equal(gateway.refunds.length, calls + 1);
          assert.equal(gateway.refunds.at(-1).amount, 2420000);
        },
      );
      await t.test(
        'inspection and customer consent are per unit; one refund waits for all units and settles them together',
        async () => {
          const p = await paid(await pair(), 0),
            bundle = await ops.detail(p.bundleId, customer);
          const records = bundle.bookings.map((b) => ({
            bookingId: b.id,
            accessories: 'Pin, sạc và nắp theo biên bản',
            condition: 'Đối chiếu tình trạng thiết bị đầy đủ',
            shutterCount: null,
            receiptReference: 'BB-' + b.cameraItemId,
          }));
          await assert.rejects(ops.handover(p.bundleId, customer, { ...op(), records }), { statusCode: 403 });
          await ops.handover(p.bundleId, admin, { ...op(), records });
          await assert.rejects(ops.cancel(p.bundleId, customer, op()), { statusCode: 409 });
          await ops.receiveReturn(p.bundleId, admin, op());
          const input = {
            ...op(),
            bookingId: bundle.bookings[0].id,
            shutterCount: null,
            condition: 'Đã đối chiếu thiết bị khi trả',
            deductionAmount: 100000,
            deductionReason: 'Vệ sinh theo biên bản đã ghi nhận',
            releaseToStock: true,
          };
          await ops.inspect(p.bundleId, admin, input);
          await assert.rejects(ops.requestRefund(p.bundleId, customer, crypto.randomUUID()), {
            statusCode: 409,
          });
          await ops.inspect(p.bundleId, admin, {
            ...input,
            ...op(),
            bookingId: bundle.bookings[1].id,
            deductionAmount: 0,
            deductionReason: '',
          });
          assert.equal((await ops.detail(p.bundleId, customer)).canRefund, false);
          const current = await ops.detail(p.bundleId, customer),
            line = current.bookings[0];
          await assert.rejects(
            ops.decideDeduction(p.bundleId, admin, {
              ...op(),
              bookingId: line.id,
              accept: true,
              expectedAmount: 100000,
              inspectedAt: line.inspectedAt.toISOString(),
            }),
            { statusCode: 403 },
          );
          await ops.decideDeduction(p.bundleId, customer, {
            ...op(),
            bookingId: line.id,
            accept: true,
            expectedAmount: 100000,
            inspectedAt: line.inspectedAt.toISOString(),
          });
          const calls = gateway.refunds.length;
          await Promise.all([
            ops.requestRefund(p.bundleId, customer, crypto.randomUUID()),
            ops.requestRefund(p.bundleId, customer, crypto.randomUUID()),
          ]);
          assert.equal(gateway.refunds.length, calls + 1);
          assert.equal(gateway.refunds.at(-1).amount, 2200000);
          gateway.refundQuery = { return_code: 1, refund_id: '1234567890123456789' };
          const settled = await ops.checkRefund(p.bundleId, customer);
          gateway.refundQuery = { return_code: 3 };
          assert.equal(settled.refunds[0].status, 'SUCCEEDED');
          assert.deepEqual(settled.bookings.map((b) => b.depositStatus).sort(), ['DEDUCTED', 'REFUNDED']);
        },
      );
    } finally {
      if (users.length) {
        const ids = users.map((u) => u.id);
        await db.refundAttempt.deleteMany({ where: { booking: { userId: { in: ids } } } });
        await db.paymentAttempt.deleteMany({ where: { userId: { in: ids } } });
        await db.rentalBooking.deleteMany({ where: { userId: { in: ids } } });
        await db.rentalBundle.deleteMany({ where: { userId: { in: ids } } });
      }
      if (models.length) await db.product.deleteMany({ where: { id: { in: models.map((m) => m.id) } } });
      if (users.length) await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
      await db.rentalPolicy.update({
        where: { id: 'rental' },
        data: {
          version: original.version,
          returnBufferDays: original.returnBufferDays,
          terms: original.terms,
          cancellationRefund: original.cancellationRefund,
          rules: original.rules ?? Prisma.DbNull,
        },
      });
      await db.$disconnect();
    }
  },
);
