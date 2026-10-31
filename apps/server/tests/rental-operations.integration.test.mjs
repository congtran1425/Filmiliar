import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { SandboxPaymentFlow } from '../dist/services/payment-flow.js';
import { RentalOperations } from '../dist/services/rental-operations.js';
import { quoteRental, getUnitCalendar } from '../dist/services/rental-availability.js';

const databaseUrl = process.env.PAYMENT_TEST_DATABASE_URL;
test('rental calendar, lifecycle, consent and refund reconciliation on isolated Postgres', { skip: !databaseUrl }, async t => {
  assert.equal(new URL(databaseUrl).pathname, '/filmiliar_payment_test');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = crypto.randomBytes(5).toString('hex');
  const day = offset => new Date(Date.now() + 7 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
  const gateway = {
    appId: 123456, createCount: 0, refundCalls: [], refundResult: { return_code: 1, refund_id: '9876543210987654321' },
    queryResult: { return_code: 3 }, loseRefund: false,
    async createPayment() { this.createCount++; return { return_code: 1, qr_code: 'isolated-test' }; },
    async checkOrderStatus() { return { return_code: 3 }; },
    async createRefund(input) { this.refundCalls.push(input); if (this.loseRefund) throw new Error('Response lost'); return this.refundResult; },
    async queryRefund() { return this.queryResult; }, verifyCallback() { return true; }, parseCallback() { throw new Error('unused'); }
  };
  const flow = new SandboxPaymentFlow(db, gateway);
  const ops = new RentalOperations(db, gateway);
  let customer, admin, other, product;
  let sequence = 0;
  let transactionSequence = 0;
  const op = (note = 'Đã đối chiếu biên bản và thiết bị.') => ({ requestId: crypto.randomUUID(), note });
  const unit = () => db.cameraItem.create({ data: { modelId: product.id, serialNumber: `OPS-${suffix}-${++sequence}`, conditionGrade: 'A', opticsCondition: 'Good', scratchNotes: 'Good', shutterCount: 100, depositAmount: 1000000 } });
  const create = async (item, start = day(0), end = day(1), who = customer) => {
    const { view } = await quoteRental(db, item.id, start, end);
    return flow.create(who.id, { cameraItemId: item.id, startDate: start, endDate: end, clientRequestId: crypto.randomUUID(), quoteHash: view.quoteHash, termsAccepted: true });
  };
  const paid = async (item, start = day(0), end = day(1)) => {
    const payment = await create(item, start, end);
    await flow.handleCallback({ app_id: gateway.appId, app_trans_id: payment.appTransId, amount: payment.totalAmount, zp_trans_id: `9876543210987${String(++transactionSequence).padStart(4,'0')}`, embed_data: JSON.stringify({ bookingId: payment.bookingId }) });
    return payment;
  };
  const handover = id => ops.handover(id, admin, { ...op(), accessories: 'Pin và sạc', condition: 'Ngoại hình tốt', shutterCount: 110, receiptReference: 'BB-TEST' });
  const returned = id => ops.receiveReturn(id, admin, op());
  const inspect = (id, deductionAmount = 0) => ops.inspect(id, admin, { ...op(), condition: 'Kiểm tra đầy đủ', shutterCount: 120, deductionAmount, deductionReason: deductionAmount ? 'Biên bản vết xước mới và chi phí xử lý.' : '', releaseToStock: true });
  try {
    const users = await Promise.all(['customer','admin','other'].map(role => db.user.create({ data: { email: `ops-${role}-${suffix}@example.test`, fullName: `Test ${role}`, passwordHash: 'isolated-test', role: role === 'admin' ? 'ADMIN' : 'CUSTOMER' } })));
    [customer, admin, other] = users;
    product = await db.product.create({ data: { slug: `ops-${suffix}`, modelName: 'Operations test', brand: 'Filmiliar', categoryName: 'Camera', weightGrams: 500, recommendedPurpose: 'Test', dailyRentalRate: 250000, referenceUsedPrice: 5000000 } });

    await t.test('interval calendar permits separated dates, excludes overlaps and preserves other reservations', async () => {
      const item = await unit();
      const first = await paid(item, day(3), day(4));
      const later = await paid(item, day(5), day(6));
      assert.equal((await quoteRental(db, item.id, day(4), day(5))).view.available, false, 'return buffer is reserved');
      const attempts = await Promise.allSettled([create(item, day(8), day(9)), create(item, day(8), day(9), other)]);
      assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(attempts.filter(r => r.status === 'rejected').length, 1);
      const calendar = await getUnitCalendar(db, item.id, day(0), day(12));
      assert.equal(calendar.ranges.length, 3);
      assert.equal(JSON.stringify(calendar).includes(customer.id), false);
      assert.equal(JSON.stringify(calendar).includes(first.bookingId), false);
      await assert.rejects(db.rentalAllocation.create({ data: { cameraItemId: item.id, kind: 'BLOCK', startDate: new Date(day(3)), endDate: new Date(day(4)), reason: 'Direct SQL collision' } }), /exclusion|overlap/i);
      await ops.cancel(first.bookingId, customer, op('Thay đổi lịch trước bàn giao.'));
      assert.equal((await quoteRental(db, item.id, day(3), day(4))).view.available, true);
      assert.equal((await db.rentalAllocation.findUnique({ where: { bookingId: later.bookingId } })).releasedAt, null);
      const block = await db.rentalAllocation.create({ data: { cameraItemId: item.id, kind: 'BLOCK', startDate: new Date(day(11)), endDate: new Date(day(12)), reason: 'Bảo dưỡng định kỳ' } });
      assert.equal((await quoteRental(db, item.id, day(11), day(12))).view.available, false);
      await db.rentalAllocation.update({ where: { id: block.id }, data: { releasedAt: new Date() } });
      assert.equal((await quoteRental(db, item.id, day(11), day(12))).view.available, true);
    });

    await t.test('stale quotes, unpaid handovers, early handovers and other customers are rejected', async () => {
      const item = await unit();
      const quote = (await quoteRental(db, item.id, day(0), day(1))).view;
      await db.cameraItem.update({ where: { id: item.id }, data: { depositAmount: 1100000 } });
      await assert.rejects(flow.create(customer.id, { cameraItemId: item.id, startDate: day(0), endDate: day(1), clientRequestId: crypto.randomUUID(), quoteHash: quote.quoteHash, termsAccepted: true }), /chính sách vừa thay đổi/);
      const waiting = await create(item);
      await assert.rejects(handover(waiting.bookingId), { statusCode: 409 });
      await assert.rejects(ops.cancel(waiting.bookingId, customer, op()), /đối soát/);
      await assert.rejects(ops.detail(waiting.bookingId, other), { statusCode: 404 });
      const future = await paid(await unit(), day(2), day(3));
      await assert.rejects(handover(future.bookingId), /ngày nhận máy/);
      await assert.rejects(ops.handover(future.bookingId, customer, { ...op(), accessories: 'pin', condition: 'Good condition', shutterCount: 110, receiptReference: 'TEST' }), { statusCode: 403 });
    });

    await t.test('handover and inspection are atomic, idempotent, and refund completes only after query success', async () => {
      const item = await unit(); const payment = await paid(item);
      const input = { ...op(), accessories: 'Pin và sạc', condition: 'Ngoại hình tốt', shutterCount: 110, receiptReference: 'BB-IDEMPOTENT' };
      await ops.handover(payment.bookingId, admin, input);
      await ops.handover(payment.bookingId, admin, input);
      assert.equal(await db.rentalEvent.count({ where: { bookingId: payment.bookingId, action: 'HANDOVER' } }), 1);
      await assert.rejects(ops.handover(payment.bookingId, admin, { ...input, note: 'Different payload' }), { statusCode: 409 });
      await assert.rejects(ops.cancel(payment.bookingId, customer, op()), /Sau bàn giao/);
      await assert.rejects(ops.requestRefund(payment.bookingId, customer, crypto.randomUUID()), /nghiệm thu/);
      await returned(payment.bookingId);
      assert.equal((await quoteRental(db, item.id, day(3), day(4))).view.available, false);
      await inspect(payment.bookingId);
      assert.equal((await db.cameraItem.findUnique({ where: { id: item.id } })).status, 'AVAILABLE');
      const before = gateway.refundCalls.length;
      gateway.queryResult = { return_code: 3 };
      const requests = await Promise.all([ops.requestRefund(payment.bookingId, customer, crypto.randomUUID()), ops.requestRefund(payment.bookingId, admin, crypto.randomUUID())]);
      assert.equal(gateway.refundCalls.length, before + 1);
      let result = await ops.detail(payment.bookingId, customer);
      assert.equal(result.refunds.length, 1); assert.equal(result.refunds[0].status, 'PENDING');
      assert.equal(result.depositStatus, 'REFUND_PENDING'); assert.equal(gateway.refundCalls.at(-1).amount, 1000000);
      await assert.rejects(ops.requestRefund(payment.bookingId, other, requests[0].refunds[0].clientRequestId), { statusCode: 404 });
      gateway.queryResult = { return_code: 2, sub_return_code: -500 };
      await ops.reconcileRefund(result.refunds[0].id, true);
      assert.equal((await ops.detail(payment.bookingId, customer)).depositStatus, 'REFUND_PENDING');
      gateway.queryResult = { return_code: 1, refund_id: '9876543210987654321' };
      await Promise.all([ops.reconcileRefund(result.refunds[0].id, true), ops.reconcileRefund(result.refunds[0].id, true)]);
      result = await ops.detail(payment.bookingId, customer);
      assert.equal(result.depositStatus, 'REFUNDED'); assert.equal(result.refunds[0].status, 'SUCCEEDED');
      assert.equal(result.events.filter(e => e.action === 'REFUND_CONFIRMED').length, 1);
      await ops.requestRefund(payment.bookingId, customer, crypto.randomUUID());
      assert.equal(gateway.refundCalls.length, before + 1);
    });

    await t.test('deduction requires customer consent, supports dispute revision without overwriting stock', async () => {
      const item = await unit(); const payment = await paid(item);
      await handover(payment.bookingId); await returned(payment.bookingId);
      let result = await inspect(payment.bookingId, 100000);
      await assert.rejects(ops.requestRefund(payment.bookingId, admin, crypto.randomUUID()), /khách đồng ý/);
      const decide = (who, accept, expectedAmount = 100000, inspectedAt = result.inspectedAt.toISOString()) => ops.decideDeduction(payment.bookingId, who, { ...op(), accept, expectedAmount, inspectedAt });
      await assert.rejects(decide(admin, true), { statusCode: 403 });
      await assert.rejects(decide(customer, true, 200000), { statusCode: 409 });
      await decide(customer, false);
      await db.cameraItem.update({ where: { id: item.id }, data: { status: 'MAINTENANCE', shutterCount: 500, scratchNotes: 'New stock record' } });
      result = await inspect(payment.bookingId, 50000);
      const current = await db.cameraItem.findUnique({ where: { id: item.id } });
      assert.equal(current.status, 'MAINTENANCE'); assert.equal(current.shutterCount, 500); assert.equal(current.scratchNotes, 'New stock record');
      await decide(customer, true, 50000);
      gateway.queryResult = { return_code: 1 };
      result = await ops.requestRefund(payment.bookingId, customer, crypto.randomUUID());
      assert.equal(result.refunds[0].amount, 950000); assert.equal(result.depositStatus, 'DEDUCTED');
    });

    await t.test('cancellation uses frozen policy and a lost refund response reuses its one provider request', async () => {
      const payment = await paid(await unit(), day(4), day(5));
      await ops.cancel(payment.bookingId, customer, op('Hủy trước ngày nhận thiết bị.'));
      const before = gateway.refundCalls.length;
      gateway.loseRefund = true; gateway.queryResult = { return_code: 2, sub_return_code: -101 };
      let result = await ops.requestRefund(payment.bookingId, customer, crypto.randomUUID());
      assert.equal(result.refunds[0].amount, payment.totalAmount);
      const original = result.refunds[0].mRefundId;
      await ops.requestRefund(payment.bookingId, customer, crypto.randomUUID());
      assert.equal(gateway.refundCalls.length, before + 1);
      gateway.loseRefund = false; gateway.queryResult = { return_code: 1 };
      await ops.reconcileRefund(result.refunds[0].id, true);
      result = await ops.detail(payment.bookingId, customer);
      assert.equal(result.refunds[0].mRefundId, original); assert.equal(result.depositStatus, 'REFUNDED');
    });

    await t.test('known rejection permits a new refund and merchant mismatch prevents submission', async () => {
      const payment = await paid(await unit(), day(4), day(5));
      await ops.cancel(payment.bookingId, customer, op());
      await db.paymentAttempt.update({ where: { bookingId: payment.bookingId }, data: { merchantAppId: 999999 } });
      await assert.rejects(ops.requestRefund(payment.bookingId, admin, crypto.randomUUID()), /Merchant/);
      await db.paymentAttempt.update({ where: { bookingId: payment.bookingId }, data: { merchantAppId: gateway.appId } });
      gateway.refundResult = { return_code: 2, sub_return_code: -14 };
      let result = await ops.requestRefund(payment.bookingId, customer, crypto.randomUUID());
      assert.equal(result.refunds[0].status, 'FAILED'); assert.equal(result.refunds[0].activeBookingId, null); assert.equal(result.depositStatus, 'HELD');
      gateway.refundResult = { return_code: 1 }; gateway.queryResult = { return_code: 1 };
      result = await ops.requestRefund(payment.bookingId, customer, crypto.randomUUID());
      assert.equal(result.refunds.length, 2); assert.equal(result.depositStatus, 'REFUNDED');
    });
  } finally {
    await db.paymentAttempt.deleteMany({ where: { user: { email: { endsWith: `${suffix}@example.test` } } } });
    await db.rentalBooking.deleteMany({ where: { user: { email: { endsWith: `${suffix}@example.test` } } } });
    await db.cameraItem.deleteMany({ where: { serialNumber: { startsWith: `OPS-${suffix}-` } } });
    await db.product.deleteMany({ where: { slug: `ops-${suffix}` } });
    await db.user.deleteMany({ where: { email: { endsWith: `${suffix}@example.test` } } });
    await db.$disconnect();
  }
});
