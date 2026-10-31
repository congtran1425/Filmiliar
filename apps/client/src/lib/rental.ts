import { useEffect, useState } from 'react';
import { apiRequest } from './session';

export type RentalPolicy = { id: string; version: number; returnBufferDays: number; cancellationRefund: 'FULL_PAYMENT' | 'DEPOSIT_ONLY'; terms: string; updatedAt: string };
export type RentalQuote = {
  cameraItemId: number; serialNumber: string; startDate: string; endDate: string; totalDays: number;
  dailyRate: number; rentalFee: number; depositAmount: number; totalAmount: number;
  returnBufferDays: number; blockedUntil: string; available: boolean; unavailableReason: string | null;
  policyVersion: number; terms: string; cancellationRefund: string; quoteHash: string; checkedAt: string;
};
export type Refund = { id: string; mRefundId: string; providerRefundId: string | null; amount: number; purpose: string;
  status: 'CREATING' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REVIEW'; activeBookingId: string | null;
  lastSubReturnCode: number | null; reviewReason: string | null; submittedAt: string; confirmedAt: string | null };
export type RentalBooking = {
  id: string; bookingCode: string; userId: string; status: string; depositStatus: string; startDate: string; endDate: string;
  totalDays: number; totalRentalFee: number; depositAmount: number; handoverAt: string | null; returnedAt: string | null; inspectedAt: string | null;
  handoverRecord: { accessories: string; condition: string; receiptReference: string; shutterCount: number | null; note: string } | null;
  returnRecord: { condition: string; shutterCount: number | null; releaseToStock: boolean; note: string } | null;
  deductionAmount: number; deductionReason: string | null; deductionDecision: string; returnInspectionNote: string | null;
  policySnapshot: { version?: number; terms?: string; cancellationRefund?: string } | null;
  user: { id: string; fullName: string; email: string; phone: string | null };
  cameraItem: { id: number; serialNumber: string; shutterCount: number | null; status: string; product: { modelName: string; slug: string; brand: string } };
  paymentAttempt: { status: string; appTransId: string; providerTxnId: string | null; amount: number; reviewReason: string | null } | null;
  refunds: Refund[]; events: { id: string; action: string; detail: string; createdAt: string }[];
};

export const rentalStatus: Record<string, string> = { PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã giữ lịch', ACTIVE_RENTAL: 'Đang thuê', RETURNED_PENDING_INSPECTION: 'Chờ nghiệm thu', COMPLETED: 'Đã nghiệm thu', CANCELLED: 'Đã hủy' };
export const refundStatus: Record<string, string> = { CREATING: 'Đang gửi yêu cầu', PENDING: 'Đang hoàn tiền', SUCCEEDED: 'Đã hoàn tiền', FAILED: 'Yêu cầu chưa thành công', REVIEW: 'Cần đối soát' };
export const todayVN = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export const addDays = (day: string, days: number) => {
  const stamp = Date.parse(day + 'T00:00:00Z');
  return Number.isFinite(stamp) ? new Date(stamp + days * 86400000).toISOString().slice(0, 10) : '';
};
export const showDay = (day: string) => day.slice(0, 10).split('-').reverse().join('/');

export function useRentalQuote(unitId: number | undefined, startDate: string, endDate: string) {
  const [tick, setTick] = useState(0);
  const key = `${unitId}:${startDate}:${endDate}:${tick}`;
  const valid = !!unitId && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate > startDate;
  const [result, setResult] = useState<{ key: string; quote: RentalQuote | null; error: string }>({ key: '', quote: null, error: '' });
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      apiRequest<{ data: RentalQuote }>(`/api/rental/quote/${unitId}?${new URLSearchParams({ startDate, endDate })}`, { signal: controller.signal, cache: 'no-store' })
        .then(({ data }) => { if (!controller.signal.aborted) setResult({ key, quote: data, error: '' }); })
        .catch(cause => { if (!controller.signal.aborted) setResult({ key, quote: null, error: cause instanceof Error ? cause.message : 'Không kiểm tra được lịch' }); });
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [key, valid, unitId, startDate, endDate]);
  useEffect(() => {
    const refresh = () => setTick(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  return { quote: valid && result.key === key ? result.quote : null, loading: valid && result.key !== key,
    error: valid && result.key === key ? result.error : '', refresh: () => setTick(value => value + 1) };
}

export function useRentalPolicy() {
  const [policy, setPolicy] = useState<RentalPolicy | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ data: RentalPolicy }>('/api/rental-policy', { signal: controller.signal, cache: 'no-store' })
      .then(({ data }) => { if (!controller.signal.aborted) setPolicy(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được chính sách'); });
    return () => controller.abort();
  }, []);
  return { policy, error };
}
