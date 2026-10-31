import { useEffect, useId, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/session';
import { addDays, showDay, todayVN } from '../lib/rental';
import type { RentalQuote } from '../lib/rental';

type Calendar = { cameraItemId: number; status: string; ranges: { startDate: string; endDate: string; kind: string }[] };
export function RentalSchedule({ unitId, startDate, endDate, onChange, quote, checking, error }: {
  unitId: number; startDate: string; endDate: string; onChange: (start: string, end: string) => void;
  quote: RentalQuote | null; checking: boolean; error: string;
}) {
  const prefix = useId();
  const today = todayVN();
  const [monthOffset, setMonthOffset] = useState(0);
  const [tick, setTick] = useState(0);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [calendarError, setCalendarError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setCalendar(null); setCalendarError('');
    const params = new URLSearchParams({ from: today, to: addDays(today, 120) });
    apiRequest<{ data: Calendar }>(`/api/rental/calendar/${unitId}?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(({ data }) => { if (!controller.signal.aborted) setCalendar(data); })
      .catch(cause => { if (!controller.signal.aborted) setCalendarError(cause instanceof Error ? cause.message : 'Không tải được lịch'); });
    return () => controller.abort();
  }, [unitId, today, tick]);
  const base = new Date(today + 'T00:00:00Z');
  const month = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset, 1));
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const padding = (month.getUTCDay() + 6) % 7;
  const hardBlocked = calendar?.status === 'MAINTENANCE' || calendar?.status === 'SOLD';
  const maxStart = addDays(today, 90);
  const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const input = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-film-border bg-film-dark px-3 text-sm text-white [color-scheme:dark]';
  const selectDay = (day: string) => {
    if (!startDate || endDate || day <= startDate) onChange(day, '');
    else onChange(startDate, day);
  };
  return <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-5" aria-labelledby={`${prefix}-title`}>
    <h2 id={`${prefix}-title`} className="font-bold text-white">Chọn lịch thuê</h2>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="min-w-0 text-xs text-slate-300" htmlFor={`${prefix}-start`}>Ngày nhận máy<input id={`${prefix}-start`} type="date" className={input} min={today} max={maxStart} value={startDate} onChange={e => onChange(e.target.value, endDate && endDate > e.target.value ? endDate : '')}/></label>
      <label className="min-w-0 text-xs text-slate-300" htmlFor={`${prefix}-end`}>Ngày trả máy<input id={`${prefix}-end`} type="date" className={input} min={startDate ? addDays(startDate, 1) : addDays(today, 1)} max={startDate ? addDays(startDate, 30) : addDays(today, 120)} value={endDate} onChange={e => onChange(startDate, e.target.value)}/></label>
    </div>
    <div className="mt-4 flex items-center justify-between gap-2">
      <button type="button" aria-label="Tháng trước" disabled={monthOffset === 0} onClick={() => setMonthOffset(v => v - 1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-film-border disabled:opacity-30"><ChevronLeft size={18}/></button>
      <p className="text-sm font-semibold text-white">{new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month)}</p>
      <button type="button" aria-label="Tháng sau" disabled={nextMonth > maxStart} onClick={() => setMonthOffset(v => v + 1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-film-border disabled:opacity-30"><ChevronRight size={18}/></button>
    </div>
    <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
      {['T2','T3','T4','T5','T6','T7','CN'].map(day => <span key={day} className="py-2 text-slate-400">{day}</span>)}
      {Array.from({ length: padding }, (_, i) => <span key={`blank-${i}`} aria-hidden="true"/>)}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), i + 1)).toISOString().slice(0, 10);
        const busy = hardBlocked || calendar?.ranges.some(r => day >= r.startDate && day < r.endDate);
        const disabled = !calendar || calendar.cameraItemId !== unitId || busy || day < today || day > maxStart;
        const edge = day === startDate || day === endDate;
        const inRange = !!startDate && !!endDate && day > startDate && day < endDate;
        return <button key={day} type="button" disabled={disabled} aria-pressed={edge} aria-label={`${showDay(day)}${busy ? ', đã có lịch' : ''}`} onClick={() => selectDay(day)} className={`min-h-11 rounded-md border text-xs transition-colors disabled:cursor-not-allowed ${edge ? 'border-film-warm bg-film-warm font-bold text-film-dark' : inRange ? 'border-film-warm/30 bg-film-warm/15 text-film-warm' : busy ? 'border-transparent bg-slate-700/40 text-slate-500 line-through' : 'border-film-border text-slate-200 hover:border-film-warm disabled:opacity-30'}`}>{i + 1}</button>;
      })}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-400">Chọn ngày nhận rồi ngày trả. Ngày gạch ngang đã có lịch hoặc không nhận thuê.</p>
    {calendarError && <p role="alert" className="mt-2 text-xs text-amber-300">{calendarError}<button type="button" onClick={() => setTick(v => v + 1)} className="ml-2 inline-flex min-h-11 items-center gap-1 underline"><RefreshCw size={12}/>Tải lại lịch</button></p>}
    <div role="status" aria-live="polite" className="mt-3 border-t border-film-border pt-3 text-sm">
      {checking ? <p className="text-slate-300">Đang kiểm tra lịch và mức cọc...</p> : error ? <p className="text-red-300">{error}</p> : quote ? <>
        <p className={quote.available ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-300'}>{quote.available ? `Còn lịch ${showDay(startDate)} → ${showDay(endDate)}` : quote.unavailableReason}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{quote.totalDays} ngày tính phí{quote.returnBufferDays ? ` · Chừa ${quote.returnBufferDays} ngày để nhận lại, kiểm tra và chuẩn bị máy.` : ' · Có thể xếp lịch tiếp theo từ ngày trả.'}</p>
      </> : <p className="text-slate-400">Chọn đủ ngày để xem lịch và tổng chi phí.</p>}
    </div>
  </section>;
}
