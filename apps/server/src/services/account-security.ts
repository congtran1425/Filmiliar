import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../auth.js';
import type { RecoveryMailer } from './recovery-mail.js';

const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const LIFETIME = 15 * 60_000;
export class AccountSecurityError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const invalidLink = () => new AccountSecurityError('Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.');
async function lockUser(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
}

export class AccountSecurity {
  constructor(private readonly db: PrismaClient, private readonly mailer: RecoveryMailer,
    private readonly clientOrigin = process.env.PUBLIC_CLIENT_URL || 'https://filmiliar.congtc145.id.vn') {}

  ready() {
    try {
      const url = new URL(this.clientOrigin);
      return this.mailer.isConfigured() && url.origin === this.clientOrigin && !url.username && !url.password &&
        (url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)));
    } catch { return false; }
  }

  async issueReset(email: string) {
    if (!this.ready()) throw new AccountSecurityError('Không thể gửi email lúc này. Vui lòng thử lại sau.', 503);
    const found = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (!found) return;
    const raw = crypto.randomBytes(32).toString('base64url');
    const token = await this.db.$transaction(async tx => {
      await lockUser(tx, found.id);
      const user = await tx.user.findUnique({ where: { id: found.id } });
      if (!user) return null;
      const recent = await tx.passwordResetToken.findMany({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - LIFETIME) } }, orderBy: { createdAt: 'desc' }, take: 3, select: { createdAt: true } });
      if (recent.length >= 3 || (recent[0] && recent[0].createdAt.getTime() > Date.now() - 60_000)) return null;
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
      return tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: digest(raw), credentialVersion: digest(user.passwordHash), expiresAt: new Date(Date.now() + LIFETIME) } });
    });
    if (!token) return;
    try { await this.mailer.sendReset({ email, url: `${this.clientOrigin}/dat-lai-mat-khau#token=${raw}`, requestId: token.id }); }
    catch {
      await this.db.passwordResetToken.deleteMany({ where: { id: token.id } });
      throw new Error('Recovery mail delivery failed');
    }
  }

  async resetPassword(raw: string, nextPassword: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw invalidLink();
    const tokenHash = digest(raw);
    const initial = await this.db.passwordResetToken.findUnique({ where: { tokenHash }, select: { userId: true } });
    if (!initial) throw invalidLink();
    const nextHash = hashPassword(nextPassword);
    await this.db.$transaction(async tx => {
      await lockUser(tx, initial.userId);
      const [token, user] = await Promise.all([
        tx.passwordResetToken.findUnique({ where: { tokenHash } }), tx.user.findUnique({ where: { id: initial.userId } })
      ]);
      if (!token || !user || token.usedAt || token.expiresAt.getTime() <= Date.now() || token.credentialVersion !== digest(user.passwordHash)) throw invalidLink();
      if (verifyPassword(nextPassword, user.passwordHash)) throw new AccountSecurityError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: nextHash } });
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    });
  }

  async changePassword(userId: string, currentPassword: string, nextPassword: string) {
    const nextHash = hashPassword(nextPassword);
    return this.db.$transaction(async tx => {
      await lockUser(tx, userId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || !verifyPassword(currentPassword, user.passwordHash)) throw new AccountSecurityError('Mật khẩu hiện tại không đúng.', 401);
      if (verifyPassword(nextPassword, user.passwordHash)) throw new AccountSecurityError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      const saved = await tx.user.update({ where: { id: userId }, data: { passwordHash: nextHash } });
      await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      return saved;
    });
  }
}
