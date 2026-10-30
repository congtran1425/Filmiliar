import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Trash2, X } from 'lucide-react';
import { formatVnd } from '../lib/catalog';
import { useCart } from '../lib/CartContext';
import { getMount, isLens, rentalDays } from '../lib/rentalCart';

export function CartDrawer() {
  const cart = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!cart.isOpen) return;
    const previous = document.body.style.overflow;
    const priorFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { cart.closeCart(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] a[href], [role="dialog"] button:not([disabled]), [role="dialog"] input:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKeyDown); priorFocus?.focus(); };
  }, [cart.isOpen]);
  if (!cart.isOpen) return null;
  const days = rentalDays(cart.start, cart.end);
  const daily = cart.items.reduce((sum, item) => sum + item.rentPrice, 0);
  const today = new Date().toLocaleDateString('en-CA');
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end bg-film-dark/70" onMouseDown={(event) => { if (event.target === event.currentTarget) cart.closeCart(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="cart-title" className="flex h-full w-full max-w-[480px] flex-col bg-film-paper text-film-ink shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-film-ink/15 px-5 py-5 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-film-teal">Thuê máy · bản dự kiến</p><h2 id="cart-title" className="mt-1 text-2xl font-bold">Bộ thiết bị của bạn</h2></div>
          <button ref={closeRef} type="button" onClick={cart.closeCart} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-film-ink/20" aria-label="Đóng giỏ thiết bị"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {cart.loading ? <p role="status">Đang tải thiết bị...</p> : cart.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-film-ink/25 bg-film-paperRaised p-7 text-center"><Camera className="mx-auto mb-4 text-film-teal" size={32} /><p className="font-semibold">Chưa có thiết bị trong bộ.</p><p className="mt-2 text-sm text-film-ink/70">Chọn một thân máy, sau đó chọn ống kính cùng hệ ngàm nếu cần.</p><Link onClick={cart.closeCart} to="/san-pham?mode=rent" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-film-teal px-5 text-sm font-semibold text-white">Xem thiết bị <ArrowRight size={16}/></Link></div>
          ) : <div className="space-y-3">{cart.items.map((item) => <article key={item.slug} className="flex gap-3 rounded-xl border border-film-ink/15 bg-film-paperRaised p-3">
            <img src={item.thumbnailUrl || '/filmiliar-icon.png'} alt="" className="h-20 w-20 shrink-0 rounded-lg bg-film-paper object-contain" />
            <div className="min-w-0 flex-1"><p className="text-[11px] uppercase tracking-wide text-film-teal">{isLens(item) ? 'Ống kính' : 'Thân máy'} · {getMount(item)}</p><Link onClick={cart.closeCart} to={`/thiet-bi/${item.slug}`} className="mt-1 block text-sm font-bold hover:underline">{item.name}</Link><p className="mt-1 text-xs text-film-ink/70">{formatVnd(item.rentPrice)} / ngày · giá tham khảo</p></div>
            <button type="button" onClick={() => cart.remove(item.slug)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-film-ink/70 hover:bg-film-paper" aria-label={`Bỏ ${item.name}`}><Trash2 size={17}/></button>
          </article>)}</div>}
          {cart.items.length > 0 && <div className="mt-7 space-y-4 border-t border-film-ink/15 pt-6">
            <div><h3 className="font-bold">Thời gian dự kiến</h3><p className="mt-1 text-xs text-film-ink/65">Tạm tính tối thiểu một ngày theo chênh lệch ngày lịch. Quy tắc tính giá chính thức và lịch trống chưa được xác nhận.</p></div>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Ngày nhận<input type="date" min={today} value={cart.start} onChange={(event) => cart.setDates(event.target.value, cart.end)} className="mt-2 block w-full min-w-0 rounded-lg border border-film-ink/20 bg-white p-2.5 text-base" /></label><label className="text-xs font-semibold">Ngày trả<input type="date" min={cart.start || today} value={cart.end} onChange={(event) => cart.setDates(cart.start, event.target.value)} className="mt-2 block w-full min-w-0 rounded-lg border border-film-ink/20 bg-white p-2.5 text-base" /></label></div>
            <div className="space-y-2 rounded-xl bg-white p-4 text-sm"><div className="flex justify-between gap-3"><span>Giá thuê / ngày</span><strong>{formatVnd(daily)}</strong></div><div className="flex justify-between gap-3"><span>Số ngày</span><strong>{days > 0 ? days : 'Chưa chọn hợp lệ'}</strong></div><div className="flex justify-between gap-3 border-t border-film-ink/10 pt-2 font-bold"><span>Tiền thuê dự kiến</span><span>{days > 0 ? formatVnd(daily * days) : '—'}</span></div><p className="text-xs text-film-ink/65">Tiền cọc và phí giao nhận: chờ chính sách chính thức.</p></div>
            <p className="rounded-lg border border-film-teal/20 bg-film-teal/5 p-3 text-xs leading-5">Bộ này chỉ được lưu trên trình duyệt. Chưa tạo đơn, giữ thiết bị hay mở thanh toán. Tình trạng từng chiếc và phụ kiện cần được xác nhận riêng.</p>
            {cart.isDemo && <p className="text-xs text-film-ink/65">Đang dùng dữ liệu minh họa do API chưa sẵn sàng.</p>}
          </div>}
        </div>
      </section>
    </div>, document.body
  );
}
