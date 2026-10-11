import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CameraCard } from './components/CameraCard';
import { TechnicalPassportModal } from './components/TechnicalPassportModal';
import { CameraMatchQuizModal } from './components/CameraMatchQuizModal';
import { RentalBookingModal } from './components/RentalBookingModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { AuthModal } from './components/AuthModal';
import { MyRentalsModal } from './components/MyRentalsModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { InfoPagesModal, InfoTabType } from './components/InfoPagesModal';
import { Footer } from './components/Footer';
import { Camera as CameraType } from './types/camera';
import { ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');

  // Modals state
  const [selectedPassportCamera, setSelectedPassportCamera] = useState<CameraType | null>(null);
  const [selectedBookingCamera, setSelectedBookingCamera] = useState<CameraType | null>(null);
  const [selectedDetailCamera, setSelectedDetailCamera] = useState<CameraType | null>(null);
  const [isQuizOpen, setIsQuizOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isMyRentalsOpen, setIsMyRentalsOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [infoModalTab, setInfoModalTab] = useState<InfoTabType | null>(null);

  // User auth state
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('filmiliar_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const fetchCameras = async () => {
    try {
      const response = await fetch(apiUrl('/api/cameras'));
      const result = await response.json();
      if (result.success && result.data) {
        setCameras(result.data);
      }
    } catch (error) {
      console.warn('Backend API not responding, using static fallback:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('filmiliar_token');
    localStorage.removeItem('filmiliar_user');
    setCurrentUser(null);
  };

  const filteredCameras = cameras.filter((cam) => {
    if (selectedBrand === 'ALL') return true;
    return cam.brand.toLowerCase() === selectedBrand.toLowerCase();
  });

  const scrollToCatalog = () => {
    const el = document.getElementById('catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-film-dark text-slate-100 flex flex-col font-sans">
      {/* Navigation */}
      <Navbar 
        currentUser={currentUser}
        onOpenQuiz={() => setIsQuizOpen(true)} 
        onScrollToCatalog={scrollToCatalog}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenMyRentals={() => setIsMyRentalsOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenInfo={(tab) => setInfoModalTab(tab)}
      />

      {/* Hero Section */}
      <Hero 
        onOpenQuiz={() => setIsQuizOpen(true)} 
        onScrollToCatalog={scrollToCatalog}
      />

      {/* Main Catalog Section */}
      <main id="catalog" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full space-y-10">
        {/* Section Header & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="text-xs font-mono font-semibold text-amber-500 uppercase tracking-wider">
              Danh mục thiết bị sẵn có
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Máy ảnh & ống kính
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Khám phá giá tham khảo và thông tin của từng thiết bị. Hồ sơ kiểm định chỉ hiển thị khi đã có dữ liệu.
            </p>
          </div>

          {/* Brand Filter Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            {['ALL', 'Sony', 'Fujifilm', 'Canon'].map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedBrand === brand
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {brand === 'ALL' ? 'Tất cả thương hiệu' : brand}
              </button>
            ))}
          </div>
        </div>

        {/* Camera Cards Grid */}
        {loading ? (
          <div className="text-center py-20 p-8 rounded-2xl bg-slate-900/40 border border-slate-800">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-slate-400 text-xs">Đang tải dữ liệu kiểm định thiết bị...</p>
          </div>
        ) : filteredCameras.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCameras.map((camera) => (
              <CameraCard
                key={camera.id}
                camera={camera}
                onViewDetail={(c) => setSelectedDetailCamera(c)}
                onViewPassport={(c) => setSelectedPassportCamera(c)}
                onBookRental={(c) => setSelectedBookingCamera(c)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 p-8 rounded-2xl bg-slate-900/40 border border-slate-800">
            <p className="text-slate-400 text-sm">Không tìm thấy thiết bị thuộc bộ lọc này.</p>
          </div>
        )}

        {/* Technical Passport Educational Section */}
        <section id="passport-info" className="mt-20 p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 space-y-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Hồ sơ thiết bị Filmiliar</span>
            </div>
            <h3 className="text-2xl font-bold text-white mt-2">
              Hồ sơ kỹ thuật giúp bạn xem những gì?
            </h3>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Khi chọn máy cũ, các chi tiết như số lần trập, tình trạng cảm biến và vết xước giúp người xem đánh giá thiết bị. Filmiliar chỉ nên hiển thị kết quả đã được kiểm tra và gắn với đúng chiếc máy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div 
              onClick={() => setInfoModalTab('INSPECTION')}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 cursor-pointer hover:border-amber-500/50 transition-colors"
            >
              <div className="text-amber-400 font-mono text-sm font-bold">01. Minh bạch số shot</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Số lần trập cần có nguồn kiểm tra phù hợp với từng mẫu máy; không nên suy đoán khi thiếu dữ liệu.
              </p>
            </div>

            <div 
              onClick={() => setInfoModalTab('INSPECTION')}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 cursor-pointer hover:border-amber-500/50 transition-colors"
            >
              <div className="text-amber-400 font-mono text-sm font-bold">02. Soi cảm biến & thấu kính</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tình trạng cảm biến và ống kính cần được mô tả theo kết quả kiểm tra thực tế của từng thiết bị.
              </p>
            </div>

            <div 
              onClick={() => setInfoModalTab('DEPOSIT_POLICY')}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 cursor-pointer hover:border-amber-500/50 transition-colors"
            >
              <div className="text-amber-400 font-mono text-sm font-bold">03. Đồng kiểm vết xước & Cọc</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hộ chiếu kỹ thuật dự kiến ghi nhận vết xước của từng thiết bị; quy tắc đặt cọc và hoàn cọc đang được nhóm xây dựng.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer 
        onOpenInfo={(tab) => setInfoModalTab(tab)}
        onOpenQuiz={() => setIsQuizOpen(true)}
        onScrollToCatalog={scrollToCatalog}
      />

      {/* Modals */}
      {/* 1. Technical Passport Modal */}
      <TechnicalPassportModal
        camera={selectedPassportCamera}
        onClose={() => setSelectedPassportCamera(null)}
        onBookRental={(c) => setSelectedBookingCamera(c)}
      />

      {/* 2. Full Product Detail Page Modal */}
      <ProductDetailModal
        camera={selectedDetailCamera}
        onClose={() => setSelectedDetailCamera(null)}
        onBookRental={(c) => setSelectedBookingCamera(c)}
        onViewPassport={(c) => setSelectedPassportCamera(c)}
      />

      {/* 3. Camera Match Quiz Modal */}
      <CameraMatchQuizModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        onSelectCamera={(c) => setSelectedBookingCamera(c)}
      />

      {/* 4. Rental Booking & ZaloPay Payment Modal */}
      <RentalBookingModal
        camera={selectedBookingCamera}
        onClose={() => setSelectedBookingCamera(null)}
        onBookingSuccess={() => {
          setSelectedBookingCamera(null);
          setIsMyRentalsOpen(true);
        }}
      />

      {/* 5. User Authentication & eKYC Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* 6. My Rentals Customer Portal Modal */}
      <MyRentalsModal
        isOpen={isMyRentalsOpen}
        onClose={() => setIsMyRentalsOpen(false)}
        user={currentUser}
      />

      {/* 7. Admin Dashboard Hub Modal */}
      <AdminDashboardModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />

      {/* 8. Information & Policy Pages Modal */}
      <InfoPagesModal
        isOpen={infoModalTab !== null}
        initialTab={infoModalTab || 'INSPECTION'}
        onClose={() => setInfoModalTab(null)}
      />
    </div>
  );
};

export default App;
import { apiUrl } from './lib/api';
