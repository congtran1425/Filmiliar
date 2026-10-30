import { ArrowUpRight, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatVnd, ProductSummary } from '../lib/catalog';

interface ProductTileProps {
  product: ProductSummary;
  mode: 'RENT' | 'BUY' | 'ALL';
}

export function ProductTile({ product, mode }: ProductTileProps) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-film-border bg-film-card transition-all hover:border-film-warm/70 shadow-sm">
      <Link 
        to={`/thiet-bi/${product.slug}`} 
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-warm" 
        aria-label={`Xem chi tiết và từng chiếc máy ${product.name}`}
      >
        <div className="relative aspect-[16/10] sm:aspect-[4/3] bg-[#f5f2eb] overflow-hidden">
          {product.thumbnailUrl ? (
            <img 
              src={product.thumbnailUrl} 
              alt={`Ảnh minh họa dòng máy ${product.name}`} 
              loading="lazy" 
              className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              <Camera className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
          <span className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-md bg-film-dark/90 px-2 py-1 text-[11px] text-slate-300 border border-film-border/60">
            {product.thumbnailUrl ? 'Ảnh minh họa · chưa xác minh đúng chiếc' : 'Chưa có ảnh phù hợp'}
          </span>
        </div>

        <div className="space-y-3.5 p-4 sm:p-5">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-film-warm">
              {product.brand} · {product.category}
            </p>
            <div className="mt-1 flex items-start justify-between gap-2">
              <h3 className="min-w-0 text-base sm:text-lg font-bold leading-snug text-white [overflow-wrap:anywhere]">
                {product.name}
              </h3>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-film-warm/80 group-hover:text-film-warm group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {product.sensorType} · {product.videoResolution}
            </p>
          </div>

          {/* Pricing Tailored to Intent Mode */}
          <div className="border-t border-film-border/80 pt-3">
            {mode === 'RENT' ? (
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="block text-[11px] text-slate-400">Giá thuê theo ngày</span>
                  <strong className="text-base sm:text-lg text-white font-extrabold text-film-warm">
                    {formatVnd(product.rentPrice)}
                    <span className="text-xs font-normal text-slate-400"> / ngày</span>
                  </strong>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-slate-500">Mua tham khảo</span>
                  <span className="text-xs text-slate-300">{formatVnd(product.salePrice)}</span>
                </div>
              </div>
            ) : mode === 'BUY' ? (
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="block text-[11px] text-slate-400">Giá mua tham khảo</span>
                  <strong className="text-base sm:text-lg text-white font-extrabold text-film-warm">
                    {formatVnd(product.salePrice)}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-slate-500">Thuê trải nghiệm</span>
                  <span className="text-xs text-slate-300">{formatVnd(product.rentPrice)}/ngày</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-left">
                <div>
                  <span className="block text-[11px] text-slate-400">Thuê / ngày</span>
                  <strong className="text-sm sm:text-base text-white">{formatVnd(product.rentPrice)}</strong>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">Mua tham khảo</span>
                  <strong className="text-sm sm:text-base text-white">{formatVnd(product.salePrice)}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="pt-1 flex items-center justify-between text-xs font-medium text-film-warm">
            <span>{product.unitsCount > 0 ? 'Xem tình trạng từng chiếc máy' : 'Xem thông tin dòng máy'}</span>
            <span aria-hidden="true">→</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

