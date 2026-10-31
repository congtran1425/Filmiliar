import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { apiUrl } from '../lib/api';
import { useSession } from '../lib/session';
import type { SessionUser } from '../lib/session';
import { normalizePhone } from '../lib/phone';
import { PasswordInput } from './PasswordInput';

type Mode = 'LOGIN' | 'REGISTER';

export function AuthForm({ initialMode, onSuccess, onModeChange }: { initialMode: Mode; onSuccess?: (user: SessionUser, token: string) => void; onModeChange?: (mode: Mode) => void }) {
  const { signIn } = useSession();
  const hintId = useId();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMode(initialMode); setError(''); }, [initialMode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const normalizedPhone = normalizePhone(phone);
    if (mode === 'REGISTER' && !normalizedPhone) { setError('Vui lòng nhập số điện thoại hợp lệ, ví dụ 0912345678 hoặc +84 912345678.'); return; }
    setBusy(true);
    try {
      const response = await fetch(apiUrl(mode === 'LOGIN' ? '/api/auth/login' : '/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'LOGIN' ? { email, password } : { email, password, fullName, phone: normalizedPhone })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.token || !result.user) throw new Error(result.message || 'Không thể xác thực lúc này');
      signIn(result.token, result.user);
      onSuccess?.(result.user, result.token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lỗi kết nối, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-film-border bg-film-card p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-film-dark p-1" role="group" aria-label="Chọn hình thức tài khoản">
        {(['LOGIN', 'REGISTER'] as const).map((nextMode) => (
          <button key={nextMode} type="button" onClick={() => { setMode(nextMode); onModeChange?.(nextMode); }} aria-pressed={mode === nextMode}
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${mode === nextMode ? 'bg-film-warm text-film-dark' : 'text-slate-300 hover:text-white'}`}>
            {nextMode === 'LOGIN' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        {mode === 'REGISTER' && (
          <>
            <label className="block text-sm font-medium text-slate-200">Họ và tên
              <input required name="fullName" placeholder="VD: Nguyễn Minh Anh" minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} aria-describedby={`${hintId}-name`}
                className="mt-1.5 min-h-12 w-full rounded-lg border border-film-border bg-film-dark px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm" />
            </label>
            <p id={`${hintId}-name`} className="text-xs leading-5 text-slate-400">Nhập họ tên người sẽ nhận máy.</p>
            <label className="block text-sm font-medium text-slate-200">Số điện thoại
              <input required name="phone" type="tel" inputMode="tel" placeholder="VD: 0912 345 678" maxLength={30} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} aria-describedby={`${hintId}-phone`}
                className="mt-1.5 min-h-12 w-full rounded-lg border border-film-border bg-film-dark px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm" />
            </label>
            <p id={`${hintId}-phone`} className="text-xs leading-5 text-slate-400">Bắt buộc để liên hệ khi nhận máy. Có thể nhập +84 912345678.</p>
          </>
        )}
        <label className="block text-sm font-medium text-slate-200">Email
          <input required name="email" type="email" placeholder="VD: minhanh@gmail.com" maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby={`${hintId}-email`}
            className="mt-1.5 min-h-12 w-full rounded-lg border border-film-border bg-film-dark px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm" />
        </label>
        <p id={`${hintId}-email`} className="text-xs leading-5 text-slate-400">{mode === 'LOGIN' ? 'Dùng email đã đăng ký tài khoản.' : 'Dùng email bạn thường sử dụng để đăng nhập.'}</p>
        <div>
          <label htmlFor={`${hintId}-password-input`} className="block text-sm font-medium text-slate-200">Mật khẩu</label>
          <PasswordInput key={mode} id={`${hintId}-password-input`} required name="password" placeholder={mode === 'REGISTER' ? 'Tạo mật khẩu từ 10 ký tự' : 'Nhập mật khẩu của bạn'} minLength={mode === 'REGISTER' ? 10 : undefined} maxLength={128} aria-describedby={`${hintId}-password`}
            autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-lg border border-film-border bg-film-dark px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm" />
        </div>
        <p id={`${hintId}-password`} className="text-xs leading-5 text-slate-400">{mode === 'REGISTER' ? 'Từ 10 đến 128 ký tự. Nên kết hợp chữ, số và ký hiệu; không dùng số điện thoại làm mật khẩu.' : 'Nhập mật khẩu đã tạo khi đăng ký.'}</p>
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-lg bg-film-warm px-4 text-sm font-bold text-film-dark hover:bg-amber-300 disabled:opacity-60">
          {busy ? 'Đang xử lý...' : mode === 'LOGIN' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </button>
      </form>
    </div>
  );
}
