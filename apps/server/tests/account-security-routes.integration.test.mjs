import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { registerAccountSecurityRoutes } from '../dist/routes/account-security.js';
import { hashPassword,createSessionToken,getSessionUser } from '../dist/auth.js';

const url=process.env.PAYMENT_TEST_DATABASE_URL;
test('recovery HTTP responses do not reveal accounts or tokens and password change renews only the current session',{skip:!url},async()=>{
  assert.equal(new URL(url).pathname,'/filmiliar_payment_test');
  Object.assign(process.env,{JWT_SECRET:'isolated-security-route-key-at-least-32-characters',RESEND_API_KEY:'re_isolated_route_key_only_for_tests',RECOVERY_EMAIL_FROM:'no-reply@example.test',PUBLIC_CLIENT_URL:'https://example.test'});
  const db=new PrismaClient({datasources:{db:{url}}});const suffix=crypto.randomBytes(5).toString('hex');
  const nativeFetch=globalThis.fetch;const deliveries=[];
  globalThis.fetch=async(target,init)=>{assert.equal(target,'https://api.resend.com/emails');deliveries.push(JSON.parse(init.body));return new Response('{"id":"isolated-mail"}');};
  const app=express();app.use(express.json());
  const requireUser=async(req,res,next)=>{const user=await getSessionUser(db,req);if(!user)return res.status(401).json({success:false});res.locals.user=user;next();};
  registerAccountSecurityRoutes(app,db,requireUser);
  app.get('/whoami',requireUser,(_req,res)=>res.json({success:true}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,body,token,method='POST')=>{const res=await nativeFetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:res.status,body:await res.json()};};
  try{
    const user=await db.user.create({data:{email:`security-route-${suffix}@example.test`,fullName:'Security routes',passwordHash:hashPassword('initial-password-123')}});
    const oldSession=createSessionToken(user);
    const known=await call('/api/auth/forgot-password',{email:user.email});const unknown=await call('/api/auth/forgot-password',{email:`unknown-${suffix}@example.test`});
    assert.equal(known.status,202);assert.deepEqual(known,unknown);assert.equal('token' in known.body,false);
    for(let i=0;i<50&&!deliveries.length;i++)await new Promise(resolve=>setTimeout(resolve,100));
    assert.equal(deliveries.length,1);
    const link=deliveries[0].text.match(/https:\/\/example\.test\/dat-lai-mat-khau#token=[A-Za-z0-9_-]{43}/)?.[0];assert.ok(link);
    const token=new URLSearchParams(new URL(link).hash.slice(1)).get('token');
    assert.equal((await call('/api/auth/reset-password',{token,newPassword:'replacement-password-123'})).status,200);
    assert.equal((await call('/whoami',null,oldSession,'GET')).status,401);
    assert.equal((await call('/api/auth/reset-password',{token,newPassword:'another-password-123'})).status,400);
    const current=await db.user.findUnique({where:{id:user.id}});const activeToken=createSessionToken(current);
    assert.equal((await call('/api/user/change-password',{currentPassword:'wrong-password',newPassword:'last-password-123'},activeToken,'PUT')).status,401);
    const changed=await call('/api/user/change-password',{currentPassword:'replacement-password-123',newPassword:'last-password-123'},activeToken,'PUT');
    assert.equal(changed.status,200);assert.equal((await call('/whoami',null,activeToken,'GET')).status,401);assert.equal((await call('/whoami',null,changed.body.token,'GET')).status,200);
  }finally{globalThis.fetch=nativeFetch;await db.user.deleteMany({where:{email:`security-route-${suffix}@example.test`}});await db.$disconnect();await new Promise(resolve=>server.close(resolve));}
});
