import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.PAYMENT_TEST_DATABASE_URL;

test('admin routes enforce roles, keep identity fields private, and guard inventory transitions', { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl);
  assert.equal(target.pathname, '/filmiliar_payment_test');
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = 'isolated-admin-route-test-key-at-least-32-characters';
  process.env.PAYMENT_MODE = 'disabled';
  process.env.FILMILIAR_TEST_MODE = 'routes';
  process.env.CORS_ORIGIN = 'http://localhost:5173';

  const [{ app }, { createSessionToken, hashPassword }] = await Promise.all([
    import('../dist/index.js'), import('../dist/auth.js')
  ]);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = crypto.randomBytes(5).toString('hex');
  const server = app.listen(0, '127.0.0.1');
  if (!server.listening) await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const call = async (path, token, method = 'GET', body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, body: await response.json() };
  };

  try {
    const admin = await prisma.user.create({ data: {
      email: `admin-route-${suffix}@example.test`, fullName: 'Admin route test', role: 'ADMIN',
      passwordHash: hashPassword('test-admin-password')
    } });
    const customer = await prisma.user.create({ data: {
      email: `customer-route-${suffix}@example.test`, fullName: 'Customer route test', role: 'CUSTOMER',
      passwordHash: hashPassword('test-customer-password'), idCardNumber: '012345678901',
      idCardFrontUrl: 'https://example.test/private-document'
    } });
    const product = await prisma.product.create({ data: {
      slug: `admin-route-${suffix}`, modelName: 'Admin route camera', brand: 'Filmiliar', categoryName: 'Camera',
      weightGrams: 500, recommendedPurpose: 'Integration test', dailyRentalRate: 250000, referenceUsedPrice: 5000000
    } });
    const adminToken = createSessionToken(admin);
    const customerToken = createSessionToken(customer);
    assert.equal((await call('/api/admin/models')).status, 401);
    assert.equal((await call('/api/admin/models', customerToken)).status, 403);
    const models = await call('/api/admin/models', adminToken);
    assert.equal(models.status, 200);
    assert.ok(models.body.data.some((model) => model.id === product.id));

    const users = await call(`/api/admin/users?q=${suffix}`, adminToken);
    assert.equal(users.status, 200);
    const listedCustomer = users.body.data.find((user) => user.id === customer.id);
    assert.ok(listedCustomer);
    assert.equal('idCardNumber' in listedCustomer, false);
    assert.equal('idCardFrontUrl' in listedCustomer, false);

    const item = { serialNumber: `ADMIN-TEST-${suffix}`, modelId: product.id, conditionGrade: 'A',
      depositAmount: 0, opticsCondition: 'Checked', scratchNotes: 'None' };
    assert.equal((await call('/api/admin/inventory', adminToken, 'POST', { ...item, status: 'AVAILABLE' })).status, 400);
    const created = await call('/api/admin/inventory', adminToken, 'POST', item);
    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, 'MAINTENANCE');
    assert.equal((await call(`/api/admin/inventory/${item.serialNumber}`, customerToken, 'PATCH', { status: 'AVAILABLE' })).status, 403);
    assert.equal((await call(`/api/admin/inventory/${item.serialNumber}`, adminToken, 'PATCH', { status: 'RENTED' })).status, 400);
    const opened = await call(`/api/admin/inventory/${item.serialNumber}`, adminToken, 'PATCH', { status: 'AVAILABLE' });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.data.status, 'AVAILABLE');
    const booking = await prisma.rentalBooking.create({ data: {
      bookingCode: `BK-ADMIN-${suffix}`, userId: customer.id, cameraItemId: created.body.data.id,
      startDate: new Date('2026-11-01T00:00:00.000Z'), endDate: new Date('2026-11-02T00:00:00.000Z'),
      totalDays: 1, dailyRate: 250000, totalRentalFee: 250000, depositAmount: 0, status: 'CONFIRMED'
    } });
    assert.equal((await call(`/api/admin/inventory/${item.serialNumber}`, adminToken, 'PATCH', { status: 'MAINTENANCE' })).status, 409);
    await prisma.rentalBooking.delete({ where: { id: booking.id } });
    assert.equal((await call(`/api/admin/inventory/${item.serialNumber}`, adminToken, 'PATCH', { status: 'MAINTENANCE' })).status, 200);

    assert.equal((await call(`/api/admin/users/${customer.id}/role`, adminToken, 'PATCH', { role: 'ADMIN' })).status, 503);
    assert.equal((await call(`/api/admin/users/${customer.id}/kyc`, adminToken, 'PATCH', { kycStatus: 'VERIFIED' })).status, 503);
    assert.equal((await call('/api/admin/bookings/unknown/status', adminToken, 'PATCH', { status: 'COMPLETED' })).status, 503);
    assert.equal((await call('/api/admin/orders/unknown/status', adminToken, 'PATCH', { status: 'PAID' })).status, 503);
    assert.equal((await call('/api/user/kyc', customerToken, 'POST', { idCardNumber: '012345678901' })).status, 503);
    assert.equal((await prisma.user.findUnique({ where: { id: customer.id } })).role, 'CUSTOMER');
  } finally {
    await prisma.rentalBooking.deleteMany({ where: { bookingCode: `BK-ADMIN-${suffix}` } });
    await prisma.cameraItem.deleteMany({ where: { serialNumber: `ADMIN-TEST-${suffix}` } });
    await prisma.product.deleteMany({ where: { slug: `admin-route-${suffix}` } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@example.test` } } });
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
  }
});
