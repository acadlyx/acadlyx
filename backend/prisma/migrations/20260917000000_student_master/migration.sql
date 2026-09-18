-- Student master and explicit semester enrollment
CREATE TABLE "student_profiles" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "admissionNumber" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3),
  "gender" TEXT,
  "bloodGroup" TEXT,
  "nationality" TEXT,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "postalCode" TEXT,
  "guardianName" TEXT,
  "guardianPhone" TEXT,
  "guardianEmail" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "admissionDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_profiles_userId_key"
  ON "student_profiles"("userId");

CREATE UNIQUE INDEX "student_profiles_institutionId_admissionNumber_key"
  ON "student_profiles"("institutionId", "admissionNumber");

CREATE INDEX "student_profiles_institutionId_status_idx"
  ON "student_profiles"("institutionId", "status");

CREATE INDEX "student_profiles_institutionId_userId_idx"
  ON "student_profiles"("institutionId", "userId");

ALTER TABLE "student_profiles"
  ADD CONSTRAINT "student_profiles_institutionId_fkey"
  FOREIGN KEY ("institutionId")
  REFERENCES "institutions"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "student_profiles"
  ADD CONSTRAINT "student_profiles_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "student_enrollments"
  ADD COLUMN "semesterId" TEXT;

CREATE INDEX "student_enrollments_semesterId_idx"
  ON "student_enrollments"("semesterId");

ALTER TABLE "student_enrollments"
  ADD CONSTRAINT "student_enrollments_semesterId_fkey"
  FOREIGN KEY ("semesterId")
  REFERENCES "semesters"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
