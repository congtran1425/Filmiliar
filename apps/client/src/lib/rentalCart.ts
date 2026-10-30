import type { ProductSummary } from './catalog';

export type LensMount = 'Sony E' | 'Fujifilm X' | 'Canon RF' | 'Canon EF-M' | 'Nikon Z';

// Only direct, adapter-free mounts present in the current catalog.
// Manufacturer references: sony.com/electronics/support/articles/00268240,
// fujifilm-x.com/global/support/compatibility/cameras/,
// cam.start.canon/en/C011/manual/html/UG-11_Reference_0090.html,
// usa.canon.com/support/p/eos-m50, asia.canon/en/support/6200654100,
// nikonusa.com/p/z-30/1737/overview.
const mounts: Record<string, LensMount> = {
  'sony-alpha-a6700': 'Sony E', 'sony-zv-e10': 'Sony E',
  'sony-e-35mm-f1-8-oss': 'Sony E', 'sony-fe-50mm-f1-8': 'Sony E',
  'fujifilm-x-t50': 'Fujifilm X', 'fujifilm-x-t30-ii': 'Fujifilm X',
  'fujifilm-x-t100': 'Fujifilm X', 'fujifilm-x-s10': 'Fujifilm X',
  'fujifilm-xf-35mm-f1-4-r': 'Fujifilm X',
  'canon-eos-r50': 'Canon RF', 'canon-rf-50mm-f1-8-stm': 'Canon RF',
  'canon-eos-m50': 'Canon EF-M', 'canon-eos-m200': 'Canon EF-M',
  'nikon-z30': 'Nikon Z',
};

export function isLens(product: ProductSummary): boolean { return product.category === 'Lens'; }
export function getMount(product: ProductSummary): LensMount | undefined { return mounts[product.slug]; }

export function cartAddError(existing: ProductSummary[], candidate: ProductSummary): string | null {
  if (existing.some((item) => item.slug === candidate.slug)) return 'Thiết bị đã có trong bộ dự kiến.';
  const body = existing.find((item) => !isLens(item));
  if (!isLens(candidate) && body) return 'Một bộ chỉ chọn một thân máy. Hãy bỏ thân máy cũ trước.';
  const compared = isLens(candidate) ? (body ? [body] : existing.filter(isLens)) : existing.filter(isLens);
  if (compared.some((item) => !getMount(item) || !getMount(candidate) || getMount(item) !== getMount(candidate))) {
    return 'Ngàm ống kính không khớp thân máy đã chọn. Hãy chọn thiết bị cùng hệ ngàm.';
  }
  if (!getMount(candidate)) return 'Chưa xác minh ngàm của thiết bị này để thêm vào bộ.';
  return null;
}

export function rentalDays(start: string, end: string): number {
  const first = Date.parse(`${start}T12:00:00Z`);
  const last = Date.parse(`${end}T12:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return 0;
  return Math.max(1, Math.round((last - first) / 86_400_000));
}
