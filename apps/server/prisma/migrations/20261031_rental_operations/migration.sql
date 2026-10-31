ALTER TYPE "DepositStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
CREATE TYPE "RefundStatus" AS ENUM ('CREATING', 'PENDING', 'SUCCEEDED', 'FAILED', 'REVIEW');

BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "RentalBooking"
  ADD COLUMN "policySnapshot" JSONB,
  ADD COLUMN "returnBufferDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "handoverAt" TIMESTAMP(3),
  ADD COLUMN "handoverRecord" JSONB,
  ADD COLUMN "returnedAt" TIMESTAMP(3),
  ADD COLUMN "inspectedAt" TIMESTAMP(3),
  ADD COLUMN "returnRecord" JSONB,
  ADD COLUMN "deductionAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deductionReason" TEXT,
  ADD COLUMN "deductionDecision" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "deductionAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "cancellationNote" TEXT,
  ADD CONSTRAINT "RentalBooking_deposit_bounds" CHECK ("depositAmount" >= 0 AND "deductionAmount" >= 0 AND "deductionAmount" <= "depositAmount"),
  ADD CONSTRAINT "RentalBooking_buffer_bounds" CHECK ("returnBufferDays" BETWEEN 0 AND 3),
  ADD CONSTRAINT "RentalBooking_deduction_decision" CHECK ("deductionDecision" IN ('NONE','PENDING','ACCEPTED','REJECTED'));
ALTER TABLE "PaymentAttempt" ADD COLUMN "merchantAppId" INTEGER;

CREATE TABLE "RentalPolicy" (
  "id" TEXT NOT NULL DEFAULT 'rental',
  "version" INTEGER NOT NULL DEFAULT 1,
  "returnBufferDays" INTEGER NOT NULL DEFAULT 1,
  "cancellationRefund" TEXT NOT NULL DEFAULT 'FULL_PAYMENT',
  "terms" TEXT NOT NULL,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentalPolicy_bounds" CHECK ("version" > 0 AND "returnBufferDays" BETWEEN 0 AND 3 AND "cancellationRefund" IN ('FULL_PAYMENT','DEPOSIT_ONLY'))
);
INSERT INTO "RentalPolicy" ("id","terms","updatedAt") VALUES (
  'rental',
  'Tiền cọc được cấu hình riêng cho từng chiếc máy, không giảm theo eKYC. Tiền thuê tính theo chênh lệch ngày nhận và ngày trả. Khi nhận và trả máy, khách và nhân viên đối chiếu thiết bị, tình trạng và phụ kiện trong biên bản. Sau khi nhận lại máy, Filmiliar nghiệm thu; khoản khấu trừ phải có lý do và được khách chấp thuận. Hoàn tiền về giao dịch ZaloPay ban đầu; thời điểm tiền về phụ thuộc quá trình xử lý của ZaloPay và nguồn thanh toán.',
  CURRENT_TIMESTAMP
);

CREATE TABLE "RentalAllocation" (
  "id" TEXT NOT NULL,
  "cameraItemId" INTEGER NOT NULL,
  "bookingId" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'BOOKING',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "actorId" TEXT,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentalAllocation_cameraItemId_fkey" FOREIGN KEY ("cameraItemId") REFERENCES "CameraItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RentalAllocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RentalAllocation_valid_period" CHECK ("startDate" < "endDate"),
  CONSTRAINT "RentalAllocation_kind" CHECK (("kind"='BOOKING' AND "bookingId" IS NOT NULL) OR ("kind"='BLOCK' AND "bookingId" IS NULL)),
  CONSTRAINT "RentalAllocation_no_overlap" EXCLUDE USING gist (
    "cameraItemId" WITH =, tsrange("startDate","endDate",'[)') WITH &&
  ) WHERE ("releasedAt" IS NULL)
);
CREATE UNIQUE INDEX "RentalAllocation_bookingId_key" ON "RentalAllocation"("bookingId");
CREATE INDEX "RentalAllocation_cameraItemId_startDate_endDate_idx" ON "RentalAllocation"("cameraItemId","startDate","endDate");

