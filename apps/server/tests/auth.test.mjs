import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.JWT_SECRET = 'local-test-key-with-at-least-32-characters-only';
const { createSessionToken, getSessionUser, hashPassword, verifyPassword } = await import('../dist/auth.js');

test('password hashes validate the intended password and reject malformed hashes', () => {
  const hash = hashPassword('correct horse battery staple');
  assert.equal(verifyPassword('correct horse battery staple', hash), true);
  assert.equal(verifyPassword('different password', hash), false);
  assert.equal(verifyPassword('anything', 'scrypt:broken'), false);
});

test('session resolves the current database role and expires after a password change', async () => {
  const user = { id: 'user-1', passwordHash: hashPassword('original password'), role: 'CUSTOMER' };
  const prisma = { user: { findUnique: async ({ where }) => where.id === user.id ? user : null } };
  const token = createSessionToken(user);
  const request = { headers: { authorization: `Bearer ${token}` } };

  assert.equal((await getSessionUser(prisma, request))?.role, 'CUSTOMER');
  user.role = 'ADMIN';
  assert.equal((await getSessionUser(prisma, request))?.role, 'ADMIN');

  user.passwordHash = hashPassword('replacement password');
  assert.equal(await getSessionUser(prisma, request), null);
  assert.equal((await getSessionUser(prisma, { headers: { authorization: `Bearer ${createSessionToken(user)}` } }))?.role, 'ADMIN');
});

test('session rejects missing and altered bearer tokens', async () => {
  const user = { id: 'user-1', passwordHash: hashPassword('example password'), role: 'CUSTOMER' };
  const prisma = { user: { findUnique: async () => user } };
  const token = createSessionToken(user);
  assert.equal(await getSessionUser(prisma, { headers: {} }), null);
  assert.equal(await getSessionUser(prisma, { headers: { authorization: `Bearer ${token}x` } }), null);
  assert.equal(await getSessionUser({ user: { findUnique: async () => null } }, { headers: { authorization: `Bearer ${token}` } }), null);
});
