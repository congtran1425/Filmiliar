import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

const url = process.env.PAYMENT_TEST_DATABASE_URL;
test(
  'bundle HTTP routes enforce consent, owner, admin and contact checks; lists count one whole order',
  { skip: !url },
  async () => {
    assert.equal(new URL(url).pathname, '/filmiliar_payment_test');
    Object.assign(process.env, {
      DATABASE_URL: url,
      JWT_SECRET: 'isolated-bundle-http-key-at-least-32-characters',
      FILMILIAR_TEST_MODE: 'routes',
      PAYMENT_MODE: 'sandbox',
      ZALOPAY_APP_ID: '123456',
      ZALOPAY_KEY1: 'isolated-provider-key1-at-least-32-characters',
      ZALOPAY_KEY2: 'isolated-provider-key2-at-least-32-characters',
      ZALOPAY_CALLBACK_URL: 'https://example.test/callback',
    });
    const nativeFetch = globalThis.fetch;
    let creates = 0;
    globalThis.fetch = async (target, init) => {
      if (String(target).startsWith('https://sb-openapi.zalopay.vn/')) {
        if (String(target).endsWith('/create')) {
          creates++;
          return new Response('{"return_code":1,"qr_code":"isolated-bundle-qr"}');
        }
        return new Response('{"return_code":3}');
      }
      return nativeFetch(target, init);
    };
    const [{ app }, { createSessionToken, hashPassword }, { SandboxPaymentFlow }] = await Promise.all([
      import('../dist/index.js'),
      import('../dist/auth.js'),
      import('../dist/services/payment-flow.js'),
    ]);
    const db = new PrismaClient({ datasources: { db: { url } } });
    const suffix = crypto.randomBytes(5).toString('hex'),
      users = [],
      models = [];
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, token, method = 'GET', body) => {
      const response = await nativeFetch(base + path, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    const day = (offset) => new Date(Date.now() + 7 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
    try {
      for (const role of ['ADMIN', 'CUSTOMER', 'CUSTOMER'])
        users.push(
          await db.user.create({
            data: {
              email: `bundle-http-${users.length}-${suffix}@example.test`,
              role,
              fullName: 'Bundle HTTP test',
              passwordHash: hashPassword('isolated-password'),
            },
          }),
        );
      const [admin, customer, stranger] = users;
      const [adminToken, token, otherToken] = users.map(createSessionToken);
      for (const [slug, categoryName, dailyRentalRate] of [
        ['sony-zv-e10', 'Mirrorless', 170000],
        ['sony-fe-50mm-f1-8', 'Lens', 70000],
      ]) {
        models.push(
          await db.product.create({
            data: {
              slug,
              modelName: slug,
              categoryName,
              brand: 'Fixture',
              dailyRentalRate,
              weightGrams: 400,
              recommendedPurpose: 'Isolated HTTP test',
              referenceUsedPrice: 10000000,
            },
          }),
        );
      }
      const units = await Promise.all(
        models.map((model, i) =>
          db.cameraItem.create({
            data: {
              modelId: model.id,
              serialNumber: `BUNDLE-HTTP-${suffix}-${i}`,
              conditionGrade: '96%',
              opticsCondition: 'Checked',
              scratchNotes: 'Recorded',
              depositAmount: 1000000,
            },
          }),
        ),
      );
      const selection = {
        cameraItemIds: units.map((u) => u.id),
        startDate: day(10),
        endDate: day(11),
        startTime: '08:00',
        endTime: '09:00',
      };
      const query = new URLSearchParams({
        unitIds: selection.cameraItemIds.join(','),
        startDate: selection.startDate,
        endDate: selection.endDate,
        startTime: '08:00',
        endTime: '09:00',
      });
      const result = await call(`/api/rental/bundle-quote?${query}`);
      assert.equal(result.status, 200);
      const quote = result.body.data;
      assert.equal(quote.totalDays, 2);
      assert.equal(quote.rentalFee, 480000);
      assert.equal(quote.depositAmount, 2000000);
      assert.equal((await call('/api/rental/bundle-quote?unitIds=0&startDate=x&endDate=y')).status, 400);
      assert.equal((await call(`/api/rental/bundle-quote?${query}&amount=1`)).status, 400);
      assert.equal((await call(`/api/payment/bundle/active?${query}`)).status, 401);
      const input = { ...selection, quoteHash: quote.quoteHash, clientRequestId: crypto.randomUUID() };
      assert.equal((await call('/api/payment/bundle/create', token, 'POST', input)).status, 400);
      assert.equal(
        (await call('/api/payment/bundle/create', token, 'POST', { ...input, termsAccepted: false })).status,
        400,
      );
      assert.equal(
        (await call('/api/payment/bundle/create', token, 'POST', { ...input, termsAccepted: true })).status,
        409,
      );
      assert.equal(creates, 0);
      await db.user.update({ where: { id: customer.id }, data: { phone: '0912345678' } });
      const created = await call('/api/payment/bundle/create', token, 'POST', {
        ...input,
        termsAccepted: true,
      });
      assert.equal(created.status, 200);
      assert.equal(creates, 1);
      const payment = created.body.data;
      assert.equal(
        (await call('/api/payment/bundle/create', token, 'POST', { ...input, termsAccepted: true })).body.data
          .bookingId,
        payment.bookingId,
      );
      assert.equal(creates, 1);
      await db.user.update({ where: { id: customer.id }, data: { phone: null } });
      assert.equal(
        (await call('/api/payment/bundle/create', token, 'POST', { ...input, termsAccepted: true })).status,
        200,
      );
      assert.equal(
        (await call(`/api/payment/bundle/active?${query}`, token)).body.data.bundleId,
        payment.bundleId,
      );
      assert.equal((await call(`/api/payment/booking/${payment.bookingId}`, otherToken)).status, 404);
      assert.equal(
        (await call(`/api/payment/booking/${payment.bookingId}`, token)).body.data.totalAmount,
        2480000,
      );
      assert.equal((await call(`/api/rental/bundles/${payment.bundleId}`, otherToken)).status, 404);
      assert.equal(
        (await call(`/api/admin/rental-bundles/${payment.bundleId}/handover`, token, 'POST', {})).status,
        403,
      );
      assert.equal(
        (await call(`/api/admin/rental-bundles/${payment.bundleId}/handover`, adminToken, 'POST', {})).status,
        400,
      );
      const detail = (await call(`/api/rental/bundles/${payment.bundleId}`, token)).body.data;
      assert.equal(detail.bookings.length, 2);
      const list = (await call('/api/user/rentals', token)).body.data;
      assert.equal(list.length, 1);
      assert.equal(list[0].bundleSummary.count, 2);
      assert.equal(list[0].bundleSummary.depositAmount, 2000000);
      const adminList = (await call(`/api/admin/bookings?q=${units[1].serialNumber}`, adminToken)).body.data;
      assert.equal(adminList.length, 1);
      assert.equal(adminList[0].bundleSummary.id, payment.bundleId);
      const otherMember = detail.bookings.find((b) => b.id !== payment.bookingId);
      await assert.rejects(
        db.rentalBooking.update({ where: { id: otherMember.id }, data: { rescheduleCount: 1 } }),
        undefined,
        'database rejects changing just one member schedule',
      );
      assert.equal(
        (await db.rentalBooking.findUniqueOrThrow({ where: { id: otherMember.id } })).rescheduleCount,
        0,
      );
    const before = (await call('/api/admin/stats', adminToken)).body.stats;
      const flow = new SandboxPaymentFlow(db, { appId: 123456 });
      await flow.handleCallback({
        app_id: 123456,
        app_trans_id: payment.appTransId,
        amount: payment.totalAmount,
        zp_trans_id: '888888888888888888',
      });
    const after = (await call('/api/admin/stats', adminToken)).body.stats;
      assert.equal(after.sandboxHeldDepositAmount - before.sandboxHeldDepositAmount, 2000000);
      assert.equal(
        (await call('/api/admin/bookings?status=CONFIRMED', adminToken)).body.data.filter(
          (b) => b.bundleSummary?.id === payment.bundleId,
        ).length,
        1,
      );
      assert.equal(
        (
          await call(`/api/rental/bookings/${otherMember.id}/cancel`, token, 'POST', {
            requestId: crypto.randomUUID(),
            note: 'Cannot cancel only one item',
          })
        ).status,
        409,
      );
    } finally {
      globalThis.fetch = nativeFetch;
      if (users.length) {
        const ids = users.map((u) => u.id);
        await db.paymentAttempt.deleteMany({ where: { userId: { in: ids } } });
        await db.rentalBooking.deleteMany({ where: { userId: { in: ids } } });
        await db.rentalBundle.deleteMany({ where: { userId: { in: ids } } });
      }
      if (models.length) await db.product.deleteMany({ where: { id: { in: models.map((m) => m.id) } } });
      if (users.length) await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
      await db.$disconnect();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
