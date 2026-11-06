import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/session';
import { formatVnd } from '../lib/catalog';
import { refundStatus, rentalStatus, todayVN, addDays } from '../lib/rental';
import type { RentalBundle } from '../lib/bundle';
import { RentalUnitForms } from './RentalUnitForms';
import { PaymentQrModal } from './PaymentQrModal';

const input =
  'mt-2 min-h-11 w-full min-w-0 rounded-lg border border-film-border bg-film-dark px-3 py-2 text-base text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm';
const button =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-film-warm px-4 text-sm font-bold text-film-dark disabled:opacity-40';
const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-film-border px-4 text-sm font-semibold text-white disabled:opacity-40';
type Action = (name: string, body?: Record<string, unknown>) => Promise<void>;
const time = (date: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date));

function HandoverForm({ bundle, busy, act }: { bundle: RentalBundle; busy: boolean; act: Action }) {
  const [reference, setReference] = useState(''),
    [note, setNote] = useState('');
  const [records, setRecords] = useState(
    bundle.bookings.map((b) => ({
      bookingId: b.id,
      accessories: b.cameraItem.passport?.accessories.join(', ') || '',
      condition: b.cameraItem.scratchNotes || b.cameraItem.opticsCondition || '',
      shutterCount: b.cameraItem.shutterCount == null ? '' : String(b.cameraItem.shutterCount),
    })),
  );
  const update = (id: string, name: 'accessories' | 'condition' | 'shutterCount', value: string) =>
    setRecords((current) => current.map((r) => (r.bookingId === id ? { ...r, [name]: value } : r)));
  return (
    <form
      className="rounded-xl border border-film-border bg-film-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void act('handover', {
          note,
          records: records.map((r) => ({
            ...r,
            receiptReference: reference,
            shutterCount: r.shutterCount === '' ? null : Number(r.shutterCount),
          })),
        });
      }}
    >
      <h3 className="text-lg font-bold text-white">Bàn giao cả bộ</h3>
      <label className="mt-4 block text-sm text-slate-300">
        Mã biên bản
        <input
          required
          minLength={3}
          maxLength={120}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className={input}
        />
      </label>
      {records.map((record) => {
        const line = bundle.bookings.find((b) => b.id === record.bookingId)!;
        return (
          <fieldset key={record.bookingId} className="mt-5 min-w-0 rounded-lg border border-film-border p-3">
            <legend className="max-w-full break-words px-1 text-sm font-semibold text-white">
              {line.cameraItem.product.modelName} · {line.cameraItem.serialNumber}
            </legend>
            <label className="block text-sm text-slate-300">
              Phụ kiện
              <textarea
                required
                minLength={2}
                maxLength={1000}
                rows={2}
                value={record.accessories}
                onChange={(e) => update(record.bookingId, 'accessories', e.target.value)}
                className={input}
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Tình trạng
              <textarea
                required
                minLength={5}
                maxLength={1000}
                rows={2}
                value={record.condition}
                onChange={(e) => update(record.bookingId, 'condition', e.target.value)}
                className={input}
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Số shot (bỏ trống với ống kính)
              <input
                type="number"
                min={0}
                max={10000000}
                value={record.shutterCount}
                onChange={(e) => update(record.bookingId, 'shutterCount', e.target.value)}
                className={input}
              />
            </label>
          </fieldset>
        );
      })}
      <label className="mt-4 block text-sm text-slate-300">
        Ghi nhận bàn giao
        <textarea
          required
          minLength={5}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={input}
        />
      </label>
      <label className="mt-3 flex min-h-11 items-start gap-3 text-sm leading-6 text-slate-300">
        <input required type="checkbox" className="mt-1 accent-film-warm" />
        Đã đồng kiểm và bàn giao đủ thiết bị trong bộ.
      </label>
      <button disabled={busy || bundle.startDate.slice(0, 10) !== todayVN()} className={`${button} mt-3`}>
        Xác nhận bàn giao cả bộ
      </button>
    </form>
  );
}

function DeductionChoice({
  line,
  busy,
  act,
}: {
  line: RentalBundle['bookings'][number];
  busy: boolean;
  act: Action;
}) {
  const [note, setNote] = useState('');
  const body = (accept: boolean) => ({
    bookingId: line.id,
    accept,
    expectedAmount: line.deductionAmount,
    inspectedAt: line.inspectedAt,
    note: note.trim() || (accept ? 'Khách đồng ý khoản khấu trừ trong biên bản.' : ''),
  });
  return (
    <div className="mt-3">
      <label className="text-sm text-slate-300">
        Phản hồi
        <textarea
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={input}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => void act('deduction-decision', body(true))} className={button}>
          Đồng ý khoản khấu trừ
        </button>
        <button
          disabled={busy || note.trim().length < 5}
          onClick={() => void act('deduction-decision', body(false))}
          className={secondary}
        >
          Yêu cầu xem lại
        </button>
      </div>
    </div>
  );
}

