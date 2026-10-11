import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiUrl } from '../lib/api';


interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('filmiliar_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [statsRes, bookingsRes] = await Promise.all([
        fetch(apiUrl('/api/admin/stats'), { headers }),
        fetch(apiUrl('/api/admin/bookings'), { headers })
      ]);

      const statsData = await statsRes.json();
      const bookingsData = await bookingsRes.json();

      if (statsData.success) setStats(statsData.stats);
      if (bookingsData.success) setBookings(bookingsData.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Quản trị Hệ thống Filmiliar (Admin Hub)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  MASTER CONTROL
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Xem dữ liệu thiết bị và đơn thuê; quy trình cọc đang được xây dựng</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchAdminData}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Cập nhật dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Key Metrics Dashboard */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Dòng sản phẩm</span>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {stats.totalModels} <span className="text-xs text-slate-400 font-normal">mẫu máy</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">7 Body + 4 Lens</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Thiết bị sẵn sàng</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {stats.availableUnits} <span className="text-xs text-slate-400 font-normal">/ {stats.totalUnits} máy</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 mt-1 block">Tất cả kèm Hộ chiếu KT</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Đơn đặt thuê</span>
                <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                  {stats.totalBookings} <span className="text-xs text-slate-400 font-normal">đơn</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Thanh toán qua ZaloPay</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Tiền cọc đang giữ</span>
                <div className="text-2xl font-bold font-mono text-blue-400 mt-1">
                  {(stats.heldDepositAmount || 0).toLocaleString('vi-VN')} <span className="text-xs text-slate-400 font-normal">đ</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Bảo lãnh ký quỹ an toàn</span>
              </div>
            </div>
          )}

          {/* Bookings Management Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <span>Quản lý Đơn thuê & Hoàn cọc (Live Queue)</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-300">
                  {bookings.length} đơn
                </span>
              </h4>
              <span className="text-[10px] text-slate-500">Chỉ xem dữ liệu; thao tác trạng thái đang tạm dừng</span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-mono text-slate-400 uppercase">
                      <th className="py-3 px-4">Mã đơn & Ngày</th>
                      <th className="py-3 px-4">Người thuê (eKYC)</th>
                      <th className="py-3 px-4">Thiết bị & Số Serial</th>
                      <th className="py-3 px-4">Tiền cọc</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Hành động Quản trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Chưa có đơn thuê nào được khởi tạo.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-amber-400 block">{b.bookingCode}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(b.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-white block">{b.user?.fullName || 'Khách vãng lai'}</span>
                            <span className="text-[10px] text-slate-400 block">{b.user?.phone || 'Chưa cập nhật SĐT'}</span>
                            {b.user?.idCardNumber && (
                              <span className="text-[9px] font-mono text-emerald-400 block">CCCD: {b.user.idCardNumber}</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-200 block">{b.cameraItem?.product?.modelName}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Serial: {b.cameraItem?.serialNumber}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-mono text-amber-400 font-bold block">
                              {b.depositAmount.toLocaleString('vi-VN')} đ
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {b.depositStatus === 'REFUNDED' ? 'Đã ghi nhận hoàn cọc' : b.depositStatus === 'HELD' ? 'Đang giữ cọc' : 'Chưa thu cọc'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                              b.status === 'CONFIRMED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              b.status === 'ACTIVE_RENTAL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              b.status === 'COMPLETED' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {b.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right space-x-1.5">
                            {b.status === 'PENDING_PAYMENT' && (
                              <button
                                disabled
                                 className="px-2.5 py-1 rounded bg-blue-600 text-white text-[11px] font-semibold opacity-50 cursor-not-allowed"
                              >
                                Chưa xử lý cọc
                              </button>
                            )}

                            {b.status === 'CONFIRMED' && (
                              <button
                                disabled
                                 className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 text-[11px] font-bold opacity-50 cursor-not-allowed"
                              >
                                Bàn giao máy
                              </button>
                            )}

                            {b.status === 'ACTIVE_RENTAL' && (
                              <button
                                 disabled
                                 className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold opacity-50 cursor-not-allowed"
                              >
                                Chưa xử lý hoàn cọc
                              </button>
                            )}

                            {b.status === 'COMPLETED' && (
                              <span className="text-[11px] text-emerald-400 font-mono">Đã tất toán</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
