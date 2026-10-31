export interface RecoveryMailer {
  isConfigured(): boolean;
  sendReset(input: { email: string; url: string; requestId: string }): Promise<void>;
}

export class ResendRecoveryMailer implements RecoveryMailer {
  constructor(private readonly options = {
    key: process.env.RESEND_API_KEY || '', from: process.env.RECOVERY_EMAIL_FROM || '', fetcher: fetch
  }) {}

  isConfigured() {
    return this.options.key.startsWith('re_') && this.options.key.length >= 20 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(this.options.from);
  }

  async sendReset({ email, url, requestId }: { email: string; url: string; requestId: string }) {
    if (!this.isConfigured()) throw new Error('Recovery mail is not configured');
    const text = `Bạn vừa yêu cầu đặt lại mật khẩu Filmiliar.\n\nMở liên kết sau trong 15 phút:\n${url}\n\nLiên kết chỉ dùng một lần. Nếu không yêu cầu, bạn có thể bỏ qua email này; mật khẩu hiện tại vẫn được giữ nguyên. Filmiliar không yêu cầu bạn cung cấp mật khẩu qua email.`;
    const response = await this.options.fetcher('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${this.options.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `password-reset/${requestId}` },
      body: JSON.stringify({ from: `Filmiliar <${this.options.from}>`, to: [email], subject: 'Đặt lại mật khẩu Filmiliar', text })
    });
    if (!response.ok) throw new Error('Recovery mail delivery failed');
    const data = await response.json() as { id?: string };
    if (typeof data.id !== 'string' || !data.id) throw new Error('Recovery mail delivery was not acknowledged');
  }
}
