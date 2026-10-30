import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, Filter, Camera, ShoppingBag, Layers, AlertCircle } from 'lucide-react';
import { ProductTile } from '../components/ProductTile';
import { getCatalog, ProductSummary } from '../lib/catalog';
import { useCart } from '../lib/CartContext';

export function CatalogPage() {
  const cart = useCart();
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const brand = searchParams.get('brand') || 'ALL';
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const mode = searchParams.get('mode') === 'buy' ? 'BUY' : searchParams.get('mode') === 'rent' ? 'RENT' : 'ALL';
  useEffect(() => {
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (start && end && end >= start) cart.setDates(start, end);
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    getCatalog(controller.signal)
      .then((result) => { setItems(result.data); setIsDemo(result.isDemo); setError(null); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được danh mục'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const brands = useMemo(() => ['ALL', ...new Set(items.map((item) => item.brand))], [items]);
  const visible = useMemo(() => items.filter((item) =>
    (brand === 'ALL' || item.brand === brand) &&
    (category === 'all' || (category === 'lens' ? item.category === 'Lens' : item.category !== 'Lens')) &&
    (!query || `${item.name} ${item.brand} ${item.category}`.toLocaleLowerCase('vi-VN').includes(query.toLocaleLowerCase('vi-VN')))
  ), [items, brand, category, query]);

  const title = mode === 'RENT' ? 'Thiết bị cho thuê' : mode === 'BUY' ? 'Máy ảnh & ống kính để mua' : 'Tìm thiết bị của bạn';
  const subtitle = mode === 'RENT' 
    ? 'Xem dòng máy và giá thuê tham khảo; tình trạng từng chiếc đang được cập nhật.'
    : mode === 'BUY' 
    ? 'Tìm dòng máy cũ với giá tham khảo; thông tin từng chiếc đang được cập nhật.'
    : 'Khám phá toàn bộ máy ảnh và ống kính đang có trong hệ thống.';

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'ALL') next.delete(key); else next.set(key, value);
    setSearchParams(next, { replace: key === 'q' });
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    setSearchParams(next, { replace: true });
  };

  const hasActiveFilters = brand !== 'ALL' || query.trim() !== '' || category !== 'all';

  return (
    <main id="catalog" className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-6 sm:py-10 sm:px-6 lg:px-8">
      {/* Catalog Header & Intent Switcher */}
      <div className="flex flex-col gap-4 border-b border-film-border pb-5 sm:pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-film-warm">Danh mục Filmiliar</span>
            {isDemo && (
              <span className="inline-flex items-center gap-1 rounded bg-film-warm/15 px-1.5 py-0.5 text-[10px] font-semibold text-film-warm">
                <AlertCircle className="h-3 w-3" />
                Dữ liệu minh họa
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-slate-400">{subtitle}</p>
        </div>

        {/* Mode Switcher Tabs */}
        <nav aria-label="Chế độ danh mục" className="flex items-center gap-1.5 rounded-xl bg-film-card p-1 border border-film-border self-start md:self-auto">
          <button type="button" onClick={() => updateFilter('mode', 'rent')} aria-pressed={mode === 'RENT'}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              mode === 'RENT' 
                ? 'bg-film-warm text-film-dark shadow-sm' 
                : 'text-slate-300 hover:text-white hover:bg-film-border/50'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Thuê máy</span>
          </button>
          <button type="button" onClick={() => updateFilter('mode', 'buy')} aria-pressed={mode === 'BUY'}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              mode === 'BUY' 
                ? 'bg-film-warm text-film-dark shadow-sm' 
                : 'text-slate-300 hover:text-white hover:bg-film-border/50'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Mua máy</span>
          </button>
          <button type="button" onClick={() => updateFilter('mode', '')} aria-pressed={mode === 'ALL'}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              mode === 'ALL' 
                ? 'bg-film-warm text-film-dark shadow-sm font-bold' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tất cả</span>
          </button>
        </nav>
      </div>

      {/* Demo Notice Banner (concise) */}
      {isDemo && (
        <div role="status" className="rounded-xl border border-film-warm/30 bg-film-warm/10 p-3 text-xs text-film-warm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-film-warm" />
          <div className="leading-relaxed">
            <strong>Chế độ xem trước giao diện:</strong> Thông tin thiết bị và giá mang tính minh họa từ đề án. Chưa mở nhận đơn hoặc giữ chỗ trực tuyến.
          </div>
        </div>
      )}
      {(searchParams.get('start') || searchParams.get('end')) && <p className="rounded-xl border border-film-border bg-film-card p-3 text-xs text-slate-300">Ngày đã chọn chỉ để dự tính chi phí. Danh mục chưa lọc theo lịch trống; chọn thiết bị vào bộ dự kiến để xem tổng tiền thuê.</p>}

      {/* Search and Filter Controls */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
            <input 
              type="search" 
              value={query} 
              onChange={(e) => updateFilter('q', e.target.value)} 
              placeholder="Tìm tên máy ảnh, thương hiệu (Sony, Canon, Fujifilm)..." 
              className="w-full min-h-[44px] rounded-xl border border-film-border bg-film-card pl-10 pr-10 py-2.5 text-sm sm:text-sm text-white placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm" 
            />
            {query && (
              <button 
                type="button" 
                onClick={() => updateFilter('q', '')}
                className="absolute right-3 top-2.5 p-1 rounded-md text-slate-400 hover:text-white min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Desktop Brand Select */}
          <div className="hidden sm:flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-300"><span className="font-semibold text-slate-400">Loại:</span><select value={category} onChange={(e) => updateFilter('category', e.target.value)} className="min-h-[44px] rounded-xl border border-film-border bg-film-card px-3 text-xs text-white"><option value="all">Tất cả</option><option value="body">Thân máy</option><option value="lens">Ống kính</option></select></label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <span className="font-semibold text-slate-400">Hãng:</span>
              <select 
                value={brand} 
                onChange={(e) => updateFilter('brand', e.target.value)} 
                className="min-w-36 min-h-[44px] rounded-xl border border-film-border bg-film-card px-3 py-2 text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm cursor-pointer"
              >
                {brands.map((name) => (
                  <option key={name} value={name}>{name === 'ALL' ? 'Tất cả thương hiệu' : name}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Mobile Filter Toggle Button */}
          <div className="flex sm:hidden items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-film-border bg-film-card text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm"
              aria-expanded={showFilterDrawer}
            >
              <Filter className="w-3.5 h-3.5 text-film-warm" />
              <span>Lọc: {brand === 'ALL' ? 'Tất cả hãng' : brand}</span>
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-film-border bg-film-card text-xs text-slate-400 hover:text-white"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* Mobile Horizontal Brand Pills Drawer */}
        {showFilterDrawer && (
          <div className="sm:hidden p-3 rounded-xl bg-film-card border border-film-border space-y-2 animate-fade-in">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Loại thiết bị</div>
            <div className="flex flex-wrap gap-1.5">{[['all','Tất cả'],['body','Thân máy'],['lens','Ống kính']].map(([value,label]) => <button key={value} type="button" onClick={() => updateFilter('category',value)} aria-pressed={category === value} className={`min-h-[36px] rounded-lg px-3 text-xs ${category === value ? 'bg-film-warm text-film-dark' : 'border border-film-border text-slate-300'}`}>{label}</button>)}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chọn thương hiệu</div>
            <div className="flex flex-wrap gap-1.5">
              {brands.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    updateFilter('brand', name);
                    setShowFilterDrawer(false);
                  }}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    brand === name
                      ? 'bg-film-warm text-film-dark font-bold'
                      : 'bg-film-dark border border-film-border text-slate-300'
                  }`}
                >
                  {name === 'ALL' ? 'Tất cả' : name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Bar with Filter State */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <div>
            Hiển thị <strong className="text-white font-semibold">{visible.length}</strong> thiết bị
            {hasActiveFilters && (
              <span className="ml-1 text-slate-500">
                (kết quả cho {brand !== 'ALL' ? `hãng "${brand}"` : ''}{brand !== 'ALL' && query ? ' và ' : ''}{query ? `từ khóa "${query}"` : ''})
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-film-warm hover:underline hidden sm:inline-block"
            >
              Xóa tất cả bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Product Grid / Loading / Error / Empty States */}
      {loading ? (
        <div role="status" className="rounded-2xl border border-film-border bg-film-card p-12 text-center text-slate-300 space-y-2">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-film-warm border-t-transparent"></div>
          <p className="text-sm">Đang tải danh mục thiết bị...</p>
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-film-border bg-film-card p-10 text-center text-slate-300 space-y-3">
          <p className="text-sm text-red-400">{error}</p>
          <button 
            type="button" 
            onClick={() => window.location.reload()} 
            className="min-h-[44px] px-4 py-2 rounded-lg bg-film-warm text-film-dark text-xs font-bold"
          >
            Thử tải lại
          </button>
        </div>
      ) : visible.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <ProductTile key={item.id} product={item} mode={mode} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-film-border bg-film-card p-10 text-center text-slate-300 space-y-3">
          <p className="text-sm">Không tìm thấy thiết bị nào phù hợp với bộ lọc hiện tại.</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-film-warm text-film-dark text-xs font-bold transition-all"
            >
              Xóa bộ lọc để xem tất cả
            </button>
          )}
        </div>
      )}
    </main>
  );
}

