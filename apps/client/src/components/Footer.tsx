import React from 'react';
import { ShieldCheck, RotateCcw, BookOpen } from 'lucide-react';
import { InfoTabType } from './InfoPagesModal';
import { Link } from 'react-router-dom';

interface FooterProps {
  onOpenInfo: (tab: InfoTabType) => void;
  onOpenQuiz: () => void;
  onScrollToCatalog: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenInfo, onOpenQuiz, onScrollToCatalog }) => {
  return (
    <footer className="border-t border-film-border bg-film-dark text-slate-400 text-xs py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <Link
              to="/"
              className="inline-flex rounded-lg bg-film-paperRaised px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-warm"
              aria-label="Filmiliar — về đầu trang"
            >
              <img src="/filmiliar-logo.png" alt="" className="block h-9 w-auto" />
            </Link>
            <p className="text-slate-400 text-xs leading-relaxed">
              Khám phá máy ảnh second-hand để thuê hoặc mua. Thông tin về tình trạng thiết bị được hiển thị khi đã có hồ sơ kiểm định.
            </p>
            <nav aria-label="Đường dẫn chính" className="flex flex-wrap gap-x-3 gap-y-1 text-xs"><Link to="/quy-trinh" className="hover:text-white">Quy trình</Link><Link to="/san-pham" className="hover:text-white">Sản phẩm</Link><Link to="/cam-nang" className="hover:text-white">Cẩm nang</Link><Link to="/lien-he" className="hover:text-white">Liên hệ</Link></nav>
            <p className="text-[11px] text-slate-500 font-mono">
              Dự án môn học của Nhóm 1 · UEH.
            </p>
          </div>

          {/* Col 2 */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Khám phá Filmiliar</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={onScrollToCatalog} className="hover:text-amber-400 transition-colors">
                  Danh mục máy ảnh & ống kính
                </button>
              </li>
              <li>
                <button onClick={() => onOpenInfo('INSPECTION')} className="hover:text-amber-400 transition-colors flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Thông tin kiểm định</span>
                </button>
              </li>

              <li>
                <button onClick={() => onOpenInfo('DEPOSIT_POLICY')} className="hover:text-amber-400 transition-colors flex items-center space-x-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Thông tin đặt cọc</span>
                </button>
              </li>
              <li>
                <button onClick={() => onOpenInfo('WARRANTY')} className="hover:text-amber-400 transition-colors">
                  Thông tin bảo hành
                </button>
              </li>
              <li>
                <button onClick={onOpenQuiz} className="hover:text-amber-400 transition-colors">
                  Camera Match Quiz (Tư vấn máy)
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Hỗ trợ & thông tin</h4>
            <div className="space-y-2 text-slate-400">
              <button
                onClick={() => onOpenInfo('CONTACT')}
                className="flex items-start space-x-2 text-left hover:text-white transition-colors"
              >
                <span>Liên hệ nhóm Filmiliar</span>
              </button>
              <button onClick={() => onOpenInfo('BLOG')} className="hover:text-film-warm transition-colors flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5 text-film-warm" />
                <span>Cẩm nang & kinh nghiệm nhiếp ảnh</span>
              </button>
            </div>
          </div>

          {/* Col 4 */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Thuê máy dễ dàng</h4>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-2 text-slate-300 leading-relaxed">
              <p>Chọn chiếc máy và kiểm tra lịch thuê.</p>
              <p>Xem rõ tiền thuê và mức cọc trước khi đặt.</p>
              <p>Theo dõi bàn giao và hoàn cọc trong tài khoản.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500">
          <div>© 2026 Filmiliar. Bản quyền thuộc Nhóm 1 - Khóa TMĐT UEH.</div>
          <div className="flex space-x-4 mt-2 sm:mt-0">
            <button onClick={() => onOpenInfo('DEPOSIT_POLICY')} className="hover:underline">
              Thông tin đặt cọc
            </button>
            <button onClick={() => onOpenInfo('CONTACT')} className="hover:underline">
              Liên hệ
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
