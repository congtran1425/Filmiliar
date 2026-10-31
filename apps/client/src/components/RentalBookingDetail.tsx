import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/session';
import { formatVnd } from '../lib/catalog';
import { refundStatus, rentalStatus, showDay, todayVN } from '../lib/rental';
import type { RentalBooking } from '../lib/rental';

const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-film-border bg-film-dark px-3 py-2 text-sm text-white';
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-film-warm px-4 text-sm font-bold text-film-dark disabled:cursor-not-allowed disabled:opacity-40';
const secondaryClass = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-film-border px-4 text-sm font-semibold text-white disabled:opacity-40';
type Action = (action: string, body?: Record<string, unknown>) => Promise<void>;

function AdminForms({ booking, busy, act }: { booking: RentalBooking; busy: boolean; act: Action }) {
  const [note, setNote] = useState('');
  const [accessories, setAccessories] = useState('');
  const [reference, setReference] = useState('');
  const [condition, setCondition] = useState(booking.returnRecord?.condition || booking.handoverRecord?.condition || '');
  const [shutterCount, setShutterCount] = useState(booking.cameraItem.shutterCount == null ? '' : String(booking.cameraItem.shutterCount));
  const [deduction, setDeduction] = useState(String(booking.deductionAmount || 0));
  const [reason, setReason] = useState(booking.deductionReason || '');
  const [releaseToStock, setReleaseToStock] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const revising = booking.status === 'COMPLETED' && booking.deductionDecision === 'REJECTED';
  if (!['CONFIRMED', 'ACTIVE_RENTAL', 'RETURNED_PENDING_INSPECTION'].includes(booking.status) && !revising) return null;
  const inspect = booking.status === 'RETURNED_PENDING_INSPECTION' || revising;
  return <form className="rounded-xl border border-film-border bg-film-card p-4 sm:p-5" onSubmit={event => {
    event.preventDefault();
    const count = shutterCount === '' ? null : Number(shutterCount);
    if (booking.status === 'CONFIRMED') void act('handover', { note, accessories, condition, shutterCount: count, receiptReference: reference });
    else if (inspect) void act('inspect', { note, condition, shutterCount: count, deductionAmount: Number(deduction), deductionReason: reason, releaseToStock });
    else void act('receive-return', { note });
  }}>
    <h3 className="text-lg font-bold text-white">{inspect ? revising ? 'Cập nhật biên bản sau phản hồi' : 'Nghiệm thu máy' : booking.status === 'CONFIRMED' ? 'Bàn giao thiết bị' : 'Ghi nhận khách trả máy'}</h3>
    {booking.status === 'CONFIRMED' && <>
      <label className="mt-4 block text-sm text-slate-300">Mã biên bản bàn giao<input required minLength={3} maxLength={120} value={reference} onChange={e => setReference(e.target.value)} className={inputClass}/></label>
      <label className="mt-3 block text-sm text-slate-300">Phụ kiện bàn giao<textarea required minLength={2} maxLength={1000} value={accessories} onChange={e => setAccessories(e.target.value)} className={inputClass} rows={2}/></label>
      {booking.startDate.slice(0, 10) !== todayVN() && <p className="mt-3 text-sm text-amber-300">Ngày nhận máy: {showDay(booking.startDate)}. Thao tác bàn giao mở đúng ngày nhận.</p>}
    </>}
    {(booking.status === 'CONFIRMED' || inspect) && <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm text-slate-300">Số shot (bỏ trống với lens)<input type="number" min={0} max={10000000} value={shutterCount} onChange={e => setShutterCount(e.target.value)} className={inputClass}/></label>
      <label className="text-sm text-slate-300">Ngoại hình, quang học<textarea required minLength={5} maxLength={1000} value={condition} onChange={e => setCondition(e.target.value)} className={inputClass} rows={2}/></label>
    </div>}
    {inspect && <>
      <label className="mt-3 block text-sm text-slate-300">Đề nghị khấu trừ (đ)<input required type="number" min={0} max={booking.depositAmount} step={1} value={deduction} onChange={e => setDeduction(e.target.value)} className={inputClass}/></label>
      {Number(deduction) > 0 && <label className="mt-3 block text-sm text-slate-300">Căn cứ, chi phí và biên bản khấu trừ<textarea required minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className={inputClass} rows={3}/><span className="mt-2 block text-xs leading-5 text-slate-400">Khách cần đồng ý khoản này trong hồ sơ đơn trước khi gửi hoàn phần cọc còn lại.</span></label>}
      <label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-slate-300"><input type="checkbox" checked={releaseToStock} onChange={e => setReleaseToStock(e.target.checked)} className="mt-1 accent-film-warm"/><span>Máy đạt để tiếp tục cho thuê. Bỏ chọn nếu cần bảo dưỡng.</span></label>
    </>}
    <label className="mt-3 block text-sm text-slate-300">{inspect ? 'Kết quả nghiệm thu' : 'Ghi chú biên bản'}<textarea required minLength={5} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} className={inputClass} rows={3}/></label>
    <label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-slate-300"><input required type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 accent-film-warm"/><span>{inspect ? 'Tôi đã đối chiếu máy, phụ kiện và biên bản bàn giao.' : booking.status === 'CONFIRMED' ? 'Tôi xác nhận đã đồng kiểm và bàn giao máy cho khách.' : 'Tôi xác nhận đã nhận lại máy thực tế.'}</span></label>
    <button disabled={busy || (booking.status === 'CONFIRMED' && booking.startDate.slice(0, 10) !== todayVN())} className={`${buttonClass} mt-4`}>{busy ? 'Đang xử lý...' : inspect ? Number(deduction) > 0 ? 'Gửi biên bản cho khách xác nhận' : 'Xác nhận nghiệm thu và gửi hoàn cọc' : booking.status === 'CONFIRMED' ? 'Xác nhận bàn giao' : 'Nhận máy và chuyển nghiệm thu'}</button>
  </form>;
}

