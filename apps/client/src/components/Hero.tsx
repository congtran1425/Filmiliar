import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Camera, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeroProps {
  onOpenQuiz: () => void;
  onScrollToCatalog: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenQuiz }) => {
  return (
    <section className="relative overflow-hidden bg-film-paper text-film-ink py-8 sm:py-16 lg:py-20 border-b border-film-ink/10">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-film-teal/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6">
          {/* Badge */}
          <div className="inline-flex max-w-full items-center gap-2 px-3 py-1 rounded-full bg-film-teal/10 border border-film-teal/20 text-film-teal text-[11px] sm:text-xs font-medium">
            <span className="w-1.5 h-1.5 flex-shrink-0 rounded-full bg-film-teal"></span>
            <span className="min-w-0 whitespace-normal text-left sm:text-center">Máy ảnh second-hand & cho thuê tại TP.HCM</span>
          </div>

          {/* Main Headline */}
          <h1 className="min-w-0 text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-film-ink leading-tight [overflow-wrap:anywhere]">
            Ghi trọn khoảnh khắc, <br />
            <span className="text-film-teal">
              không cần chi bộn tiền.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-film-ink/75 leading-relaxed max-w-2xl mx-auto px-2">
            Khám phá máy ảnh để thuê hoặc mua, xem ảnh, giá và thông tin tình trạng đang có của từng thiết bị trước khi quyết định.
          </p>

          {/* Action CTAs: Dual Intent (Thuê & Mua) first, then Quiz */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 max-w-md sm:max-w-none mx-auto">
            <Link
              to="/thue"
              className="min-h-[44px] px-6 py-3 rounded-xl bg-film-teal hover:bg-film-ink text-white font-bold text-sm transition-all shadow-md shadow-film-teal/15 active:scale-95 flex items-center justify-center space-x-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-teal"
            >
              <Camera className="w-4 h-4" />
              <span>Thuê máy theo ngày</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Link>

            <Link
              to="/mua"
              className="min-h-[44px] px-6 py-3 rounded-xl bg-film-paperRaised hover:bg-white border border-film-ink/20 text-film-ink font-bold text-sm transition-all active:scale-95 flex items-center justify-center space-x-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-teal"
            >
              <ShoppingBag className="w-4 h-4 text-film-teal" />
              <span>Tìm máy để mua</span>
            </Link>

            <button
              onClick={onOpenQuiz}
              type="button"
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-dashed border-film-teal/40 hover:bg-film-teal/5 text-film-teal text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-teal"
            >
              <Sparkles className="w-3.5 h-3.5 text-film-teal" />
              <span>Quiz tư vấn máy (1 phút)</span>
            </button>
          </div>

          {/* Condensed Trust Bar for Mobile & Desktop */}
          <div className="pt-5 sm:pt-8 border-t border-film-ink/10">
            {/* Desktop 3 columns */}
            <div className="hidden sm:grid grid-cols-3 gap-3 text-left">
              <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-film-paperRaised/80 border border-film-ink/10">
                <ShieldCheck className="w-4 h-4 text-film-teal flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-film-ink">Hồ sơ từng thiết bị</h4>
                  <p className="text-[11px] text-film-ink/65 mt-0.5">Xem thông tin kỹ thuật khi thiết bị đã có hồ sơ kiểm định.</p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-film-paperRaised/80 border border-film-ink/10">
                <CheckCircle2 className="w-4 h-4 text-film-teal flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-film-ink">Xem trước chi phí</h4>
                  <p className="text-[11px] text-film-ink/65 mt-0.5">Giá thuê và mua tham khảo; chưa mở nhận đơn trực tuyến.</p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-film-paperRaised/80 border border-film-ink/10">
                <Sparkles className="w-4 h-4 text-film-teal flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-film-ink">Tư vấn theo nhu cầu</h4>
                  <p className="text-[11px] text-film-ink/65 mt-0.5">Dùng quiz để tìm gợi ý cho chuyến đi, chụp ảnh hoặc vlog.</p>
                </div>
              </div>
            </div>

            {/* Mobile Condensed Note */}
            <div className="sm:hidden flex items-center justify-center gap-2 text-[11px] text-film-ink/70">
              <ShieldCheck className="w-3.5 h-3.5 text-film-teal shrink-0" />
              <span>Hồ sơ từng máy · Giá minh bạch · Chưa thu tiền trực tuyến</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

