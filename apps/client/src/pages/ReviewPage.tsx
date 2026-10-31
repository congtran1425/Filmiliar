import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { formatVnd } from '../lib/catalog';
import { useProduct } from '../lib/useProduct';
import { apiRequest, useSession } from '../lib/session';
import { useRentalQuote } from '../lib/rental';
import { PaymentQrModal } from '../components/PaymentQrModal';
import { RentalSchedule } from '../components/RentalSchedule';

type ActivePayment = { bookingId: string; paymentStatus: string };
export function ReviewPage() {
  const { slug, mode } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const { product, loading, error } = useProduct(slug);
  const unit = product?.units.find(item => String(item.id) === params.get('may'));
  const [startDate, setStartDate] = useState(params.get('start') || '');
  const [endDate, setEndDate] = useState(params.get('end') || '');
  const { quote, loading: checking, error: quoteError, refresh } = useRentalQuote(mode === 'thue' ? unit?.id : undefined, startDate, endDate);
  const [acceptedHash, setAcceptedHash] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState<{ key: string; data: ActivePayment | null }>({ key: '', data: null });
  const [showPayment, setShowPayment] = useState<{ quoteHash: string; termsAccepted: boolean } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const { user, state } = useSession();
  const activeKey = `${user?.id}:${unit?.id}:${startDate}:${endDate}:${refreshTick}`;
  const currentPayment = active.key === activeKey ? active.data : null;
  const closePayment = useCallback(() => { setShowPayment(null); setRefreshTick(value => value + 1); }, []);
  useEffect(() => { refresh(); }, [refreshTick]);
  useEffect(() => {
    if (state !== 'ready' || !user) { setEnabled(false); return; }
    const controller = new AbortController();
    apiRequest<{ sandboxEnabled: boolean }>('/api/payment/capabilities', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setEnabled(result.sandboxEnabled); })
      .catch(() => { if (!controller.signal.aborted) setEnabled(false); });
    return () => controller.abort();
  }, [state, user?.id]);
  useEffect(() => {
    if (!user || !unit || mode !== 'thue' || !startDate || !endDate || !enabled) return;
    const controller = new AbortController();
    apiRequest<{ data: ActivePayment | null }>(`/api/payment/active/${unit.id}?${new URLSearchParams({ startDate, endDate })}`, { signal: controller.signal, cache: 'no-store' })
      .then(result => { if (!controller.signal.aborted) setActive({ key: activeKey, data: result.data }); })
      .catch(() => { if (!controller.signal.aborted) setActive({ key: activeKey, data: null }); });
    return () => controller.abort();
  }, [activeKey, enabled, mode]);

  if (loading) return <main role="status" className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-slate-300">Đang tải thông tin...</main>;
  if (error || !product || !unit || (mode !== 'thue' && mode !== 'mua')) return <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12"><h1 className="text-2xl font-bold text-white">Chọn chiếc máy để tiếp tục</h1><p className="mt-3 text-slate-400">{error || 'Mở trang thiết bị và chọn một chiếc máy cụ thể.'}</p><Link to={product ? `/thiet-bi/${product.slug}` : '/san-pham'} className="mt-5 inline-flex min-h-11 items-center text-film-warm underline">Về trang thiết bị</Link></main>;
  const canResume = !!currentPayment && currentPayment.paymentStatus !== 'PAID';
  const accepted = !!quote && acceptedHash === quote.quoteHash;
  const canCreate = enabled && !!user && !!quote?.available && accepted && !checking;
  const button = 'flex min-h-12 w-full items-center justify-center rounded-xl bg-film-warm px-4 text-center text-sm font-bold text-film-dark disabled:cursor-not-allowed disabled:opacity-40';
  const detailPath = `/thiet-bi/${product.slug}?${new URLSearchParams({ may: String(unit.id), start: startDate, end: endDate })}`;
  return <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
    <Link to={detailPath} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300"><ArrowLeft size={16}/>Chi tiết thiết bị</Link>
    <p className="mt-4 text-xs font-bold uppercase tracking-wider text-film-warm">{mode === 'thue' ? 'Thuê thiết bị' : 'Mua máy cũ'}</p>
    <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">Xem lại {mode === 'thue' ? 'lịch thuê và chi phí' : 'thiết bị muốn mua'}</h1>
    <div className="mt-6 grid min-w-0 gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-5"><h2 className="font-bold text-white">{product.name}</h2><p className="mt-2 break-all text-sm text-slate-300">Serial {unit.serialNumber} · Ngoại hình {unit.conditionGrade}</p><p className="mt-3 text-xs leading-5 text-slate-400">Nhận máy trực tiếp. Đối chiếu tình trạng, phụ kiện và biên bản khi bàn giao.</p></section>
        {mode === 'thue' ? <>
          <RentalSchedule unitId={unit.id} startDate={startDate} endDate={endDate} onChange={(start, end) => { setStartDate(start); setEndDate(end); setAcceptedHash(''); }} quote={quote} checking={checking} error={quoteError}/>
          {quote && <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-5"><h2 className="font-bold text-white">Quy định thuê · phiên bản {quote.policyVersion}</h2><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-300">{quote.terms}</p><p className="mt-3 text-sm text-slate-300">Hủy trước bàn giao: {quote.cancellationRefund === 'FULL_PAYMENT' ? 'hoàn tiền thuê và tiền cọc' : 'hoàn tiền cọc; phí thuê không hoàn'}. Mức cọc áp dụng riêng cho chiếc máy, không giảm theo eKYC.</p><label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 border-t border-film-border pt-4 text-sm leading-6 text-white"><input type="checkbox" checked={accepted} onChange={event => setAcceptedHash(event.target.checked ? quote.quoteHash : '')} className="mt-1 h-5 w-5 shrink-0 accent-film-warm"/>Tôi đồng ý lịch thuê, mức cọc và quy định ở trên.</label></section>}
        </> : <section className="rounded-2xl border border-film-border bg-film-card p-5 text-sm leading-6 text-slate-300"><h2 className="font-bold text-white">Hẹn xem máy trực tiếp</h2><p className="mt-3">Đối chiếu chiếc máy, phụ kiện, giá bán và điều kiện bảo hành trước khi quyết định mua.</p><Link to="/lien-he" className="mt-4 inline-flex min-h-11 items-center text-film-warm underline">Liên hệ Filmiliar</Link></section>}
      </div>
      <aside className="h-fit min-w-0 space-y-4 rounded-2xl border border-film-border bg-film-card p-4 md:sticky md:top-24 sm:p-5">
        <h2 className="font-bold text-white">Tóm tắt {mode === 'thue' ? 'đơn thuê' : 'thiết bị'}</h2>
        {mode === 'thue' ? <dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-400">Giá thuê / ngày</dt><dd className="text-white">{formatVnd(quote?.dailyRate ?? product.rentPrice)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-400">Tiền thuê {quote ? `(${quote.totalDays} ngày)` : ''}</dt><dd className="text-white">{quote ? formatVnd(quote.rentalFee) : '—'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-400">Cọc thiết bị</dt><dd className="text-white">{formatVnd(quote?.depositAmount ?? unit.depositAmount ?? 0)}</dd></div><div className="flex justify-between gap-3 border-t border-film-border pt-3 font-bold text-film-warm"><dt>Tổng thanh toán</dt><dd>{quote ? formatVnd(quote.totalAmount) : '—'}</dd></div></dl> : <p className="text-xl font-bold text-film-warm">{formatVnd(product.salePrice)}</p>}
        {mode === 'thue' && <>
          <p className="text-xs text-slate-400">ZaloPay Sandbox</p>
          {currentPayment?.paymentStatus === 'PAID' ? <Link to={`/tai-khoan/don-thue/${currentPayment.bookingId}`} className={button}>Xem đơn đã xác nhận</Link> : user ? <button type="button" disabled={!canResume && !canCreate} onClick={() => setShowPayment({ quoteHash: quote?.quoteHash || '', termsAccepted: accepted })} className={button}>{canResume ? 'Tiếp tục giao dịch đang có' : checking ? 'Đang kiểm tra lịch…' : 'Thanh toán và giữ lịch'}</button> : <Link to={`/dang-nhap?redirect=${encodeURIComponent(location.pathname + location.search)}`} className={button}>Đăng nhập để đặt thuê</Link>}
          <p className="text-xs leading-5 text-slate-400">Lịch được giữ khi tạo giao dịch và xác nhận sau khi thanh toán. Tiền cọc được hoàn sau nghiệm thu; khoản khấu trừ cần bạn xác nhận.</p>
        </>}
      </aside>
    </div>
    {showPayment && <PaymentQrModal cameraItemId={unit.id} startDate={startDate} endDate={endDate} quoteHash={showPayment.quoteHash} termsAccepted={showPayment.termsAccepted} onClose={closePayment}/>}
  </main>;
}
