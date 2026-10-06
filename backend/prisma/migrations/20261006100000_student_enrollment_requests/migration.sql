-- ACADLYX: canonical persisted student academic enrollment requests
CREATE TABLE "student_enrollment_requests" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "semesterId" TEXT NOT NULL,
  "sectionId" TEXT,
  "requestedById" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "correctionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_enrollment_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_enrollment_requests_studentId_academicYearId_key" ON "student_enrollment_requests"("studentId","academicYearId");
CREATE INDEX "student_enrollment_requests_institutionId_status_createdAt_idx" ON "student_enrollment_requests"("institutionId","status","createdAt");
CREATE INDEX "student_enrollment_requests_institutionId_programId_academicYearId_semesterId_status_idx" ON "student_enrollment_requests"("institutionId","programId","academicYearId","semesterId","status");
CREATE INDEX "student_enrollment_requests_studentId_status_idx" ON "student_enrollment_requests"("studentId","status");
CREATE INDEX "student_enrollment_requests_sectionId_status_idx" ON "student_enrollment_requests"("sectionId","status");
ALTER TABLE "student_enrollment_requests" ADD CONSTRAINT "student_enrollment_requests_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_enrollment_requests" ADD CONSTRAINT "student_enrollment_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_enrollment_requests" ADD CONSTRAINT "student_enrollment_requests_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_enrollment_requests" ADD CONSTRAINT "student_enrollment_requests_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_enrollment_requests" ADD CONSTRAINT "student_enrollment_requests_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_enrollment_requests" ADD CONSTRAINT "student_enrollment_requests_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_enrollment_requests" ADD CONSTRAINT "student_enrollment_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_enrollment_requests" ADD CONSTRAINT "student_enrollment_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
