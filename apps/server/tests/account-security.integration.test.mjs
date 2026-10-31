import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { AccountSecurity } from '../dist/services/account-security.js';
import { hashPassword, verifyPassword, createSessionToken, getSessionUser } from '../dist/auth.js';

const url=process.env.PAYMENT_TEST_DATABASE_URL;
test('recovery links are hashed, single use, throttled, expire, and revoke sessions', {skip:!url},async t=>{
  assert.equal(new URL(url).pathname,'/filmiliar_payment_test');
  process.env.JWT_SECRET='isolated-account-security-key-at-least-32-characters';
  const db=new PrismaClient({datasources:{db:{url}}});const suffix=crypto.randomBytes(5).toString('hex');
  const mail=[];const mailer={isConfigured:()=>true,async sendReset(input){mail.push(input);}};
  const service=new AccountSecurity(db,mailer,'https://example.test');
  const original='initial-password-123';let user;
  const tokenFrom=message=>new URLSearchParams(new URL(message.url).hash.slice(1)).get('token');
  const issue=async()=>{await db.passwordResetToken.deleteMany({where:{userId:user.id}});await service.issueReset(user.email);return tokenFrom(mail.at(-1));};
  try{
    user=await db.user.create({data:{email:`recovery-${suffix}@example.test`,fullName:'Recovery test',passwordHash:hashPassword(original)}});
    await t.test('unknown email does not send, stored hashes do not expose raw link, rate limit retains the first link',async()=>{
      await service.issueReset(`unknown-${suffix}@example.test`);assert.equal(mail.length,0);
      await service.issueReset(user.email);const first=mail[0];const raw=tokenFrom(first);
      assert.match(raw,/^[A-Za-z0-9_-]{43}$/);assert.equal(new URL(first.url).search,'');
      const stored=await db.passwordResetToken.findFirst({where:{userId:user.id}});
      assert.notEqual(stored.tokenHash,raw);assert.equal(stored.tokenHash,crypto.createHash('sha256').update(raw).digest('hex'));
      await service.issueReset(user.email);assert.equal(mail.length,1);
      assert.equal(verifyPassword(original,(await db.user.findUnique({where:{id:user.id}})).passwordHash),true);
    });
    await t.test('invalid, expired, reused links and unchanged passwords are rejected',async()=>{
      await assert.rejects(service.resetPassword('invalid','new-password-123'),{status:400});
      const raw=await issue();
      await assert.rejects(service.resetPassword(raw,original),/phải khác/);
      await db.passwordResetToken.updateMany({where:{userId:user.id},data:{createdAt:new Date(Date.now()-120000),expiresAt:new Date(Date.now()-60000)}});
      await assert.rejects(service.resetPassword(raw,'new-password-123'),{status:400});
      const fresh=await issue();const oldSession=createSessionToken(user);
      await service.resetPassword(fresh,'new-password-123');
      assert.equal(await getSessionUser(db,{headers:{authorization:'Bearer '+oldSession}}),null);
      await assert.rejects(service.resetPassword(fresh,'second-password-123'),{status:400});
      user=await db.user.findUnique({where:{id:user.id}});assert.equal(verifyPassword('new-password-123',user.passwordHash),true);
    });
    await t.test('concurrent reset requests consume one link exactly once',async()=>{
      const raw=await issue();const results=await Promise.allSettled([service.resetPassword(raw,'racing-password-one'),service.resetPassword(raw,'racing-password-two')]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
      user=await db.user.findUnique({where:{id:user.id}});
    });
    await t.test('change requires the current password and invalidates recovery links and all old sessions',async()=>{
      const current=verifyPassword('racing-password-one',user.passwordHash)?'racing-password-one':'racing-password-two';
      const raw=await issue();const oldSession=createSessionToken(user);
      await assert.rejects(service.changePassword(user.id,'wrong-password','replacement-password'),{status:401});
      await assert.rejects(service.changePassword(user.id,current,current),{status:400});
      const next=await service.changePassword(user.id,current,'replacement-password');
      assert.equal(await getSessionUser(db,{headers:{authorization:'Bearer '+oldSession}}),null);
      assert.equal((await getSessionUser(db,{headers:{authorization:'Bearer '+createSessionToken(next)}})).id,user.id);
      await assert.rejects(service.resetPassword(raw,'last-password-123'),{status:400});
    });
    await t.test('failed email delivery leaves no usable recovery record',async()=>{
      await db.passwordResetToken.deleteMany({where:{userId:user.id}});
      const failed=new AccountSecurity(db,{isConfigured:()=>true,async sendReset(){throw new Error('provider unavailable');}},'https://example.test');
      await assert.rejects(failed.issueReset(user.email),/delivery failed/);
      assert.equal(await db.passwordResetToken.count({where:{userId:user.id}}),0);
    });
  }finally{await db.user.deleteMany({where:{email:`recovery-${suffix}@example.test`}});await db.$disconnect();}
});