CREATE FUNCTION filmiliar_allocation_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(27187, NEW."cameraItemId");
  IF TG_OP='UPDATE' AND OLD."cameraItemId" <> NEW."cameraItemId" THEN
    RAISE EXCEPTION 'Allocation cannot change physical unit';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "RentalAllocation_lock" BEFORE INSERT OR UPDATE ON "RentalAllocation" FOR EACH ROW EXECUTE FUNCTION filmiliar_allocation_lock();

CREATE FUNCTION filmiliar_booking_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD."cameraItemId" <> NEW."cameraItemId" THEN
    RAISE EXCEPTION 'Booking cannot change physical unit';
  END IF;
  PERFORM pg_advisory_xact_lock(27187, NEW."cameraItemId");
  IF NEW."status"::text IN ('COMPLETED','CANCELLED') THEN
    UPDATE "RentalAllocation" SET "releasedAt"=COALESCE("releasedAt",CURRENT_TIMESTAMP),"updatedAt"=CURRENT_TIMESTAMP WHERE "bookingId"=NEW."id";
  ELSE
    INSERT INTO "RentalAllocation" ("id","cameraItemId","bookingId","kind","startDate","endDate","updatedAt")
    VALUES (gen_random_uuid()::text,NEW."cameraItemId",NEW."id",'BOOKING',NEW."startDate",NEW."endDate"+make_interval(days=>NEW."returnBufferDays"),CURRENT_TIMESTAMP)
    ON CONFLICT ("bookingId") DO UPDATE SET "startDate"=EXCLUDED."startDate","endDate"=EXCLUDED."endDate","releasedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "RentalBooking_allocation" AFTER INSERT OR UPDATE OF "status","startDate","endDate","cameraItemId","returnBufferDays" ON "RentalBooking" FOR EACH ROW EXECUTE FUNCTION filmiliar_booking_allocation();
INSERT INTO "RentalAllocation" ("id","cameraItemId","bookingId","kind","startDate","endDate","updatedAt")
SELECT gen_random_uuid()::text,"cameraItemId","id",'BOOKING',"startDate","endDate",CURRENT_TIMESTAMP
FROM "RentalBooking" WHERE "status" NOT IN ('COMPLETED','CANCELLED');

CREATE TABLE "RefundAttempt" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "activeBookingId" TEXT,
  "clientRequestId" TEXT NOT NULL,
  "mRefundId" TEXT NOT NULL,
  "providerTxnId" TEXT NOT NULL,
  "providerRefundId" TEXT,
  "merchantAppId" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "purpose" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'CREATING',
  "requestedById" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastQueriedAt" TIMESTAMP(3),
  "lastReturnCode" INTEGER,
  "lastSubReturnCode" INTEGER,
  "reviewReason" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundAttempt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RefundAttempt_amount" CHECK ("amount">0),
  CONSTRAINT "RefundAttempt_purpose" CHECK ("purpose" IN ('DEPOSIT','CANCELLATION'))
);
CREATE UNIQUE INDEX "RefundAttempt_activeBookingId_key" ON "RefundAttempt"("activeBookingId");
CREATE UNIQUE INDEX "RefundAttempt_mRefundId_key" ON "RefundAttempt"("mRefundId");
CREATE UNIQUE INDEX "RefundAttempt_bookingId_clientRequestId_key" ON "RefundAttempt"("bookingId","clientRequestId");
CREATE INDEX "RefundAttempt_status_lastQueriedAt_idx" ON "RefundAttempt"("status","lastQueriedAt");

CREATE TABLE "RentalEvent" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "requestId" TEXT,
  "payloadHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentalEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentalEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RentalEvent_bookingId_createdAt_idx" ON "RentalEvent"("bookingId","createdAt");
CREATE UNIQUE INDEX "RentalEvent_requestId_key" ON "RentalEvent"("requestId");
COMMIT;
