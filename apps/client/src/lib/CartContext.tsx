import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCatalog, type ProductSummary } from './catalog';
import { cartAddError } from './rentalCart';

const STORAGE_KEY = 'filmiliar-rental-plan-v1';
type StoredCart = { slugs: string[]; start: string; end: string };
type CartValue = {
  items: ProductSummary[]; count: number; loading: boolean; isDemo: boolean;
  isOpen: boolean; openCart: () => void; closeCart: () => void;
  start: string; end: string; setDates: (start: string, end: string) => void;
  add: (item: ProductSummary) => string | null; remove: (slug: string) => void;
};
const CartContext = createContext<CartValue | null>(null);

function initialCart(): StoredCart {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<StoredCart>;
    return {
      slugs: Array.isArray(parsed.slugs) ? parsed.slugs.filter((slug): slug is string => typeof slug === 'string').slice(0, 8) : [],
      start: typeof parsed.start === 'string' ? parsed.start : '',
      end: typeof parsed.end === 'string' ? parsed.end : '',
    };
  } catch { return { slugs: [], start: '', end: '' }; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<StoredCart>(initialCart);
  const [catalog, setCatalog] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(saved.slugs.length > 0);
  const [isDemo, setIsDemo] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (saved.slugs.length === 0) { setLoading(false); setCatalog([]); return; }
    const controller = new AbortController();
    setLoading(true);
    getCatalog(controller.signal).then((result) => {
      setCatalog(result.data); setIsDemo(result.isDemo);
      if (result.data.length > 0) {
        const known = new Set(result.data.map((item) => item.slug));
        setSaved((previous) => previous.slugs.every((slug) => known.has(slug)) ? previous : { ...previous, slugs: previous.slugs.filter((slug) => known.has(slug)) });
      }
    }).catch(() => { /* Route changes can abort an in-flight refresh. */
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [saved.slugs.join('|')]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }, [saved]);

  const items = useMemo(() => saved.slugs.flatMap((slug) => {
    const item = catalog.find((entry) => entry.slug === slug);
    return item ? [item] : [];
  }), [saved.slugs, catalog]);
  const add = (item: ProductSummary) => {
    if (loading) return 'Đang tải bộ thiết bị. Vui lòng thử lại sau ít giây.';
    const error = cartAddError(items, item);
    if (error) return error;
    setCatalog((previous) => previous.some((entry) => entry.slug === item.slug) ? previous : [...previous, item]);
    setSaved((previous) => ({ ...previous, slugs: [...previous.slugs, item.slug] }));
    setIsOpen(true);
    return null;
  };
  const remove = (slug: string) => setSaved((previous) => ({ ...previous, slugs: previous.slugs.filter((item) => item !== slug) }));
  const setDates = (start: string, end: string) => setSaved((previous) => ({ ...previous, start, end }));
  return <CartContext.Provider value={{ items, count: saved.slugs.length, loading, isDemo, isOpen, openCart: () => setIsOpen(true), closeCart: () => setIsOpen(false), start: saved.start, end: saved.end, setDates, add, remove }}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('CartProvider is missing');
  return value;
}
