import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthForm } from '../components/AuthForm';
import { useSession } from '../lib/session';

export function AuthPage({ mode }: { mode: 'LOGIN' | 'REGISTER' }) {
  const { user, state } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const requested = new URLSearchParams(location.search).get('redirect');
  const destination = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/tai-khoan';

  if (state === 'loading') return <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-slate-300" role="status">Đang kiểm tra phiên đăng nhập...</main>;
  if (state === 'ready' && user) return <Navigate to={destination} replace />;
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-film-warm">Tài khoản Filmiliar</p>
      <h1 className="mt-3 text-3xl font-bold text-white">{mode === 'LOGIN' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h1>
      <p className="mb-7 mt-3 text-sm leading-6 text-slate-300">Quản lý hồ sơ và xem thông tin thiết bị. Filmiliar chưa nhận đơn hoặc thanh toán trực tuyến.</p>
      <AuthForm initialMode={mode} onSuccess={() => navigate(destination, { replace: true })}
        onModeChange={(nextMode) => navigate(`${nextMode === 'LOGIN' ? '/dang-nhap' : '/dang-ky'}${location.search}`, { replace: true })} />
    </main>
  );
}
