import { useState } from 'react';
import type { RentalBooking } from '../lib/rental';
import { showDay, todayVN } from '../lib/rental';
const inputClass =
  'mt-1 min-h-11 w-full rounded-lg border border-film-border bg-film-dark px-3 py-2 text-sm text-white';
const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-film-warm px-4 text-sm font-bold text-film-dark disabled:cursor-not-allowed disabled:opacity-40';
type Action = (action: string, body?: Record<string, unknown>) => Promise<void>;

export function RentalUnitForms({
  booking,
  busy,
  act,
}: {
  booking: RentalBooking;
  busy: boolean;
  act: Action;
}) {
  const [note, setNote] = useState('');
  const [accessories, setAccessories] = useState('');
  const [reference, setReference] = useState('');
  const [condition, setCondition] = useState(
    booking.returnRecord?.condition || booking.handoverRecord?.condition || '',
  );
  const [shutterCount, setShutterCount] = useState(
    booking.cameraItem.shutterCount == null ? '' : String(booking.cameraItem.shutterCount),
  );
  const [deduction, setDeduction] = useState(String(booking.deductionAmount || 0));
  const [reason, setReason] = useState(booking.deductionReason || '');
  const [releaseToStock, setReleaseToStock] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const revising = booking.status === 'COMPLETED' && booking.deductionDecision === 'REJECTED';
  if (!['CONFIRMED', 'ACTIVE_RENTAL', 'RETURNED_PENDING_INSPECTION'].includes(booking.status) && !revising)
    return null;
  const inspect = booking.status === 'RETURNED_PENDING_INSPECTION' || revising;
  return (
    <form
      className="rounded-xl border border-film-border bg-film-card p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const count = shutterCount === '' ? null : Number(shutterCount);
        if (booking.status === 'CONFIRMED')
          void act('handover', {
            note,
            accessories,
            condition,
            shutterCount: count,
            receiptReference: reference,
          });
        else if (inspect)
          void act('inspect', {
            note,
            condition,
            shutterCount: count,
            deductionAmount: Number(deduction),
            deductionReason: reason,
            releaseToStock,
          });
        else void act('receive-return', { note });
      }}
    >
      <h3 className="text-lg font-bold text-white">
        {inspect
          ? revising
            ? 'Cập nhật biên bản sau phản hồi'
            : 'Nghiệm thu máy'
          : booking.status === 'CONFIRMED'
            ? 'Bàn giao thiết bị'
            : 'Ghi nhận khách trả máy'}
      </h3>
      {booking.status === 'CONFIRMED' && (
        <>
          <label className="mt-4 block text-sm text-slate-300">
            Mã biên bản bàn giao
            <input
              required
              minLength={3}
              maxLength={120}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="mt-3 block text-sm text-slate-300">
            Phụ kiện bàn giao
            <textarea
              required
              minLength={2}
              maxLength={1000}
              value={accessories}
              onChange={(e) => setAccessories(e.target.value)}
              className={inputClass}
              rows={2}
            />
          </label>
          {booking.startDate.slice(0, 10) !== todayVN() && (
            <p className="mt-3 text-sm text-amber-300">
              Ngày nhận máy: {showDay(booking.startDate)}. Thao tác bàn giao mở đúng ngày nhận.
            </p>
          )}
        </>
      )}
      {(booking.status === 'CONFIRMED' || inspect) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
            Số shot (bỏ trống với lens)
            <input
              type="number"
              min={0}
              max={10000000}
              value={shutterCount}
              onChange={(e) => setShutterCount(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm text-slate-300">
            Ngoại hình, quang học
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className={inputClass}
              rows={2}
            />
          </label>
        </div>
      )}
      {inspect && (
        <>
          <label className="mt-3 block text-sm text-slate-300">
            Đề nghị khấu trừ (đ)
            <input
              required
              type="number"
              min={0}
              max={booking.depositAmount}
              step={1}
              value={deduction}
              onChange={(e) => setDeduction(e.target.value)}
              className={inputClass}
            />
          </label>
          {Number(deduction) > 0 && (
            <label className="mt-3 block text-sm text-slate-300">
              Căn cứ, chi phí và biên bản khấu trừ
              <textarea
                required
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputClass}
                rows={3}
              />
            </label>
          )}
          <label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={releaseToStock}
              onChange={(e) => setReleaseToStock(e.target.checked)}
              className="mt-1 accent-film-warm"
            />
            <span>Máy đạt để tiếp tục cho thuê. Bỏ chọn nếu cần bảo dưỡng.</span>
          </label>
        </>
      )}
      <label className="mt-3 block text-sm text-slate-300">
        {inspect ? 'Kết quả nghiệm thu' : 'Ghi chú biên bản'}
        <textarea
          required
          minLength={5}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
          rows={3}
        />
      </label>
      <label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-slate-300">
        <input
          required
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 accent-film-warm"
        />
        <span>
          {inspect
            ? 'Tôi đã đối chiếu máy, phụ kiện và biên bản bàn giao.'
            : booking.status === 'CONFIRMED'
              ? 'Tôi xác nhận đã đồng kiểm và bàn giao máy cho khách.'
              : 'Tôi xác nhận đã nhận lại máy thực tế.'}
        </span>
      </label>
      <button
        disabled={busy || (booking.status === 'CONFIRMED' && booking.startDate.slice(0, 10) !== todayVN())}
        className={`${buttonClass} mt-4`}
      >
        {busy
          ? 'Đang xử lý...'
          : inspect
            ? Number(deduction) > 0
              ? 'Gửi biên bản cho khách xác nhận'
              : 'Xác nhận nghiệm thu và gửi hoàn cọc'
            : booking.status === 'CONFIRMED'
              ? 'Xác nhận bàn giao'
              : 'Nhận máy và chuyển nghiệm thu'}
      </button>
    </form>
  );
}
