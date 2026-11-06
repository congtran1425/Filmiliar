import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './session';
import type { RentalBooking, RentalQuote } from './rental';
import type { TechnicalPassport } from './catalog';

export type BundleQuote = RentalQuote & {
  items: (RentalQuote & { name: string; slug: string; conditionGrade: string })[];
};
export type RentalBundle = {
  id: string;
  code: string;
  userId: string;
  status: string;
  primaryBookingId: string;
  user: RentalBooking['user'];
  bookings: (RentalBooking & {
    cameraItem: RentalBooking['cameraItem'] & {
      passport?: TechnicalPassport | null;
      opticsCondition: string;
      scratchNotes: string;
    };
  })[];
  paymentAttempt: RentalBooking['paymentAttempt'];
  refunds: RentalBooking['refunds'];
  events: RentalBooking['events'];
  totalRentalFee: number;
  depositAmount: number;
  totalAmount: number;
  deductionAmount: number;
  totalDays: number;
  startDate: string;
  endDate: string;
  pickupAt: string | null;
  dueAt: string | null;
  rescheduleCount: number;
  policySnapshot: RentalBooking['policySnapshot'];
  cancellationRefundAmount: number;
  canRefund: boolean;
};

export function useBundleQuote(
  ids: number[],
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
) {
  const [tick, setTick] = useState(0);
  const selection = [...ids].sort((a, b) => a - b).join(',');
  const key = `${selection}|${startDate}|${endDate}|${startTime}|${endTime}|${tick}`;
  const ready = !!selection && !!startDate && !!endDate && !!startTime && !!endTime;
  const [state, setState] = useState<{
    key: string;
    data: BundleQuote | null;
    loading: boolean;
    error: string;
  }>({ key: '', data: null, loading: false, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    if (!ready) return () => controller.abort();
    setState({ key, data: null, loading: true, error: '' });
    const timer = window.setTimeout(() => {
      apiRequest<{ data: BundleQuote }>(
        `/api/rental/bundle-quote?${new URLSearchParams({ unitIds: selection, startDate, endDate, startTime, endTime })}`,
        { signal: controller.signal, cache: 'no-store' },
      )
        .then((result) => {
          if (!controller.signal.aborted) setState({ key, data: result.data, loading: false, error: '' });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setState({
              key,
              data: null,
              loading: false,
              error: error instanceof Error ? error.message : 'Không kiểm tra được bộ thuê',
            });
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key, ready]);
  const refresh = useCallback(() => setTick((v) => v + 1), []);
  return {
    quote: ready && state.key === key ? state.data : null,
    loading: ready && (state.key !== key || state.loading),
    error: ready && state.key === key ? state.error : '',
    refresh,
  };
}
