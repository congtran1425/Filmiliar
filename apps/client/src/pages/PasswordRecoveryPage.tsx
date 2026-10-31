import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PasswordInput } from '../components/PasswordInput';
import { apiRequest, useSession } from '../lib/session';

const input = 'mt-2 min-h-12 w-full rounded-xl border border-film-border bg-film-dark px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm';
const button = 'min-h-12 w-full rounded-xl bg-film-warm px-5 text-sm font-bold text-film-dark disabled:opacity-50';
export function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  const location = useLocation();
  const { user, signOut } = useSession();
  const [email, setEmail] = useState(user?.email || '');
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const tokenPresent = /^[A-Za-z0-9_-]{43}$/.test(token);
  useEffect(() => { setDone(false); setError(''); setPassword(''); setConfirm(''); },[location.hash]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(v => v - 1),1000);
    return () => window.clearTimeout(timer);
  },[cooldown]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (reset && password !== confirm) { setError('Mật khẩu xác nhận chưa khớp.'); return; }
    setBusy(true);
    try {
      await apiRequest(reset ? '/api/auth/reset-password' : '/api/auth/forgot-password', {
        method: 'POST', body: JSON.stringify(reset ? { token, newPassword: password } : { email: email.trim().toLowerCase() })
      });
      setDone(true);
      if (reset) { signOut(); setPassword(''); setConfirm(''); }
      else setCooldown(60);
    } catch(cause) { setError(cause instanceof Error ? cause.message : 'Không thể xử lý lúc này.'); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 sm:py-20">
    <Link to="/dang-nhap" className="inline-flex min-h-11 items-center text-sm text-slate-300">← Đăng nhập</Link>
    <p className="mt-4 text-xs font-bold uppercase tracking-wider text-film-warm">Khôi phục tài khoản</p><h1 className="mt-3 text-3xl font-bold text-white">{reset ? 'Đặt lại mật khẩu' : 'Quên mật khẩu?'}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-300">{reset ? 'Tạo mật khẩu mới cho tài khoản đã yêu cầu khôi phục.' : 'Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.'}</p>
    <section className="mt-7 rounded-2xl border border-film-border bg-film-card p-5 sm:p-7">
      {reset && done ? <div role="status"><h2 className="text-xl font-bold text-white">Đã đặt lại mật khẩu</h2><p className="mt-3 text-sm leading-6 text-slate-300">Các phiên đăng nhập cũ đã hết hiệu lực. Dùng mật khẩu mới để đăng nhập lại.</p><Link to="/dang-nhap" className={`${button} mt-5 flex items-center justify-center`}>Đăng nhập bằng mật khẩu mới</Link></div> : reset && !tokenPresent ? <div><h2 className="font-bold text-white">Liên kết không hợp lệ</h2><p className="mt-3 text-sm leading-6 text-slate-300">Mở đầy đủ liên kết trong email, hoặc yêu cầu một liên kết mới.</p><Link to="/quen-mat-khau" className="mt-4 inline-flex min-h-11 items-center text-sm text-film-warm underline">Gửi liên kết mới</Link></div> : <form onSubmit={submit} className="space-y-5">
        {error && <p role="alert" className="rounded-lg bg-red-400/10 p-3 text-sm leading-6 text-red-200">{error}</p>}
        {reset ? <>
          <div><label htmlFor="reset-next" className="text-sm text-slate-200">Mật khẩu mới</label><PasswordInput id="reset-next" label="mật khẩu mới" className={input} required minLength={10} maxLength={128} placeholder="Tạo mật khẩu mới từ 10 ký tự" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></div>
          <div><label htmlFor="reset-confirm" className="text-sm text-slate-200">Nhập lại mật khẩu mới</label><PasswordInput id="reset-confirm" label="mật khẩu xác nhận" className={input} required minLength={10} maxLength={128} placeholder="Nhập lại đúng mật khẩu mới" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}/></div>
          <p className="text-xs leading-5 text-slate-400">Mật khẩu có 10–128 ký tự. Liên kết có hạn 15 phút và chỉ dùng một lần.</p>
          <button disabled={busy} className={button}>{busy ? 'Đang cập nhật…' : 'Đặt lại mật khẩu'}</button><Link to="/quen-mat-khau" className="inline-flex min-h-11 items-center text-sm text-film-warm underline">Liên kết hết hạn? Yêu cầu liên kết mới</Link>
        </> : <>
          {done && <p role="status" className="rounded-lg bg-film-warm/10 p-3 text-sm leading-6 text-slate-200">Nếu email đã được đăng ký, bạn sẽ nhận liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư rác. Liên kết có hạn 15 phút.</p>}
          <label className="block text-sm text-slate-200">Email đăng ký<input required type="email" maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="VD: minhanh@gmail.com" className={input} value={email} onChange={e => { setEmail(e.target.value); setDone(false); }}/></label>
          <button disabled={busy || cooldown > 0} className={button}>{busy ? 'Đang gửi…' : cooldown > 0 ? `Gửi lại sau ${cooldown} giây` : done ? 'Gửi lại liên kết' : 'Gửi liên kết đặt lại'}</button>
          <p className="text-xs leading-5 text-slate-400">Không gửi mật khẩu hoặc giấy tờ qua email. Chỉ đặt mật khẩu mới trên website Filmiliar.</p>
        </>}
      </form>}
    </section>
  </main>;
}
