import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/session';
import { addDays, rentalStatus, showDay, todayVN } from '../lib/rental';
import type { RentalBooking, RentalPolicy } from '../lib/rental';
import { RentalBookingDetail } from './RentalBookingDetail';

type Unit = { id: number; serialNumber: string; status: string; depositAmount: number; product: { modelName: string; isPublished: boolean } };
type ListItem = { id: string; bookingCode: string; status: string; user: { fullName: string }; cameraItem: { serialNumber: string; product: { modelName: string } } };
type Allocation = { id: string; bookingId: string | null; kind: string; startDate: string; endDate: string; reason: string | null; booking: { bookingCode: string; status: string; user: { fullName: string } } | null };
const input = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-film-border bg-film-dark px-3 py-2 text-sm text-white [color-scheme:dark]';
const button = 'min-h-11 rounded-lg bg-film-warm px-4 text-sm font-bold text-film-dark disabled:opacity-40';

function PolicyForm({ policy, onSaved }: { policy: RentalPolicy; onSaved: (policy: RentalPolicy) => void }) {
  const [buffer, setBuffer] = useState(policy.returnBufferDays);
  const [cancellation, setCancellation] = useState(policy.cancellationRefund);
  const [terms, setTerms] = useState(policy.terms);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <form className="rounded-xl border border-film-border bg-film-card p-4 sm:p-5" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await apiRequest<{ data: RentalPolicy }>('/api/admin/rental-policy', { method: 'PATCH', body: JSON.stringify({ version: policy.version, returnBufferDays: buffer, cancellationRefund: cancellation, terms }) });
      onSaved(result.data);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không lưu được chính sách'); }
    finally { setBusy(false); }
  }}><h3 className="text-lg font-bold text-white">Quy tắc thuê và hoàn tiền</h3><p className="mt-2 text-xs leading-5 text-slate-400">Phiên bản {policy.version}. Đơn đã tạo giữ nguyên cọc và điều khoản tại lúc đặt, kể cả khi cấu hình được sửa sau đó.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-300">Ngày đệm sau ngày trả<select className={input} value={buffer} onChange={e => setBuffer(Number(e.target.value))}>{[0,1,2,3].map(n => <option key={n} value={n}>{n} ngày</option>)}</select></label><label className="text-sm text-slate-300">Hoàn khi hủy trước bàn giao<select className={input} value={cancellation} onChange={e => setCancellation(e.target.value as RentalPolicy['cancellationRefund'])}><option value="FULL_PAYMENT">Phí thuê và cọc</option><option value="DEPOSIT_ONLY">Chỉ tiền cọc</option></select></label></div>
    <label className="mt-4 block text-sm text-slate-300">Điều khoản hiển thị cho khách<textarea required minLength={40} maxLength={8000} className={input} rows={7} value={terms} onChange={e => setTerms(e.target.value)}/></label>
    <p className="mt-2 text-xs leading-5 text-slate-400">Cọc theo từng chiếc; không giảm theo eKYC. Khấu trừ cần khách chấp thuận. Chỉ xác nhận đã hoàn sau kết quả tra cứu ZaloPay.</p>
    <button className={`${button} mt-4`} disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu phiên bản chính sách mới'}</button>{message && <p role="alert" className="mt-3 text-sm text-red-200">{message}</p>}
  </form>;
}

function DepositForm({ unit, onSaved }: { unit: Unit; onSaved: (id: number, amount: number) => void }) {
  const [amount, setAmount] = useState(String(unit.depositAmount));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <form className="rounded-xl border border-film-border bg-film-card p-4" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await apiRequest<{ data: { id: number; depositAmount: number } }>(`/api/admin/rental-units/${unit.id}/deposit`, { method: 'PATCH', body: JSON.stringify({ depositAmount: Number(amount) }) });
      onSaved(result.data.id, result.data.depositAmount); setMessage('Đã lưu mức cọc cho lượt đặt mới.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không lưu được mức cọc'); }
    finally { setBusy(false); }
  }}><h4 className="font-semibold text-white">{unit.product.modelName}</h4><p className="mt-1 break-all font-mono text-xs text-slate-400">{unit.serialNumber}</p><label className="mt-3 block text-sm text-slate-300">Tiền cọc (đ)<input type="number" required min={0} max={50000000} step={1000} value={amount} onChange={e => setAmount(e.target.value)} className={input}/></label><button disabled={busy} className={`${button} mt-3`}>{busy ? 'Đang lưu...' : 'Lưu mức cọc'}</button>{message && <p role="status" className="mt-2 text-xs leading-5 text-slate-300">{message}</p>}</form>;
}

