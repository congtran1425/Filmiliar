import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { SandboxPaymentFlow } from '../dist/services/payment-flow.js';
import { RentalOperations } from '../dist/services/rental-operations.js';
import { quoteRental } from '../dist/services/rental-availability.js';
import { APPROVED_RULES, APPROVED_TERMS, cancellationRefundAmount } from '../dist/services/approved-policy.js';

const databaseUrl=process.env.PAYMENT_TEST_DATABASE_URL;
test('approved timed policy protects money, idempotency, exact hours and one-time rescheduling', {skip:!databaseUrl}, async t => {
  assert.equal(new URL(databaseUrl).pathname,'/filmiliar_payment_test');
  const db=new PrismaClient({datasources:{db:{url:databaseUrl}}});
  const suffix=crypto.randomBytes(5).toString('hex');
  const original=await db.rentalPolicy.findUniqueOrThrow({where:{id:'rental'}});
  const gateway={appId:123456,created:0,refundCalls:[],async createPayment(){this.created++;return{return_code:1,qr_code:'isolated-test'}},async checkOrderStatus(){return{return_code:3}},async createRefund(input){this.refundCalls.push(input);return{return_code:1,refund_id:'1234567890123456789'}},async queryRefund(){return{return_code:3}},verifyCallback(){return true},parseCallback(){throw new Error('unused')}};
  const flow=new SandboxPaymentFlow(db,gateway), ops=new RentalOperations(db,gateway);
  const day=n=>new Date(Date.now()+7*3600000+n*86400000).toISOString().slice(0,10);
  const op=()=>({requestId:crypto.randomUUID(),note:'Approved policy isolated integration check.'});
  let customer,admin,product,seq=0,txn=0;
  const unit=()=>db.cameraItem.create({data:{modelId:product.id,serialNumber:`POL-${suffix}-${++seq}`,conditionGrade:'96%',opticsCondition:'Kit checked',scratchNotes:'Recorded',depositAmount:3897000}});
  const create=async(item,start=day(3),end=day(4),startTime='08:00',endTime='08:00',requestId=crypto.randomUUID())=>{
    const q=(await quoteRental(db,item.id,start,end,startTime,endTime)).view;
    return flow.create(customer.id,{cameraItemId:item.id,startDate:start,endDate:end,startTime,endTime,clientRequestId:requestId,quoteHash:q.quoteHash,termsAccepted:true});
  };
  const paid=async(item,start=day(3),end=day(4))=>{
    const p=await create(item,start,end);
    await flow.handleCallback({app_id:gateway.appId,app_trans_id:p.appTransId,amount:p.totalAmount,zp_trans_id:`12345678901234${String(++txn).padStart(3,'0')}`,embed_data:JSON.stringify({bookingId:p.bookingId})});
    return p;
  };
  try{
    [customer,admin]=await Promise.all(['CUSTOMER','ADMIN'].map(role=>db.user.create({data:{email:`policy-${role}-${suffix}@example.test`,fullName:'Policy test',passwordHash:'isolated',role,phone:'0912345678'}})));
    product=await db.product.create({data:{slug:`policy-${suffix}`,modelName:'Policy integration',brand:'Filmiliar',categoryName:'Camera',weightGrams:400,recommendedPurpose:'Test',dailyRentalRate:170000,referenceUsedPrice:12990000}});
    await db.rentalPolicy.update({where:{id:'rental'},data:{cancellationRefund:'TIMED',terms:APPROVED_TERMS,rules:APPROVED_RULES,returnBufferDays:0,version:{increment:1}}});
    await t.test('changed pickup time cannot reuse an earlier request or stale quote',async()=>{
      const item=await unit(), requestId=crypto.randomUUID();const p=await create(item,day(3),day(4),'08:00','08:00',requestId);
      assert.ok(p.pickupAt);const calls=gateway.created;
      await assert.rejects(create(item,day(3),day(4),'09:00','09:00',requestId),{statusCode:409});assert.equal(gateway.created,calls);
    });
    await t.test('allocation prevents overlapping hours and allows exact adjacent hours with zero buffer',async()=>{
      const item=await unit();await create(item,day(3),day(4),'08:00','10:00');
      assert.equal((await quoteRental(db,item.id,day(4),day(5),'09:59','10:00')).view.available,false);
      assert.equal((await quoteRental(db,item.id,day(4),day(5),'10:00','10:00')).view.available,true);
    });
    await t.test('rescheduling excludes its own hold, rejects maintenance blocks and can occur only once',async()=>{
      const item=await unit();const p=await paid(item);
      const block=await db.rentalAllocation.create({data:{cameraItemId:item.id,kind:'BLOCK',startDate:new Date(day(6)+'T00:00:00Z'),endDate:new Date(day(7)+'T00:00:00Z'),reason:'Maintenance'}});
      await assert.rejects(ops.reschedule(p.bookingId,customer,{...op(),startDate:day(6),endDate:day(7)}),{statusCode:409});
      await db.rentalAllocation.update({where:{id:block.id},data:{releasedAt:new Date()}});
      const changed=await ops.reschedule(p.bookingId,customer,{...op(),startDate:day(6),endDate:day(7)});
      assert.equal(changed.rescheduleCount,1);assert.equal(changed.totalRentalFee,170000);
      await assert.rejects(ops.reschedule(p.bookingId,customer,{...op(),startDate:day(8),endDate:day(9)}),{statusCode:409});
      const stored=await db.rentalBooking.findUniqueOrThrow({where:{id:p.bookingId}});assert.equal(stored.policySnapshot.cancellationRefund,'TIMED');
    });
    await t.test('partial refund uses the frozen cancellation instant and ignores later policy changes',async()=>{
      const item=await unit();const p=await paid(item);const now=new Date();
      const pickupAt=new Date(now.getTime()+36*3600000),dueAt=new Date(now.getTime()+60*3600000);
      await db.rentalBooking.update({where:{id:p.bookingId},data:{pickupAt,dueAt}});
      const cancelled=await ops.cancel(p.bookingId,customer,op());assert.equal(cancelled.cancellationRefundAmount,3982000);
      await db.rentalPolicy.update({where:{id:'rental'},data:{cancellationRefund:'FULL_PAYMENT',version:{increment:1}}});
      await ops.requestRefund(p.bookingId,customer,crypto.randomUUID());assert.equal(gateway.refundCalls.at(-1).amount,3982000);
      const frozen=await db.rentalBooking.findUniqueOrThrow({where:{id:p.bookingId}});assert.equal(cancellationRefundAmount(frozen,new Date(now.getTime()+72*3600000)),3982000);
      await db.rentalPolicy.update({where:{id:'rental'},data:{cancellationRefund:'TIMED'}});
    });
    await t.test('only admin can mark store fault and return the full payment',async()=>{
      const p=await paid(await unit(),day(1),day(2));
      await assert.rejects(ops.cancel(p.bookingId,customer,{...op(),storeFault:true}),{statusCode:403});
      const cancelled=await ops.cancel(p.bookingId,admin,{...op(),storeFault:true});assert.equal(cancelled.cancellationRefundAmount,p.totalAmount);
      await ops.requestRefund(p.bookingId,admin,crypto.randomUUID());assert.equal(gateway.refundCalls.at(-1).amount,p.totalAmount);
    });
  }finally{
    if(customer){await db.refundAttempt.deleteMany({where:{booking:{userId:customer.id}}});await db.paymentAttempt.deleteMany({where:{userId:customer.id}});await db.rentalBooking.deleteMany({where:{userId:customer.id}})}
    if(product)await db.product.delete({where:{id:product.id}});
    if(customer)await db.user.deleteMany({where:{id:{in:[customer.id,admin.id]}}});
    await db.rentalPolicy.update({where:{id:'rental'},data:{version:original.version,returnBufferDays:original.returnBufferDays,cancellationRefund:original.cancellationRefund,terms:original.terms,rules:original.rules??undefined}});
    await db.$disconnect();
  }
});
