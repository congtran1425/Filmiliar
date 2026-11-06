import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { PrismaClient, Prisma } from '@prisma/client';
import { APPROVED_RULES, APPROVED_TERMS, POLICY_RELEASE } from '../dist/services/approved-policy.js';

const prisma = new PrismaClient();
type Entry = { slug: string; serialNumber: string; shutterCount: number; conditionGrade: string; sensorInspection: string; opticsCondition: string; scratchNotes: string; depositAmount: number; passport: Prisma.InputJsonObject };
const entries: Entry[] = JSON.parse(readFileSync('apps/server/prisma/data/approved-passports.json', 'utf8'));
try {
  for (const entry of entries) {
    const passport = entry.passport as Record<string, any>;
    if (!entry.serialNumber.startsWith('SIM-') || passport.kind !== 'SIMULATED' || entry.depositAmount !== Math.round(passport.referenceValue * passport.depositPercent / 100)) throw new Error('Invalid approved passport or deposit');
    if (passport.overallPercent !== Math.round(passport.parts.reduce((sum: number, part: { percent: number }) => sum + part.percent, 0) / passport.parts.length)) throw new Error('Incorrect overall condition');
    if (!await prisma.product.findUnique({ where: { slug: entry.slug } })) throw new Error('Missing catalog model: '+entry.slug);
  }
  console.log(JSON.stringify({ release: POLICY_RELEASE, serials: entries.map(e => e.serialNumber), apply: process.argv.includes('--apply') }));
  if (process.argv.includes('--apply')) await prisma.$transaction(async tx => {
    const policy = await tx.rentalPolicy.findUniqueOrThrow({ where: { id: 'rental' } });
    if (policy.terms !== APPROVED_TERMS || policy.cancellationRefund !== 'TIMED' || !isDeepStrictEqual(policy.rules, APPROVED_RULES)) {
      await tx.rentalPolicy.update({ where: { id: 'rental' }, data: { terms: APPROVED_TERMS, rules: APPROVED_RULES, cancellationRefund: 'TIMED', version: { increment: 1 } } });
    }
    for (const entry of entries) {
      const { slug, ...data } = entry;
      const product = await tx.product.findUniqueOrThrow({ where: { slug } });
      const existing = await tx.cameraItem.findUnique({ where: { serialNumber: entry.serialNumber } });
      if (existing && existing.modelId !== product.id) throw new Error('Serial belongs to another model');
      if (existing && (existing.passport as { kind?: string } | null)?.kind !== 'SIMULATED') throw new Error('Refusing to overwrite an unrelated unit record');
      const changed = !existing || Object.entries(data).some(([k,v]) => !isDeepStrictEqual(existing[k as keyof typeof existing], v));
      if (changed && existing && await tx.rentalBooking.count({ where: { cameraItemId: existing.id, status: { notIn: ['COMPLETED','CANCELLED'] } } })) throw new Error('Unit has an active booking; review before updating');
      if (changed) await tx.cameraItem.upsert({ where: { serialNumber: entry.serialNumber }, create: { ...data, modelId: product.id }, update: data });
    }
  });
  console.log('Approved policy and exact-serial passports checked.');
} finally { await prisma.$disconnect(); }