export function RentalBookingDetail({ bookingId, admin = false, onUpdated }: { bookingId: string; admin?: boolean; onUpdated?: (booking: RentalBooking) => void }) {
  const [booking, setBooking] = useState<RentalBooking | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const requestIds = useRef(new Map<string, string>());
  const activeId = useRef(bookingId);
  activeId.current = bookingId;
  const load = useCallback(async (signal?: AbortSignal) => {
    const result = await apiRequest<{ data: RentalBooking }>(`/api/rental/bookings/${bookingId}`, { signal, cache: 'no-store' });
    if (!signal?.aborted && activeId.current === bookingId) setBooking(result.data);
    return result.data;
  }, [bookingId]);
  useEffect(() => {
    const controller = new AbortController();
    setBooking(null); setError(''); setMessage('');
    load(controller.signal).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được đơn'); });
    return () => controller.abort();
  }, [load]);
  const pending = booking?.id === bookingId && (booking.refunds.some(r => ['CREATING', 'PENDING'].includes(r.status)) || ['CREATING', 'WAITING'].includes(booking.paymentAttempt?.status || ''));
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => { void load(controller.signal).catch(() => {}); }, 8000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [load, pending]);
  const act: Action = async (action, body = {}) => {
    setBusy(true); setError(''); setMessage('');
    const key = action + ':' + JSON.stringify(body) + (action === 'refund' ? `:${booking?.refunds.find(refund => refund.status === 'FAILED')?.id || 'initial'}` : '');
    let requestId = requestIds.current.get(key);
    if (!requestId) { requestId = crypto.randomUUID(); requestIds.current.set(key, requestId); }
    const adminAction = ['handover', 'receive-return', 'inspect'].includes(action);
    const path = adminAction ? `/api/admin/rentals/${bookingId}/${action}` : `/api/rental/bookings/${bookingId}/${action}`;
    const payload = action === 'refund' ? { clientRequestId: requestId } : action === 'check-refund' ? {} : { ...body, requestId };
    try {
      const result = await apiRequest<{ data: RentalBooking }>(path as `/api/${string}`, { method: 'POST', body: JSON.stringify(payload) });
      if (activeId.current !== bookingId) return;
      setBooking(result.data); onUpdated?.(result.data); setMessage('Đã cập nhật hồ sơ đơn.');
    } catch (cause) {
      if (activeId.current !== bookingId) return;
      setError(cause instanceof Error ? cause.message : 'Không xử lý được thao tác');
      void load().catch(() => {});
    } finally { if (activeId.current === bookingId) setBusy(false); }
  };
  if (!booking || booking.id !== bookingId) return <div role="status" className="rounded-xl border border-film-border p-5 text-sm text-slate-300">{error || 'Đang tải hồ sơ đơn thuê...'}</div>;
  const refund = booking.refunds[0];
  const refundDone = refund?.status === 'SUCCEEDED';
  const canRefund = (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') && booking.paymentAttempt?.status === 'PAID' && (!booking.deductionAmount || booking.deductionDecision === 'ACCEPTED') && (!refund || refund.status === 'FAILED') && !['REFUNDED','DEDUCTED'].includes(booking.depositStatus);
  const time = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  return <div className="space-y-4">
    <section className="rounded-xl border border-film-border bg-film-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-film-warm">Hồ sơ thuê máy</p><h2 className="mt-1 break-all text-xl font-bold text-white">{booking.bookingCode}</h2></div><span className="rounded-full border border-film-border px-3 py-1.5 text-xs text-slate-300">ZaloPay Sandbox</span></div>
      <p className="mt-3 text-sm font-semibold text-white">{booking.cameraItem.product.modelName} · <span className="break-all font-mono">{booking.cameraItem.serialNumber}</span></p>
      <p className="mt-1 text-sm text-slate-400">{showDay(booking.startDate)} → {showDay(booking.endDate)} · {rentalStatus[booking.status] || booking.status}</p>
      {admin && <p className="mt-2 break-words text-sm text-slate-300">{booking.user.fullName} · {booking.user.email}{booking.user.phone ? ` · ${booking.user.phone}` : ''}</p>}
      <dl className="mt-4 space-y-2 border-t border-film-border pt-4 text-sm">
        {[['Tiền thuê',formatVnd(booking.totalRentalFee)],['Cọc của đơn',formatVnd(booking.depositAmount)],['Đề nghị khấu trừ',formatVnd(booking.deductionAmount)],['Hoàn về giao dịch ban đầu',refundDone ? formatVnd(refund.amount) : booking.depositAmount === 0 && booking.status === 'COMPLETED' ? 'Không phát sinh tiền cọc' : refund ? refundStatus[refund.status] : booking.depositStatus === 'DEDUCTED' ? 'Đã xử lý theo khoản khấu trừ' : 'Chờ xử lý theo trạng thái đơn']].map(([name,value]) => <div key={name} className="flex justify-between gap-4"><dt className="text-slate-400">{name}</dt><dd className="max-w-[60%] text-right font-medium text-white">{value}</dd></div>)}
      </dl>
      {booking.handoverRecord && <div className="mt-4 border-t border-film-border pt-3 text-xs leading-6 text-slate-300"><p><strong>Biên bản:</strong> {booking.handoverRecord.receiptReference}</p><p><strong>Phụ kiện:</strong> {booking.handoverRecord.accessories}</p><p><strong>Tình trạng bàn giao:</strong> {booking.handoverRecord.condition}</p></div>}
      {booking.returnInspectionNote && <p className="mt-3 text-sm leading-6 text-slate-300"><strong>Nghiệm thu:</strong> {booking.returnInspectionNote}</p>}
      {booking.policySnapshot && <details className="mt-4 border-t border-film-border pt-3 text-xs leading-6 text-slate-300"><summary className="min-h-11 cursor-pointer font-semibold text-white">Điều khoản đã đồng ý · phiên bản {booking.policySnapshot.version}</summary><p className="whitespace-pre-line">{booking.policySnapshot.terms}</p><p className="mt-2">Hủy trước bàn giao: {booking.policySnapshot.cancellationRefund === 'DEPOSIT_ONLY' ? 'hoàn tiền cọc' : 'hoàn tiền thuê và tiền cọc'}.</p></details>}
      {refund && <div className="mt-4 rounded-lg border border-film-border bg-film-dark p-3 text-xs leading-6 text-slate-300"><p className={refundDone ? 'font-bold text-emerald-300' : 'font-semibold text-film-warm'}>{refundStatus[refund.status]} · {formatVnd(refund.amount)}</p><p className="break-all font-mono">Mã hoàn: {refund.mRefundId}</p>{refund.providerRefundId && <p className="break-all">ZaloPay: {refund.providerRefundId}</p>}{refund.confirmedAt && <p>Xác nhận: {time(refund.confirmedAt)}</p>}{refund.status !== 'SUCCEEDED' && <button type="button" disabled={busy} onClick={() => void act('check-refund')} className={`${secondaryClass} mt-2`}>Kiểm tra kết quả hoàn tiền</button>}{admin && refund.reviewReason && <p className="mt-2 break-all text-amber-300">Đối soát: {refund.reviewReason}</p>}</div>}
      {canRefund && <button disabled={busy} onClick={() => void act('refund')} className={`${buttonClass} mt-4`}>{refund?.status === 'FAILED' ? 'Gửi lại yêu cầu hoàn tiền' : 'Gửi yêu cầu hoàn tiền'}</button>}
    </section>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
    {!admin && booking.deductionAmount > 0 && <section className="rounded-xl border border-film-warm/40 bg-film-card p-4 sm:p-5"><h3 className="font-bold text-white">Biên bản đề nghị khấu trừ</h3><p className="mt-2 text-sm leading-6 text-slate-300">{booking.deductionReason}</p><p className="mt-2 font-bold text-film-warm">{formatVnd(booking.deductionAmount)}</p>{booking.deductionDecision === 'PENDING' ? <><label className="mt-4 block text-sm text-slate-300">Phản hồi của bạn<textarea className={inputClass} rows={2} value={decisionNote} maxLength={1000} onChange={e => setDecisionNote(e.target.value)}/></label><div className="mt-3 flex flex-wrap gap-3"><button disabled={busy} className={buttonClass} onClick={() => void act('deduction-decision', { accept: true, expectedAmount: booking.deductionAmount, inspectedAt: booking.inspectedAt, note: decisionNote.trim() || 'Khách đồng ý khoản khấu trừ trong biên bản.' })}>Đồng ý và hoàn phần cọc còn lại</button><button disabled={busy || decisionNote.trim().length < 5} className={secondaryClass} onClick={() => void act('deduction-decision', { accept: false, expectedAmount: booking.deductionAmount, inspectedAt: booking.inspectedAt, note: decisionNote })}>Yêu cầu xem lại</button></div></> : <p className="mt-3 text-sm text-slate-300">{booking.deductionDecision === 'ACCEPTED' ? 'Bạn đã đồng ý khoản khấu trừ này.' : 'Đã gửi phản hồi. Nhân viên sẽ xem lại biên bản.'}</p>}</section>}
    {admin && <AdminForms key={`${booking.id}:${booking.status}:${booking.inspectedAt}`} booking={booking} busy={busy} act={act}/>}
    {booking.status === 'CONFIRMED' && !booking.handoverAt && <form className="rounded-xl border border-film-border p-4" onSubmit={e => { e.preventDefault(); void act('cancel', { note: cancelReason }); }}><h3 className="font-semibold text-white">Hủy trước bàn giao</h3><label className="mt-3 block text-sm text-slate-300">Lý do hủy<textarea required minLength={5} maxLength={1000} value={cancelReason} onChange={e => setCancelReason(e.target.value)} className={inputClass} rows={2}/></label><button disabled={busy} className={`${secondaryClass} mt-3`}>Hủy đơn và gửi yêu cầu hoàn tiền theo chính sách</button></form>}
    {booking.status === 'PENDING_PAYMENT' && <Link className={`${secondaryClass} w-full`} to={`/thiet-bi/${booking.cameraItem.product.slug}/xem-lai/thue?may=${booking.cameraItem.id}&start=${booking.startDate.slice(0,10)}&end=${booking.endDate.slice(0,10)}`}>Xem lại giao dịch thanh toán</Link>}
    <section className="rounded-xl border border-film-border p-4 sm:p-5"><h3 className="font-bold text-white">Lịch sử xử lý</h3><ol className="mt-4 space-y-4">{booking.events.map(event => <li key={event.id} className="border-l-2 border-film-teal pl-4"><p className="text-xs text-slate-400">{time(event.createdAt)}</p><p className="mt-1 break-words text-sm leading-6 text-slate-200">{event.detail}</p></li>)}</ol></section>
  </div>;
}
