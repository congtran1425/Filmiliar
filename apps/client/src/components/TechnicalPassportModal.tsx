import React from 'react';
import { Camera as CameraType } from '../types/camera';
import { X, ShieldCheck, CheckCircle2, AlertCircle, QrCode, Calendar, Wrench } from 'lucide-react';

interface TechnicalPassportModalProps {
  camera: CameraType | null;
  onClose: () => void;
  onBookRental: (camera: CameraType) => void;
}

export const TechnicalPassportModal: React.FC<TechnicalPassportModalProps> = ({ camera, onClose, onBookRental }) => {
  if (!camera) return null;
  const { passport } = camera;

  if (!passport) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{camera.name}</h3>
          <p className="text-sm text-slate-400 mb-6">
            Thiết bị này chưa có hồ sơ kiểm định để hiển thị. Nhóm cần bổ sung dữ liệu của đúng thiết bị trước khi công bố.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const isLens = camera.category === 'Lens';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Technical Passport</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  VERIFIED
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">{passport.passportCode}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Header Device Summary */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src={camera.thumbnailUrl} 
                alt={camera.name} 
                className="w-16 h-16 rounded-lg object-cover border border-slate-800"
              />
              <div>
                <span className="text-[11px] font-semibold text-amber-500 uppercase">{camera.brand}</span>
                <h4 className="text-sm font-bold text-white">{camera.name}</h4>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                  <span>Cấp ngoại hình: <strong className="text-emerald-400 font-semibold">{passport.cosmeticGrade}</strong></span>
                  <span>•</span>
                  <span>Độ mới: <strong className="text-slate-200">{camera.conditionPercent}%</strong></span>
                </div>
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
              <QrCode className="w-8 h-8 text-slate-400" />
              <span className="text-[9px] font-mono text-slate-500 mt-1">TRA CỨU GỐC</span>
            </div>
          </div>

          {/* 3 Core Inspections */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-xs text-slate-400">Số lần trập (Shutter)</div>
              <div className="text-lg font-bold font-mono text-amber-400 mt-1">
                {isLens || passport.shutterCount === null || passport.shutterCount === 0
                  ? 'N/A (Lens)'
                  : `${passport.shutterCount.toLocaleString('vi-VN')} shot`}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {isLens ? 'Thấu kính không dùng màn trập' : 'Màn trập cơ hoạt động nhịp nhàng'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-xs text-slate-400">Kiểm định Cảm biến</div>
              <div className="text-xs font-semibold text-emerald-400 mt-1 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{isLens ? 'Không áp dụng' : '0 Dead Pixel'}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {isLens ? 'Thiết bị quang học rời' : 'Bề mặt CMOS sạch tuyệt đối'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-xs text-slate-400">Thấu kính & Ngàm</div>
              <div className="text-xs font-semibold text-emerald-400 mt-1 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Không mốc, rễ tre</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Tiếp điểm ngàm zin chuẩn</div>
            </div>
          </div>


          {/* Detailed Observations */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chi tiết biên bản kiểm tra</h4>
            
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5">
              <div>
                <span className="text-xs font-medium text-slate-400 block">Tình trạng cảm biến (Sensor):</span>
                <p className="text-xs text-slate-200 mt-0.5">{passport.sensorCondition}</p>
              </div>

              <div className="border-t border-slate-900 pt-2">
                <span className="text-xs font-medium text-slate-400 block">Thấu kính & cơ khí:</span>
                <p className="text-xs text-slate-200 mt-0.5">{passport.opticsCondition}</p>
              </div>

              {passport.scratchNotes && (
                <div className="border-t border-slate-900 pt-2 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-amber-300 block">Ghi chú khuyết điểm / Vết trầy xước có sẵn:</span>
                    <p className="text-xs text-slate-300 mt-0.5">{passport.scratchNotes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Technician Sign-off */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <Wrench className="w-4 h-4 text-slate-400" />
              <span>{passport.technicianNotes}</span>
            </div>
            <div className="flex items-center space-x-1 font-mono text-[11px] text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{passport.lastInspectedDate}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400">Giá thuê máy này:</div>
            <div className="text-base font-bold text-amber-400">
              {camera.baseRentDailyPrice.toLocaleString('vi-VN')} đ/ngày
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                onClose();
                onBookRental(camera);
              }}
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all active:scale-95 shadow-md shadow-amber-500/10"
            >
              Đặt thuê chiếc này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
