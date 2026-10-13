import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Sparkles, 
  ShieldCheck, 
  User, 
  LogOut, 
  ChevronDown, 
  BookOpen, 
  Menu, 
  X, 
  Camera, 
  ShoppingBag, 
  RotateCcw,
  PhoneCall
} from 'lucide-react';
import { InfoTabType } from './InfoPagesModal';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  currentUser: any;
  onOpenQuiz: () => void;
  onScrollToCatalog: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenMyRentals: () => void;
  onOpenAdmin: () => void;
  onOpenInfo: (tab: InfoTabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentUser,
  onOpenQuiz, 
  onScrollToCatalog: _onScrollToCatalog,
  onOpenAuth,
  onLogout,
  onOpenMyRentals,
  onOpenAdmin,
  onOpenInfo
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const location = useLocation();

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname, location.search]);

  // Handle ESC key and lock body scroll when mobile drawer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserDropdownOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 film-glass film-border border-x-0 border-t-0 shadow-sm shadow-film-ink/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand logo */}
        <Link
          to="/"
          className="flex-shrink-0 rounded-lg px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-teal"
          aria-label="Filmiliar — về đầu trang"
        >
          <img src="/filmiliar-logo.png" alt="Filmiliar" className="block h-9 w-auto sm:h-10" />
        </Link>

        {/* Desktop Navigation links */}
        <nav className="hidden lg:flex items-center space-x-6 text-xs font-medium text-film-ink/80">
          <Link 
            to="/thue" 
            className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors ${
              location.pathname === '/thue' ? 'text-film-teal font-bold' : 'hover:text-film-teal'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Thuê máy</span>
          </Link>

          <Link 
            to="/mua" 
            className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors ${
              location.pathname === '/mua' ? 'text-film-teal font-bold' : 'hover:text-film-teal'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Mua máy</span>
          </Link>

          <button 
            onClick={onOpenQuiz} 
            className="flex items-center space-x-1.5 text-film-teal hover:text-film-ink transition-colors px-2 py-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Camera Match Quiz</span>
          </button>

          <button 
            onClick={() => onOpenInfo('INSPECTION')}
            className="flex items-center space-x-1 hover:text-film-teal transition-colors px-2 py-1"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-film-teal" />
            <span>Hồ sơ thiết bị</span>
          </button>

          <button 
            onClick={() => onOpenInfo('DEPOSIT_POLICY')}
            className="hover:text-film-teal transition-colors px-2 py-1"
          >
            Thông tin đặt cọc
          </button>

          <button 
            onClick={() => onOpenInfo('BLOG')}
            className="flex items-center space-x-1 hover:text-film-teal transition-colors px-2 py-1"
          >
            <BookOpen className="w-3.5 h-3.5 text-film-teal" />
            <span>Cẩm nang</span>
          </button>

          <button 
            onClick={() => onOpenInfo('CONTACT')}
            className="hover:text-film-teal transition-colors px-2 py-1"
          >
            Liên hệ
          </button>
        </nav>

        {/* Action Button & User Profile */}
        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          {currentUser?.role === 'ADMIN' && <Link to="/admin" className="hidden min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg bg-film-teal px-3 text-xs font-bold text-white hover:bg-film-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-teal xl:inline-flex"><ShieldCheck className="h-4 w-4" /> Trung tâm quản trị</Link>}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="min-h-[44px] flex items-center space-x-1.5 py-1.5 px-2 sm:px-3 rounded-lg bg-film-paperRaised border border-film-ink/15 text-xs font-semibold text-film-ink hover:border-film-teal transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-teal"
                aria-expanded={userDropdownOpen}
                aria-haspopup="true"
                aria-label="Tài khoản cá nhân"
              >
                <div className="w-6 h-6 rounded-full bg-film-warm/20 text-film-teal flex items-center justify-center text-[11px] font-bold">
                  {currentUser.fullName ? currentUser.fullName[0].toUpperCase() : 'U'}
                </div>
                <span className="hidden sm:inline-block max-w-[120px] truncate">{currentUser.fullName || currentUser.email}</span>
                <ChevronDown className="w-3.5 h-3.5 text-film-ink/50" />
              </button>

              {userDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-52 bg-film-dark border border-film-border rounded-xl shadow-xl p-1.5 z-50 text-xs space-y-1 animate-fade-in"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <button
                    onClick={onOpenMyRentals}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-film-card text-slate-200 transition-colors flex items-center space-x-2 min-h-[44px]"
                  >
                    <User className="w-4 h-4 text-film-warm" />
                    <span>Tài khoản của tôi</span>
                  </button>

                  {currentUser.role === 'ADMIN' && (
                    <button
                      onClick={onOpenAdmin}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-film-card text-film-warm font-bold transition-colors flex items-center space-x-2 min-h-[44px]"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Trung tâm quản trị</span>
                    </button>
                  )}

                  <div className="border-t border-film-border my-1"></div>

                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors flex items-center space-x-2 min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="min-h-[44px] min-w-[44px] py-1.5 px-2.5 rounded-lg bg-film-paperRaised hover:bg-white border border-film-ink/15 text-xs font-semibold text-film-ink transition-colors flex items-center justify-center space-x-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-teal"
              aria-label="Đăng nhập"
            >
              <User className="w-4 h-4 text-film-teal" />
              <span className="hidden sm:inline">Đăng nhập</span>
            </button>
          )}

          {/* Quick Quiz CTA on desktop */}
          <button 
            onClick={onOpenQuiz}
            className="hidden sm:inline-flex min-h-[44px] text-xs font-bold px-3.5 py-2 rounded-lg bg-film-teal hover:bg-film-ink text-white transition-all shadow-sm active:scale-95 items-center space-x-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-teal"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tư vấn máy</span>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-film-paperRaised hover:bg-white border border-film-ink/15 text-film-ink flex items-center justify-center space-x-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-teal"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu điều hướng'}
          >
            {mobileMenuOpen ? (
              <>
                <X className="w-4 h-4 text-film-ink" aria-hidden="true" />
                <span className="text-[11px] font-bold">Đóng</span>
              </>
            ) : (
              <>
                <Menu className="w-4 h-4 text-film-ink" aria-hidden="true" />
                <span className="text-[11px] font-bold">Menu</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay & Drawer Panel via Portal to escape header containing block */}
      {mobileMenuOpen && typeof document !== 'undefined' && createPortal(
        <div 
          id="mobile-nav-panel"
          className="lg:hidden fixed inset-0 top-16 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex flex-col justify-start"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-full max-h-[calc(100dvh-4rem)] overflow-y-auto bg-film-paper border-b border-film-ink/15 shadow-2xl p-4 sm:p-6 text-film-ink space-y-5 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Primary Intent Nav Cards (Thuê & Mua) */}
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/thue"
                onClick={() => setMobileMenuOpen(false)}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-colors min-h-[64px] ${
                  location.pathname === '/thue'
                    ? 'bg-film-teal text-white border-film-teal shadow-md'
                    : 'bg-white border-film-ink/15 text-film-ink hover:border-film-teal'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Camera className="w-4 h-4" />
                  <span className="font-bold text-sm">Thuê máy</span>
                </div>
                <span className={`text-[11px] mt-1 ${location.pathname === '/thue' ? 'text-white/80' : 'text-film-ink/65'}`}>
                  Theo ngày trải nghiệm
                </span>
              </Link>

              <Link
                to="/mua"
                onClick={() => setMobileMenuOpen(false)}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-colors min-h-[64px] ${
                  location.pathname === '/mua'
                    ? 'bg-film-teal text-white border-film-teal shadow-md'
                    : 'bg-white border-film-ink/15 text-film-ink hover:border-film-teal'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="font-bold text-sm">Mua máy</span>
                </div>
                <span className={`text-[11px] mt-1 ${location.pathname === '/mua' ? 'text-white/80' : 'text-film-ink/65'}`}>
                  Máy cũ tham khảo
                </span>
              </Link>
            </div>

            {/* Quiz Action */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenQuiz();
              }}
              className="w-full p-3.5 rounded-xl bg-film-paperRaised hover:bg-white border border-film-teal/30 text-film-ink flex items-center justify-between min-h-[48px] transition-all"
            >
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-film-teal/10 text-film-teal">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-film-ink">Camera Match Quiz</div>
                  <div className="text-[11px] text-film-ink/65">Tư vấn chọn máy trong 1 phút</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-film-teal">Bắt đầu →</span>
            </button>

            {/* Informational Links */}
            <div className="pt-2 border-t border-film-ink/10 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-film-ink/50 block px-2 mb-1">
                Thông tin & Hỗ trợ
              </span>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenInfo('INSPECTION');
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-film-paperRaised text-xs font-medium text-film-ink min-h-[44px] text-left transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-film-teal" />
                <span>Hồ sơ thiết bị & Quy trình kiểm định</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenInfo('DEPOSIT_POLICY');
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-film-paperRaised text-xs font-medium text-film-ink min-h-[44px] text-left transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-film-teal" />
                <span>Thông tin đặt cọc</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenInfo('WARRANTY');
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-film-paperRaised text-xs font-medium text-film-ink min-h-[44px] text-left transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-film-teal" />
                <span>Thông tin bảo hành</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenInfo('BLOG');
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-film-paperRaised text-xs font-medium text-film-ink min-h-[44px] text-left transition-colors"
              >
                <BookOpen className="w-4 h-4 text-film-teal" />
                <span>Cẩm nang nhiếp ảnh</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenInfo('CONTACT');
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-film-paperRaised text-xs font-medium text-film-ink min-h-[44px] text-left transition-colors"
              >
                <PhoneCall className="w-4 h-4 text-film-teal" />
                <span>Liên hệ nhóm Filmiliar</span>
              </button>
            </div>

            {/* User Account / Auth Actions */}
            <div className="pt-2 border-t border-film-ink/10">
              {currentUser ? (
                <div className="space-y-1">
                  <div className="px-3 py-2 text-xs text-film-ink/75 font-semibold">
                    Đang đăng nhập: <strong className="text-film-ink">{currentUser.fullName || currentUser.email}</strong>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenMyRentals();
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-film-paperRaised text-xs font-medium text-film-ink min-h-[44px] text-left transition-colors"
                  >
                    <User className="w-4 h-4 text-film-warm" />
                    <span>Tài khoản của tôi</span>
                  </button>
                  {currentUser.role === 'ADMIN' && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAdmin();
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-film-paperRaised text-xs font-bold text-film-teal min-h-[44px] text-left transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-film-teal" />
                      <span>Trang quản trị</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-red-50 text-xs font-semibold text-red-600 min-h-[44px] text-left transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-film-teal hover:bg-film-ink text-white font-bold text-xs min-h-[44px] flex items-center justify-center space-x-2 transition-all"
                >
                  <User className="w-4 h-4" />
                  <span>Đăng nhập hoặc Đăng ký</span>
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};


