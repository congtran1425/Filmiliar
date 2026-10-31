import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePhone } from '../dist/phone.js';

test('contact numbers are normalized without claiming verified ownership', () => {
  for (const input of ['0912345678', '0912 345 678', '+84 912345678', '0912.345.678', '(0912) 345-678']) assert.equal(normalizePhone(input), '0912345678');
  assert.equal(normalizePhone('+1 202 555 0123'), '+12025550123');
  assert.equal(normalizePhone('02812345678'), '02812345678');
  for (const input of [null, undefined, 912345678, '', '   ', 'abc0912345678', '09123', '++84912345678', '+84912/345678', '0'.repeat(31)]) assert.equal(normalizePhone(input), null);
});
