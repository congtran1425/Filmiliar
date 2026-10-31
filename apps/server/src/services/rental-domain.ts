export const DAY_MS = 86_400_000;
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export class PaymentFlowError extends Error {
  constructor(message: string, public readonly statusCode = 400) { super(message); }
}

export function vietnamDate(date = new Date()): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function dateKey(date: Date): string { return date.toISOString().slice(0, 10); }

export function parseDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new PaymentFlowError('Ngày không hợp lệ');
  const result = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(result.getTime()) || dateKey(result) !== value) throw new PaymentFlowError('Ngày không hợp lệ');
  return result;
}

export function parseRentalDates(startDate: string, endDate: string) {
  const start = parseDay(startDate);
  const end = parseDay(endDate);
  const today = parseDay(vietnamDate());
  const days = (end.getTime() - start.getTime()) / DAY_MS;
  if (start < today || start.getTime() > today.getTime() + 90 * DAY_MS || days < 1 || days > 30) {
    throw new PaymentFlowError('Ngày nhận trong 90 ngày tới; thời gian thuê từ 1 đến 30 ngày');
  }
  return { start, end, days };
}

export function isAllocationConflict(error: unknown): boolean {
  return error instanceof Error && /RentalAllocation_no_overlap|23P01|conflicting key value violates exclusion/.test(error.message);
}
