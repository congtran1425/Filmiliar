import crypto from 'node:crypto';
import { BookingStatus, ItemStatus, Prisma, PrismaClient } from '@prisma/client';
import { DAY_MS, PaymentFlowError, dateKey, parseDay, parseRentalDates, vietnamDate } from './rental-domain.js';

type Database = PrismaClient | Prisma.TransactionClient;

export async function lockUnit(tx: Prisma.TransactionClient, unitId: number) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(27187, ${unitId}::integer)::text`;
}

export async function lockBooking(tx: Prisma.TransactionClient, bookingId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(27188, hashtext(${bookingId}))::text`;
}

export async function getRentalPolicy(db: Database) {
  const policy = await db.rentalPolicy.findUnique({ where: { id: 'rental' } });
  if (!policy) throw new PaymentFlowError('Chưa có cấu hình thuê máy', 503);
  return policy;
}

export async function quoteRental(db: Database, unitId: number, startDate: string, endDate: string) {
  const dates = parseRentalDates(startDate, endDate);
  const [unit, policy] = await Promise.all([
    db.cameraItem.findUnique({ where: { id: unitId }, include: { product: true } }), getRentalPolicy(db)
  ]);
  if (!unit || !unit.product.isPublished) throw new PaymentFlowError('Không tìm thấy chiếc máy', 404);
  const blockedUntil = new Date(dates.end.getTime() + policy.returnBufferDays * DAY_MS);
  const [conflict, activePhysical, reservationCount] = await Promise.all([
    db.rentalAllocation.findFirst({ where: { cameraItemId: unitId, releasedAt: null, startDate: { lt: blockedUntil }, endDate: { gt: dates.start } }, select: { id: true } }),
    db.rentalBooking.findFirst({ where: { cameraItemId: unitId, status: { in: [BookingStatus.ACTIVE_RENTAL, BookingStatus.RETURNED_PENDING_INSPECTION] } }, select: { status: true, endDate: true } }),
    db.rentalAllocation.count({ where: { cameraItemId: unitId, releasedAt: null } })
  ]);
  let unavailableReason: string | null = null;
  if (unit.status === ItemStatus.SOLD) unavailableReason = 'Chiếc máy đã bán';
  else if (unit.status === ItemStatus.MAINTENANCE) unavailableReason = 'Chiếc máy đang bảo dưỡng hoặc chờ nghiệm thu';
  else if (activePhysical?.status === BookingStatus.RETURNED_PENDING_INSPECTION) unavailableReason = 'Chiếc máy đang chờ nghiệm thu';
  else if (activePhysical && activePhysical.endDate < parseDay(vietnamDate())) unavailableReason = 'Lịch trả máy cần được nhân viên xác nhận lại';
  else if (unit.status === ItemStatus.RENTED && !activePhysical) unavailableReason = 'Nhân viên cần cập nhật lịch của chiếc máy';
  else if (unit.status === ItemStatus.RESERVED && reservationCount === 0) unavailableReason = 'Nhân viên cần xác nhận thông tin giữ chỗ';
  else if (conflict) unavailableReason = 'Chiếc máy đã có lịch trong khoảng ngày này';
  const rentalFee = dates.days * unit.product.dailyRentalRate;
  const totalAmount = rentalFee + unit.depositAmount;
  if (unit.product.dailyRentalRate <= 0 || unit.depositAmount < 0 || !Number.isSafeInteger(totalAmount) || totalAmount > 50_000_000) unavailableReason = 'Giá thuê hoặc mức cọc cần được cập nhật';
  const quoteHash = crypto.createHash('sha256').update(JSON.stringify([unit.id, startDate, endDate, unit.product.dailyRentalRate, unit.depositAmount, policy.version, policy.returnBufferDays])).digest('hex');
  return { unit, policy, dates, view: {
    cameraItemId: unitId, serialNumber: unit.serialNumber, startDate, endDate, totalDays: dates.days,
    dailyRate: unit.product.dailyRentalRate, rentalFee, depositAmount: unit.depositAmount, totalAmount,
    returnBufferDays: policy.returnBufferDays, blockedUntil: dateKey(blockedUntil), available: unavailableReason === null,
    unavailableReason, policyVersion: policy.version, terms: policy.terms, cancellationRefund: policy.cancellationRefund,
    quoteHash, checkedAt: new Date().toISOString()
  } };
}

export async function getUnitCalendar(db: Database, unitId: number, from: string, to: string) {
  const start = parseDay(from), end = parseDay(to);
  if (end <= start || end.getTime() - start.getTime() > 120 * DAY_MS) throw new PaymentFlowError('Khoảng lịch cần từ 1 đến 120 ngày');
  const unit = await db.cameraItem.findUnique({ where: { id: unitId }, select: { id: true, serialNumber: true, status: true, product: { select: { isPublished: true } } } });
  if (!unit || !unit.product.isPublished) throw new PaymentFlowError('Không tìm thấy chiếc máy', 404);
  const allocations = await db.rentalAllocation.findMany({
    where: { cameraItemId: unitId, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } },
    select: { startDate: true, endDate: true, kind: true }, orderBy: { startDate: 'asc' }
  });
  return { cameraItemId: unitId, status: unit.status, ranges: allocations.map(a => ({ startDate: dateKey(a.startDate), endDate: dateKey(a.endDate), kind: a.kind === 'BLOCK' ? 'BLOCKED' : 'RESERVED' })), checkedAt: new Date().toISOString() };
}

export async function refreshUnitStatus(tx: Prisma.TransactionClient, unitId: number) {
  const unit = await tx.cameraItem.findUnique({ where: { id: unitId } });
  if (!unit || unit.status === ItemStatus.SOLD || unit.status === ItemStatus.MAINTENANCE) return;
  const today = parseDay(vietnamDate());
  const active = await tx.rentalBooking.findFirst({ where: { cameraItemId: unitId, status: BookingStatus.ACTIVE_RENTAL } });
  const current = !active && await tx.rentalBooking.findFirst({ where: { cameraItemId: unitId, status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED] }, startDate: { lte: today }, endDate: { gte: today } } });
  await tx.cameraItem.update({ where: { id: unitId }, data: { status: active ? ItemStatus.RENTED : current ? ItemStatus.RESERVED : ItemStatus.AVAILABLE } });
}
