/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Aperture, ArrowRight, CalendarDays, Camera, Grid2X2 } from 'lucide-react';
import { addDays, todayVN } from '../lib/rental';

const categories = [
  { value: 'all', label: 'Tất cả', Icon: Grid2X2 },
  { value: 'body', label: 'Máy ảnh', Icon: Camera },
  { value: 'lens', label: 'Ống kính', Icon: Aperture },
] as const;

export function DeviceFinder() {
  const navigate = useNavigate();
  const today = todayVN();
  const [category, setCategory] = useState<(typeof categories)[number]['value']>('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const dateStarted = Boolean(start || end);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams({ mode: 'rent' });
    if (category !== 'all') params.set('category', category);
    if (start && end && end > start) {
      params.set('start', start);
      params.set('end', end);
    }
    navigate(`/san-pham?${params.toString()}`);
  };

  const changeStart = (nextStart: string) => {
    setStart(nextStart);
    if (!nextStart || (end && (end <= nextStart || end > addDays(nextStart, 30)))) setEnd('');
  };

  const dateInput = 'mt-2 block h-14 w-full min-w-0 rounded-xl border border-film-ink/20 bg-white px-4 text-base font-semibold text-film-ink outline-2 outline-transparent focus-visible:border-film-teal focus-visible:outline-film-teal focus-visible:outline-offset-1';

  return (
    <section id="tim-thiet-bi" aria-labelledby="device-finder-title" className="bg-film-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-6 border-t border-white/20 pt-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:items-end md:gap-12">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-film-warm">Bộ tìm thiết bị Filmiliar</p>
            <h2 id="device-finder-title" className="mt-5 max-w-3xl min-w-0 text-[clamp(2.15rem,5.5vw,4.75rem)] font-extrabold leading-[1.07] tracking-[-0.055em] [overflow-wrap:anywhere]">
              Chọn ngày chụp.<br /><span className="text-film-warm">Tìm chiếc máy.</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-white/70 sm:text-base">
            Bắt đầu bằng loại thiết bị và khoảng ngày dự kiến. Sau đó, xem từng chiếc máy để kiểm tra lịch trống và mức cọc.
          </p>
        </div>

        <form onSubmit={submit} className="mt-9 overflow-hidden rounded-[1.75rem] bg-film-paperRaised text-film-ink shadow-[0_24px_70px_rgba(0,0,0,0.14)] lg:mt-12 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <fieldset className="min-w-0 border-b border-film-ink/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <legend className="sr-only">Loại thiết bị muốn tìm</legend>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-film-teal">Thiết bị</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Bạn muốn tìm gì?</h3>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {categories.map(({ value, label, Icon }) => {
                const selected = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategory(value)}
                    className={`flex min-h-[88px] min-w-0 flex-col items-start justify-between rounded-2xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-teal active:translate-y-px sm:min-h-[104px] sm:p-4 ${selected ? 'border-film-teal bg-film-teal text-white' : 'border-film-ink/15 bg-white text-film-ink hover:border-film-teal hover:bg-film-paper'}`}
                  >
                    <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
                    <span className="whitespace-nowrap text-xs font-bold sm:text-sm">{label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-5 text-xs leading-5 text-film-ink/65">Xem toàn bộ bộ sưu tập, hoặc lọc riêng thân máy và ống kính.</p>
          </fieldset>

          <div className="min-w-0 p-5 sm:p-8">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-1 shrink-0 text-film-teal" size={20} strokeWidth={1.8} aria-hidden="true" />
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-film-teal">Thời gian dự kiến</p>
                <h3 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Bạn cần máy khi nào?</h3>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-semibold">
                Ngày nhận
                <input type="date" lang="vi-VN" min={today} max={addDays(today, 90)} required={dateStarted} value={start} onChange={event => changeStart(event.target.value)} className={dateInput} />
              </label>
              <label className="min-w-0 text-sm font-semibold">
                Ngày trả
                <input type="date" lang="vi-VN" min={start ? addDays(start, 1) : addDays(today, 1)} max={start ? addDays(start, 30) : addDays(today, 120)} required={dateStarted} value={end} onChange={event => setEnd(event.target.value)} className={dateInput} />
              </label>
            </div>
            <p className="mt-3 min-h-5 text-xs leading-5 text-film-ink/60">Có thể bỏ trống ngày để xem máy trước. Nếu chọn lịch, thời gian thuê từ 1 đến 30 ngày.</p>
            <button type="submit" className="mt-6 flex min-h-14 w-full items-center justify-between gap-4 rounded-xl bg-film-teal px-5 text-sm font-bold text-white transition-colors hover:bg-film-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-teal active:translate-y-px sm:text-base">
              <span className="whitespace-nowrap">{start && end ? 'Tìm máy theo lịch' : 'Khám phá thiết bị'}</span>
              <ArrowRight size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <p className="mt-3 text-xs leading-5 text-film-ink/60">Lịch trống được xác nhận trên trang của từng chiếc máy.</p>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-white/65">
          <p>Đang tìm máy để mua?</p>
          <Link to="/san-pham?mode=buy" className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap font-bold text-white underline decoration-film-warm underline-offset-4 hover:text-film-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-warm">
            Xem thiết bị để mua <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
