import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCatalog, type ProductSummary } from './catalog';
import { cartAddError } from './rentalCart';

const STORAGE_KEY = 'filmiliar-rental-plan-v1';
type StoredCart = { slugs: string[]; start: string; end: string; startTime: string; endTime: string; units: Record<string,number> };
type CartValue = {
  items: ProductSummary[]; count: number; loading: boolean; isDemo: boolean;
  isOpen: boolean; openCart: () => void; closeCart: () => void;
  start: string; end: string; setDates: (start: string, end: string) => void;
  startTime: string; endTime: string; setTimes: (start: string,end: string) => void;
  units: Record<string,number>; selectUnit: (slug: string,id: number) => void;
  error: string; refresh: () => void;
  add: (item: ProductSummary, unitId?: number) => string | null; remove: (slug: string) => void; removeItems: (slugs: string[]) => void;
};
const CartContext = createContext<CartValue | null>(null);

function initialCart(): StoredCart {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<StoredCart>;
    return {
      slugs: Array.isArray(parsed.slugs) ? [...new Set(parsed.slugs.filter((slug): slug is string => typeof slug === 'string'))].slice(0, 8) : [],
      start: typeof parsed.start === 'string' ? parsed.start : '',
      end: typeof parsed.end === 'string' ? parsed.end : '',
      startTime: typeof parsed.startTime === 'string' ? parsed.startTime : '08:00',
      endTime: typeof parsed.endTime === 'string' ? parsed.endTime : '08:00',
      units: parsed.units && typeof parsed.units === 'object' ? Object.fromEntries(Object.entries(parsed.units).filter(([,id])=>Number.isSafeInteger(id)&&id>0)) : {},
    };
  } catch { return { slugs: [], start: '', end: '', startTime:'08:00',endTime:'08:00',units:{} }; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<StoredCart>(initialCart);
  const [catalog, setCatalog] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(saved.slugs.length > 0);
  const [isDemo, setIsDemo] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (saved.slugs.length === 0) { setLoading(false); setCatalog([]); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    getCatalog(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setIsDemo(result.isDemo);
      if (result.isFallback) { setError('Không tải được danh mục hiện tại. Vui lòng thử lại.'); return; }
      setCatalog(result.data);
      if (result.data.length > 0) {
        const known = new Set(result.data.map((item) => item.slug));
        setSaved((previous) => previous.slugs.every((slug) => known.has(slug)) ? previous : { ...previous, slugs: previous.slugs.filter((slug) => known.has(slug)) });
      }
    }).catch(() => { if (!controller.signal.aborted) setError('Không tải được bộ thiết bị. Vui lòng thử lại.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [saved.slugs.join('|'), tick]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }, [saved]);

  const items = useMemo(() => saved.slugs.flatMap((slug) => {
    const item = catalog.find((entry) => entry.slug === slug);
    return item ? [item] : [];
  }), [saved.slugs, catalog]);
  const add = (item: ProductSummary, unitId?: number) => {
    if (loading) return 'Đang tải bộ thiết bị. Vui lòng thử lại sau ít giây.';
    const error = cartAddError(items, item);
    if (error) return error;
    setCatalog((previous) => previous.some((entry) => entry.slug === item.slug) ? previous : [...previous, item]);
    setSaved((previous) => ({ ...previous, slugs: [...new Set([...previous.slugs, item.slug])], units: unitId && unitId > 0 ? {...previous.units,[item.slug]:unitId} : previous.units }));
    setIsOpen(true);
    return null;
  };
  const remove = (slug: string) => setSaved((previous) => ({ ...previous, slugs: previous.slugs.filter((item) => item !== slug) }));
  const setDates = (start: string, end: string) => setSaved((previous) => ({ ...previous, start, end }));
  const setTimes = (startTime: string,endTime: string) => setSaved(previous=>({...previous,startTime,endTime}));
  const selectUnit = (slug: string,id: number) => setSaved(previous=>({...previous,units:{...previous.units,[slug]:id}}));
  const removeItems = (slugs: string[]) => setSaved(previous=>({...previous,slugs:previous.slugs.filter(slug=>!slugs.includes(slug)),units:Object.fromEntries(Object.entries(previous.units).filter(([slug])=>!slugs.includes(slug)))}));
  return <CartContext.Provider value={{ items, count: saved.slugs.length, loading, isDemo, error, refresh:()=>setTick(v=>v+1), isOpen, openCart: () => setIsOpen(true), closeCart: () => setIsOpen(false), start: saved.start, end: saved.end, startTime:saved.startTime,endTime:saved.endTime,units:saved.units,selectUnit,setTimes,removeItems,setDates,add,remove }}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('CartProvider is missing');
  return value;
}
