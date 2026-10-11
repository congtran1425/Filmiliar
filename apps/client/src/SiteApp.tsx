import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { CameraMatchQuizModal } from './components/CameraMatchQuizModal';
import { AuthModal } from './components/AuthModal';
import { MyRentalsModal } from './components/MyRentalsModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { InfoTabType } from './components/InfoPagesModal';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { ReviewPage } from './pages/ReviewPage';
import { SupportPage, supportPaths } from './pages/SupportPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function SiteApp() {
  const navigate = useNavigate();
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMyRentalsOpen, setIsMyRentalsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try { const stored = localStorage.getItem('filmiliar_user'); return stored ? JSON.parse(stored) : null; }
    catch { return null; }
  });

  const handleLogout = () => {
    localStorage.removeItem('filmiliar_token');
    localStorage.removeItem('filmiliar_user');
    setCurrentUser(null);
  };
  const openInfo = (tab: InfoTabType) => navigate(supportPaths[tab]);

  return (
    <div className="flex min-h-screen flex-col bg-film-dark font-sans text-slate-100">
      <ScrollToTop />
      <Navbar currentUser={currentUser} onOpenQuiz={() => setIsQuizOpen(true)} onScrollToCatalog={() => navigate('/thue')} onOpenAuth={() => setIsAuthOpen(true)} onLogout={handleLogout} onOpenMyRentals={() => setIsMyRentalsOpen(true)} onOpenAdmin={() => setIsAdminOpen(true)} onOpenInfo={openInfo} />
      <Routes>
        <Route path="/" element={<><Hero onOpenQuiz={() => setIsQuizOpen(true)} onScrollToCatalog={() => navigate('/thue')} /><CatalogPage mode="ALL" /></>} />
        <Route path="/thue" element={<CatalogPage mode="RENT" />} />
        <Route path="/mua" element={<CatalogPage mode="BUY" />} />
        <Route path="/thiet-bi/:slug" element={<ProductPage />} />
        <Route path="/thiet-bi/:slug/xem-lai/:mode" element={<ReviewPage />} />
        <Route path="/thong-tin/:topic" element={<SupportPage />} />
        <Route path="*" element={<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-20"><p className="text-xs uppercase tracking-wider text-film-warm">404</p><h1 className="mt-2 text-3xl font-bold text-white">Không tìm thấy trang</h1><p className="mt-3 text-slate-400">Đường dẫn này không có trong Filmiliar.</p><Link to="/" className="mt-6 inline-block rounded-lg bg-film-warm px-4 py-2.5 text-sm font-bold text-film-dark">Về trang chủ</Link></main>} />
      </Routes>
      <Footer onOpenInfo={openInfo} onOpenQuiz={() => setIsQuizOpen(true)} onScrollToCatalog={() => navigate('/thue')} />

      <CameraMatchQuizModal isOpen={isQuizOpen} onClose={() => setIsQuizOpen(false)} onSelectCamera={(camera) => { setIsQuizOpen(false); navigate(`/thiet-bi/${camera.slug}`); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLoginSuccess={setCurrentUser} />
      <MyRentalsModal isOpen={isMyRentalsOpen} onClose={() => setIsMyRentalsOpen(false)} user={currentUser} />
      <AdminDashboardModal isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
    </div>
  );
}
