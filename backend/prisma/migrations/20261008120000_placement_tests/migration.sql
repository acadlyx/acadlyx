-- Placement assessment/test lifecycle. Tests are institution-scoped and linked to a drive.
CREATE TABLE IF NOT EXISTS "placement_tests" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "driveId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'ONLINE',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER,
  "maxScore" DOUBLE PRECISION,
  "testLink" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "instructions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_tests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "placement_tests_institutionId_scheduledAt_status_idx"
  ON "placement_tests"("institutionId","scheduledAt","status");
CREATE INDEX IF NOT EXISTS "placement_tests_institutionId_driveId_idx"
  ON "placement_tests"("institutionId","driveId");

CREATE TABLE IF NOT EXISTS "placement_test_participants" (
  "testId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "attendanceStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "resultStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "score" DOUBLE PRECISION,
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_test_participants_pkey" PRIMARY KEY ("testId","studentId")
);
CREATE INDEX IF NOT EXISTS "placement_test_participants_studentId_resultStatus_idx"
  ON "placement_test_participants"("studentId","resultStatus");

ALTER TABLE "placement_tests"
  ADD CONSTRAINT "placement_tests_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_tests"
  ADD CONSTRAINT "placement_tests_driveId_fkey"
  FOREIGN KEY ("driveId") REFERENCES "placement_drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_test_participants"
  ADD CONSTRAINT "placement_test_participants_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "placement_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_test_participants"
  ADD CONSTRAINT "placement_test_participants_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
