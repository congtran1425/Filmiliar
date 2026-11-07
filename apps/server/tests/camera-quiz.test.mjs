import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quizSchema, recommendCameras } from '../dist/services/camera-quiz.js';

const camera = (id, changes = {}) => ({
  id,
  slug: 'camera-' + id,
  modelName: 'Camera ' + id,
  brand: 'Fixture',
  categoryName: 'Mirrorless',
  isPublished: true,
  recommendedPurpose: 'Du lịch, chụp chân dung, học nhiếp ảnh',
  dailyRentalRate: 200000,
  referenceUsedPrice: 10000000n,
  thumbnailUrl: null,
  units: [{ id: id * 10, status: 'AVAILABLE' }],
  ...changes,
});
const answers = (changes = {}) => ({ intent: 'RENT', purpose: 'TRAVEL', maxBudgetVnd: 200000, ...changes });

test('quiz requires explicit intent and explicit budget choice without converting rent into buy', () => {
  for (const invalid of [
    { purpose: 'TRAVEL', maxBudgetVnd: 200000 },
    answers({ maxBudgetVnd: undefined }),
    answers({ purpose: 'INVALID' }),
    answers({ maxBudgetVnd: -1 }),
    answers({ maxBudgetVnd: '200000' }),
    { ...answers(), experienceLevel: 'ADVANCED' },
  ])
    assert.equal(quizSchema.safeParse(invalid).success, false);
  assert.equal(quizSchema.safeParse(answers({ maxBudgetVnd: null })).success, true);
  const result = recommendCameras([camera(1)], answers({ maxBudgetVnd: 500000 }));
  assert.equal(result.intent, 'RENT');
  assert.equal(result.matches[0].priceVnd, 200000);
});
test('rental and purchase budgets use different prices and preserve the exact cap', () => {
  const items = [
    camera(1, { dailyRentalRate: 200000, referenceUsedPrice: 11000000n }),
    camera(2, { dailyRentalRate: 200001, referenceUsedPrice: 10000000n }),
  ];
  assert.deepEqual(
    recommendCameras(items, answers()).matches.map((m) => m.slug),
    ['camera-1'],
  );
  const buy = recommendCameras(items, answers({ intent: 'BUY', maxBudgetVnd: 10000000 }));
  assert.deepEqual(
    buy.matches.map((m) => m.slug),
    ['camera-2'],
  );
  assert.equal(buy.matches[0].priceVnd, 10000000);
});
test('travel and concert remain distinct; an over-budget match does not become an unrelated cheap recommendation', () => {
  const items = [
    camera(1),
    camera(2, { recommendedPurpose: 'Đi Concert / Đu Idol', dailyRentalRate: 350000 }),
  ];
  const concert = recommendCameras(items, answers({ purpose: 'CONCERT' }));
  assert.equal(concert.emptyReason, 'OVER_BUDGET');
  assert.equal(concert.minimumMatchingPrice, 350000);
  assert.deepEqual(concert.matches, []);
  assert.ok(concert.concertAdvice.includes('ống kính'));
  assert.equal(
    recommendCameras(items, answers({ purpose: 'CONCERT', maxBudgetVnd: 350000 })).matches[0].slug,
    'camera-2',
  );
  assert.equal(recommendCameras(items, answers()).matches[0].slug, 'camera-1');
});
test('unpublished, lens, sold, maintenance and nonexistent inventory cannot be recommended', () => {
  const items = [
    camera(1, { isPublished: false }),
    camera(2, { categoryName: 'Lens' }),
    camera(3, { categoryName: 'Ống kính' }),
    camera(4, { units: [{ id: 40, status: 'SOLD' }] }),
    camera(5, { units: [{ id: 50, status: 'MAINTENANCE' }] }),
    camera(6, { units: [] }),
    camera(7, { units: [{ id: -1, status: 'AVAILABLE' }] }),
  ];
  assert.deepEqual(recommendCameras(items, answers()).matches, []);
});
test('buy suggestions exclude committed units while rental suggestions require a later date check', () => {
  const items = [
    camera(1, {
      units: [
        { id: 11, status: 'RENTED' },
        { id: 12, status: 'RESERVED' },
      ],
    }),
    camera(2, {
      units: [
        { id: 22, status: 'RENTED' },
        { id: 23, status: 'AVAILABLE' },
      ],
    }),
  ];
  assert.deepEqual(
    recommendCameras(items, answers({ intent: 'BUY', maxBudgetVnd: null })).matches.map((m) => m.slug),
    ['camera-2'],
  );
  const rent = recommendCameras(items, answers());
  assert.equal(rent.matches.length, 2);
  assert.equal(rent.matches[1].unitId, 23);
  assert.equal(Object.hasOwn(rent.matches[0], 'available'), false);
});
test('results are stable, limited, cheapest first and do not fabricate a match on an empty catalog', () => {
  const items = [
    camera(5, { dailyRentalRate: 180000 }),
    camera(4, { dailyRentalRate: 150000 }),
    camera(3, { dailyRentalRate: 150000 }),
    camera(2, { dailyRentalRate: 170000 }),
  ];
  const snapshot = structuredClone(items);
  assert.deepEqual(
    recommendCameras(items, answers({ maxBudgetVnd: null })).matches.map((m) => m.slug),
    ['camera-3', 'camera-4', 'camera-2'],
  );
  assert.deepEqual(items, snapshot);
  assert.equal(recommendCameras([], answers()).emptyReason, 'NO_MATCH');
  assert.equal(
    recommendCameras([camera(1, { recommendedPurpose: 'Quang học tốt' })], answers({ purpose: 'LEARNING' }))
      .matches.length,
    0,
  );
  assert.equal(
    recommendCameras(
      [camera(1, { referenceUsedPrice: 9007199254740993n })],
      answers({ intent: 'BUY', maxBudgetVnd: null }),
    ).matches.length,
    0,
  );
});
