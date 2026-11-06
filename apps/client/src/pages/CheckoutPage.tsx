import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useCart } from '../lib/CartContext';
import { getProduct, formatVnd, type ProductDetail } from '../lib/catalog';
import { useBundleQuote } from '../lib/bundle';
import { apiRequest, useSession } from '../lib/session';
import { normalizePhone } from '../lib/phone';
import { todayVN, addDays } from '../lib/rental';
import { filmiliarContact } from '../content/filmiliar';
import { PaymentQrModal } from '../components/PaymentQrModal';

const field =
  'mt-2 min-h-12 w-full min-w-0 rounded-lg border border-film-border bg-film-dark px-3 text-base text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm';
const action =
  'flex min-h-12 w-full items-center justify-center rounded-xl bg-film-warm px-4 text-sm font-bold text-film-dark hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40';
type Active = { bookingId: string; bundleId: string; paymentStatus: string };

export function CheckoutPage() {
  const cart = useCart(),
    { user, state: sessionState } = useSession();
  const slugs = cart.items.map((item) => item.slug).join('|');
  const [data, setData] = useState<{ key: string; products: ProductDetail[]; error: string }>({
    key: '',
    products: [],
    error: '',
  });
  const [retry, setRetry] = useState(0),
    [accepted, setAccepted] = useState(''),
    [enabled, setEnabled] = useState(false),
    [paymentOpen, setPaymentOpen] = useState(false);
  const [tick, setTick] = useState(0),
    [active, setActive] = useState<{ key: string; data: Active | null }>({ key: '', data: null });
  useEffect(() => {
    if (!slugs) return;
    const controller = new AbortController();
    Promise.all(
      slugs.split('|').map(async (slug) => {
        const result = await getProduct(slug, controller.signal);
        if (result.isFallback || !result.data)
          throw new Error('Không tải được dữ liệu kho hiện tại. Vui lòng thử lại.');
        return result.data;
      }),
    )
      .then((products) => {
        if (!controller.signal.aborted) setData({ key: slugs, products, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setData({
            key: slugs,
            products: [],
            error: error instanceof Error ? error.message : 'Không tải được bộ thuê',
          });
      });
    return () => controller.abort();
  }, [slugs, retry]);
  const products = data.key === slugs ? data.products : [];
  useEffect(() => {
    for (const product of products)
      if (!cart.units[product.slug]) {
        const candidate =
          product.units.find((u) => u.passport && u.status === 'AVAILABLE') ||
          product.units.find((u) => u.status === 'AVAILABLE') ||
          product.units.find((u) => !['SOLD', 'MAINTENANCE'].includes(u.status));
        if (candidate && candidate.id > 0) cart.selectUnit(product.slug, candidate.id);
      }
  }, [products, cart.units]);
  const selected = useMemo(
    () =>
      products.map((product) => ({
        product,
        unit: product.units.find((u) => u.id === cart.units[product.slug]),
      })),
    [products, cart.units],
  );
  const complete =
    products.length === cart.items.length &&
    products.length > 0 &&
    selected.every((item) => item.unit && item.unit.id > 0);
  const ids = complete ? selected.map((item) => item.unit!.id) : [];
  const {
    quote,
    loading: checking,
    error: quoteError,
    refresh,
  } = useBundleQuote(ids, cart.start, cart.end, cart.startTime, cart.endTime);
  const selection = ids
    .slice()
    .sort((a, b) => a - b)
    .join(',');
  const activeKey = `${user?.id}|${selection}|${cart.start}|${cart.end}|${cart.startTime}|${cart.endTime}|${tick}`;
  useEffect(() => {
    if (!user || sessionState !== 'ready') return;
    const controller = new AbortController();
    apiRequest<{ sandboxEnabled: boolean }>('/api/payment/capabilities', { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setEnabled(r.sandboxEnabled);
      })
      .catch(() => setEnabled(false));
    return () => controller.abort();
  }, [user?.id, sessionState]);
  useEffect(() => {
    if (!user || !enabled || !selection || !cart.start || !cart.end) return;
    const controller = new AbortController();
    apiRequest<{ data: Active | null }>(
      `/api/payment/bundle/active?${new URLSearchParams({ unitIds: selection, startDate: cart.start, endDate: cart.end, startTime: cart.startTime, endTime: cart.endTime })}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then((r) => {
        if (!controller.signal.aborted) setActive({ key: activeKey, data: r.data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setActive({ key: activeKey, data: null });
      });
    return () => controller.abort();
  }, [activeKey, enabled]);
  const closePayment = useCallback(() => {
    setPaymentOpen(false);
    setTick((v) => v + 1);
    refresh();
  }, [refresh]);
  const current = active.key === activeKey ? active.data : null;
  const clearPurchased = () => cart.removeItems(selected.map((item) => item.product.slug));
  const canPay =
    enabled &&
    !!user &&
    !!normalizePhone(user.phone || '') &&
    !!quote?.available &&
    !checking &&
    accepted === quote.quoteHash;
  if (cart.loading)
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16" role="status">
        Đang tải bộ thuê...
      </main>
    );
  if (cart.error)
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <p role="alert">{cart.error}</p>
        <button type="button" onClick={cart.refresh} className="mt-4 min-h-11 text-film-warm underline">
          Thử lại
        </button>
      </main>
    );
  if (!cart.count)
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <h1 className="text-3xl font-bold text-white">Bộ thuê đang trống</h1>
        <Link
          to="/san-pham?mode=rent"
          className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-film-warm px-5 font-bold text-film-dark"
        >
          Chọn thiết bị
        </Link>
      </main>
    );
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <Link
        to="/san-pham?mode=rent"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300"
      >
        <ArrowLeft size={16} />
        Chọn thêm thiết bị
      </Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-film-warm">Bộ thuê Filmiliar</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Hoàn tất đặt thuê</h1>
      <div className="mt-7 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-6">
            <h2 className="text-lg font-bold text-white">Thiết bị trong bộ</h2>
            {data.key !== slugs ? (
              <p role="status" className="mt-4">
                Đang tải kho thiết bị...
              </p>
            ) : data.error ? (
              <div role="alert" className="mt-4 text-sm text-red-200">
                {data.error}
                <button
                  type="button"
                  onClick={() => setRetry((v) => v + 1)}
                  className="ml-3 min-h-11 underline"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-film-border">
                {selected.map(({ product, unit }) => {
                  const line = quote?.items.find((item) => item.cameraItemId === unit?.id);
                  return (
                    <article key={product.slug} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex gap-3">
                        <img
                          src={product.thumbnailUrl || '/filmiliar-icon.png'}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-lg bg-film-paper object-contain p-1"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/thiet-bi/${product.slug}?${new URLSearchParams({ may: String(unit?.id || '') })}`}
                            className="text-sm font-bold text-white hover:text-film-warm"
                          >
                            {product.name}
                          </Link>
                          <p className="mt-2 text-sm text-slate-300">{formatVnd(product.rentPrice)} / ngày</p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Bỏ ${product.name}`}
                          onClick={() => cart.remove(product.slug)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:text-film-warm"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <label className="mt-4 block text-sm text-slate-300">
                        Chọn chiếc {product.name}
                        <select
                          className={field}
                          value={unit?.id || ''}
                          onChange={(e) => cart.selectUnit(product.slug, Number(e.target.value))}
                        >
                          <option value="" disabled>
                            {product.units.length ? 'Chọn một chiếc trong kho' : 'Chưa có thiết bị trong kho'}
                          </option>
                          {product.units.map((u) => (
                            <option
                              key={u.id}
                              value={u.id}
                              disabled={['SOLD', 'MAINTENANCE'].includes(u.status)}
                            >
                              {u.serialNumber} · {u.conditionGrade}
                              {u.status === 'MAINTENANCE'
                                ? ' · Bảo dưỡng'
                                : u.status === 'SOLD'
                                  ? ' · Đã bán'
                                  : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      {line && (
                        <dl className="mt-3 flex flex-wrap justify-between gap-x-5 gap-y-2 text-sm">
                          <div className="flex gap-2">
                            <dt className="text-slate-400">Tiền thuê</dt>
                            <dd className="font-semibold text-white">{formatVnd(line.rentalFee)}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-slate-400">Cọc</dt>
                            <dd className="font-semibold text-white">{formatVnd(line.depositAmount)}</dd>
                          </div>
                        </dl>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-6">
            <h2 className="text-lg font-bold text-white">Lịch nhận và trả</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="min-w-0 text-sm text-slate-300">
                Ngày nhận
                <input
                  type="date"
                  min={todayVN()}
                  max={addDays(todayVN(), 90)}
                  value={cart.start}
                  onChange={(e) => cart.setDates(e.target.value, cart.end > e.target.value ? cart.end : '')}
                  className={field}
                />
              </label>
              <label className="min-w-0 text-sm text-slate-300">
                Ngày trả
                <input
                  type="date"
                  min={cart.start ? addDays(cart.start, 1) : addDays(todayVN(), 1)}
                  max={cart.start ? addDays(cart.start, 30) : undefined}
                  value={cart.end}
                  onChange={(e) => cart.setDates(cart.start, e.target.value)}
                  className={field}
                />
              </label>
              <label className="min-w-0 text-sm text-slate-300">
                Giờ nhận
                <input
                  type="time"
                  min="08:00"
                  max="20:00"
                  value={cart.startTime}
                  onChange={(e) => cart.setTimes(e.target.value, cart.endTime)}
                  className={field}
                />
              </label>
              <label className="min-w-0 text-sm text-slate-300">
                Giờ trả
                <input
                  type="time"
                  min="08:00"
                  max="20:00"
                  value={cart.endTime}
                  onChange={(e) => cart.setTimes(cart.startTime, e.target.value)}
                  className={field}
                />
              </label>
            </div>
          </section>
          <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-6">
            <h2 className="text-lg font-bold text-white">Nhận máy trực tiếp</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{filmiliarContact.address}</p>
            {user && (
              <dl className="mt-4 space-y-2 border-t border-film-border pt-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">Người nhận</dt>
                  <dd className="text-white">{user.fullName}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">Số điện thoại</dt>
                  <dd className="text-white">{user.phone || 'Chưa bổ sung'}</dd>
                </div>
              </dl>
            )}
          </section>
        </div>
        <aside className="min-w-0 rounded-2xl border border-film-border bg-film-card p-4 sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-white">Chi phí cả bộ</h2>
          <dl className="mt-5 space-y-3 text-sm">
            {[
              ['Thiết bị', String(cart.count)],
              ['Số ngày', quote ? String(quote.totalDays) : '—'],
              ['Tiền thuê', quote ? formatVnd(quote.rentalFee) : '—'],
              ['Tiền cọc', quote ? formatVnd(quote.depositAmount) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-semibold text-white">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-film-border pt-4 text-base font-bold text-film-warm">
              <dt>Tổng thanh toán</dt>
              <dd>{quote ? formatVnd(quote.totalAmount) : '—'}</dd>
            </div>
          </dl>
          {checking && (
            <p role="status" className="mt-4 text-sm">
              Đang kiểm tra lịch cả bộ...
            </p>
          )}
          {(quoteError || quote?.unavailableReason) && (
            <p role="alert" className="mt-4 text-sm leading-6 text-red-200">
              {quoteError || quote?.unavailableReason}
            </p>
          )}
          {quoteError && <button type="button" onClick={refresh} className="mt-2 min-h-11 text-sm font-semibold text-film-warm underline">Kiểm tra lại</button>}
          {quote && (
            <>
              <details className="mt-5 border-t border-film-border pt-3 text-sm">
                <summary className="min-h-11 cursor-pointer py-2 font-semibold text-film-warm">
                  Điều kiện thuê và hoàn cọc
                </summary>
                <p className="whitespace-pre-line text-xs leading-6 text-slate-300">{quote.terms}</p>
              </details>
              <label className="mt-3 flex min-h-11 items-start gap-3 text-sm leading-6 text-white">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-film-warm"
                  checked={accepted === quote.quoteHash}
                  onChange={(e) => setAccepted(e.target.checked ? quote.quoteHash : '')}
                />
                Tôi đã đọc và đồng ý lịch thuê, mức cọc và điều kiện thuê của cả bộ.
              </label>
            </>
          )}
          <div className="mt-5">
            {current?.paymentStatus === 'PAID' ? (
              <Link to={`/tai-khoan/bo-thue/${current.bundleId}`} onClick={clearPurchased} className={action}>
                Xem đơn bộ đã xác nhận
              </Link>
            ) : current ? (
              <button type="button" onClick={() => setPaymentOpen(true)} className={action}>
                Tiếp tục giao dịch đang có
              </button>
            ) : sessionState === 'loading' ? (
              <button disabled className={action}>
                Đang kiểm tra tài khoản...
              </button>
            ) : !user ? (
              <Link to="/dang-nhap?redirect=%2Fdat-thue" className={action}>
                Đăng nhập để đặt thuê
              </Link>
            ) : !normalizePhone(user.phone || '') ? (
              <Link to="/tai-khoan?tab=ho-so" className={action}>
                Bổ sung số điện thoại
              </Link>
            ) : (
              <button
                type="button"
                disabled={!canPay}
                onClick={() => setPaymentOpen(true)}
                className={action}
              >
                Thanh toán và giữ lịch cả bộ
              </button>
            )}
          </div>
        </aside>
      </div>
      {paymentOpen && complete && (
        <PaymentQrModal
          cameraItemId={ids[0]}
          cameraItemIds={ids}
          startDate={cart.start}
          endDate={cart.end}
          startTime={cart.startTime}
          endTime={cart.endTime}
          quoteHash={quote?.quoteHash || ''}
          termsAccepted={!!quote && accepted === quote.quoteHash}
          onClose={closePayment}
          onComplete={clearPurchased}
        />
      )}
    </main>
  );
}
