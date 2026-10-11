import React, { useState } from 'react';
import { Camera as CameraType } from '../types/camera';
import { 
  X, 
  ShieldCheck, 
  Calendar, 
  ShoppingBag, 
  Camera, 
  Weight, 
  Film, 
  Zap, 
  Package, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';


interface ProductDetailModalProps {
  camera: CameraType | null;
  onClose: () => void;
  onBookRental: (camera: CameraType) => void;
  onViewPassport: (camera: CameraType) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ 
  camera, 
  onClose, 
  onBookRental,
  onViewPassport
}) => {
  if (!camera) return null;

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'INSTANCES' | 'SPECS'>('OVERVIEW');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  // Thư viện ảnh mô phỏng các góc chụp
  const galleryImages = [
    camera.thumbnailUrl,
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=800&q=80'
  ];

  const isLens = camera.category === 'Lens';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold uppercase tracking-wider">
              {camera.brand} • {camera.category}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white line-clamp-1">
              {camera.name}
            </h2>
          </div>

          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-8 text-xs text-slate-300">
          {/* Main Showcase Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left: Gallery (5 cols) */}
            <div className="md:col-span-6 space-y-3">
              <div className="relative aspect-[4/3] rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner group">
                <img 
                  src={galleryImages[selectedImageIndex] || camera.thumbnailUrl} 
                  alt={camera.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Passport Badge Overlay */}
                <div className="absolute top-3 left-3 flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-700/80 text-xs font-semibold text-slate-100 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Kiểm định: {camera.passport?.cosmeticGrade || 'A (98%)'}</span>
                </div>

                <div className="absolute bottom-3 right-3 text-[10px] font-mono text-slate-400 bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10">
                  {camera.passport?.passportCode || 'TP-VERIFIED'}
                </div>
              </div>

              {/* Thumbnails */}
              <div className="grid grid-cols-4 gap-2">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`aspect-[4/3] rounded-lg overflow-hidden border transition-all ${
                      selectedImageIndex === idx 
                        ? 'border-amber-500 ring-2 ring-amber-500/20' 
                        : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Key Specs & Pricing Action (6 cols) */}
            <div className="md:col-span-6 space-y-5 flex flex-col justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {camera.name}
                </h1>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Xem thông số và giá tham khảo của thiết bị. Kết quả kiểm định chỉ có giá trị khi hồ sơ của đúng chiếc máy đã được bổ sung.
                </p>

                {/* Quick Spec Pills */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2.5">
                    <Camera className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Cảm biến</span>
                      <strong className="text-xs text-slate-200">{camera.sensorType}</strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2.5">
                    <Film className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Độ phân giải & Video</span>
                      <strong className="text-xs text-slate-200 line-clamp-1">{camera.videoResolution}</strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2.5">
                    <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Số lần trập (Shutter)</span>
                      <strong className="text-xs text-slate-200">
                        {isLens ? 'Không dùng trập' : `${camera.currentShutter.toLocaleString('vi-VN')} shot`}
                      </strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2.5">
                    <Weight className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Trọng lượng</span>
                      <strong className="text-xs text-slate-200">{camera.weightGram}g (Gọn nhẹ)</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price & Dual CTA Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Giá thuê tham khảo theo 24H</span>
                    <div className="text-2xl font-bold text-amber-400 font-mono">
                      {camera.baseRentDailyPrice.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">đ/ngày</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Quy tắc đặt cọc đang được xây dựng
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Giá mua tham khảo</span>
                    <div className="text-sm font-bold text-slate-200 font-mono">
                      {camera.baseSalePrice.toLocaleString('vi-VN')} đ
                    </div>
                    <span className="text-[10px] text-slate-400 block">Chính sách bảo hành đang được xây dựng</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      onClose();
                      onBookRental(camera);
                    }}
                    className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-md shadow-amber-500/10"
                  >
                    <Calendar className="w-4 h-4 text-slate-950" />
                    <span>Xem thông tin thuê</span>
                  </button>

                  <button
                    type="button"
                    disabled
                    className="py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-semibold text-xs flex items-center justify-center space-x-2 cursor-not-allowed"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Mua trực tuyến chưa mở</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">Chưa nhận đơn mua hoặc thanh toán trực tuyến.</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-slate-800 flex space-x-6 text-xs">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`pb-3 font-semibold transition-all border-b-2 ${
                activeTab === 'OVERVIEW' 
                  ? 'border-amber-500 text-amber-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Hồ sơ kỹ thuật
            </button>

            <button
              onClick={() => setActiveTab('INSTANCES')}
              className={`pb-3 font-semibold transition-all border-b-2 flex items-center space-x-1.5 ${
                activeTab === 'INSTANCES' 
                  ? 'border-amber-500 text-amber-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Con máy trong kho ({camera.unitsCount || 1})</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">Live</span>
            </button>

            <button
              onClick={() => setActiveTab('SPECS')}
              className={`pb-3 font-semibold transition-all border-b-2 ${
                activeTab === 'SPECS' 
                  ? 'border-amber-500 text-amber-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Phụ kiện kèm theo & Gợi ý Lens
            </button>
          </div>

          {/* TAB 1: OVERVIEW & PASSPORT */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4 animate-fade-in">
              {camera.passport ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h4 className="text-xs font-bold text-white">Biên bản thẩm định kỹ thuật thực tế</h4>
                        <span className="text-[10px] font-mono text-slate-400">{camera.passport.passportCode}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onViewPassport(camera);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1 transition-colors"
                    >
                      <span>Xem Hộ chiếu gốc</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Kiểm tra Cảm biến CMOS</span>
                      <span className="text-xs font-semibold text-emerald-400 mt-1 block">
                        {camera.passport.sensorCondition}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Kiểm tra Ngàm & Thấu kính</span>
                      <span className="text-xs font-semibold text-slate-200 mt-1 block">
                        {camera.passport.opticsCondition}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Vết trầy xước có sẵn (Minh bạch)</span>
                      <span className="text-xs text-amber-300 mt-1 block">
                        {camera.passport.scratchNotes || 'Không trầy xước, thân vỏ đẹp hoàn hảo'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-300">Chưa có hồ sơ kỹ thuật cho thiết bị này. Vui lòng không xem các thông số mẫu là kết quả kiểm định.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PHYSICAL INSTANCES IN STOCK */}
          {activeTab === 'INSTANCES' && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-xs text-slate-400">
                Tại Filmiliar, mỗi con máy là một cá thể độc nhất với số Serial và biên bản kiểm tra riêng biệt:
              </p>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      {camera.passport?.serialNumber || 'S01-ACTIVE-UNIT'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      SẴN SÀNG CHO THUÊ
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Cấp {camera.passport?.cosmeticGrade || 'A'} • {camera.currentShutter > 0 ? `${camera.currentShutter.toLocaleString('vi-VN')} shot` : 'Ống kính quang học'} • {camera.passport?.scratchNotes || 'Vỏ đẹp nguyên bản'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onBookRental(camera);
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap active:scale-95 transition-all"
                >
                  Chọn chiếc này để thuê
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ACCESSORIES & COMBO */}
          {activeTab === 'SPECS' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Phụ kiện tham khảo</span>
                </h4>
                <p className="text-xs text-slate-400">Danh sách phụ kiện thực tế cần được xác nhận riêng cho từng chiếc máy trước khi nhận đơn.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
