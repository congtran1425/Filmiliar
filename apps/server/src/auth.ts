import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import type { PrismaClient, User } from '@prisma/client';

function signingKey(): string {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  return secret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[0-9a-f]{32}$/.test(parts[1]) || !/^[0-9a-f]{128}$/.test(parts[2])) return false;
  const actual = crypto.scryptSync(password, parts[1], 64);
  return crypto.timingSafeEqual(actual, Buffer.from(parts[2], 'hex'));
}

function passwordVersion(passwordHash: string): string {
  return crypto.createHmac('sha256', signingKey()).update(passwordHash).digest('hex');
}

export function createSessionToken(user: Pick<User, 'id' | 'passwordHash'>): string {
  return jwt.sign({ id: user.id, pv: passwordVersion(user.passwordHash) }, signingKey(), { algorithm: 'HS256', expiresIn: '7d' });
}

export async function getSessionUser(prisma: PrismaClient, req: Request): Promise<User | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), signingKey(), { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.id !== 'string' || typeof payload.pv !== 'string') return null;
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return null;
    const expected = Buffer.from(passwordVersion(user.passwordHash), 'hex');
    const received = Buffer.from(payload.pv, 'hex');
    return received.length === expected.length && crypto.timingSafeEqual(received, expected) ? user : null;
  } catch {
    return null;
  }
}
