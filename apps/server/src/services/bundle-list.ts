import type { Prisma } from '@prisma/client';
export const visibleRentalWhere = {
  OR: [{ bundleId: null }, { paymentAttempt: { isNot: null } }],
} satisfies Prisma.RentalBookingWhereInput;
type Summary = {
  id: string;
  code: string;
  bookings: {
    status: string;
    totalRentalFee: number;
    depositAmount: number;
    depositStatus: string;
    deductionAmount: number;
  }[];
};
export function rentalListView<T extends { bundle?: Summary | null }>(booking: T) {
  const bundle = booking.bundle,
    first = bundle?.bookings[0];
  return {
    ...booking,
    bundleSummary:
      bundle && first
        ? {
            id: bundle.id,
            code: bundle.code,
            count: bundle.bookings.length,
            totalRentalFee: bundle.bookings.reduce((n, b) => n + b.totalRentalFee, 0),
            depositAmount: bundle.bookings.reduce((n, b) => n + b.depositAmount, 0),
            deductionAmount: bundle.bookings.reduce((n, b) => n + b.deductionAmount, 0),
            depositStatus: bundle.bookings.every((b) => ['REFUNDED', 'DEDUCTED'].includes(b.depositStatus))
              ? bundle.bookings.some((b) => b.depositStatus === 'DEDUCTED')
                ? 'DEDUCTED'
                : 'REFUNDED'
              : bundle.bookings.some((b) => b.depositStatus === 'REFUND_PENDING')
                ? 'REFUND_PENDING'
                : bundle.bookings.some((b) => b.depositStatus === 'HELD')
                  ? 'HELD'
                  : 'PENDING',
            status: bundle.bookings.every((b) => b.status === first.status)
              ? first.status
              : bundle.bookings.every((b) => ['COMPLETED', 'RETURNED_PENDING_INSPECTION'].includes(b.status))
                ? 'RETURNED_PENDING_INSPECTION'
                : 'REVIEW',
          }
        : null,
  };
}
