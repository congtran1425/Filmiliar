import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

const url = process.env.PAYMENT_TEST_DATABASE_URL;
test('registration and profile require a contact number while legacy login continues working', { skip: !url }, async () => {
  assert.equal(new URL(url).pathname, '/filmiliar_payment_test');
  Object.assign(process.env, { DATABASE_URL: url, JWT_SECRET: 'isolated-auth-profile-key-at-least-32-characters', PAYMENT_MODE: 'disabled', FILMILIAR_TEST_MODE: 'routes' });
  const [{ app }, { hashPassword }] = await Promise.all([import('../dist/index.js'), import('../dist/auth.js')]);
  const db = new PrismaClient({ datasources: { db: { url } } });
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const suffix = crypto.randomBytes(5).toString('hex');
  const email = `auth-${suffix}@example.test`; const password = 'isolated-password-123';
  const call = async (path, method, body, token) => {
    const res = await fetch(base+path,{ method, headers: {'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})}, body:JSON.stringify(body) });
    return { status:res.status, body:await res.json() };
  };
  try {
    for(const phone of [undefined,null,'','letters','09123']) {
      const result = await call('/api/auth/register','POST',{email,password,fullName:'Registration Test',phone});
      assert.equal(result.status,400); assert.match(result.body.message,/số điện thoại/);
    }
    assert.equal(await db.user.count({where:{email}}),0);
    const registered = await call('/api/auth/register','POST',{email,password,fullName:'Registration Test',phone:'+84 912 345 678'});
    assert.equal(registered.status,200); assert.equal(registered.body.user.phone,'0912345678');
    const token = registered.body.token;
    for(const phone of [null,'','bad-number']) assert.equal((await call('/api/user/profile','PUT',{fullName:'Registration Test',address:null,phone},token)).status,400);
    const saved = await call('/api/user/profile','PUT',{fullName:'Updated Test',address:null,phone:'0987-654-321'},token);
    assert.equal(saved.status,200); assert.equal(saved.body.user.phone,'0987654321');
    // Existing accounts remain nullable in storage; only new registration/profile writes require the field.
    const old = await db.user.create({data:{email:`legacy-${suffix}@example.test`,fullName:'Legacy Test',phone:null,passwordHash:hashPassword(password)}});
    const login = await call('/api/auth/login','POST',{email:old.email,password});
    assert.equal(login.status,200); assert.equal(login.body.user.phone,null);
  }finally{
    await db.user.deleteMany({where:{email:{endsWith:`${suffix}@example.test`}}});await db.$disconnect();await new Promise(resolve=>server.close(resolve));
  }
});
