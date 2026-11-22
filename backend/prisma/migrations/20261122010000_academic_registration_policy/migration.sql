-- Institution-configured registration and withdrawal windows.
ALTER TABLE "academic_years"
  ADD COLUMN "registrationOpensAt" TIMESTAMP(3),
  ADD COLUMN "registrationClosesAt" TIMESTAMP(3),
  ADD COLUMN "addDropDeadline" TIMESTAMP(3),
  ADD COLUMN "withdrawalDeadline" TIMESTAMP(3),
  ADD COLUMN "exceptionalWithdrawalAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "exceptionalWithdrawalStartsAt" TIMESTAMP(3),
  ADD COLUMN "exceptionalWithdrawalEndsAt" TIMESTAMP(3);

-- Keep approved registrations active until a formal withdrawal decision.
CREATE TABLE "course_withdrawal_requests" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_withdrawal_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_withdrawal_requests_registrationId_attemptNumber_key"
  ON "course_withdrawal_requests"("registrationId", "attemptNumber");
CREATE INDEX "course_withdrawal_requests_institutionId_status_requestedAt_idx"
  ON "course_withdrawal_requests"("institutionId", "status", "requestedAt");
CREATE INDEX "course_withdrawal_requests_registrationId_status_idx"
  ON "course_withdrawal_requests"("registrationId", "status");
CREATE INDEX "course_withdrawal_requests_studentId_status_idx"
  ON "course_withdrawal_requests"("studentId", "status");

ALTER TABLE "course_withdrawal_requests"
  ADD CONSTRAINT "course_withdrawal_requests_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_withdrawal_requests"
  ADD CONSTRAINT "course_withdrawal_requests_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "course_registrations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_withdrawal_requests"
  ADD CONSTRAINT "course_withdrawal_requests_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_withdrawal_requests"
  ADD CONSTRAINT "course_withdrawal_requests_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
