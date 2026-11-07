import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

const url = process.env.PAYMENT_TEST_DATABASE_URL;
test(
  'public quiz validates answers, filters the real catalog, exposes correct prices and writes no transactions',
  { skip: !url },
  async () => {
    assert.equal(new URL(url).pathname, '/filmiliar_payment_test');
    Object.assign(process.env, {
      DATABASE_URL: url,
      JWT_SECRET: 'isolated-quiz-http-key-at-least-32-characters',
      PAYMENT_MODE: 'disabled',
      FILMILIAR_TEST_MODE: 'routes',
    });
    const { app } = await import('../dist/index.js'),
      db = new PrismaClient({ datasources: { db: { url } } }),
      suffix = crypto.randomBytes(5).toString('hex'),
      models = [];
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const call = async (body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/quiz/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };
    try {
      const create = async (changes = {}) => {
        const product = await db.product.create({
          data: {
            slug: `quiz-${models.length}-${suffix}`,
            modelName: 'Quiz fixture',
            brand: 'Fixture',
            categoryName: 'Mirrorless',
            recommendedPurpose: 'Du lịch, chụp chân dung',
            weightGrams: 400,
            dailyRentalRate: 200000,
            referenceUsedPrice: 10000000,
            ...changes,
          },
        });
        models.push(product);
        await db.cameraItem.create({
          data: {
            modelId: product.id,
            serialNumber: 'QUIZ-' + product.slug,
            conditionGrade: '96%',
            opticsCondition: 'Recorded',
            scratchNotes: 'Recorded',
            depositAmount: 1000000,
          },
        });
        return product;
      };
      const good = await create(),
        concert = await create({ recommendedPurpose: 'Đi Concert / Đu Idol', dailyRentalRate: 350000 });
      await create({ isPublished: false });
      await create({ categoryName: 'Lens' });
      const sold = await create();
      await db.cameraItem.updateMany({ where: { modelId: sold.id }, data: { status: 'SOLD' } });
      const before = {
        bookings: await db.rentalBooking.count(),
        payments: await db.paymentAttempt.count(),
        orders: await db.order.count(),
      };
      for (const body of [
        {},
        { purpose: 'TRAVEL', intent: 'BUY' },
        { intent: 'RENT', purpose: 'TRAVEL', maxBudgetVnd: -1 },
        { intent: 'RENT', purpose: 'TRAVEL', maxBudgetVnd: 200000, override: true },
      ])
        assert.equal((await call(body)).status, 400);
      const input = { intent: 'RENT', purpose: 'TRAVEL', maxBudgetVnd: 200000 };
      const result = await call(input);
      assert.equal(result.status, 200);
      assert.deepEqual(
        result.body.recommendation.matches.map((m) => m.slug),
        [good.slug],
      );
      assert.equal(result.body.recommendation.matches[0].priceVnd, 200000);
      assert.ok(result.body.recommendation.matches[0].unitId > 0);
      assert.equal(JSON.stringify(result.body).includes('depositRequired'), false);
      assert.equal(JSON.stringify(result.body).includes('conditionPercent'), false);
      const empty = await call({ ...input, purpose: 'CONCERT' });
      assert.deepEqual(empty.body.recommendation.matches, []);
      assert.equal(empty.body.recommendation.minimumMatchingPrice, 350000);
      assert.equal(
        (await call({ ...input, purpose: 'CONCERT', maxBudgetVnd: 350000 })).body.recommendation.matches[0]
          .slug,
        concert.slug,
      );
      assert.equal(
        (await call({ ...input, intent: 'BUY', maxBudgetVnd: 10000000 })).body.recommendation.matches[0]
          .priceVnd,
        10000000,
      );
      assert.deepEqual(
        {
          bookings: await db.rentalBooking.count(),
          payments: await db.paymentAttempt.count(),
          orders: await db.order.count(),
        },
        before,
      );
    } finally {
      if (models.length) await db.product.deleteMany({ where: { id: { in: models.map((m) => m.id) } } });
      await db.$disconnect();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