export function RentalBundleDetail({
  bundleId,
  admin = false,
  onUpdated,
}: {
  bundleId: string;
  admin?: boolean;
  onUpdated?: (bundle: RentalBundle) => void;
}) {
  const [bundle, setBundle] = useState<RentalBundle | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [note, setNote] = useState(''),
    [storeFault, setStoreFault] = useState(false),
    [newStart, setNewStart] = useState(''),
    [newEnd, setNewEnd] = useState(''),
    [startTime, setStartTime] = useState('08:00'),
    [endTime, setEndTime] = useState('08:00'),
    [showPayment, setShowPayment] = useState(false);
  const ids = useRef(new Map<string, string>()),
    active = useRef(bundleId);
  active.current = bundleId;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const result = await apiRequest<{ data: RentalBundle }>(`/api/rental/bundles/${bundleId}`, {
        signal,
        cache: 'no-store',
      });
      if (!signal?.aborted && active.current === bundleId) setBundle(result.data);
      return result.data;
    },
    [bundleId],
  );
  useEffect(() => {
    const controller = new AbortController();
    setBundle(null);
    setError('');
    setMessage('');
    void load(controller.signal).catch((error) => {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Không tải được bộ thuê');
    });
    return () => controller.abort();
  }, [load]);
  const pending =
    bundle?.id === bundleId &&
    (bundle.refunds.some((r) => ['CREATING', 'PENDING'].includes(r.status)) ||
      ['CREATING', 'WAITING'].includes(bundle.paymentAttempt?.status || ''));
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      void load(controller.signal).catch(() => {});
    }, 8000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [pending, load]);
  const act: Action = async (name, body = {}) => {
    setBusy(true);
    setError('');
    setMessage('');
    const key =
      name +
      JSON.stringify(body) +
      (name === 'refund' ? bundle?.refunds.find((r) => r.status === 'FAILED')?.id || 'initial' : '');
    let requestId = ids.current.get(key);
    if (!requestId) {
      requestId = crypto.randomUUID();
      ids.current.set(key, requestId);
    }
    const path = ['handover', 'receive-return', 'inspect'].includes(name)
      ? `/api/admin/rental-bundles/${bundleId}/${name}`
      : `/api/rental/bundles/${bundleId}/${name}`;
    try {
      const result = await apiRequest<{ data: RentalBundle }>(path as `/api/${string}`, {
        method: 'POST',
        body: JSON.stringify(
          name === 'refund'
            ? { clientRequestId: requestId }
            : name === 'check-refund'
              ? {}
              : { ...body, requestId },
        ),
      });
      if (active.current !== bundleId) return;
      setBundle(result.data);
      onUpdated?.(result.data);
      setMessage('Đã cập nhật đơn bộ thuê.');
      setNote('');
    } catch (error) {
      if (active.current !== bundleId) return;
      setError(error instanceof Error ? error.message : 'Không cập nhật được bộ thuê');
      void load().catch(() => {});
    } finally {
      if (active.current === bundleId) setBusy(false);
    }
  };
  const closePayment = useCallback(() => {
    setShowPayment(false);
    void load().catch(() => {});
  }, [load]);
  if (!bundle || bundle.id !== bundleId)
    return (
      <div role="status" className="rounded-xl border border-film-border p-5 text-sm">
        {error || 'Đang tải đơn bộ thuê...'}
      </div>
    );
  const refund = bundle.refunds[0],
    isPaid = bundle.paymentAttempt?.status === 'PAID';
  const reschedulable =
    bundle.status === 'CONFIRMED' &&
    bundle.pickupAt &&
    bundle.rescheduleCount === 0 &&
    new Date(bundle.pickupAt).getTime() - Date.now() >= 24 * 3600000;
  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-film-warm">
          Đơn bộ thuê · {bundle.bookings.length} thiết bị
        </p>
        <h1 className="mt-2 break-all text-2xl font-bold text-white">{bundle.code}</h1>
        <p className="mt-3 text-sm text-slate-300">
          {bundle.pickupAt ? time(bundle.pickupAt) : bundle.startDate.slice(0, 10)} →{' '}
          {bundle.dueAt ? time(bundle.dueAt) : bundle.endDate.slice(0, 10)}
        </p>
        <p className="mt-2 text-sm font-semibold text-film-warm">
          {rentalStatus[bundle.status] || 'Cần đối soát'}
          {bundle.paymentAttempt?.status === 'REVIEW' ? ' · Cần đối soát thanh toán' : ''}
        </p>
        {admin && (
          <p className="mt-3 break-words text-sm text-slate-300">
            {bundle.user.fullName} · {bundle.user.phone} · {bundle.user.email}
          </p>
        )}
        <dl className="mt-5 space-y-3 border-t border-film-border pt-4 text-sm">
          {[
            ['Tiền thuê', formatVnd(bundle.totalRentalFee)],
            ['Cọc cả bộ', formatVnd(bundle.depositAmount)],
            ['Khấu trừ đề nghị', formatVnd(bundle.deductionAmount)],
            ['Tổng đã thanh toán', isPaid ? formatVnd(bundle.totalAmount) : 'Chưa xác nhận'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-slate-400">{label}</dt>
              <dd className="text-right font-semibold text-white">{value}</dd>
            </div>
          ))}
        </dl>
        {bundle.policySnapshot && (
          <details className="mt-5 border-t border-film-border pt-3 text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-film-warm">Điều khoản đã xác nhận</summary>
            <p className="whitespace-pre-line text-xs leading-6 text-slate-300">
              {bundle.policySnapshot.terms}
            </p>
          </details>
        )}
        {bundle.status === 'PENDING_PAYMENT' && (
          <button type="button" onClick={() => setShowPayment(true)} className={`${button} mt-4`}>
            Xem giao dịch thanh toán
          </button>
        )}
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-300">
          {message}
        </p>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Thiết bị và biên bản</h2>
        {bundle.bookings.map((line) => (
          <article
            key={line.id}
            className="min-w-0 rounded-xl border border-film-border bg-film-card p-4 sm:p-5"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <Link
                to={`/thiet-bi/${line.cameraItem.product.slug}?may=${line.cameraItemId}`}
                className="font-bold text-white hover:text-film-warm"
              >
                {line.cameraItem.product.modelName}
              </Link>
              <span className="text-xs text-film-warm">{rentalStatus[line.status] || line.status}</span>
            </div>
            <p className="mt-2 break-all font-mono text-xs text-slate-400">{line.cameraItem.serialNumber}</p>
            <p className="mt-3 text-sm text-slate-300">
              Thuê {formatVnd(line.totalRentalFee)} · Cọc {formatVnd(line.depositAmount)}
            </p>
            {line.handoverRecord && (
              <details className="mt-3 text-sm">
                <summary className="min-h-11 cursor-pointer py-2 text-slate-200">Biên bản bàn giao</summary>
                <p className="text-xs leading-6 text-slate-300">
                  {line.handoverRecord.receiptReference} · {line.handoverRecord.accessories}
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-300">{line.handoverRecord.condition}</p>
              </details>
            )}
            {line.returnInspectionNote && (
              <p className="mt-3 text-sm leading-6 text-slate-300">Nghiệm thu: {line.returnInspectionNote}</p>
            )}
            {line.deductionAmount > 0 && (
              <div className="mt-4 border-t border-film-border pt-4">
                <h3 className="font-semibold text-film-warm">Khấu trừ {formatVnd(line.deductionAmount)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{line.deductionReason}</p>
                {!admin && line.deductionDecision === 'PENDING' ? (
                  <DeductionChoice line={line} busy={busy} act={act} />
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    {line.deductionDecision === 'ACCEPTED'
                      ? 'Khách đã đồng ý'
                      : line.deductionDecision === 'REJECTED'
                        ? 'Khách yêu cầu xem lại'
                        : 'Đang chờ khách xác nhận'}
                  </p>
                )}
              </div>
            )}
            {admin &&
              (['RETURNED_PENDING_INSPECTION'].includes(line.status) ||
                (line.status === 'COMPLETED' && line.deductionDecision === 'REJECTED')) && (
                <div className="mt-4">
                  <RentalUnitForms
                    key={`${line.id}:${line.status}:${line.inspectedAt}`}
                    booking={{ ...line, user: bundle.user }}
                    busy={busy}
                    act={(name, body) => act(name, { ...body, bookingId: line.id })}
                  />
                </div>
              )}
          </article>
        ))}
      </section>
      {refund && (
        <section className="rounded-xl border border-film-border bg-film-card p-4 text-sm">
          <h2 className="font-bold text-white">Hoàn tiền cả bộ</h2>
          <p className="mt-3 font-semibold text-film-warm">
            {refundStatus[refund.status]} · {formatVnd(refund.amount)}
          </p>
          <p className="mt-2 break-all font-mono text-xs text-slate-400">{refund.mRefundId}</p>
          {refund.status !== 'SUCCEEDED' && (
            <button disabled={busy} onClick={() => void act('check-refund')} className={`${secondary} mt-4`}>
              Kiểm tra kết quả hoàn
            </button>
          )}
        </section>
      )}
      {bundle.canRefund && (
        <button disabled={busy} onClick={() => void act('refund')} className={button}>
          Gửi yêu cầu hoàn tiền cả bộ
        </button>
      )}
      {admin && bundle.status === 'CONFIRMED' && isPaid && (
        <HandoverForm bundle={bundle} busy={busy} act={act} />
      )}
      {admin && bundle.status === 'ACTIVE_RENTAL' && (
        <form
          className="rounded-xl border border-film-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act('receive-return', { note });
          }}
        >
          <h2 className="font-bold text-white">Nhận lại cả bộ</h2>
          <label className="mt-3 block text-sm text-slate-300">
            Ghi nhận trả máy
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={input}
            />
          </label>
          <label className="mt-3 flex min-h-11 items-start gap-3 text-sm leading-6 text-slate-300">
            <input type="checkbox" required className="mt-1 accent-film-warm" />
            Đã nhận lại đủ {bundle.bookings.length} thiết bị trong bộ.
          </label>
          <button disabled={busy} className={`${button} mt-3`}>
            Nhận đủ bộ và chuyển nghiệm thu
          </button>
        </form>
      )}
      {bundle.status === 'CONFIRMED' && isPaid && (
        <form
          className="rounded-xl border border-film-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act('cancel', { note, ...(admin ? { storeFault } : {}) });
          }}
        >
          <h2 className="font-bold text-white">Hủy cả bộ trước bàn giao</h2>
          <p className="mt-3 text-sm text-slate-300">
            Dự kiến hoàn: {formatVnd(storeFault ? bundle.totalAmount : bundle.cancellationRefundAmount)}
          </p>
          {admin && (
            <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={storeFault} onChange={(e) => setStoreFault(e.target.checked)} />
              Filmiliar không thể giao máy theo lịch
            </label>
          )}
          <label className="mt-3 block text-sm text-slate-300">
            Lý do hủy
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={input}
            />
          </label>
          <button disabled={busy} className={`${secondary} mt-3`}>
            Hủy cả bộ và gửi hoàn theo chính sách
          </button>
        </form>
      )}
      {reschedulable && (
        <form
          className="rounded-xl border border-film-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act('reschedule', {
              startDate: newStart,
              endDate: newEnd,
              startTime,
              endTime,
              note: 'Đổi lịch một lần cho cả bộ, giữ nguyên thời lượng và tiền thuê.',
            });
          }}
        >
          <h2 className="font-bold text-white">Đổi lịch cả bộ</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="min-w-0 text-sm text-slate-300">
              Ngày nhận mới
              <input
                type="date"
                required
                min={todayVN()}
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className={input}
              />
            </label>
            <label className="min-w-0 text-sm text-slate-300">
              Ngày trả mới
              <input
                type="date"
                required
                min={newStart ? addDays(newStart, 1) : todayVN()}
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className={input}
              />
            </label>
            <label className="min-w-0 text-sm text-slate-300">
              Giờ nhận
              <input
                type="time"
                required
                min="08:00"
                max="20:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={input}
              />
            </label>
            <label className="min-w-0 text-sm text-slate-300">
              Giờ trả
              <input
                type="time"
                required
                min="08:00"
                max="20:00"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={input}
              />
            </label>
          </div>
          <button disabled={busy} className={`${secondary} mt-4`}>
            Kiểm tra và xác nhận lịch mới
          </button>
        </form>
      )}
      <section className="rounded-xl border border-film-border p-4">
        <h2 className="font-bold text-white">Lịch sử xử lý</h2>
        <ol className="mt-4 space-y-4">
          {bundle.events.map((event) => (
            <li key={event.id} className="border-l-2 border-film-teal pl-3">
              <p className="text-xs text-slate-400">{time(event.createdAt)}</p>
              <p className="mt-1 break-words text-sm leading-6 text-slate-200">{event.detail}</p>
            </li>
          ))}
        </ol>
      </section>
      {showPayment && (
        <PaymentQrModal
          cameraItemId={bundle.bookings[0].cameraItemId}
          cameraItemIds={bundle.bookings.map((b) => b.cameraItemId)}
          existingBookingId={bundle.primaryBookingId}
          startDate={bundle.startDate.slice(0, 10)}
          endDate={bundle.endDate.slice(0, 10)}
          startTime={
            bundle.pickupAt
              ? new Date(new Date(bundle.pickupAt).getTime() + 7 * 3600000).toISOString().slice(11, 16)
              : '08:00'
          }
          endTime={
            bundle.dueAt
              ? new Date(new Date(bundle.dueAt).getTime() + 7 * 3600000).toISOString().slice(11, 16)
              : '08:00'
          }
          quoteHash=""
          termsAccepted={false}
          onClose={closePayment}
        />
      )}
    </div>
  );
}
