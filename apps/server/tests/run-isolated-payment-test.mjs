import { spawnSync } from 'node:child_process';

const original = process.env.DATABASE_URL || (process.env.FILMILIAR_DB_PASSWORD
  ? `postgresql://filmiliar:${encodeURIComponent(process.env.FILMILIAR_DB_PASSWORD)}@db:5432/filmiliar?schema=public`
  : undefined);
if (!original) throw new Error('DATABASE_URL missing');
const url = new URL(original);
if (url.pathname !== '/filmiliar') throw new Error('Expected the Filmiliar database connection');
url.pathname = '/filmiliar_payment_test';
process.env.DATABASE_URL = url.toString();
process.env.PAYMENT_TEST_DATABASE_URL = url.toString();

for (const [command, args] of [
  ['npx', ['prisma', 'migrate', 'deploy', '--schema=apps/server/prisma/schema.prisma']],
  ['node', ['--test', 'apps/server/tests/payment-flow.integration.test.mjs']],
  ['node', ['--test', 'apps/server/tests/admin-routes.integration.test.mjs']]
]) {
  const result = spawnSync(command, args, { env: process.env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
