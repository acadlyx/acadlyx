-- Existing placement events remain published for backward compatibility.
ALTER TABLE "placement_visits"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PUBLISHED';
CREATE INDEX "placement_visits_institutionId_status_startsAt_idx"
  ON "placement_visits"("institutionId", "status", "startsAt");
