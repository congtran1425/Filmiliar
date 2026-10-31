import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.PAYMENT_TEST_DATABASE_URL;
test('customer Sandbox checkout validates consent and quote; admin calendar is private and versioned', { skip: !databaseUrl }, async () => {
  assert.equal(new URL(databaseUrl).pathname, '/filmiliar_payment_test');
  Object.assign(process.env, { DATABASE_URL: databaseUrl, JWT_SECRET: 'isolated-rental-route-test-key-at-least-32-characters', FILMILIAR_TEST_MODE: 'routes', PAYMENT_MODE: 'sandbox',
    ZALOPAY_APP_ID: '123456', ZALOPAY_KEY1: 'isolated-provider-key1-at-least-32-characters', ZALOPAY_KEY2: 'isolated-provider-key2-at-least-32-characters', ZALOPAY_CALLBACK_URL: 'https://example.test/callback' });
  const nativeFetch = globalThis.fetch;
  let creates = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://sb-openapi.zalopay.vn/')) {
      if (String(url).endsWith('/create')) { creates++; return new Response('{"return_code":1,"qr_code":"isolated-qr"}'); }
      return new Response('{"return_code":3}');
    }
    return nativeFetch(url, init);
  };
  const [{ app }, { createSessionToken, hashPassword }] = await Promise.all([import('../dist/index.js'), import('../dist/auth.js')]);
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = crypto.randomBytes(5).toString('hex');
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, token, method = 'GET', body) => {
    const response = await nativeFetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const day = n => new Date(Date.now() + 7 * 3600000 + n * 86400000).toISOString().slice(0, 10);
  try {
    const [admin, customer, stranger] = await Promise.all(['ADMIN','CUSTOMER','CUSTOMER'].map((role,i) => db.user.create({ data: { email: `route-${i}-${suffix}@example.test`, fullName: 'Rental route test', role, passwordHash: hashPassword('isolated-password') } })));
    const [adminToken, token, otherToken] = [admin,customer,stranger].map(createSessionToken);
    const product = await db.product.create({ data: { slug: `rental-route-${suffix}`, modelName: 'Route test camera', brand: 'Filmiliar', categoryName: 'Camera', weightGrams: 500, recommendedPurpose: 'Test', dailyRentalRate: 250000, referenceUsedPrice: 5000000 } });
    const unit = await db.cameraItem.create({ data: { modelId: product.id, serialNumber: `ROUTE-${suffix}`, conditionGrade: 'A', opticsCondition: 'Good', scratchNotes: 'Good', depositAmount: 1000000 } });
    assert.equal((await call('/api/admin/rental-units')).status, 401);
    assert.equal((await call('/api/admin/rental-units', token)).status, 403);
    assert.equal((await call(`/api/admin/rental-units/${unit.id}/deposit`, token, 'PATCH', { depositAmount: 1 })).status, 403);
    const capability = await call('/api/payment/capabilities', token);
    assert.equal(capability.body.sandboxEnabled, true);
    const quote = (await call(`/api/rental/quote/${unit.id}?startDate=${day(10)}&endDate=${day(11)}`)).body.data;
    assert.equal(quote.totalAmount, 1250000);
    assert.equal(quote.available, true);
    const input = { cameraItemId: unit.id, startDate: day(10), endDate: day(11), clientRequestId: crypto.randomUUID(), quoteHash: quote.quoteHash };
    assert.equal((await call('/api/payment/create', token, 'POST', input)).status, 400);
    assert.equal((await call('/api/payment/create', token, 'POST', { ...input, termsAccepted: false })).status, 400);
    assert.equal((await call('/api/payment/create', token, 'POST', { ...input, quoteHash: '0'.repeat(64), termsAccepted: true })).status, 409);
    assert.equal(creates, 0);
    const created = await call('/api/payment/create', token, 'POST', { ...input, termsAccepted: true });
    assert.equal(created.status, 200); assert.equal(creates, 1);
    assert.equal((await call('/api/payment/create', token, 'POST', { ...input, termsAccepted: true })).body.data.bookingId, created.body.data.bookingId);
    assert.equal(creates, 1);
    assert.equal((await call(`/api/rental/bookings/${created.body.data.bookingId}`, otherToken)).status, 404);
    assert.equal((await call(`/api/rental/bookings/${created.body.data.bookingId}`, token)).status, 200);
    const calendar = await call(`/api/rental/calendar/${unit.id}?from=${day(0)}&to=${day(20)}`);
    assert.equal(calendar.body.data.ranges.length, 1);
    assert.equal(JSON.stringify(calendar.body).includes(customer.email), false);
    assert.equal((await call(`/api/admin/rental-calendar/${unit.id}`, token)).status, 403);
    const blockInput = { requestId: crypto.randomUUID(), startDate: day(15), endDate: day(16), reason: 'Lịch ngoài website' };
    const block = await call(`/api/admin/rental-calendar/${unit.id}/blocks`, adminToken, 'POST', blockInput);
    assert.equal(block.status, 200);
    assert.equal((await call(`/api/admin/rental-calendar/${unit.id}/blocks`, adminToken, 'POST', blockInput)).body.data.id, block.body.data.id);
    assert.equal((await call(`/api/admin/rental-calendar/${unit.id}/blocks`, adminToken, 'POST', { ...blockInput, requestId: crypto.randomUUID() })).status, 409);
    assert.equal((await call(`/api/admin/rental-blocks/${block.body.data.id}/release`, adminToken, 'PATCH')).status, 200);
    const policy = (await call('/api/admin/rental-policy', adminToken)).body.data;
    // A stale editor must not overwrite policy; leave shared values unchanged for concurrent files.
    const change = { version: policy.version + 1000000, terms: policy.terms, returnBufferDays: policy.returnBufferDays, cancellationRefund: policy.cancellationRefund };
    assert.equal((await call('/api/admin/rental-policy', adminToken, 'PATCH', change)).status, 409);
  } finally {
    globalThis.fetch = nativeFetch;
    await db.paymentAttempt.deleteMany({ where: { user: { email: { endsWith: `${suffix}@example.test` } } } });
    await db.rentalBooking.deleteMany({ where: { user: { email: { endsWith: `${suffix}@example.test` } } } });
    await db.cameraItem.deleteMany({ where: { serialNumber: `ROUTE-${suffix}` } });
    await db.product.deleteMany({ where: { slug: `rental-route-${suffix}` } });
    await db.user.deleteMany({ where: { email: { endsWith: `${suffix}@example.test` } } });
    await db.$disconnect();
    await new Promise(resolve => server.close(resolve));
  }
});
