import React from 'react';
import type { SupportInfoTab } from '../pages/SupportPage';
import { Link } from 'react-router-dom';
import { filmiliarContact, filmiliarCopyright } from '../content/filmiliar';

interface FooterProps {
  onOpenInfo: (tab: SupportInfoTab) => void;
  onOpenQuiz: () => void;
  onScrollToCatalog: () => void;
}

/* Hallmark · component: footer · theme: Filmiliar · pre-emit critique: P4 H4 E4 S5 R5 V4 */
const footerLink = 'inline-flex max-w-full items-center py-1 text-left leading-6 transition-colors hover:text-film-warm focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-warm active:text-film-warm';

export const Footer: React.FC<FooterProps> = ({ onOpenInfo, onOpenQuiz, onScrollToCatalog }) => {
  return (
    <footer className="border-t border-film-border bg-film-dark py-8 text-sm text-slate-300 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)_minmax(0,1.3fr)]">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <Link
              to="/"
              className="inline-flex rounded-lg bg-film-paperRaised px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-warm"
              aria-label="Filmiliar — về đầu trang"
            >
              <img src="/filmiliar-logo.png" alt="" className="block h-8 w-auto" />
            </Link>
            <p className="mt-3 max-w-[32ch] text-sm leading-6 text-slate-400">
              Máy ảnh và ống kính second-hand để thuê hoặc mua.
            </p>
          </div>

          <nav aria-label="Khám phá Filmiliar" className="min-w-0">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white">Khám phá Filmiliar</h2>
            <ul>
              <li>
                <button type="button" onClick={onScrollToCatalog} className={footerLink}>
                  Danh mục thiết bị
                </button>
              </li>
              <li>
                <Link to="/quy-trinh" className={footerLink}>Quy trình thuê</Link>
              </li>
              <li>
                <button type="button" onClick={onOpenQuiz} className={footerLink}>
                  Tư vấn chọn máy
                </button>
              </li>
            </ul>
          </nav>

          <section aria-labelledby="footer-contact-title" className="min-w-0">
            <h2 id="footer-contact-title" className="mb-2 text-xs font-semibold uppercase tracking-wider text-white">Hỗ trợ & thông tin</h2>
            <address className="flex flex-col items-start text-xs not-italic">
              <a href={filmiliarContact.phoneHref} className={`${footerLink} text-sm font-medium text-white`}>{filmiliarContact.phone}</a>
              <a href={`mailto:${filmiliarContact.email}`} className={footerLink}>{filmiliarContact.email}</a>
              <a href={filmiliarContact.mapsUrl} target="_blank" rel="noopener noreferrer" className={footerLink}>{filmiliarContact.address}</a>
            </address>
          </section>
        </div>

        <div className="mt-6 flex flex-col gap-x-6 gap-y-2 border-t border-film-border pt-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div>{filmiliarCopyright}</div>
          <nav aria-label="Chính sách Filmiliar" className="flex flex-wrap gap-x-5">
            <button type="button" onClick={() => onOpenInfo('DEPOSIT_POLICY')} className={footerLink}>
              Thông tin đặt cọc
            </button>
            <button type="button" onClick={() => onOpenInfo('WARRANTY')} className={footerLink}>
              Thông tin bảo hành
            </button>
            <Link to="/thong-tin/chinh-sach" className={footerLink}>Chính sách thuê và bán</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};
