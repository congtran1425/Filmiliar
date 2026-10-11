import React, { useState } from 'react';
import { Camera as CameraType, QuizResult } from '../types/camera';
import { X, Sparkles, ArrowRight, ArrowLeft, ThumbsUp, RefreshCw, Camera } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface CameraMatchQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCamera: (camera: CameraType) => void;
}

export const CameraMatchQuizModal: React.FC<CameraMatchQuizModalProps> = ({ isOpen, onClose, onSelectCamera }) => {
  const [step, setStep] = useState<number>(1);
  const [purpose, setPurpose] = useState<string>('CONCERT');
  const [experience, setExperience] = useState<string>('BEGINNER');
  const [budget, setBudget] = useState<string>('MEDIUM');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCalculateRecommendation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/quiz/recommend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          experienceLevel: experience,
          budgetRange: budget
        })
      });
      const data = await response.json();
      if (data.success && data.recommendation) {
        setResult(data.recommendation);
      } else {
        setError(data.message || 'Chưa thể tạo gợi ý lúc này.');
      }
    } catch (error) {
      console.error('Quiz recommendation error:', error);
      setError('Không kết nối được dịch vụ gợi ý. Bạn có thể xem danh mục để chọn máy.');
    } finally {
      setLoading(false);
      setStep(4);
    }
  };

  const handleReset = () => {
    setStep(1);
    setResult(null);
    setError(null);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-film-dark border border-film-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-film-border bg-film-dark flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-film-warm/15 text-film-warm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="quiz-modal-title" className="text-sm font-bold text-white">Camera Match Quiz</h3>
              <p className="text-[11px] text-slate-400">Tư vấn bộ máy và hình thức (thuê/mua) phù hợp</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-white flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"
            aria-label="Đóng Quiz"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content based on step with internal scrolling */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 pb-safe">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono text-film-warm uppercase tracking-wider font-bold">Bước 1 / 3</span>
                <h4 className="text-base sm:text-lg font-bold text-white mt-1">Bạn dự định dùng máy ảnh cho dịp gì nhất?</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {[
                  { id: 'CONCERT', label: 'Đi Concert / Đu Idol', desc: 'Zoom xa, bắt nét nhanh trong thiếu sáng' },
                  { id: 'TRAVEL_SHORT', label: 'Du lịch / Dã ngoại', desc: 'Gọn nhẹ, pin tốt, chụp phong cảnh & chân dung' },
                  { id: 'TIKTOK_VLOG', label: 'Quay TikTok / Làm Vlog', desc: 'Màn hình lật, bắt nét mắt, mic thu tốt' },
                  { id: 'LEARN_PHOTOGRAPHY', label: 'Học quay chụp / Chụp kỷ yếu', desc: 'Dễ làm quen, tone màu đẹp tự nhiên' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPurpose(item.id)}
                    className={`p-3.5 rounded-xl text-left border transition-all min-h-[64px] flex flex-col justify-center active:scale-[0.99] ${
                      purpose === item.id 
                        ? 'bg-film-warm/15 border-film-warm text-white ring-1 ring-film-warm/40' 
                        : 'bg-film-card border-film-border text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold">{item.label}</div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">{item.desc}</div>
                  </button>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-film-warm hover:bg-amber-300 text-film-dark font-extrabold text-xs sm:text-sm flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm"
                >
                  <span>Tiếp tục</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono text-film-warm uppercase tracking-wider font-bold">Bước 2 / 3</span>
                <h4 className="text-base sm:text-lg font-bold text-white mt-1">Kinh nghiệm sử dụng máy ảnh của bạn?</h4>
              </div>

              <div className="space-y-2.5 pt-1">
                {[
                  { id: 'BEGINNER', title: 'Người mới bắt đầu', desc: 'Chủ yếu chụp điện thoại, muốn máy có chế độ tự động thông minh và dễ thao tác' },
                  { id: 'INTERMEDIATE', title: 'Đã biết cơ bản', desc: 'Biết chỉnh khẩu độ, ISO, tốc độ trập, muốn thử ống kính cao cấp đa dụng' },
                  { id: 'ADVANCED', title: 'Bán chuyên / Chuyên nghiệp', desc: 'Cần thiết bị Full-frame cao cấp phục vụ dự án chất lượng cao' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExperience(item.id)}
                    className={`w-full p-3.5 rounded-xl text-left border transition-all min-h-[60px] active:scale-[0.99] ${
                      experience === item.id 
                        ? 'bg-film-warm/15 border-film-warm text-white ring-1 ring-film-warm/40' 
                        : 'bg-film-card border-film-border text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold">{item.title}</div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">{item.desc}</div>
                  </button>
                ))}
              </div>

              <div className="pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-film-card border border-film-border text-slate-300 text-xs sm:text-sm font-semibold flex items-center space-x-1 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-film-warm hover:bg-amber-300 text-film-dark font-extrabold text-xs sm:text-sm flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm"
                >
                  <span>Tiếp tục</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono text-film-warm uppercase tracking-wider font-bold">Bước 3 / 3</span>
                <h4 className="text-base sm:text-lg font-bold text-white mt-1">Dự trù ngân sách bạn muốn chi trả?</h4>
              </div>

              <div className="space-y-2.5 pt-1">
                {[
                  { id: 'LOW', title: 'Tiết kiệm tối đa (Dưới 250.000 đ/ngày)', desc: 'Chỉ cần máy nhỏ gọn, chụp nét hơn điện thoại và chi phí thấp nhất' },
                  { id: 'MEDIUM', title: 'Tiêu chuẩn (250.000 - 450.000 đ/ngày)', desc: 'Dòng máy phổ biến, màu đẹp, đầy đủ ống kính đa dụng' },
                  { id: 'HIGH', title: 'Muốn sở hữu hoặc dùng máy cao cấp', desc: 'Sẵn sàng đầu tư để sở hữu máy second-hand hoặc thuê flagship' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBudget(item.id)}
                    className={`w-full p-3.5 rounded-xl text-left border transition-all min-h-[60px] active:scale-[0.99] ${
                      budget === item.id 
                        ? 'bg-film-warm/15 border-film-warm text-white ring-1 ring-film-warm/40' 
                        : 'bg-film-card border-film-border text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold">{item.title}</div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">{item.desc}</div>
                  </button>
                ))}
              </div>

              <div className="pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-film-card border border-film-border text-slate-300 text-xs sm:text-sm font-semibold flex items-center space-x-1 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>
                <button
                  type="button"
                  onClick={handleCalculateRecommendation}
                  disabled={loading}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-film-warm hover:bg-amber-300 text-film-dark font-extrabold text-xs sm:text-sm flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
                >
                  {loading ? (
                    <span>Đang phân tích...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Xem gợi ý ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 4 && result && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-film-warm/10 border border-film-warm/30">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-film-warm">
                  <ThumbsUp className="w-4 h-4" />
                  <span>Khuyên bạn nên: {result.action === 'RENT' ? 'THUÊ TRẢI NGHIỆM' : 'MUA SECOND-HAND'}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 mt-2 leading-relaxed">
                  {result.reason}
                </p>
                <div className="mt-2 text-xs text-film-warm font-medium">
                  {result.adviceText}
                </div>
              </div>

              {/* Matched Camera Box */}
              <div className="p-3.5 rounded-xl bg-film-card border border-film-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-lg border border-film-border bg-film-dark">
                    <Camera className="h-5 w-5 text-film-warm" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-film-warm uppercase">{result.matchedCamera.brand}</span>
                    <h5 className="text-xs sm:text-sm font-bold text-white truncate">{result.matchedCamera.name}</h5>
                    <div className="text-xs font-bold text-film-warm mt-0.5">
                      {result.matchedCamera.baseRentDailyPrice.toLocaleString('vi-VN')} đ/ngày
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectCamera(result.matchedCamera);
                  }}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl bg-film-warm hover:bg-amber-300 text-film-dark font-extrabold text-xs active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0"
                >
                  Xem chi tiết thiết bị
                </button>
              </div>

              <div className="pt-2 flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={handleReset}
                  className="min-h-[44px] text-slate-400 hover:text-white flex items-center space-x-1.5 px-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Làm lại Quiz</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] text-slate-400 hover:text-white px-2"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {step === 4 && error && (
            <div role="alert" className="space-y-4 text-xs sm:text-sm text-slate-300 p-2">
              <p>{error}</p>
              <button 
                type="button" 
                onClick={handleReset} 
                className="min-h-[44px] rounded-xl bg-film-warm px-4 py-2 font-bold text-film-dark"
              >
                Thử lại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

