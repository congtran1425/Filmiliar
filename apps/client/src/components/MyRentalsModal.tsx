import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle2, MapPin, RefreshCw, FileText } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface MyRentalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export const MyRentalsModal: React.FC<MyRentalsModalProps> = ({ isOpen, onClose, user }) => {
  if (!isOpen) return null;

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRentals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('filmiliar_token');
      const res = await fetch(apiUrl('/api/user/rentals'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success && data.data) {
        setBookings(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRentals();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">ĐÃ XÁC NHẬN - CHỜ NHẬN MÁY</span>;
      case 'ACTIVE_RENTAL':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">ĐANG SỬ DỤNG</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold">ĐÃ HOÀN TẤT</span>;
      case 'PENDING_PAYMENT':
      default:
        return <span className="px-2 py-0.5 rounded bg-film-warm/15 text-film-warm border border-film-warm/30 text-[10px] font-bold">CHỜ XỬ LÝ</span>;
    }
  };

  const getDepositBadge = (status: string, amount: number) => {
    if (status === 'REFUNDED') {
      return (
        <span className="text-emerald-400 font-semibold flex items-center space-x-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Đã ghi nhận hoàn cọc ({amount.toLocaleString('vi-VN')} đ)</span>
        </span>
      );
    }
    if (status === 'HELD') {
      return (
        <span className="text-film-warm font-semibold flex items-center space-x-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Đang giữ an toàn ({amount.toLocaleString('vi-VN')} đ)</span>
        </span>
      );
    }
    return <span className="text-slate-400">Chờ giữ cọc</span>;
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl bg-film-dark border border-film-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rentals-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-film-border bg-film-dark flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-film-warm/15 text-film-warm">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 id="rentals-modal-title" className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Thiết bị & Đơn thuê của tôi</span>
                {user && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-film-card text-slate-300 border border-film-border">
                    {user.fullName || user.email}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">Theo dõi tiến độ nhận máy, hạn trả và tình trạng tiền đặt cọc</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={fetchRentals}
              className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-white flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"
              title="Làm mới danh sách"
              aria-label="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              type="button"
              onClick={onClose} 
              className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-white flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"
              aria-label="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content with internal scrolling */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-300 pb-safe flex-1">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-film-warm border-t-transparent mr-2 align-middle"></div>
              <span>Đang tải danh sách đơn thuê...</span>
            </div>
          ) : bookings.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-film-card text-slate-400 flex items-center justify-center mx-auto border border-film-border">
                <FileText className="w-6 h-6 text-film-warm" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">Bạn chưa có đơn thuê nào</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Khám phá danh mục máy ảnh & ống kính để xem chi tiết từng chiếc và dự tính chi phí trước chuyến đi!
              </p>
            </div>
          ) : (
            bookings.map((booking) => {
              const product = booking.cameraItem?.product;
              const unit = booking.cameraItem;
              return (
                <div key={booking.id} className="p-4 rounded-xl bg-film-card border border-film-border space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-film-border/80">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-film-warm text-xs">{booking.bookingCode}</span>
                      {getStatusBadge(booking.status)}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Tạo lúc: {new Date(booking.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className="sm:col-span-7 flex items-center space-x-3">
                      <img 
                        src={product?.thumbnailUrl || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32'} 
                        alt={product?.modelName || 'Camera'} 
                        className="w-14 h-14 rounded-lg object-cover border border-film-border" 
                      />
                      <div>
                        <span className="text-[10px] text-film-warm font-bold uppercase">{product?.brand}</span>
                        <h5 className="text-xs font-bold text-white">{product?.modelName}</h5>
                        <div className="text-[11px] text-slate-400 mt-0.5 space-x-2 font-mono">
                          <span>Serial: <strong className="text-slate-200">{unit?.serialNumber}</strong></span>
                          <span>•</span>
                          <span>Hồ sơ: <strong className="text-film-warm">TP-{unit?.serialNumber}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-5 bg-film-dark/70 p-2.5 rounded-lg border border-film-border/60 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Thời gian thuê:</span>
                        <span className="text-slate-200 font-medium">
                          {new Date(booking.startDate).toLocaleDateString('vi-VN')} - {new Date(booking.endDate).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tiền thuê ({booking.totalDays} ngày):</span>
                        <span className="text-white font-mono font-bold">{booking.totalRentalFee.toLocaleString('vi-VN')} đ</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-film-border">
                        <span className="text-slate-400">Tình trạng cọc:</span>
                        <div>{getDepositBadge(booking.depositStatus, booking.depositAmount)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-film-border/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-film-warm" />
                      <span>Địa điểm nhận máy: <strong>chưa được xác nhận</strong></span>
                    </div>

                    <span className="text-[10px] text-slate-400">Phụ kiện theo biên bản bàn giao của từng thiết bị</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
