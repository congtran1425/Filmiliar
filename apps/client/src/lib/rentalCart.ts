import type { ProductSummary } from './catalog';
import catalogMounts from '../../../server/src/content/rental-mounts.json';

export type LensMount = 'Sony E' | 'Fujifilm X' | 'Canon RF' | 'Canon EF-M' | 'Nikon Z';

// Only direct, adapter-free mounts present in the current catalog.
// Manufacturer references: sony.com/electronics/support/articles/00268240,
// fujifilm-x.com/global/support/compatibility/cameras/,
// cam.start.canon/en/C011/manual/html/UG-11_Reference_0090.html,
// usa.canon.com/support/p/eos-m50, asia.canon/en/support/6200654100,
// nikonusa.com/p/z-30/1737/overview.
const mounts = catalogMounts as Record<string, LensMount>;

export function isLens(product: ProductSummary): boolean { return product.category === 'Lens'; }
export function getMount(product: ProductSummary): LensMount | undefined { return mounts[product.slug]; }

export function cartAddError(existing: ProductSummary[], candidate: ProductSummary): string | null {
  if (existing.some((item) => item.slug === candidate.slug)) return 'Thiết bị đã có trong bộ dự kiến.';
  if (existing.length >= 8) return 'Một bộ tối đa 8 thiết bị.';
  const body = existing.find((item) => !isLens(item));
  if (!isLens(candidate) && body) return 'Một bộ chỉ chọn một thân máy. Hãy bỏ thân máy cũ trước.';
  const compared = isLens(candidate) ? (body ? [body] : existing.filter(isLens)) : existing.filter(isLens);
  if (compared.some((item) => !getMount(item) || !getMount(candidate) || getMount(item) !== getMount(candidate))) {
    return 'Ngàm ống kính không khớp thân máy đã chọn. Hãy chọn thiết bị cùng hệ ngàm.';
  }
  if (!getMount(candidate)) return 'Chưa xác minh ngàm của thiết bị này để thêm vào bộ.';
  return null;
}

export function rentalDays(start: string, end: string, startTime = '08:00', endTime = '08:00'): number {
  const first = Date.parse(`${start}T${startTime}:00+07:00`);
  const last = Date.parse(`${end}T${endTime}:00+07:00`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return 0;
  return Math.ceil((last - first) / 86_400_000);
}
