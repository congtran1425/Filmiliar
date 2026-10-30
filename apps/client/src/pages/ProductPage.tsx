import { useState } from 'react';
import { ArrowLeft, Camera, Check, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CameraUnit, formatVnd, PRODUCT_GALLERY } from '../lib/catalog';
import { useProduct } from '../lib/useProduct';

const unitStatus: Record<CameraUnit['status'], string> = {
  AVAILABLE: 'Có trong kho (chưa xác nhận lịch)',
  RESERVED: 'Đang giữ chỗ',
  RENTED: 'Đang cho thuê',
  MAINTENANCE: 'Đang bảo dưỡng',
  SOLD: 'Đã bán',
};

export function ProductPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { product, isDemo, loading, error } = useProduct(slug);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [selectedAngleIndex, setSelectedAngleIndex] = useState(0);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 text-slate-300" role="status">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-film-warm border-t-transparent"></div>
          <span>Đang tải thông tin thiết bị...</span>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16">
        <h1 className="text-2xl font-bold text-white">Không tìm thấy thiết bị</h1>
        <p className="mt-2 text-slate-400">{error || 'Đường dẫn này chưa có trong danh mục.'}</p>
        <Link className="mt-6 inline-flex items-center gap-1.5 text-film-warm underline min-h-[44px]" to="/thue">
          <ArrowLeft className="w-4 h-4" /> Về danh mục máy ảnh
        </Link>
      </main>
    );
  }

  const selected = 
    product.units.find((unit) => String(unit.id) === searchParams.get('may')) || 
    product.units.find((unit) => unit.status === 'AVAILABLE') || 
    product.units[0];

  const reviewPath = (mode: 'thue' | 'mua') => 
    `/thiet-bi/${product.slug}/xem-lai/${mode}?may=${selected?.id}`;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8 sm:px-6 lg:px-8 pb-28 lg:pb-12">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Đường dẫn" className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Link to="/thue" className="hover:text-white min-h-[32px] inline-flex items-center">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Danh mục
        </Link>
        <span>/</span>
        <span className="text-film-warm font-medium">{product.brand}</span>
        <span>/</span>
        <span className="text-slate-200 truncate max-w-[200px] sm:max-w-none">{product.name}</span>
      </nav>

      {/* Demo / Verification Notices */}
      {isDemo && (
        <div role="status" className="mb-5 rounded-xl border border-film-warm/40 bg-film-warm/10 p-3 text-xs sm:text-sm text-film-warm leading-relaxed">
          <strong>Dữ liệu minh họa để xem trước UI:</strong> Mã máy, tình trạng và giá chưa được xác nhận; không thể đặt đơn hoặc thanh toán.
        </div>
      )}
      {!isDemo && (
        <div role="note" className="mb-5 rounded-xl border border-film-border bg-film-card p-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
          Thiết bị hiện dùng ảnh minh họa của dòng máy, chưa có ảnh chụp vết xước đúng chiếc máy đang chọn. Vui lòng xem thông tin tình trạng như dữ liệu đang rà soát.
        </div>
      )}

      {/* Mobile Title & Category (first on mobile) */}
      <div className="mb-4 lg:hidden">
        <p className="text-xs font-bold uppercase tracking-wider text-film-warm">
          {product.brand} · {product.category}
        </p>
        <h1 className="mt-1 min-w-0 text-2xl sm:text-3xl font-extrabold leading-tight text-white [overflow-wrap:anywhere]">
          {product.name}
        </h1>
      </div>

      {/* Two Column Layout on Desktop */}
      <div className="grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        
        {/* Left Column: Photo & Specs */}
        <div className="space-y-5">
          {/* Main Photo Card with Angle Selector */}
          {(() => {
            const angles = (product?.slug && PRODUCT_GALLERY[product.slug]) || (product?.thumbnailUrl ? [{ label: 'Tổng thể', url: product.thumbnailUrl }] : []);
            const currentAngle = angles[selectedAngleIndex] || angles[0];
            const activeImage = currentAngle?.url || product?.thumbnailUrl;

            return (
              <figure className="overflow-hidden rounded-2xl border border-film-border bg-film-card shadow-sm">
                <div className="aspect-[4/3] sm:aspect-[16/10] bg-[#f5f2eb] relative">
                  {activeImage ? (
                    <img 
                      src={activeImage} 
                      alt={`Ảnh ${currentAngle?.label || 'minh họa'} dòng máy ${product.name}`} 
                      className="h-full w-full object-contain p-3 transition-all duration-300"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500">
                      <Camera className="h-16 w-16" />
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 rounded-md bg-film-dark/90 px-2.5 py-1 text-[11px] text-slate-300 border border-film-border/60">
                    {currentAngle ? `Góc: ${currentAngle.label}` : 'Ảnh dòng máy'}
                  </span>
                </div>

                {/* Angle selection buttons */}
                {angles.length > 1 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-film-dark/70 border-t border-film-border/60">
                    {angles.map((ang, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedAngleIndex(idx)}
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm ${
                          selectedAngleIndex === idx
                            ? 'bg-film-warm text-film-dark font-bold shadow-sm'
                            : 'bg-film-card text-slate-300 hover:text-white border border-film-border hover:border-slate-500'
                        }`}
                      >
                        {ang.label}
                      </button>
                    ))}
                  </div>
                )}

                <figcaption className="p-3.5 text-xs text-slate-400 bg-film-card/80 border-t border-film-border/60 leading-relaxed">
                  Hình ảnh chụp chi tiết các góc máy. Để xem tình trạng vết xước, số shot và phụ kiện, vui lòng kiểm tra mục thông tin từng chiếc máy bên dưới.
                </figcaption>
              </figure>
            );
          })()}

          {/* Quick Price Box on Mobile (placed right after photo for quick scan) */}
          <section className="lg:hidden rounded-2xl border border-film-border bg-film-card p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-film-dark/60 border border-film-border/60">
                <span className="block text-[11px] text-slate-400">Thuê / ngày</span>
                <strong className="mt-0.5 block text-base font-extrabold text-film-warm">
                  {formatVnd(product.rentPrice)}
                </strong>
                <span className="block text-[10px] text-slate-500 mt-0.5">Giá tham khảo</span>
              </div>
              <div className="p-3 rounded-xl bg-film-dark/60 border border-film-border/60">
                <span className="block text-[11px] text-slate-400">Mua tham khảo</span>
                <strong className="mt-0.5 block text-base font-extrabold text-white">
                  {formatVnd(product.salePrice)}
                </strong>
                <span className="block text-[10px] text-slate-500 mt-0.5">Máy cũ cùng dòng</span>
              </div>
            </div>
          </section>

          {/* Technical Specs: Expandable on Mobile, Always Visible on Desktop */}
          <section className="rounded-2xl border border-film-border bg-film-card overflow-hidden">
            <button
              type="button"
              onClick={() => setSpecsOpen(!specsOpen)}
              className="w-full p-4 flex items-center justify-between text-left lg:pointer-events-none"
              aria-expanded={specsOpen}
            >
              <div>
                <h2 className="text-base font-bold text-white">Thông số kỹ thuật dòng máy</h2>
                <p className="text-xs text-slate-400 lg:hidden">Chạm để {specsOpen ? 'thu gọn' : 'xem chi tiết thông số'}</p>
              </div>
              <div className="lg:hidden p-1 text-slate-400">
                {specsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </button>

            <div className={`p-4 pt-0 lg:p-5 lg:pt-0 ${specsOpen ? 'block' : 'hidden lg:block'}`}>
              <dl className="grid grid-cols-2 gap-3 text-xs sm:text-sm border-t border-film-border/60 pt-3">
                <div className="p-2.5 rounded-lg bg-film-dark/40">
                  <dt className="text-slate-400">Cảm biến</dt>
                  <dd className="mt-0.5 font-semibold text-white">{product.sensorType}</dd>
                </div>
                <div className="p-2.5 rounded-lg bg-film-dark/40">
                  <dt className="text-slate-400">Quay video</dt>
                  <dd className="mt-0.5 font-semibold text-white">{product.videoResolution}</dd>
                </div>
                <div className="p-2.5 rounded-lg bg-film-dark/40">
                  <dt className="text-slate-400">Khối lượng</dt>
                  <dd className="mt-0.5 font-semibold text-white">{product.weightGram} g</dd>
                </div>
                <div className="p-2.5 rounded-lg bg-film-dark/40">
                  <dt className="text-slate-400">Phân loại</dt>
                  <dd className="mt-0.5 font-semibold text-white">{product.category}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>

        {/* Right Column: Decision Flow (Title -> Unit Selection -> Condition -> Price/Actions) */}
        <div className="space-y-5">
          {/* Desktop Title Header */}
          <div className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-wider text-film-warm">
              {product.brand} · {product.category}
            </p>
            <h1 className="mt-1 min-w-0 text-3xl font-extrabold leading-tight text-white [overflow-wrap:anywhere]">
              {product.name}
            </h1>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {product.units.length > 0
                ? 'Chọn một chiếc máy cụ thể để xem tình trạng ngoại hình, số shot và chuyển tiếp đến trang xem lại.'
                : 'Thông tin từng chiếc máy đang được nhóm cập nhật; hiện có thể xem ảnh và thông số của dòng máy.'}
            </p>
          </div>

          {/* Unit Selector: The Core Mobile Decision Step */}
          <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Chọn chiếc máy cụ thể</span>
                <span className="rounded bg-film-warm/20 px-2 py-0.5 text-xs text-film-warm font-semibold">
                  {product.units.length} máy trong kho
                </span>
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Mỗi chiếc máy cũ có số serial, tình trạng và số shot riêng biệt.
            </p>

            {product.units.length ? (
              <div className="mt-3.5 space-y-2">
                {product.units.map((unit) => {
                  const isCurrent = selected?.id === unit.id;
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => setSearchParams({ may: String(unit.id) }, { replace: true })}
                      aria-pressed={isCurrent}
                      className={`flex w-full min-h-[52px] items-center justify-between gap-3 rounded-xl border p-3 text-left text-xs sm:text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm active:scale-[0.99] ${
                        isCurrent
                          ? 'border-film-warm bg-film-warm/15 text-white shadow-sm ring-1 ring-film-warm/40'
                          : 'border-film-border bg-film-dark/50 hover:bg-film-dark text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="text-white font-mono text-xs sm:text-sm">{unit.serialNumber}</strong>
                          <span className="rounded bg-film-card px-1.5 py-0.5 text-[10px] text-slate-300 border border-film-border">
                            {unit.conditionGrade}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                          {unitStatus[unit.status]}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent ? (
                          <div className="h-6 w-6 rounded-full bg-film-warm text-film-dark flex items-center justify-center">
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Chọn</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                Dòng máy này hiện chưa có chiếc máy nào khả dụng.
              </p>
            )}
          </section>

          {/* Condition Facts for Selected Unit */}
          {selected && (
            <section className="rounded-2xl border border-film-border bg-film-card p-4 sm:p-5">
              <div className="flex items-start gap-2.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-film-warm" />
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    Tình trạng chiếc máy #{selected.serialNumber}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Dữ liệu lưu nội bộ · Chưa có ảnh biên bản kiểm định ngày xác nhận
                  </p>
                </div>
              </div>

              <dl className="mt-3.5 space-y-2.5 text-xs sm:text-sm border-t border-film-border pt-3">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Mức ngoại hình</dt>
                  <dd className="font-semibold text-white">{selected.conditionGrade}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Số lần trập (Shutter)</dt>
                  <dd className="font-semibold text-white">
                    {selected.shutterCount == null ? 'Chưa đo' : selected.shutterCount.toLocaleString('vi-VN')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Cảm biến</dt>
                  <dd className="max-w-[65%] text-right text-slate-200">
                    {selected.sensorInspection || 'Hoạt động bình thường'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Ống kính / Ngàm</dt>
                  <dd className="max-w-[65%] text-right text-slate-200">
                    {selected.opticsCondition || 'Sạch sẽ, không nấm mốc'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Vết xước</dt>
                  <dd className="max-w-[65%] text-right text-slate-200">
                    {selected.scratchNotes || 'Xước dăm nhẹ theo thời gian'}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {/* Desktop Pricing & Review Navigation Section */}
          <section className="hidden lg:block rounded-2xl border border-film-border bg-film-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Chi phí dự kiến</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-film-dark/60 border border-film-border/60">
                <span className="block text-xs text-slate-400">Thuê theo ngày</span>
                <strong className="mt-1 block text-xl text-film-warm font-extrabold">
                  {formatVnd(product.rentPrice)}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-film-dark/60 border border-film-border/60">
                <span className="block text-xs text-slate-400">Mua tham khảo</span>
                <strong className="mt-1 block text-xl text-white font-extrabold">
                  {formatVnd(product.salePrice)}
                </strong>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              Bước xem lại giúp đối chiếu thông tin trước khi đặt. Hiện website chưa thu tiền trực tuyến.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {selected?.status === 'AVAILABLE' ? (
                <>
                  <Link 
                    to={reviewPath('thue')} 
                    className="min-h-[44px] rounded-xl bg-film-warm hover:bg-amber-300 px-4 py-2.5 text-center text-xs font-bold text-film-dark flex items-center justify-center transition-all shadow-sm active:scale-95"
                  >
                    Xem lại yêu cầu thuê →
                  </Link>
                  <Link 
                    to={reviewPath('mua')} 
                    className="min-h-[44px] rounded-xl border border-film-warm hover:bg-film-warm/10 px-4 py-2.5 text-center text-xs font-bold text-film-warm flex items-center justify-center transition-all active:scale-95"
                  >
                    Xem lại yêu cầu mua →
                  </Link>
                </>
              ) : (
                <div className="col-span-2 p-3 text-center text-xs text-slate-400 rounded-xl bg-film-dark/40 border border-film-border">
                  Chiếc máy này không khả dụng để xem lại yêu cầu.
                </div>
              )}
            </div>
          </section>

          <div className="pt-2">
            <Link 
              to="/thue" 
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" /> Về danh mục máy ảnh
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-film-dark/95 backdrop-blur-md border-t border-film-border p-3 pb-safe shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
          {/* Left info: selected unit & price */}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-slate-400 truncate">
              {selected ? `Máy #${selected.serialNumber}` : 'Chưa chọn máy'}
            </div>
            <div className="text-xs font-extrabold text-film-warm truncate">
              {formatVnd(product.rentPrice)}
              <span className="text-[10px] text-slate-400 font-normal"> / ngày</span>
            </div>
          </div>

          {/* Right actions: Dual Review buttons */}
          {selected?.status === 'AVAILABLE' ? (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={reviewPath('thue')}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-film-warm text-film-dark font-bold text-xs flex items-center justify-center active:scale-95 transition-all shadow-sm"
              >
                Xem thuê
              </Link>
              <Link
                to={reviewPath('mua')}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-film-warm text-film-warm font-bold text-xs flex items-center justify-center active:scale-95 transition-all"
              >
                Xem mua
              </Link>
            </div>
          ) : (
            <span className="text-xs text-slate-400 py-2">
              Chưa có sẵn
            </span>
          )}
        </div>
      </div>
    </main>
  );
}

