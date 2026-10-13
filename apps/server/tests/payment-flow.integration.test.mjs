import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { SandboxPaymentFlow } from '../dist/services/payment-flow.js';

const databaseUrl = process.env.PAYMENT_TEST_DATABASE_URL;

test('Sandbox payment reservation, idempotency and reconciliation on isolated Postgres', { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl);
  assert.match(target.pathname, /^\/filmiliar_payment_test$/);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = crypto.randomBytes(5).toString('hex');
  const tomorrow = new Date(Date.now() + 7 * 3600000 + 86400000).toISOString().slice(0, 10);
  const afterTomorrow = new Date(Date.now() + 7 * 3600000 + 2 * 86400000).toISOString().slice(0, 10);
  const gateway = {
    appId: 123456,
    failCreate: false,
    queryResult: { return_code: 3 },
    createCount: 0,
    async createPayment() {
      this.createCount++;
      if (this.failCreate) throw new Error('Response lost');
      return { return_code: 1, qr_code: 'sandbox-qr' };
    },
    async checkOrderStatus() { return this.queryResult; },
    verifyCallback() { return true; },
    parseCallback() { throw new Error('unused'); }
  };
  const flow = new SandboxPaymentFlow(prisma, gateway);
  try {
    const customer = await prisma.user.create({ data: { email: `payment-customer-${suffix}@example.test`, fullName: 'Payment Customer', passwordHash: 'test-only' } });
    const second = await prisma.user.create({ data: { email: `payment-second-${suffix}@example.test`, fullName: 'Second Customer', passwordHash: 'test-only' } });
    const product = await prisma.product.create({ data: {
      slug: `payment-product-${suffix}`, modelName: 'Payment test camera', brand: 'Filmiliar', categoryName: 'Camera',
      weightGrams: 500, recommendedPurpose: 'Integration test', dailyRentalRate: 250000, referenceUsedPrice: 5000000
    } });
    const units = await Promise.all([1, 2, 3, 4, 5].map((n) => prisma.cameraItem.create({ data: {
      modelId: product.id, serialNumber: `PAY-TEST-${suffix}-${n}`, conditionGrade: 'A',
      opticsCondition: 'test', scratchNotes: 'test', depositAmount: 1000000
    } })));
    const input = (unit, clientRequestId = crypto.randomUUID()) => ({ cameraItemId: unit.id, startDate: tomorrow, endDate: afterTomorrow, clientRequestId });

    const request = input(units[0]);
    const paidView = await flow.create(customer.id, request);
    await assert.rejects(flow.create(second.id, input(units[0])), { statusCode: 409 });
    assert.equal(paidView.totalAmount, 1250000);
    assert.equal(paidView.paymentStatus, 'WAITING');
    assert.equal((await prisma.cameraItem.findUnique({ where: { id: units[0].id } })).status, 'RESERVED');
    assert.equal((await flow.create(customer.id, request)).bookingId, paidView.bookingId);
    assert.equal(gateway.createCount, 1);
    await assert.rejects(flow.getForUser(second.id, paidView.bookingId), { statusCode: 404 });

    const paidCallback = { app_id: 123456, app_trans_id: paidView.appTransId, amount: paidView.totalAmount, zp_trans_id: '98765432109876543', embed_data: JSON.stringify({ bookingId: paidView.bookingId }) };
    assert.equal(await flow.handleCallback(paidCallback), true);
    assert.equal(await flow.handleCallback(paidCallback), true);
    assert.equal((await flow.getForUser(customer.id, paidView.bookingId)).paymentStatus, 'PAID');
    assert.equal((await prisma.rentalBooking.findUnique({ where: { id: paidView.bookingId } })).status, 'CONFIRMED');
    assert.equal((await prisma.cameraItem.findUnique({ where: { id: units[0].id } })).status, 'RESERVED');

    const failed = await flow.create(customer.id, input(units[1]));
    await prisma.paymentAttempt.update({ where: { bookingId: failed.bookingId }, data: { expiresAt: new Date(Date.now() - 3 * 60_000) } });
    gateway.queryResult = { return_code: 2 };
    await flow.reconcileForUser(customer.id, failed.bookingId);
    assert.equal((await flow.getForUser(customer.id, failed.bookingId)).paymentStatus, 'FAILED');
    assert.equal((await prisma.cameraItem.findUnique({ where: { id: units[1].id } })).status, 'AVAILABLE');
    await flow.handleCallback({ ...paidCallback, app_trans_id: failed.appTransId, bookingId: failed.bookingId, embed_data: JSON.stringify({ bookingId: failed.bookingId }), zp_trans_id: '98765432109876544' });
    assert.equal((await flow.getForUser(customer.id, failed.bookingId)).paymentStatus, 'REVIEW');
    assert.equal((await prisma.cameraItem.findUnique({ where: { id: units[1].id } })).status, 'AVAILABLE');

    const mismatch = await flow.create(customer.id, input(units[2]));
    await flow.handleCallback({ ...paidCallback, app_trans_id: mismatch.appTransId, amount: mismatch.totalAmount + 1, zp_trans_id: '98765432109876545', embed_data: JSON.stringify({ bookingId: mismatch.bookingId }) });
    assert.equal((await flow.getForUser(customer.id, mismatch.bookingId)).paymentStatus, 'REVIEW');
    assert.equal((await prisma.rentalBooking.findUnique({ where: { id: mismatch.bookingId } })).status, 'PENDING_PAYMENT');

    gateway.failCreate = true;
    gateway.queryResult = { return_code: 1, amount: 1250000, zp_trans_id: '98765432109876546' };
    const lost = await flow.create(customer.id, input(units[3]));
    assert.equal(lost.paymentStatus, 'CREATING');
    await flow.reconcileForUser(customer.id, lost.bookingId);
    assert.equal((await flow.getForUser(customer.id, lost.bookingId)).paymentStatus, 'PAID');

    gateway.failCreate = false;
    const race = await Promise.allSettled([flow.create(customer.id, input(units[4])), flow.create(second.id, input(units[4]))]);
    assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(race.filter((result) => result.status === 'rejected').length, 1);
    assert.equal((await prisma.cameraItem.findUnique({ where: { id: units[4].id } })).status, 'RESERVED');
  } finally {
    await prisma.paymentAttempt.deleteMany({ where: { user: { email: { endsWith: `${suffix}@example.test` } } } });
    await prisma.rentalBooking.deleteMany({ where: { user: { email: { endsWith: `${suffix}@example.test` } } } });
    await prisma.cameraItem.deleteMany({ where: { serialNumber: { startsWith: `PAY-TEST-${suffix}` } } });
    await prisma.product.deleteMany({ where: { slug: `payment-product-${suffix}` } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@example.test` } } });
    await prisma.$disconnect();
  }
});
