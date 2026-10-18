ALTER TABLE "calendar_events" ADD COLUMN "campusId" TEXT;

CREATE INDEX "calendar_events_institutionId_campusId_startDate_idx"
  ON "calendar_events"("institutionId", "campusId", "startDate");

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_campusId_fkey"
  FOREIGN KEY ("campusId") REFERENCES "campuses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
