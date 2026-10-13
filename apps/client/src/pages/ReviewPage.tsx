import { useState, useId, useEffect, useCallback } from 'react';
import { ArrowLeft, Info, Calendar, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatVnd } from '../lib/catalog';
import { useProduct } from '../lib/useProduct';
import { apiRequest, useSession } from '../lib/session';
import { PaymentQrModal } from '../components/PaymentQrModal';

function rentalDays(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const todayString = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const todayUtc = Date.parse(`${todayString}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < todayUtc ||
      start > todayUtc + 90 * 86400000 || end <= start ||
      end > start + 30 * 86400000) return null;
  return Math.round((end - start) / 86400000);
}

export function ReviewPage() {
  const { slug, mode } = useParams();
  const [searchParams] = useSearchParams();
  const { product, isDemo, loading, error } = useProduct(slug);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [delivery, setDelivery] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [sandboxReady, setSandboxReady] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const { user, state } = useSession();
  const closePayment = useCallback(() => setShowPayment(false), []);

  useEffect(() => {
    if (state !== 'ready' || user?.role !== 'ADMIN') { setSandboxReady(false); return; }
    const controller = new AbortController();
    apiRequest<{ sandboxEnabled: boolean }>('/api/payment/capabilities', { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setSandboxReady(result.sandboxEnabled); })
      .catch(() => { if (!controller.signal.aborted) setSandboxReady(false); });
    return () => controller.abort();
  }, [state, user?.role]);

  const startDateId = useId();
  const endDateId = useId();

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-slate-300" role="status">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-film-warm border-t-transparent"></div>
          <span>Đang tải thông tin xem lại...</span>
        </div>
      </main>
    );
  }

  if (error || !product || (mode !== 'thue' && mode !== 'mua')) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-white">Không có yêu cầu để xem lại</h1>
        <p className="mt-2 text-slate-400">Đường dẫn yêu cầu không hợp lệ hoặc thiết bị không tồn tại.</p>
        <Link to="/thue" className="mt-6 inline-flex items-center gap-1.5 text-film-warm underline min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Về danh mục thiết bị
        </Link>
      </main>
    );
  }

  const unit = product.units.find((item) => String(item.id) === searchParams.get('may'));
  const days = rentalDays(startDate, endDate);
  const detailPath = `/thiet-bi/${product.slug}${unit ? `?may=${unit.id}` : ''}`;

  if (!unit) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-white">Chưa chọn chiếc máy cụ thể</h1>
        <p className="mt-2 text-slate-400 leading-relaxed">
          Mỗi yêu cầu cần đối chiếu với một chiếc máy có số serial xác định. Vui lòng quay lại chọn máy trước khi xem lại.
        </p>
        <Link to={detailPath} className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-film-warm text-film-dark font-bold px-4 py-2.5 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Quay lại chọn chiếc máy
        </Link>
      </main>
    );
  }

  const todayStr = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const dateError = startDate && endDate && !days;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10 sm:px-6">
      {/* Back Link with preserved unit selection */}
      <Link 
        to={detailPath} 
        className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-300 hover:text-white min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" /> 
        <span>Quay lại trang chi tiết chiếc máy</span>
      </Link>

      {/* Page Title & Scope Explanation */}
      <div className="mt-4 sm:mt-6">
        <p className="text-xs font-bold uppercase tracking-wider text-film-warm">
          Bước xem lại thông tin · {mode === 'thue' ? 'Thuê thiết bị' : 'Mua thiết bị'}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white">
          Xem lại thông tin {mode === 'thue' ? 'thuê máy' : 'mua máy'}
        </h1>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
          Đây là màn hình tóm tắt thông số và dự tính chi phí để bạn kiểm tra. {sandboxReady && mode === 'thue' ? 'Quản trị viên có thể thử luồng QR ZaloPay Sandbox bằng dữ liệu minh họa.' : 'Website hiện chưa mở đặt đơn, chưa giữ chỗ và không thu tiền trực tuyến.'}
        </p>
      </div>

      {/* Demo Warning Banner */}
      {isDemo && (
        <div role="status" className="mt-5 rounded-xl border border-film-warm/40 bg-film-warm/10 p-3.5 text-xs sm:text-sm text-film-warm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Dữ liệu minh họa:</strong> Chiếc máy #{unit.serialNumber} và các mức giá bên dưới chỉ mang tính hiển thị đề án, chưa phải số liệu thực tế.
          </div>
        </div>
      )}

      {/* Two Column Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        
        {/* Left Form & Info Column */}
        <div className="space-y-5">
          {/* Selected Device Summary Card */}
          <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-5">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center justify-between">
              <span>Thiết bị đã chọn</span>
              <span className="text-xs font-normal text-film-warm">#{unit.serialNumber}</span>
            </h2>
            <div className="mt-3 p-3 rounded-xl bg-film-dark/60 border border-film-border/60">
              <p className="text-sm sm:text-base font-bold text-white">{product.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{product.brand} · {product.category}</p>
            </div>

            <dl className="mt-3 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between gap-3 border-t border-film-border/60 pt-2">
                <dt className="text-slate-400">Mã định danh máy:</dt>
                <dd className="font-mono text-white font-semibold">{unit.serialNumber}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-film-border/60 pt-2">
                <dt className="text-slate-400">Mức ngoại hình:</dt>
                <dd className="text-white">{unit.conditionGrade}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-film-border/60 pt-2">
                <dt className="text-slate-400">Trạng thái kho:</dt>
                <dd className="text-white">
                  {unit.status === 'AVAILABLE' ? (
                    <span className="text-emerald-400 font-medium">Ghi nhận có trong kho</span>
                  ) : unit.status === 'RESERVED' ? (
                    <span className="text-amber-300 font-medium">Đang giữ chỗ</span>
                  ) : (
                    <span className="text-red-400 font-medium">Chưa có sẵn</span>
                  )}
                </dd>
              </div>
            </dl>

            {unit.status !== 'AVAILABLE' && (
              <div role="alert" className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{unit.status === 'RESERVED' && sandboxReady ? 'Chiếc máy đang được giữ. Nếu đó là giao dịch thử của bạn, mở cửa sổ Sandbox để xem lại cùng giao dịch.' : 'Chiếc máy này không khả dụng. Vui lòng quay lại trang chi tiết để chọn chiếc khác.'}</span>
              </div>
            )}
          </section>

          {/* Flow Specific Form */}
          {mode === 'thue' ? (
            <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-5">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-film-warm" />
                <span>Thời gian thuê dự kiến</span>
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Chọn ngày để hệ thống tính tạm số ngày thuê trải nghiệm.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={startDateId} className="block text-xs font-semibold text-slate-300 mb-1">
                    Ngày bắt đầu thuê
                  </label>
                  <input 
                    id={startDateId}
                    type="date" 
                    min={todayStr}
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="w-full min-h-[44px] rounded-xl border border-film-border bg-film-dark px-3 py-2 text-base sm:text-sm text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm" 
                  />
                </div>

                <div>
                  <label htmlFor={endDateId} className="block text-xs font-semibold text-slate-300 mb-1">
                    Ngày kết thúc thuê
                  </label>
                  <input 
                    id={endDateId}
                    type="date" 
                    min={startDate || todayStr}
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="w-full min-h-[44px] rounded-xl border border-film-border bg-film-dark px-3 py-2 text-base sm:text-sm text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm" 
                  />
                </div>
              </div>

              {dateError && (
                <div role="alert" className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Ngày kết thúc phải sau ngày bắt đầu và ngày bắt đầu không được ở quá khứ.</span>
                </div>
              )}

              {/* Delivery options */}
              <fieldset className="mt-5 border-t border-film-border pt-4">
                <legend className="text-xs font-bold text-white uppercase tracking-wider">
                  Phương án nhận máy dự kiến
                </legend>
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-film-border/80 bg-film-dark/40 hover:bg-film-dark cursor-pointer min-h-[44px] transition-colors">
                    <input 
                      type="radio" 
                      name="delivery" 
                      checked={delivery === 'PICKUP'} 
                      onChange={() => setDelivery('PICKUP')} 
                      className="h-4 w-4 accent-film-warm" 
                    />
                    <div className="text-xs">
                      <strong className="block text-white">Nhận trực tiếp tại điểm hẹn</strong>
                      <span className="text-slate-400">Khu vực TP.HCM · địa điểm cụ thể sẽ được xác nhận</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-film-border/80 bg-film-dark/40 hover:bg-film-dark cursor-pointer min-h-[44px] transition-colors">
                    <input 
                      type="radio" 
                      name="delivery" 
                      checked={delivery === 'DELIVERY'} 
                      onChange={() => setDelivery('DELIVERY')} 
                      className="h-4 w-4 accent-film-warm" 
                    />
                    <div className="text-xs">
                      <strong className="block text-white">Giao tận nơi nội thành</strong>
                      <span className="text-slate-400">Phí giao nhận và thời gian vận chuyển chưa xác nhận</span>
                    </div>
                  </label>
                </div>
              </fieldset>
              {sandboxReady && delivery === 'DELIVERY' && <p className="mt-3 text-xs text-amber-300">Luồng Sandbox chỉ thử nhận trực tiếp; phí giao tận nơi chưa được chốt.</p>}
            </section>
          ) : (
            <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-5">
              <h2 className="text-sm sm:text-base font-bold text-white">
                Thông tin mua máy cũ cần xác nhận
              </h2>
              <div className="mt-3 space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  • <strong>Giá bán:</strong> Mức giá hiển thị là giá tham khảo của dòng máy. Giá chính xác cho chiếc #{unit.serialNumber} (kèm phụ kiện, pin sạc, hộp) sẽ được báo khi tiếp nhận.
                </p>
                <p>
                  • <strong>Bảo hành:</strong> Chính sách bảo hành máy cũ (thời hạn 3 - 6 tháng) đang được nhóm xây dựng và chưa áp dụng tự động.
                </p>
              </div>
            </section>
          )}

          {/* Policy Notice */}
          <div className="flex items-start gap-2.5 rounded-xl border border-film-border bg-film-card p-3.5 text-xs text-slate-300 leading-relaxed">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-film-warm" />
            <p>
              {mode === 'thue' 
                ? 'Quy tắc đặt cọc, hoàn cọc và xác nhận lịch trống máy hiện đang được nhóm hoàn thiện. Thử nghiệm Sandbox không tạo cam kết thuê thật hoặc hoàn tiền thật.'
                : 'Quy trình kiểm tra máy trực tiếp, dùng thử và biên bản bàn giao đang được hoàn thiện trước khi mở bán chính thức.'
              }
            </p>
          </div>
        </div>

        {/* Right Aside: Estimated Summary Card */}
        <aside className="h-fit rounded-2xl border border-film-border bg-film-card p-4 sm:p-5 md:sticky md:top-24 space-y-4">
          <h2 className="text-sm sm:text-base font-bold text-white">Tóm tắt dự kiến</h2>

          <dl className="space-y-2.5 text-xs sm:text-sm border-t border-film-border pt-3">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Dòng máy:</dt>
              <dd className="text-right font-medium text-white">{product.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Số serial:</dt>
              <dd className="font-mono text-white">#{unit.serialNumber}</dd>
            </div>

            {mode === 'thue' ? (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Giá thuê / ngày:</dt>
                  <dd className="text-white font-medium">{formatVnd(product.rentPrice)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Số ngày thuê:</dt>
                  <dd className="text-white">{days ? `${days} ngày` : 'Chưa chọn hợp lệ'}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-film-border pt-2">
                  <dt className="text-slate-300 font-semibold">Tiền thuê tạm tính:</dt>
                  <dd className="font-bold text-film-warm">
                    {days ? formatVnd(days * product.rentPrice) : 'Chưa tính'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Tiền cọc thiết bị:</dt>
                  <dd className={sandboxReady && unit.depositAmount ? 'text-film-warm font-semibold' : 'text-slate-400 italic'}>{sandboxReady && unit.depositAmount ? `${formatVnd(unit.depositAmount)} (dữ liệu mẫu)` : 'Chưa xác định'}</dd>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Giá tham khảo:</dt>
                  <dd className="font-bold text-film-warm">{formatVnd(product.salePrice)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Phí kiểm định & phụ kiện:</dt>
                  <dd className="text-slate-400 italic">Chưa xác định</dd>
                </div>
              </>
            )}
          </dl>

          {/* Honest Preview Callout */}
          <div className="rounded-xl bg-film-dark/80 border border-film-border p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-film-warm font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Trạng thái xem trước</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              {sandboxReady && mode === 'thue' ? 'Chỉ quản trị viên có thể tạo đơn thử Sandbox. Đơn và trạng thái giữ chỗ được ghi trong dữ liệu để kiểm thử; chưa nhận giao dịch tiền thật.' : 'Website không gửi thông tin lên máy chủ, chưa ghi nhận đơn và không yêu cầu thanh toán.'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {sandboxReady && mode === 'thue' ? <button
              type="button"
              disabled={!days || delivery !== 'PICKUP' || (unit.status !== 'AVAILABLE' && unit.status !== 'RESERVED')}
              onClick={() => setShowPayment(true)}
              className="w-full min-h-[44px] rounded-xl bg-film-warm px-4 py-2.5 text-xs font-bold text-film-dark hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-warm active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400"
            >Thử tạo mã QR ZaloPay Sandbox</button> : <button
              type="button" disabled
              className="w-full min-h-[44px] cursor-not-allowed rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-400 text-center"
            >Chưa mở đặt đơn hoặc thanh toán</button>}

            <Link
              to={detailPath}
              className="w-full min-h-[44px] rounded-xl border border-film-border hover:bg-film-dark px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white text-center flex items-center justify-center transition-colors"
            >
              ← Thay đổi chiếc máy khác
            </Link>
          </div>
        </aside>
      </div>
      {showPayment && unit && days && <PaymentQrModal cameraItemId={unit.id} startDate={startDate} endDate={endDate} onClose={closePayment} />}
    </main>
  );
}

