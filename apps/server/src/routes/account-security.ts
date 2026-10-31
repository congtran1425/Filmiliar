import type { Express, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { createSessionToken } from '../auth.js';
import { AccountSecurity, AccountSecurityError } from '../services/account-security.js';
import { ResendRecoveryMailer } from '../services/recovery-mail.js';

export function registerAccountSecurityRoutes(app: Express, db: PrismaClient, requireUser: RequestHandler) {
  const service = new AccountSecurity(db, new ResendRecoveryMailer());
  const forgotLimit = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' } });
  const passwordLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'Vui lòng thử lại sau ít phút.' } });
  app.post('/api/auth/forgot-password', forgotLimit, (req,res) => {
    const input = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict().safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, message: 'Vui lòng nhập email hợp lệ.' });
    if (!service.ready()) return res.status(503).json({ success: false, message: 'Không thể gửi email lúc này. Vui lòng thử lại sau.' });
    // Respond identically before looking up the account or contacting the provider.
    setImmediate(() => { void service.issueReset(input.data.email).catch(() => console.error('Password recovery email could not be delivered')); });
    res.status(202).json({ success: true, message: 'Nếu email đã được đăng ký, bạn sẽ nhận liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư rác.' });
  });
  app.post('/api/auth/reset-password', passwordLimit, async (req,res) => {
    const input = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), newPassword: z.string().min(10).max(128) }).strict().safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, message: 'Liên kết không hợp lệ hoặc mật khẩu chưa đủ 10–128 ký tự.' });
    try { await service.resetPassword(input.data.token,input.data.newPassword); res.json({ success: true }); }
    catch(error) { res.status(error instanceof AccountSecurityError ? error.status : 500).json({ success: false, message: error instanceof AccountSecurityError ? error.message : 'Không thể đặt lại mật khẩu lúc này.' }); }
  });
  app.put('/api/user/change-password', requireUser, passwordLimit, async (req,res) => {
    const input = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128) }).strict().safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, message: 'Mật khẩu mới cần từ 10 đến 128 ký tự.' });
    try {
      const user = await service.changePassword(res.locals.user.id,input.data.currentPassword,input.data.newPassword);
      res.json({ success: true, token: createSessionToken(user) });
    } catch(error) { res.status(error instanceof AccountSecurityError ? error.status : 500).json({ success: false, message: error instanceof AccountSecurityError ? error.message : 'Không thể đổi mật khẩu lúc này.' }); }
  });
  const cleanup = setInterval(() => {
    void db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600_000) } } }).catch(() => console.error('Expired recovery links could not be cleaned'));
  }, 3600_000);
  cleanup.unref();
}