function UnitCalendar({ units, onSelectBooking }: { units: Unit[]; onSelectBooking: (id: string) => void }) {
  const [unitId, setUnitId] = useState(units.find(u => u.product.isPublished)?.id || units[0]?.id || 0);
  const [rows, setRows] = useState<Allocation[] | null>(null);
  const [tick, setTick] = useState(0);
  const [start, setStart] = useState(todayVN());
  const [end, setEnd] = useState(addDays(todayVN(), 1));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!unitId) return;
    const controller = new AbortController(); setRows(null); setError('');
    apiRequest<{ data: Allocation[] }>(`/api/admin/rental-calendar/${unitId}`, { signal: controller.signal, cache: 'no-store' })
      .then(result => { if (!controller.signal.aborted) setRows(result.data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được lịch'); });
    return () => controller.abort();
  }, [unitId, tick]);
  return <div className="space-y-4"><label className="block text-sm text-slate-300">Chiếc máy<select className={input} value={unitId} onChange={e => setUnitId(Number(e.target.value))}>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.serialNumber} · {unit.product.modelName}</option>)}</select></label>
    <form className="rounded-xl border border-film-border bg-film-card p-4 sm:p-5" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await apiRequest(`/api/admin/rental-calendar/${unitId}/blocks`, { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), startDate: start, endDate: end, reason }) }); setReason(''); setTick(v => v + 1); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Không khóa được lịch'); }
      finally { setBusy(false); }
    }}><h3 className="font-bold text-white">Khóa lịch ngoài đơn online</h3><p className="mt-2 text-xs leading-5 text-slate-400">Dùng cho bảo dưỡng, sử dụng nội bộ hoặc lịch đã chốt ngoài website. Lịch này cũng tham gia kiểm tra trùng.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-300">Bắt đầu khóa<input type="date" required className={input} min={todayVN()} value={start} onChange={e => setStart(e.target.value)}/></label><label className="text-sm text-slate-300">Mở lại từ ngày<input type="date" required className={input} min={start ? addDays(start, 1) : todayVN()} value={end} onChange={e => setEnd(e.target.value)}/></label></div><label className="mt-3 block text-sm text-slate-300">Lý do / mã lịch ngoài<textarea required minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className={input} rows={2}/></label><button className={`${button} mt-3`} disabled={busy || !unitId}>Khóa khoảng ngày</button></form>
    {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
    <section className="rounded-xl border border-film-border p-4"><h3 className="font-bold text-white">Lịch đang giữ</h3>{rows === null ? <p role="status" className="mt-3 text-sm text-slate-400">Đang tải lịch...</p> : !rows.length ? <p className="mt-3 text-sm text-slate-400">Không có khoảng ngày đang giữ.</p> : <ul className="mt-3 space-y-3">{rows.map(row => <li key={row.id} className="rounded-lg bg-film-card p-3 text-sm"><p className="font-semibold text-white">{showDay(row.startDate)} → trước {showDay(row.endDate)}</p><p className="mt-1 break-words text-slate-300">{row.booking ? `${row.booking.bookingCode} · ${row.booking.user.fullName}` : row.reason}</p>{row.kind === 'BLOCK' ? <button disabled={busy} type="button" className="mt-2 min-h-11 text-sm font-semibold text-film-warm underline" onClick={async () => { setBusy(true); setError(''); try { await apiRequest(`/api/admin/rental-blocks/${row.id}/release`, { method: 'PATCH' }); setTick(v => v + 1); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không mở được lịch'); } finally { setBusy(false); } }}>Bỏ khóa lịch này</button> : row.bookingId && <button className="mt-2 min-h-11 text-film-warm underline" type="button" onClick={() => onSelectBooking(row.bookingId!)}>Mở hồ sơ đơn thuê</button>}</li>)}</ul>}</section>
  </div>;
}

export function RentalAdminPanel({ bookings, onUpdated }: { bookings: ListItem[] | null; onUpdated: (booking: RentalBooking) => void }) {
  const [params, setParams] = useSearchParams();
  const section = ['coc','lich'].includes(params.get('muc') || '') ? params.get('muc')! : 'don';
  const selected = params.get('don') || bookings?.[0]?.id;
  const [policy, setPolicy] = useState<RentalPolicy | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiRequest<{ data: RentalPolicy }>('/api/admin/rental-policy', { signal: controller.signal }),
      apiRequest<{ data: Unit[] }>('/api/admin/rental-units', { signal: controller.signal })
    ]).then(([p,u]) => { if (!controller.signal.aborted) { setPolicy(p.data); setUnits(u.data); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được cấu hình thuê'); });
    return () => controller.abort();
  }, []);
  const navigateSection = (value: string, bookingId?: string) => { const next = new URLSearchParams(params); next.set('muc',value); if (bookingId) next.set('don',bookingId); setParams(next); };
  return <section className="mt-7"><h2 className="text-xl font-bold text-white">Vận hành thuê máy</h2><div className="mt-4 flex flex-wrap gap-2">{[['don','Đơn thuê'],['coc','Cọc & chính sách'],['lich','Lịch thiết bị']].map(([value,name]) => <button key={value} type="button" onClick={() => navigateSection(value)} aria-pressed={section === value} className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${section === value ? 'border-film-warm bg-film-warm text-film-dark' : 'border-film-border text-slate-300'}`}>{name}</button>)}</div>
    {error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-emerald-300">{message}</p>}
    {section === 'don' && <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]"><div className="space-y-2">{bookings === null ? <p role="status" className="text-sm text-slate-400">Đang tải đơn thuê...</p> : bookings.length ? bookings.map(booking => <button key={booking.id} type="button" onClick={() => navigateSection('don',booking.id)} aria-pressed={selected === booking.id} className={`block min-h-20 w-full rounded-xl border bg-film-card p-4 text-left ${selected === booking.id ? 'border-film-warm' : 'border-film-border'}`}><span className="block break-all text-sm font-semibold text-white">{booking.bookingCode}</span><span className="mt-1 block break-words text-xs text-slate-300">{booking.user.fullName} · {booking.cameraItem.product.modelName}</span><span className="mt-2 block text-xs text-film-warm">{rentalStatus[booking.status] || booking.status}</span></button>) : <p className="rounded-xl border border-film-border p-5 text-sm text-slate-300">Không có đơn phù hợp.</p>}</div><div className="min-w-0">{selected && <RentalBookingDetail key={selected} bookingId={selected} admin onUpdated={onUpdated}/>}</div></div>}
    {section === 'coc' && <div className="mt-5 space-y-5">{policy && <PolicyForm key={policy.version} policy={policy} onSaved={value => { setPolicy(value); setMessage('Đã lưu phiên bản chính sách ' + value.version); }}/>}<div><h3 className="mb-3 text-lg font-bold text-white">Mức cọc từng chiếc</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{units.map(unit => <DepositForm key={unit.id} unit={unit} onSaved={(id,amount) => setUnits(items => items.map(item => item.id === id ? { ...item, depositAmount: amount } : item))}/>)}</div></div></div>}
    {section === 'lich' && <div className="mt-5">{units.length ? <UnitCalendar units={units} onSelectBooking={id => navigateSection('don',id)}/> : <p className="text-sm text-slate-400">Chưa có chiếc máy trong kho.</p>}</div>}
  </section>;
}
