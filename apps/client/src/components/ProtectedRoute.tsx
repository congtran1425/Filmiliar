import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../lib/session';

export function ProtectedRoute({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, state, refresh } = useSession();
  const location = useLocation();
  if (state === 'loading') return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 text-slate-300" role="status">Đang kiểm tra phiên đăng nhập...</main>;
  if (state === 'error') return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16"><h1 className="text-2xl font-bold text-white">Chưa thể kiểm tra tài khoản</h1><button onClick={() => void refresh()} className="mt-5 min-h-11 rounded-lg bg-film-warm px-4 font-semibold text-film-dark">Thử lại</button></main>;
  if (!user) return <Navigate to={`/dang-nhap?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && user.role !== 'ADMIN') return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16"><h1 className="text-2xl font-bold text-white">Không có quyền truy cập</h1><p className="mt-2 text-slate-300">Trang này chỉ dành cho quản trị viên.</p><Link to="/tai-khoan" className="mt-5 inline-block text-film-warm underline">Về tài khoản</Link></main>;
  return <>{children}</>;
}
