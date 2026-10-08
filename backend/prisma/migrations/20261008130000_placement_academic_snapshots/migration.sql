-- Authoritative academic snapshot consumed by placement eligibility.
-- Values must be written by trusted academic/placement services, never by student profile updates.
CREATE TABLE IF NOT EXISTS "placement_academic_snapshots" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "cgpa" DOUBLE PRECISION,
  "backlogCount" INTEGER,
  "academicStatus" TEXT,
  "graduationEligible" BOOLEAN,
  "sourceUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_academic_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "placement_academic_snapshots_studentId_key" ON "placement_academic_snapshots"("studentId");
CREATE INDEX IF NOT EXISTS "placement_academic_snapshots_institutionId_cgpa_idx" ON "placement_academic_snapshots"("institutionId","cgpa");
CREATE INDEX IF NOT EXISTS "placement_academic_snapshots_institutionId_backlogCount_idx" ON "placement_academic_snapshots"("institutionId","backlogCount");
CREATE INDEX IF NOT EXISTS "placement_academic_snapshots_institutionId_academicStatus_idx" ON "placement_academic_snapshots"("institutionId","academicStatus");
ALTER TABLE "placement_academic_snapshots"
  ADD CONSTRAINT "placement_academic_snapshots_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_academic_snapshots"
  ADD CONSTRAINT "placement_academic_snapshots_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
