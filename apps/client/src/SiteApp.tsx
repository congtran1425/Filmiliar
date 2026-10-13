import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { CameraMatchQuizModal } from './components/CameraMatchQuizModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InfoTabType } from './components/InfoPagesModal';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { ReviewPage } from './pages/ReviewPage';
import { SupportPage, supportPaths } from './pages/SupportPage';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { useSession } from './lib/session';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
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
      <Navbar currentUser={currentUser} onOpenQuiz={() => setIsQuizOpen(true)} onScrollToCatalog={() => navigate('/thue')} onOpenAuth={() => navigate('/dang-nhap')} onLogout={handleLogout} onOpenMyRentals={() => navigate('/tai-khoan')} onOpenAdmin={() => navigate('/admin')} onOpenInfo={openInfo} />
      <Routes>
        <Route path="/" element={<><Hero onOpenQuiz={() => setIsQuizOpen(true)} onScrollToCatalog={() => navigate('/thue')} /><CatalogPage mode="ALL" /></>} />
        <Route path="/thue" element={<CatalogPage mode="RENT" />} />
        <Route path="/mua" element={<CatalogPage mode="BUY" />} />
        <Route path="/thiet-bi/:slug" element={<ProductPage />} />
        <Route path="/thiet-bi/:slug/xem-lai/:mode" element={<ReviewPage />} />
        <Route path="/thong-tin/:topic" element={<SupportPage />} />
        <Route path="/dang-nhap" element={<AuthPage mode="LOGIN" />} />
        <Route path="/dang-ky" element={<AuthPage mode="REGISTER" />} />
        <Route path="/tai-khoan" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute admin><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-20"><p className="text-xs uppercase tracking-wider text-film-warm">404</p><h1 className="mt-2 text-3xl font-bold text-white">Không tìm thấy trang</h1><p className="mt-3 text-slate-400">Đường dẫn này không có trong Filmiliar.</p><Link to="/" className="mt-6 inline-block rounded-lg bg-film-warm px-4 py-2.5 text-sm font-bold text-film-dark">Về trang chủ</Link></main>} />
      </Routes>
      <Footer onOpenInfo={openInfo} onOpenQuiz={() => setIsQuizOpen(true)} onScrollToCatalog={() => navigate('/thue')} />

      <CameraMatchQuizModal isOpen={isQuizOpen} onClose={() => setIsQuizOpen(false)} onSelectCamera={(camera) => { setIsQuizOpen(false); navigate(`/thiet-bi/${camera.slug}`); }} />
    </div>
  );
}
