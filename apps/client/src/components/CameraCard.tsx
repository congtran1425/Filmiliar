import React from 'react';
import { Camera as CameraType } from '../types/camera';
import { ShieldCheck, Calendar } from 'lucide-react';

interface CameraCardProps {
  camera: CameraType;
  onViewDetail?: (camera: CameraType) => void;
  onViewPassport: (camera: CameraType) => void;
  onBookRental: (camera: CameraType) => void;
}

export const CameraCard: React.FC<CameraCardProps> = ({ camera, onViewDetail, onViewPassport, onBookRental }) => {
  return (
    <div className="group relative rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-300 overflow-hidden flex flex-col justify-between hover:shadow-xl hover:shadow-black/40">
      {/* Top Media & Badges */}
      <div 
        onClick={() => onViewDetail && onViewDetail(camera)}
        className="relative aspect-[4/3] bg-slate-950 overflow-hidden cursor-pointer"
      >
        <img
          src={camera.thumbnailUrl}
          alt={camera.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
        />

        {/* Condition Grade Badge */}
        {camera.passport ? (
          <div className="absolute top-3 left-3 flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-xs font-semibold text-slate-100 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>{camera.passport.cosmeticGrade}</span>
          </div>
        ) : (
          <div className="absolute top-3 left-3 flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-[11px] font-semibold text-amber-400 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Chờ nhập kho</span>
          </div>
        )}

        {/* Shutter count badge */}
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[11px] font-mono text-slate-300 border border-white/10">
          {camera.category === 'Lens' 
            ? 'Ống kính rời' 
            : (camera.currentShutter > 0 ? `${camera.currentShutter.toLocaleString('vi-VN')} shots` : 'Chưa có máy')}
        </div>

        {/* Passport Code Pill */}
        {camera.passport && (
          <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
            {camera.passport.passportCode}
          </div>
        )}
      </div>

      {/* Body Info */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div 
          onClick={() => onViewDetail && onViewDetail(camera)}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">
              {camera.brand} • {camera.category}
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-amber-400 transition-colors">
              Xem chi tiết →
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-1 group-hover:text-amber-400 transition-colors line-clamp-1">
            {camera.name}
          </h3>


          <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60">
            <div>
              <span className="text-slate-500 block">Cảm biến:</span>
              <span className="font-medium text-slate-200 line-clamp-1">{camera.sensorType}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Quay video:</span>
              <span className="font-medium text-slate-200 line-clamp-1">{camera.videoResolution}</span>
            </div>
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-end justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Giá thuê theo 24h</div>
            <div className="text-lg font-bold text-amber-400">
              {camera.baseRentDailyPrice.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">đ/ngày</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Quy tắc đặt cọc đang được xây dựng
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-500">Giá mua second-hand</div>
            <div className="text-xs font-medium text-slate-300">
              {camera.baseSalePrice.toLocaleString('vi-VN')} đ
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => onViewPassport(camera)}
            className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center justify-center space-x-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hộ chiếu KT</span>
          </button>

          <button
            onClick={() => onBookRental(camera)}
            className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all active:scale-95 flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-950" />
            <span>Đặt thuê</span>
          </button>
        </div>
      </div>
    </div>
  );
};
