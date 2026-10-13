/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Clock3, Copy, Download, ExternalLink, ShieldAlert, X } from 'lucide-react';
import { formatVnd } from '../lib/catalog';
import { apiRequest } from '../lib/session';

type PaymentStatus = 'CREATING' | 'WAITING' | 'PAID' | 'FAILED' | 'REVIEW';
type PaymentView = {
  bookingId: string; bookingCode: string; paymentStatus: PaymentStatus; bookingStatus: string;
  appTransId: string; qrCode: string | null; orderUrl: string | null; expiresAt: string;
  cameraName: string; serialNumber: string; startDate: string; endDate: string;
  totalDays: number; rentalFee: number; depositAmount: number; totalAmount: number; sandbox: true;
};

export function PaymentQrModal({ cameraItemId, startDate, endDate, onClose }: {
  cameraItemId: number; startDate: string; endDate: string; onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const controls = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')];
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const active = await apiRequest<{ data: PaymentView | null }>(`/api/payment/active/${cameraItemId}`);
        if (cancelled) return;
        if (active.data) { setPayment(active.data); return; }
        const key = `filmiliar:payment:${cameraItemId}:${startDate}:${endDate}`;
        let clientRequestId = sessionStorage.getItem(key);
        if (!clientRequestId) {
          clientRequestId = crypto.randomUUID();
          sessionStorage.setItem(key, clientRequestId);
        }
        const created = await apiRequest<{ data: PaymentView }>('/api/payment/create', {
          method: 'POST',
          body: JSON.stringify({ cameraItemId, startDate, endDate, clientRequestId })
        });
        if (!cancelled) setPayment(created.data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tạo mã thử nghiệm');
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [cameraItemId, startDate, endDate]);

  useEffect(() => {
    if (!payment || (payment.paymentStatus !== 'CREATING' && payment.paymentStatus !== 'WAITING')) return;
    let busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const result = await apiRequest<{ data: PaymentView }>('/api/payment/check-status', {
          method: 'POST', body: JSON.stringify({ bookingId: payment.bookingId })
        });
        setPayment(result.data);
        setError('');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra giao dịch; hệ thống vẫn giữ mã hiện tại');
      } finally { busy = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 3000);
    return () => window.clearInterval(timer);
  }, [payment?.bookingId, payment?.paymentStatus]);

  useEffect(() => {
    if (!payment) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((Date.parse(payment.expiresAt) - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [payment?.expiresAt]);

  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(label); }
    catch { setError('Không thể sao chép tự động trên trình duyệt này'); }
  };

  const downloadQr = () => {
    const svg = document.getElementById('filmiliar-sandbox-qr');
    if (!svg) return;
    const content = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([content], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${payment?.bookingCode || 'filmiliar'}-sandbox-qr.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const qrValue = payment?.qrCode || payment?.orderUrl;
  const canOpenGateway = payment?.orderUrl?.startsWith('https://');
  const sameDates = payment?.startDate === startDate && payment?.endDate === endDate;
  const countdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-film-dark/85 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="max-h-[100dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-film-border bg-film-dark shadow-2xl outline-none sm:max-h-[90dvh] sm:rounded-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-film-border bg-film-dark px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-film-warm">Filmiliar · ZaloPay Sandbox</p>
            <h2 id={titleId} className="mt-1 text-xl font-bold text-white sm:text-2xl">Thử luồng QR thuê thiết bị</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng cửa sổ thanh toán" className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-film-border text-slate-200 hover:bg-film-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm active:scale-95"><X className="h-5 w-5" /></button>
        </header>

        <div className="p-4 sm:p-6">
          <p className="rounded-xl border border-film-warm/40 bg-film-warm/10 p-3 text-sm leading-6 text-film-warm">
            Chỉ dành cho quản trị viên thử nghiệm. Giá và cọc lấy từ dữ liệu minh họa; đây không phải chính sách đã duyệt và không phải giao dịch tiền thật.
          </p>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          {loading && <p role="status" className="mt-8 text-slate-300">Đang tìm hoặc tạo đúng giao dịch thử nghiệm...</p>}

          {payment && <div className="mt-6 grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="min-w-0 rounded-xl border border-film-border bg-film-card p-4 sm:p-5" aria-live="polite">
              {payment.paymentStatus === 'PAID' ? <div className="space-y-3 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                <h3 className="text-xl font-bold text-white">Sandbox ghi nhận thanh toán</h3>
                <p className="text-sm leading-6 text-slate-300">Đơn thử đã được xác nhận và chiếc máy được giữ chỗ trong dữ liệu. Máy chưa bàn giao; không có khoản hoàn cọc tự động.</p>
                <Link to="/tai-khoan?tab=thue" onClick={onClose} className="inline-flex min-h-11 items-center rounded-lg bg-film-warm px-4 font-semibold text-film-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-warm">Xem đơn thử</Link>
              </div> : payment.paymentStatus === 'FAILED' ? <div className="space-y-3 text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="text-xl font-bold text-white">Giao dịch thử không thành công</h3>
                <p className="text-sm text-slate-300">ZaloPay đã trả kết quả không thanh toán. Máy được đưa về trạng thái sẵn trong dữ liệu.</p>
                <button type="button" onClick={() => { sessionStorage.removeItem(`filmiliar:payment:${cameraItemId}:${startDate}:${endDate}`); window.location.reload(); }} className="min-h-11 rounded-lg border border-film-warm px-4 font-semibold text-film-warm hover:bg-film-warm/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm">Bắt đầu lượt thử mới</button>
              </div> : payment.paymentStatus === 'REVIEW' ? <div className="space-y-3 text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-amber-300" />
                <h3 className="text-xl font-bold text-white">Cần đối soát giao dịch</h3>
                <p className="text-sm leading-6 text-slate-300">Hệ thống chưa thể xác nhận đơn. Không quét hoặc tạo mã khác cho chiếc máy này; hãy kiểm tra trong ZaloPay Sandbox và liên hệ nhóm vận hành.</p>
              </div> : payment.paymentStatus === 'CREATING' ? <div className="space-y-3 text-center">
                <Clock3 className="mx-auto h-12 w-12 text-film-warm" />
                <h3 className="text-xl font-bold text-white">Đang kiểm tra mã đã tạo</h3>
                <p className="text-sm leading-6 text-slate-300">Chưa có QR để quét. Hệ thống đang hỏi ZaloPay về cùng mã giao dịch; không tạo thêm lượt thanh toán.</p>
              </div> : <div className="space-y-4 text-center">
                <h3 className="text-lg font-bold text-white">Quét mã thử trên ZaloPay Sandbox</h3>
                {secondsLeft > 0 && qrValue ? <>
                  <div className="mx-auto w-fit max-w-full rounded-xl bg-white p-4">
                    <QRCodeSVG id="filmiliar-sandbox-qr" value={qrValue} size={240} level="M" marginSize={1} className="h-auto max-w-full" />
                  </div>
                  {!payment.qrCode && <p className="text-xs leading-5 text-amber-300">ZaloPay chưa trả mã VietQR; QR này chứa liên kết cổng thanh toán, không dành cho ứng dụng ngân hàng.</p>}
                  <p className="flex items-center justify-center gap-1.5 text-sm text-slate-300"><Clock3 className="h-4 w-4" /> Còn {countdown} để quét</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={downloadQr} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-film-border px-3 text-sm text-slate-200 hover:bg-film-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"><Download className="h-4 w-4" /> Tải QR</button>
                    {canOpenGateway && <a href={payment.orderUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-film-border px-3 text-sm text-slate-200 hover:bg-film-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"><ExternalLink className="h-4 w-4" /> Mở ZaloPay</a>}
                  </div>
                </> : <p className="text-sm leading-6 text-slate-300">Mã đã hết thời gian quét hoặc chưa sẵn sàng. Hệ thống vẫn xác minh với ZaloPay; không tạo mã khác cho tới khi có kết quả cuối.</p>}
              </div>}
            </section>

            <section className="min-w-0 space-y-4 rounded-xl border border-film-border bg-film-card p-4 sm:p-5">
              <h3 className="text-lg font-bold text-white">Chi tiết lượt thử</h3>
              {!sameDates && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">Chiếc máy này đã có giao dịch thử với ngày thuê khác. Thông tin dưới đây là giao dịch đã lưu.</p>}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Thiết bị</dt><dd className="text-right text-white">{payment.cameraName}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Số serial</dt><dd className="break-all text-right font-mono text-white">{payment.serialNumber}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Ngày thuê thử</dt><dd className="text-right text-white">{payment.startDate} – {payment.endDate}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Tiền thuê ({payment.totalDays} ngày)</dt><dd className="text-right text-white">{formatVnd(payment.rentalFee)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Cọc trong dữ liệu mẫu</dt><dd className="text-right text-white">{formatVnd(payment.depositAmount)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-film-border pt-3 font-bold"><dt className="text-film-warm">Tổng giá trị thử</dt><dd className="text-right text-film-warm">{formatVnd(payment.totalAmount)}</dd></div>
              </dl>
              <div className="space-y-2 border-t border-film-border pt-4 text-xs text-slate-300">
                <div className="flex min-w-0 items-center justify-between gap-2"><span className="min-w-0 break-all">Đơn {payment.bookingCode}</span><button type="button" onClick={() => void copy(payment.bookingCode, 'Mã đơn')} aria-label="Sao chép mã đơn" className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-film-border hover:bg-film-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"><Copy className="h-4 w-4" /></button></div>
                <div className="flex min-w-0 items-center justify-between gap-2"><span className="min-w-0 break-all">GD {payment.appTransId}</span><button type="button" onClick={() => void copy(payment.appTransId, 'Mã giao dịch')} aria-label="Sao chép mã giao dịch" className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-film-border hover:bg-film-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"><Copy className="h-4 w-4" /></button></div>
                {copied && <p role="status" className="text-emerald-300">Đã sao chép {copied.toLowerCase()}.</p>}
              </div>
            </section>
          </div>}
        </div>
      </div>
    </div>, document.body
  );
}
