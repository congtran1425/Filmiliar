import { PaymentFlowError, DAY_MS, parseRentalDates } from './rental-domain.js';

import policyDocument from '../content/filmiliar-policy.json';
export const POLICY_RELEASE = policyDocument.release;
export const APPROVED_RULES = policyDocument.rules;

export const APPROVED_TERMS = policyDocument.sections.filter(section => section.id !== 'bao-hanh').map(section => [section.title, ...section.paragraphs].join('\n')).join('\n\n');

export function scheduledRental(startDate: string, endDate: string, startTime = '08:00', endTime = '08:00') {
  const dates = parseRentalDates(startDate, endDate);
  if (![startTime, endTime].every(v => /^(?:0[89]|1\d|20):[0-5]\d$/.test(v) && v <= '20:00')) throw new PaymentFlowError('Giờ nhận/trả từ 08:00 đến 20:00');
  const pickupAt = new Date(`${startDate}T${startTime}:00+07:00`);
  const dueAt = new Date(`${endDate}T${endTime}:00+07:00`);
  const days = Math.ceil((dueAt.getTime() - pickupAt.getTime()) / DAY_MS);
  if (days < 1 || days > 30) throw new PaymentFlowError('Thời gian thuê từ 1 đến 30 ngày, tính theo 24 giờ');
  return { ...dates, days, pickupAt, dueAt, startTime, endTime };
}

type RefundBooking = { depositAmount: number; totalRentalFee: number; startDate: Date; pickupAt?: Date | null; cancelledAt?: Date | null; cancellationCause?: string | null; policySnapshot: unknown };
export function cancellationRefundAmount(booking: RefundBooking, now = new Date()) {
  const policy = (booking.policySnapshot || {}) as { cancellationRefund?: string; rules?: { cancellationTiers?: unknown } };
  if (booking.cancellationCause === 'STORE') return booking.depositAmount + booking.totalRentalFee;
  if (policy.cancellationRefund !== 'TIMED') return booking.depositAmount + (policy.cancellationRefund === 'DEPOSIT_ONLY' ? 0 : booking.totalRentalFee);
  if (!booking.pickupAt) throw new PaymentFlowError('Đơn thiếu giờ nhận máy; cần đối soát trước khi hoàn', 409);
  const hours = (booking.pickupAt.getTime() - (booking.cancelledAt || now).getTime()) / 3600000;
  const tiers = policy.rules?.cancellationTiers ?? APPROVED_RULES.cancellationTiers;
  if (!Array.isArray(tiers) || !tiers.length || !tiers.every(tier => tier && Number.isFinite(tier.minimumHours) && tier.minimumHours >= 0 && Number.isFinite(tier.rentalRefundPercent) && tier.rentalRefundPercent >= 0 && tier.rentalRefundPercent <= 100)) throw new PaymentFlowError('Điều khoản hoàn tiền của đơn chưa hợp lệ; cần đối soát trước khi hoàn', 409);
  const tier = [...tiers].sort((a, b) => b.minimumHours - a.minimumHours).find(tier => hours >= tier.minimumHours);
  const rate = tier ? tier.rentalRefundPercent / 100 : 0;
  return booking.depositAmount + Math.floor(booking.totalRentalFee * rate);
}

export function suggestedLateFee(dueAt: Date | null, returnedAt: Date | null, dailyRate: number) {
  if (!dueAt || !returnedAt) return 0;
  const hours = (returnedAt.getTime() - dueAt.getTime()) / 3600000;
  return hours < 2 ? 0 : hours < 24 ? Math.ceil(dailyRate / 2) : Math.ceil(hours / 24) * dailyRate;
}
