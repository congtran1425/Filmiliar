CREATE TABLE "RentalBundle" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "RentalBundle_code_key" ON "RentalBundle"("code");
CREATE INDEX "RentalBundle_userId_createdAt_idx" ON "RentalBundle"("userId","createdAt");
ALTER TABLE "RentalBooking" ADD COLUMN "bundleId" TEXT REFERENCES "RentalBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "RentalBooking_bundleId_cameraItemId_key" ON "RentalBooking"("bundleId","cameraItemId");

CREATE FUNCTION filmiliar_bundle_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_booking "RentalBooking"%ROWTYPE;
BEGIN
  SELECT * INTO current_booking FROM "RentalBooking" WHERE "id"=NEW."id";
  IF NOT FOUND OR current_booking."bundleId" IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM "RentalBundle" WHERE "id"=current_booking."bundleId" AND "userId"=current_booking."userId")
    OR EXISTS (SELECT 1 FROM "RentalBooking" b WHERE b."bundleId"=current_booking."bundleId" AND
      (b."userId"<>current_booking."userId" OR b."startDate"<>current_booking."startDate" OR b."endDate"<>current_booking."endDate"
       OR b."pickupAt" IS DISTINCT FROM current_booking."pickupAt" OR b."dueAt" IS DISTINCT FROM current_booking."dueAt"
       OR b."totalDays"<>current_booking."totalDays" OR b."returnBufferDays"<>current_booking."returnBufferDays"
       OR b."rescheduleCount"<>current_booking."rescheduleCount")) THEN
    RAISE EXCEPTION 'Rental bundle must keep the same owner and schedule' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "RentalBooking_bundle_schedule" AFTER INSERT OR UPDATE ON "RentalBooking"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION filmiliar_bundle_schedule();
