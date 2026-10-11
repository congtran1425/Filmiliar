import React, { useState, useEffect, useId } from 'react';
import { Camera as CameraType } from '../types/camera';
import { X, Calendar, CheckCircle2, ExternalLink, ShieldCheck, ArrowRight, Loader2, Sparkles, MapPin } from 'lucide-react';

// Chỉ mở lại sau khi nhóm chốt chính sách cọc và nghiệm thu luồng thanh toán.
const PAYMENT_CHECKOUT_ENABLED = false;

interface RentalBookingModalProps {
  camera: CameraType | null;
  onClose: () => void;
  onBookingSuccess: () => void;
}

interface PaymentOrderResult {
  bookingId: string;
  bookingCode: string;
  cameraName: string;
  serialNumber: string;
  passportCode: string;
  conditionGrade: string;
  totalDays: number;
  dailyRate: number;
  totalRentalFee: number;
  depositAmount: number;
  totalInitialPayment: number;
  zaloPay: {
    app_trans_id: string;
    order_url: string;
    zp_trans_token: string;
    return_code: number;
    return_message: string;
  };
}

export const RentalBookingModal: React.FC<RentalBookingModalProps> = ({ camera, onClose, onBookingSuccess }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 3);

  const startDateId = useId();
  const endDateId = useId();
  const customerNameId = useId();
  const customerPhoneId = useId();
  const customerEmailId = useId();
  const customerCccdId = useId();
  const customerNotesId = useId();
  const agreeTermsId = useId();


  // Form states
  const [startDate, setStartDate] = useState<string>(tomorrow.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(dayAfter.toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerCccd, setCustomerCccd] = useState<string>('');
  const [deliveryMethod, setDeliveryMethod] = useState<string>('STORE_PICKUP');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);

  // Flow states: 'FORM' | 'PAYMENT' | 'SUCCESS'
  const [step, setStep] = useState<'FORM' | 'PAYMENT' | 'SUCCESS'>('FORM');
  const [loading, setLoading] = useState<boolean>(false);
  const [paymentData, setPaymentData] = useState<PaymentOrderResult | null>(null);
  const [countdown, setCountdown] = useState<number>(900); // 15 phút
  const [isPaid, setIsPaid] = useState<boolean>(false);

  if (!camera) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const totalRentalFee = diffDays * camera.baseRentDailyPrice;
  // Xử lý tạo đơn thanh toán ZaloPay
  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PAYMENT_CHECKOUT_ENABLED) return;
    if (!agreeTerms) return;

    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/payment/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraId: camera.id,
          startDate,
          endDate,
          customerName,
          customerPhone,
          customerEmail,
          customerCccd,
          deliveryMethod,
          customerNotes
        })
      });

      const res = await response.json();
      if (res.success && res.data) {
        setPaymentData(res.data);
        setStep('PAYMENT');
        setCountdown(900);
      } else {
        alert(res.message || 'Không thể khởi tạo cổng thanh toán');
      }
    } catch (err: any) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Polling kiểm tra trạng thái thanh toán ZaloPay mỗi 3 giây khi ở bước PAYMENT
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let pollInterval: ReturnType<typeof setInterval>;

    if (step === 'PAYMENT' && paymentData && !isPaid) {
      // Đếm ngược 15 phút
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      // Polling kiểm tra trạng thái ZaloPay
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(apiUrl('/api/payment/check-status'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              app_trans_id: paymentData.zaloPay.app_trans_id,
              bookingCode: paymentData.bookingCode
            })
          });
          const result = await res.json();
          if (result.isPaid) {
            setIsPaid(true);
            setStep('SUCCESS');
            clearInterval(pollInterval);
          }
        } catch (e) {
          // ignore network glitches
        }
      }, 3000);
    }

    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, [step, paymentData, isPaid]);

  // Giả lập thanh toán thành công (dành cho chế độ Sandbox review)
  const handleSimulateSuccess = () => {
    setIsPaid(true);
    setStep('SUCCESS');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Xem trước yêu cầu thuê</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {step === 'FORM' ? 'BƯỚC 1/2' : step === 'PAYMENT' ? 'BƯỚC 2/2' : 'HOÀN TẤT'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Chưa nhận đặt thuê hoặc thanh toán trực tuyến</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BƯỚC 1: Form Điền thông tin thuê & Chọn ngày */}
        {step === 'FORM' && (
          <form onSubmit={handleCreatePayment} className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
              Đây là bản xem trước. Nhóm đang xây dựng chính sách đặt cọc và hoàn thiện thanh toán; thao tác trên trang này chưa tạo đơn hoặc giữ máy.
            </p>
            {/* Selected Camera Overview */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <img 
                  src={camera.thumbnailUrl} 
                  alt={camera.name} 
                  className="w-14 h-14 rounded-lg object-cover border border-slate-800"
                />
                <div>
                  <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">{camera.brand}</span>
                  <h5 className="text-sm font-bold text-white line-clamp-1">{camera.name}</h5>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                    <span>Giá thuê: <strong className="text-amber-400">{camera.baseRentDailyPrice.toLocaleString('vi-VN')} đ/ngày</strong></span>
                    <span>•</span>
                    <span>Cọc: chính sách đang xây dựng</span>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <span className="text-[10px] text-slate-500 block font-mono">ĐỘ MỚI</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">{camera.conditionPercent}% ({camera.passport?.cosmeticGrade || 'A'})</span>
              </div>
            </div>

            {/* Date Picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={startDateId} className="block text-[11px] font-medium text-slate-400 mb-1">
                  Ngày nhận máy (sau 08:30):
                </label>
                <input
                  id={startDateId}
                  type="date"
                  value={startDate}
                  min={tomorrow.toISOString().split('T')[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div>
                <label htmlFor={endDateId} className="block text-[11px] font-medium text-slate-400 mb-1">
                  Ngày trả máy (trước 21:00):
                </label>
                <input
                  id={endDateId}
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>
            </div>

            {/* Customer Contact & eKYC */}
            <div className="space-y-3 pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Thông tin người thuê (Định danh eKYC)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={customerNameId} className="block text-[11px] text-slate-400 mb-1">Họ và tên:</label>
                  <input
                    id={customerNameId}
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500/50"
                    required
                  />
                </div>

                <div>
                  <label htmlFor={customerPhoneId} className="block text-[11px] text-slate-400 mb-1">Số điện thoại:</label>
                  <input
                    id={customerPhoneId}
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0909xxxxxx"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500/50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={customerEmailId} className="block text-[11px] text-slate-400 mb-1">Email nhận biên nhận:</label>
                  <input
                    id={customerEmailId}
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label htmlFor={customerCccdId} className="block text-[11px] text-slate-400 mb-1">CCCD (chưa thu thập trong bản xem trước):</label>
                  <input
                    id={customerCccdId}
                    type="text"
                    value={customerCccd}
                    onChange={(e) => setCustomerCccd(e.target.value)}
                    placeholder="Chưa cần cung cấp"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500/50 font-mono"
                  />
                </div>
              </div>

              {/* Delivery method */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('STORE_PICKUP')}
                  className={`p-2.5 rounded-lg border text-left flex items-start space-x-2 transition-all ${
                    deliveryMethod === 'STORE_PICKUP'
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-[11px] block">Nhận trực tiếp (dự kiến)</span>
                    <span className="text-[10px] text-slate-400">Địa điểm chưa xác nhận</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod('EXPRESS_DELIVERY')}
                  className={`p-2.5 rounded-lg border text-left flex items-start space-x-2 transition-all ${
                    deliveryMethod === 'EXPRESS_DELIVERY'
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-[11px] block">Giao tận nơi (dự kiến)</span>
                    <span className="text-[10px] text-slate-400">Khu vực và phí chưa xác nhận</span>
                  </div>
                </button>
              </div>

              <div>
                <label htmlFor={customerNotesId} className="block text-[11px] text-slate-400 mb-1">Ghi chú thêm:</label>
                <input
                  id={customerNotesId}
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Yêu cầu thêm pin, đổi loại dây đeo..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Financial Breakdown Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Tiền thuê ({diffDays} ngày x {camera.baseRentDailyPrice.toLocaleString('vi-VN')} đ):</span>
                <span className="font-medium text-white font-mono">{totalRentalFee.toLocaleString('vi-VN')} đ</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Tiền đặt cọc:</span>
                <span className="font-medium text-slate-300">Chưa xác định</span>
              </div>

              <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                <span className="font-bold text-xs text-white">Tổng thanh toán:</span>
                <span className="text-sm font-semibold text-slate-300">Chưa thể tính</span>
              </div>

              <div className="pt-2 text-[10px] text-emerald-400/90 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Quy tắc cọc và hoàn cọc sẽ được công bố sau khi nhóm thống nhất.</span>
              </div>
            </div>

            {/* Checkbox agreement */}
            <div className="flex items-start space-x-2">
              <input
                id={agreeTermsId}
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                required
              />
              <label htmlFor={agreeTermsId} className="text-[11px] text-slate-400 leading-tight">
                Tôi hiểu đây là bản xem trước và chưa có đơn thuê được tạo.
              </label>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!PAYMENT_CHECKOUT_ENABLED || loading || !agreeTerms}
                className="w-2/3 py-2.5 rounded-lg bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang kết nối ZaloPay...</span>
                  </>
                ) : (
                  <>
                    <span>Chưa thể đặt thuê hoặc thanh toán</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* BƯỚC 2: Cổng Thanh toán ZaloPay (Mã QR + Link mở App + Polling tự động) */}
        {step === 'PAYMENT' && paymentData && (
          <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
            <div className="text-center space-y-1">
              <span className="text-[11px] font-mono text-amber-500 font-bold uppercase tracking-wider">
                MÃ ĐƠN GIỮ CHỖ: {paymentData.bookingCode}
              </span>
              <h4 className="text-base font-bold text-white">Quét mã ZaloPay / VietQR để hoàn tất</h4>
              <p className="text-[11px] text-slate-400">
                Thời gian giữ giao dịch còn lại: <strong className="text-amber-400 font-mono">{formatTime(countdown)}</strong>
              </p>
            </div>

            {/* QR Code & Total */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-xl bg-white shadow-xl">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(paymentData.zaloPay.order_url)}`}
                  alt="ZaloPay QR Code"
                  className="w-48 h-48 rounded object-contain"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-400">Số tiền thanh toán (Tiền thuê + Cọc):</span>
                <div className="text-2xl font-bold font-mono text-amber-400">
                  {paymentData.totalInitialPayment.toLocaleString('vi-VN')} đ
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  TransID: {paymentData.zaloPay.app_trans_id}
                </div>
              </div>
            </div>

            {/* 2 Options: QR or Direct App Link */}
            <div className="space-y-2.5">
              <a
                href={paymentData.zaloPay.order_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md active:scale-98"
              >
                <span>Mở ứng dụng ZaloPay / Cổng thanh toán</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={handleSimulateSuccess}
                className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⚡ Giả lập thanh toán thành công (Sandbox Review)</span>
              </button>
            </div>

            {/* Live Polling Indicator */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Hệ thống đang tự động lắng nghe kết quả từ ZaloPay...</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Auto-poll 3s</span>
            </div>
          </div>
        )}

        {/* BƯỚC 3: Màn hình Thành công & Biên bản giữ chỗ */}
        {step === 'SUCCESS' && paymentData && (
          <div className="p-8 text-center space-y-5 animate-fade-in text-xs text-slate-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                ĐÃ NHẬN THANH TOÁN CỌC THÀNH CÔNG
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Đơn đặt thuê đã được xác nhận!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Chiếc máy <strong className="text-amber-400">{paymentData.cameraName}</strong> đã được giữ chỗ riêng cho bạn.
              </p>
            </div>

            {/* Electronic Handover Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2.5 max-w-md mx-auto">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Mã đơn giữ chỗ:</span>
                <span className="font-mono font-bold text-amber-400">{paymentData.bookingCode}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Số Serial con máy:</span>
                <span className="font-mono text-white">{paymentData.serialNumber}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Mã Hộ chiếu kỹ thuật:</span>
                <span className="font-mono text-emerald-400">{paymentData.passportCode}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Thời gian thuê:</span>
                <span className="text-slate-200">{startDate} đến {endDate} ({paymentData.totalDays} ngày)</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Tiền cọc đã giữ (ZaloPay):</span>
                <span className="font-mono text-emerald-400 font-bold">{paymentData.depositAmount.toLocaleString('vi-VN')} đ</span>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                Địa điểm nhận máy và thời gian giao sẽ được xác nhận khi nhóm hoàn thiện quy trình.
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onBookingSuccess();
              }}
              className="w-full max-w-md py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all active:scale-95 shadow-md"
            >
              Hoàn tất & Về trang chủ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
import { apiUrl } from '../lib/api';
