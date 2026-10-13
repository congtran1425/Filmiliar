import React, { useState } from 'react';
import { X, Lock, Mail, User, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Form states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'LOGIN' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'LOGIN' 
        ? { email, password } 
        : { email, password, fullName, phone };

      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem('filmiliar_token', data.token);
        localStorage.setItem('filmiliar_user', JSON.stringify(data.user));
        onLoginSuccess(data.user, data.token);
        onClose();
      } else {
        setError(data.message || 'Thao tác thất bại');
      }
    } catch (err: any) {
      setError('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-film-dark border border-film-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-film-border bg-film-dark flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-film-warm/15 text-film-warm">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 id="auth-modal-title" className="text-sm font-bold text-white">
                {mode === 'LOGIN' ? 'Đăng nhập Filmiliar' : 'Đăng ký tài khoản'}
              </h3>
              <p className="text-[11px] text-slate-400">Theo dõi thông tin; chưa mở thanh toán trực tuyến</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-white flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"
            aria-label="Đóng cửa sổ đăng nhập"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-film-card border-b border-film-border text-xs shrink-0">
          <button
            type="button"
            onClick={() => setMode('LOGIN')}
            className={`min-h-[40px] rounded-lg font-bold transition-all flex items-center justify-center ${
              mode === 'LOGIN' 
                ? 'bg-film-warm text-film-dark shadow-sm' 
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => setMode('REGISTER')}
            className={`min-h-[40px] rounded-lg font-bold transition-all flex items-center justify-center ${
              mode === 'REGISTER' 
                ? 'bg-film-warm text-film-dark shadow-sm' 
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Đăng ký mới
          </button>
        </div>

        {/* Form Body with internal scrolling */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto flex-1 pb-safe text-xs sm:text-sm text-slate-300">
          {error && (
            <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed">
              {error}
            </div>
          )}

          {mode === 'REGISTER' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Họ và tên</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-film-card border border-film-border text-base sm:text-sm text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Số điện thoại</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0909xxxxxx"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-film-card border border-film-border text-base sm:text-sm text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-film-card border border-film-border text-base sm:text-sm text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mật khẩu</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-film-card border border-film-border text-base sm:text-sm text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] rounded-xl bg-film-warm hover:bg-amber-300 text-film-dark font-extrabold text-xs sm:text-sm transition-all active:scale-95 flex items-center justify-center space-x-2 shadow-md shadow-film-warm/10 mt-3"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{mode === 'LOGIN' ? 'Đăng nhập ngay' : 'Tạo tài khoản'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};

