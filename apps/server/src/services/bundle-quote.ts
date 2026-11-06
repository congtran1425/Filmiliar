import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import mounts from '../content/rental-mounts.json';
import { quoteRental } from './rental-availability.js';
import { PaymentFlowError } from './rental-domain.js';

export type BundleSelection = {
  cameraItemIds: number[];
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
};
export function sortedUnitIds(ids: number[]) {
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 8 ||
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(ids).size !== ids.length
  )
    throw new PaymentFlowError('Chọn từ 1 đến 8 chiếc khác nhau');
  return [...ids].sort((a, b) => a - b);
}

export async function quoteBundle(
  db: PrismaClient | Prisma.TransactionClient,
  input: BundleSelection,
  ignoredBookings: Record<number, string> = {},
) {
  const ids = sortedUnitIds(input.cameraItemIds);
  const quotes = await Promise.all(
    ids.map((id) =>
      quoteRental(
        db,
        id,
        input.startDate,
        input.endDate,
        input.startTime,
        input.endTime,
        ignoredBookings[id],
      ),
    ),
  );
  if (quotes.some((q) => q.policy.version !== quotes[0].policy.version))
    throw new PaymentFlowError('Chính sách vừa thay đổi. Vui lòng kiểm tra lại cả bộ.', 409);
  const products = quotes.map((q) => q.unit.product);
  if (new Set(products.map((product) => product.id)).size !== products.length)
    throw new PaymentFlowError('Mỗi dòng máy hoặc ống kính chỉ chọn một chiếc trong bộ');
  if (products.filter((p) => p.categoryName !== 'Lens').length > 1)
    throw new PaymentFlowError('Một bộ chỉ chọn một thân máy');
  const systems = products.map((p) => (mounts as Record<string, string>)[p.slug]);
  if (systems.some((system) => !system) || new Set(systems).size > 1)
    throw new PaymentFlowError('Các thiết bị trong bộ phải cùng hệ ngàm đã xác minh');
  const rentalFee = quotes.reduce((n, q) => n + q.view.rentalFee, 0),
    depositAmount = quotes.reduce((n, q) => n + q.view.depositAmount, 0);
  const totalAmount = rentalFee + depositAmount;
  if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0 || totalAmount > 50_000_000)
    throw new PaymentFlowError('Tổng thanh toán cần từ 1đ đến 50.000.000đ');
  const first = quotes[0];
  const items = quotes.map((q) => ({
    ...q.view,
    name: q.unit.product.modelName,
    slug: q.unit.product.slug,
    conditionGrade: q.unit.conditionGrade,
  }));
  return {
    quotes,
    dates: first.dates,
    policy: first.policy,
    view: {
      ...first.view,
      items,
      rentalFee,
      depositAmount,
      totalAmount,
      available: items.every((item) => item.available),
      unavailableReason:
        items
          .filter((item) => !item.available)
          .map((item) => `${item.name}: ${item.unavailableReason}`)
          .join('; ') || null,
      quoteHash: crypto
        .createHash('sha256')
        .update(JSON.stringify(items.map((item) => item.quoteHash)))
        .digest('hex'),
    },
  };
}
