import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { CameraMatchQuizModal } from './components/CameraMatchQuizModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InfoTabType } from './components/InfoPagesModal';
import { CatalogPage } from './pages/CatalogPage';
import { HomePage } from './pages/HomePage';
import { ProcessPage } from './pages/ProcessPage';
import { ProductPage } from './pages/ProductPage';
import { ReviewPage } from './pages/ReviewPage';
import { SupportPage, supportPaths } from './pages/SupportPage';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';
import { useSession } from './lib/session';

const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function LegacyCatalogRedirect({ mode }: { mode: 'rent' | 'buy' }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('mode', mode);
  return <Navigate to={`/san-pham?${params.toString()}`} replace />;
}

export default function SiteApp() {
  const navigate = useNavigate();
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const { user: currentUser, signOut } = useSession();

  const handleLogout = () => {
    signOut();
    navigate('/');
  };
  const openInfo = (tab: InfoTabType) => navigate(supportPaths[tab]);

  return (
    <div className="flex min-h-screen flex-col bg-film-dark font-sans text-slate-100">
      <ScrollToTop />
      <Navbar currentUser={currentUser} onOpenAuth={() => navigate('/dang-nhap')} onLogout={handleLogout} onOpenMyRentals={() => navigate('/tai-khoan')} onOpenAdmin={() => navigate('/admin')} />
      <Routes>
        <Route path="/" element={<HomePage onOpenQuiz={() => setIsQuizOpen(true)} />} />
        <Route path="/san-pham" element={<CatalogPage />} />
        <Route path="/thue" element={<LegacyCatalogRedirect mode="rent" />} />
        <Route path="/mua" element={<LegacyCatalogRedirect mode="buy" />} />
        <Route path="/quy-trinh" element={<ProcessPage />} />
        <Route path="/cam-nang" element={<SupportPage topicOverride="cam-nang" />} />
        <Route path="/lien-he" element={<SupportPage topicOverride="lien-he" />} />
        <Route path="/thiet-bi/:slug" element={<ProductPage />} />
        <Route path="/thiet-bi/:slug/xem-lai/:mode" element={<ReviewPage />} />
        <Route path="/thong-tin/:topic" element={<SupportPage />} />
        <Route path="/dang-nhap" element={<AuthPage mode="LOGIN" />} />
        <Route path="/dang-ky" element={<AuthPage mode="REGISTER" />} />
        <Route path="/tai-khoan" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute admin><Suspense fallback={<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 text-slate-300" role="status">Đang mở trung tâm quản trị...</main>}><AdminPage /></Suspense></ProtectedRoute>} />
        <Route path="*" element={<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-20"><p className="text-xs uppercase tracking-wider text-film-warm">404</p><h1 className="mt-2 text-3xl font-bold text-white">Không tìm thấy trang</h1><p className="mt-3 text-slate-400">Đường dẫn này không có trong Filmiliar.</p><Link to="/" className="mt-6 inline-block rounded-lg bg-film-warm px-4 py-2.5 text-sm font-bold text-film-dark">Về trang chủ</Link></main>} />
      </Routes>
      <Footer onOpenInfo={openInfo} onOpenQuiz={() => setIsQuizOpen(true)} onScrollToCatalog={() => navigate('/san-pham')} />
      <CartDrawer />

      <CameraMatchQuizModal isOpen={isQuizOpen} onClose={() => setIsQuizOpen(false)} onSelectCamera={(camera) => { setIsQuizOpen(false); navigate(`/thiet-bi/${camera.slug}`); }} />
    </div>
  );
}
