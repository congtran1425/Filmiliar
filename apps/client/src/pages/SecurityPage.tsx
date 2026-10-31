import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PasswordInput } from '../components/PasswordInput';
import { apiRequest, useSession } from '../lib/session';

export function SecurityPage() {
  const { user, updateToken } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const input = 'mt-2 min-h-12 w-full rounded-xl border border-film-border bg-film-dark px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm';
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess(false);
    if (next !== confirm) { setError('Mật khẩu xác nhận chưa khớp.'); return; }
    setBusy(true);
    try {
      const result = await apiRequest<{ token: string }>('/api/user/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      updateToken(result.token); setCurrent(''); setNext(''); setConfirm(''); setSuccess(true);
    } catch(cause) { setError(cause instanceof Error ? cause.message : 'Không thể đổi mật khẩu.'); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
    <Link to="/tai-khoan" className="inline-flex min-h-11 items-center text-sm text-slate-300">← Tài khoản của bạn</Link>
    <p className="mt-4 text-xs font-bold uppercase tracking-wider text-film-warm">Bảo mật</p><h1 className="mt-2 text-3xl font-bold text-white">Bảo mật tài khoản</h1>
    <p className="mt-3 break-words text-sm text-slate-300">Quản lý mật khẩu cho {user?.email}.</p>
    <form onSubmit={submit} className="mt-7 space-y-5 rounded-2xl border border-film-border bg-film-card p-5 sm:p-7">
      <h2 className="text-xl font-bold text-white">Đổi mật khẩu</h2><p className="text-sm leading-6 text-slate-400">Nhập mật khẩu hiện tại để xác nhận. Sau khi đổi, các phiên đăng nhập khác và liên kết đặt lại cũ sẽ hết hiệu lực.</p>
      {error && <p role="alert" className="rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-200">Đã đổi mật khẩu. Bạn tiếp tục dùng phiên hiện tại; các phiên cũ đã hết hiệu lực.</p>}
      <div><label htmlFor="security-current" className="text-sm text-slate-200">Mật khẩu hiện tại</label><PasswordInput id="security-current" label="mật khẩu hiện tại" required maxLength={128} placeholder="Nhập mật khẩu đang sử dụng" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={input}/></div>
      <div><label htmlFor="security-next" className="text-sm text-slate-200">Mật khẩu mới</label><PasswordInput id="security-next" label="mật khẩu mới" required minLength={10} maxLength={128} placeholder="Tạo mật khẩu mới từ 10 ký tự" autoComplete="new-password" aria-describedby="security-hint" value={next} onChange={e => setNext(e.target.value)} className={input}/></div>
      <p id="security-hint" className="text-xs leading-5 text-slate-400">Từ 10 đến 128 ký tự, khác mật khẩu hiện tại.</p>
      <div><label htmlFor="security-confirm" className="text-sm text-slate-200">Nhập lại mật khẩu mới</label><PasswordInput id="security-confirm" label="mật khẩu xác nhận" required minLength={10} maxLength={128} placeholder="Nhập lại đúng mật khẩu mới" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={input}/></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><button disabled={busy} className="min-h-12 rounded-xl bg-film-warm px-5 text-sm font-bold text-film-dark disabled:opacity-50">{busy ? 'Đang đổi…' : 'Cập nhật mật khẩu'}</button><Link to="/quen-mat-khau" className="inline-flex min-h-11 items-center text-sm text-film-warm underline">Quên mật khẩu hiện tại?</Link></div>
    </form>
  </main>;
}
