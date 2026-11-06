import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { scheduledRental, cancellationRefundAmount, suggestedLateFee } from '../dist/services/approved-policy.js';

test('24-hour pricing uses Vietnam time, rounds partial days and limits service hours', () => {
  const start=new Date(Date.now()+7*3600000+7*86400000).toISOString().slice(0,10);
  const end=new Date(Date.parse(start+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  const exact=scheduledRental(start,end,'09:00','09:00');
  assert.equal(exact.days,1); assert.equal(exact.pickupAt.toISOString(),start+'T02:00:00.000Z');
  assert.equal(scheduledRental(start,end,'09:00','09:01').days,2);
  assert.equal(scheduledRental(start,end,'18:00','08:00').days,1);
  assert.throws(()=>scheduledRental(start,end,'07:59','08:00'));
  assert.throws(()=>scheduledRental(start,end,'08:00','20:01'));
});

test('cancellation boundaries, frozen cancellation time, store fault and legacy snapshots', () => {
  const now=new Date('2026-11-06T01:00:00Z');
  const booking={depositAmount:3897000,totalRentalFee:170001,startDate:now,policySnapshot:{cancellationRefund:'TIMED'}};
  for(const [hours,fee] of [[48,170001],[47.999,85000],[24,85000],[23.999,0],[-1,0]]){
    assert.equal(cancellationRefundAmount({...booking,pickupAt:new Date(now.getTime()+hours*3600000)},now),3897000+fee);
  }
  const frozen={...booking,pickupAt:new Date(now.getTime()+36*3600000),cancelledAt:now};
  assert.equal(cancellationRefundAmount(frozen,new Date(now.getTime()+100*3600000)),3982000);
  assert.equal(cancellationRefundAmount({...frozen,cancellationCause:'STORE'}),4067001);
  assert.equal(cancellationRefundAmount({...booking,policySnapshot:{cancellationRefund:'FULL_PAYMENT'}}),4067001);
  assert.equal(cancellationRefundAmount({...booking,policySnapshot:{cancellationRefund:'DEPOSIT_ONLY'}}),3897000);
  assert.equal(cancellationRefundAmount({...frozen,policySnapshot:{cancellationRefund:'TIMED',rules:{cancellationTiers:[{minimumHours:0,rentalRefundPercent:25}]}}}),3939500);
  assert.throws(()=>cancellationRefundAmount({...frozen,policySnapshot:{cancellationRefund:'TIMED',rules:{cancellationTiers:[{minimumHours:0,rentalRefundPercent:200}]}}}));
});

test('late fee suggestions respect the two-hour grace and daily rounding', () => {
  const due=new Date('2026-11-06T01:00:00Z');
  for(const [hours,fee] of [[-1,0],[1.999,0],[2,100000],[23.999,100000],[24,200000],[24.001,400000]])assert.equal(suggestedLateFee(due,new Date(due.getTime()+hours*3600000),200000),fee);
});

test('approved exact-serial passports have consistent deposits, grades and model mapping', () => {
  const entries=JSON.parse(fs.readFileSync(new URL('../prisma/data/approved-passports.json',import.meta.url)));
  assert.equal(entries.length,3);assert.equal(new Set(entries.map(e=>e.serialNumber)).size,3);
  for(const entry of entries){const p=entry.passport;assert.ok(entry.serialNumber.startsWith('SIM-'));assert.equal(entry.depositAmount,p.referenceValue*p.depositPercent/100);assert.equal(p.overallPercent,Math.round(p.parts.reduce((n,c)=>n+c.percent,0)/p.parts.length));}
  assert.equal(entries.find(e=>e.slug==='canon-eos-m50').depositAmount,3897000);
});
