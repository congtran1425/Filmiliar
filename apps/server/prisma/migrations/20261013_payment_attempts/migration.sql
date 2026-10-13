ALTER TYPE "ItemStatus" ADD VALUE IF NOT EXISTS 'RESERVED';

CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATING', 'WAITING', 'PAID', 'FAILED', 'REVIEW');

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "appTransId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATING',
    "qrCode" TEXT,
    "orderUrl" TEXT,
    "providerTxnId" TEXT,
    "reviewReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastQueriedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentAttempt_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "PaymentAttempt_bookingId_key" ON "PaymentAttempt"("bookingId");
CREATE UNIQUE INDEX "PaymentAttempt_appTransId_key" ON "PaymentAttempt"("appTransId");
CREATE UNIQUE INDEX "PaymentAttempt_providerTxnId_key" ON "PaymentAttempt"("providerTxnId");
CREATE UNIQUE INDEX "PaymentAttempt_userId_clientRequestId_key" ON "PaymentAttempt"("userId", "clientRequestId");
CREATE INDEX "PaymentAttempt_status_expiresAt_idx" ON "PaymentAttempt"("status", "expiresAt");
CREATE INDEX "PaymentAttempt_userId_createdAt_idx" ON "PaymentAttempt"("userId", "createdAt");

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
