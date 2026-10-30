import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '../lib/CartContext';
import type { InfoTabType } from './InfoPagesModal';

type NavbarProps = {
  currentUser: { fullName?: string; email?: string; role?: string } | null;
  onOpenAuth: () => void; onLogout: () => void; onOpenMyRentals: () => void; onOpenAdmin: () => void;
  onOpenQuiz?: () => void; onScrollToCatalog?: () => void; onOpenInfo?: (tab: InfoTabType) => void;
};
const links = [
  { to: '/', label: 'Trang chủ' },
  { to: '/quy-trinh', label: 'Quy trình' },
  { to: '/san-pham', label: 'Sản phẩm' },
  { to: '/cam-nang', label: 'Cẩm nang' },
  { to: '/lien-he', label: 'Liên hệ' },
];

export function Navbar({ currentUser, onOpenAuth, onLogout, onOpenMyRentals, onOpenAdmin }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const location = useLocation();
  const cart = useCart();
  useEffect(() => { setMenuOpen(false); setAccountOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const navLink = (to: string, label: string) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `min-h-11 inline-flex items-center rounded-lg px-3 text-sm font-semibold transition-colors ${isActive ? 'bg-film-teal/10 text-film-teal' : 'text-film-ink/75 hover:bg-film-teal/5 hover:text-film-teal'}`}>{label}</NavLink>;
  return <header className="sticky top-0 z-40 border-b border-film-ink/10 bg-film-paper/95 text-film-ink backdrop-blur-md">
    <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <Link to="/" className="shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-teal" aria-label="Filmiliar, về trang chủ"><img src="/filmiliar-logo.png" alt="Filmiliar" className="h-10 w-auto" /></Link>
      <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">{links.map(({to,label}) => navLink(to,label))}</nav>
      <div className="flex items-center gap-1 sm:gap-2">
        <button type="button" onClick={() => { setMenuOpen(false); cart.openCart(); }} className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-film-ink/15 hover:border-film-teal" aria-label={`Mở bộ thiết bị dự kiến, ${cart.count} món`}><ShoppingBag size={20}/>{cart.count > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-film-teal px-1 text-[10px] font-bold text-white">{cart.count}</span>}</button>
        {currentUser ? <div className="relative"><button type="button" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen} className="flex h-11 items-center gap-2 rounded-lg border border-film-ink/15 px-3 text-xs font-semibold"><User size={17}/><span className="hidden max-w-24 truncate sm:block">{currentUser.fullName || currentUser.email}</span></button>{accountOpen && <div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-film-ink/15 bg-film-paperRaised p-1 shadow-xl"><button onClick={onOpenMyRentals} className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-film-paper">Tài khoản của tôi</button>{currentUser.role === 'ADMIN' && <button onClick={onOpenAdmin} className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-film-paper">Quản trị</button>}<button onClick={onLogout} className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-film-paper">Đăng xuất</button></div>}</div> : <button onClick={onOpenAuth} className="flex h-11 items-center gap-2 rounded-lg border border-film-ink/15 px-3 text-xs font-semibold hover:border-film-teal"><User size={17}/><span className="hidden sm:inline">Đăng nhập</span></button>}
        <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} className="flex h-11 w-11 items-center justify-center rounded-lg border border-film-ink/15 lg:hidden">{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </div>
    {menuOpen && <nav id="mobile-navigation" aria-label="Điều hướng trên điện thoại" className="grid gap-1 border-t border-film-ink/10 bg-film-paper px-4 py-3 shadow-lg lg:hidden">{links.map(({to,label}) => navLink(to,label))}{currentUser?.role === 'ADMIN' && <button onClick={onOpenAdmin} className="min-h-11 rounded-lg px-3 text-left text-sm font-semibold">Quản trị</button>}</nav>}
  </header>;
}
