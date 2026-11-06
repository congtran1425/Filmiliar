import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PrismaClient, Prisma } from '@prisma/client';

const databaseUrl = process.env.PAYMENT_TEST_DATABASE_URL;
test('policy import runs as the packaged CLI, supports dry run, is idempotent and protects unrelated serials', {skip:!databaseUrl}, async () => {
  assert.equal(new URL(databaseUrl).pathname,'/filmiliar_payment_test');
  const db = new PrismaClient({datasources:{db:{url:databaseUrl}}});
  const root = fileURLToPath(new URL('../../../',import.meta.url));
  const entries = JSON.parse(readFileSync(new URL('../prisma/data/approved-passports.json',import.meta.url),'utf8'));
  const original = await db.rentalPolicy.findUniqueOrThrow({where:{id:'rental'}});
  const products = [];
  const run = apply => spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','apps/server/prisma/apply-approved-policy.ts',...(apply?['--apply']:[])],{cwd:root,env:{...process.env,DATABASE_URL:databaseUrl},encoding:'utf8',timeout:30000});
  try {
    assert.equal(await db.product.count({where:{slug:{in:entries.map(e=>e.slug)}}}),0,'Fixture models must be isolated');
    for (const entry of entries) products.push(await db.product.create({data:{slug:entry.slug,modelName:entry.slug,brand:'Filmiliar',categoryName:'Camera',weightGrams:400,recommendedPurpose:'Isolated import test',dailyRentalRate:170000,referenceUsedPrice:entry.passport.referenceValue}}));
    let result = run(false);
    assert.equal(result.status,0,result.stderr);
    assert.equal(await db.cameraItem.count({where:{modelId:{in:products.map(p=>p.id)}}}),0);
    assert.equal((await db.rentalPolicy.findUniqueOrThrow({where:{id:'rental'}})).version,original.version);
    result = run(true); assert.equal(result.status,0,result.stderr);
    const policy = await db.rentalPolicy.findUniqueOrThrow({where:{id:'rental'}});
    assert.equal(policy.cancellationRefund,'TIMED'); assert.equal(policy.rules.warrantyMonths,3);
    const units = await db.cameraItem.findMany({where:{modelId:{in:products.map(p=>p.id)}},orderBy:{id:'asc'}});
    assert.equal(units.length,3);
    for (const entry of entries) assert.deepEqual(units.find(u=>u.serialNumber===entry.serialNumber).passport,entry.passport);
    result = run(true); assert.equal(result.status,0,result.stderr);
    assert.deepEqual(await db.cameraItem.findMany({where:{modelId:{in:products.map(p=>p.id)}},orderBy:{id:'asc'}}),units);
    assert.equal((await db.rentalPolicy.findUniqueOrThrow({where:{id:'rental'}})).version,policy.version);
    await db.cameraItem.update({where:{id:units[0].id},data:{passport:Prisma.DbNull}});
    result = run(true); assert.notEqual(result.status,0); assert.match(result.stderr,/Refusing to overwrite an unrelated unit record/);
    assert.equal((await db.cameraItem.findUniqueOrThrow({where:{id:units[0].id}})).passport,null);
  } finally {
    if(products.length) await db.product.deleteMany({where:{id:{in:products.map(p=>p.id)}}});
    await db.rentalPolicy.update({where:{id:'rental'},data:{version:original.version,returnBufferDays:original.returnBufferDays,cancellationRefund:original.cancellationRefund,terms:original.terms,rules:original.rules??Prisma.DbNull}});
    await db.$disconnect();
  }
});
