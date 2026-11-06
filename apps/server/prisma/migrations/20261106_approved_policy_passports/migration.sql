ALTER TABLE "CameraItem" ADD COLUMN "passport" JSONB;
ALTER TABLE "RentalPolicy" ADD COLUMN "rules" JSONB;
ALTER TABLE "RentalPolicy" DROP CONSTRAINT "RentalPolicy_bounds";
ALTER TABLE "RentalPolicy" ADD CONSTRAINT "RentalPolicy_bounds" CHECK (
  "version" > 0 AND "returnBufferDays" BETWEEN 0 AND 3 AND
  "cancellationRefund" IN ('FULL_PAYMENT','DEPOSIT_ONLY','TIMED')
);
ALTER TABLE "RentalBooking"
  ADD COLUMN "pickupAt" TIMESTAMP(3),
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationCause" TEXT,
  ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "RentalBooking_schedule_bounds" CHECK (
    ("pickupAt" IS NULL AND "dueAt" IS NULL) OR ("pickupAt" IS NOT NULL AND "dueAt" IS NOT NULL AND "dueAt" > "pickupAt")
  ),
  ADD CONSTRAINT "RentalBooking_reschedule_bounds" CHECK ("rescheduleCount" BETWEEN 0 AND 1),
  ADD CONSTRAINT "RentalBooking_cancellation_cause" CHECK ("cancellationCause" IS NULL OR "cancellationCause" IN ('CUSTOMER','STORE'));
ALTER TABLE "Order" ALTER COLUMN "warrantyMonths" SET DEFAULT 3;

CREATE OR REPLACE FUNCTION filmiliar_booking_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD."cameraItemId" <> NEW."cameraItemId" THEN
    RAISE EXCEPTION 'Booking cannot change physical unit';
  END IF;
  PERFORM pg_advisory_xact_lock(27187, NEW."cameraItemId");
  IF NEW."status"::text IN ('COMPLETED','CANCELLED') THEN
    UPDATE "RentalAllocation" SET "releasedAt"=COALESCE("releasedAt",CURRENT_TIMESTAMP),"updatedAt"=CURRENT_TIMESTAMP WHERE "bookingId"=NEW."id";
  ELSE
    INSERT INTO "RentalAllocation" ("id","cameraItemId","bookingId","kind","startDate","endDate","updatedAt")
    VALUES (gen_random_uuid()::text,NEW."cameraItemId",NEW."id",'BOOKING',COALESCE(NEW."pickupAt",NEW."startDate"),COALESCE(NEW."dueAt",NEW."endDate")+make_interval(days=>NEW."returnBufferDays"),CURRENT_TIMESTAMP)
    ON CONFLICT ("bookingId") DO UPDATE SET "startDate"=EXCLUDED."startDate","endDate"=EXCLUDED."endDate","releasedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER "RentalBooking_allocation" ON "RentalBooking";
CREATE TRIGGER "RentalBooking_allocation" AFTER INSERT OR UPDATE OF "status","startDate","endDate","cameraItemId","returnBufferDays","pickupAt","dueAt" ON "RentalBooking" FOR EACH ROW EXECUTE FUNCTION filmiliar_booking_allocation();
