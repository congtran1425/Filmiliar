import 'dotenv/config';
import { PrismaClient, Role, KycStatus } from '@prisma/client';
import { hashPassword } from './auth.js';

async function readPassword(): Promise<string> {
  let value = '';
  for await (const chunk of process.stdin) value += chunk.toString();
  return value.replace(/[\r\n]+$/, '');
}

async function main() {
  const [emailArg, roleArg, ...nameParts] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const role = roleArg === 'ADMIN' ? Role.ADMIN : roleArg === 'CUSTOMER' ? Role.CUSTOMER : null;
  const fullName = nameParts.join(' ').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !role || fullName.length < 2) {
    throw new Error('Usage: node provision-user.js <email> <ADMIN|CUSTOMER> <full name>; pipe password through stdin');
  }
  const password = await readPassword();
  if (password.length < 20 || password.length > 128) throw new Error('Provisioning password must be 20-128 characters');
  const prisma = new PrismaClient();
  try {
    if (await prisma.user.findUnique({ where: { email } })) throw new Error('User already exists; provisioning will not overwrite it');
    await prisma.user.create({
      data: { email, fullName, role, kycStatus: KycStatus.UNVERIFIED, passwordHash: hashPassword(password) }
    });
    console.log('User provisioned');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Provisioning failed');
  process.exitCode = 1;
});
