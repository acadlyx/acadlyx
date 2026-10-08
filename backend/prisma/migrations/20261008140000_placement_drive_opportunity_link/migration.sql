ALTER TABLE "placement_drives" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "placement_drives_opportunityId_key" ON "placement_drives"("opportunityId");
ALTER TABLE "placement_drives"
  ADD CONSTRAINT "placement_drives_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
