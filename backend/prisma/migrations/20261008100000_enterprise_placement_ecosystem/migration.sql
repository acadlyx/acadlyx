-- Enterprise placement domain. All tables are institution-scoped.
ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "placementDriveId" TEXT,
  ADD COLUMN IF NOT EXISTS "placementOpeningId" TEXT;

CREATE TABLE IF NOT EXISTS "placement_companies" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "industry" TEXT,
  "companyType" TEXT,
  "website" TEXT,
  "description" TEXT,
  "headquarters" TEXT,
  "relationshipStatus" TEXT NOT NULL DEFAULT 'PROSPECT',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "placement_companies_institutionId_name_key" ON "placement_companies"("institutionId","name");
CREATE INDEX IF NOT EXISTS "placement_companies_institutionId_relationshipStatus_idx" ON "placement_companies"("institutionId","relationshipStatus");

CREATE TABLE IF NOT EXISTS "placement_company_contacts" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "designation" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_company_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "placement_company_contacts_institutionId_companyId_idx" ON "placement_company_contacts"("institutionId","companyId");

CREATE TABLE IF NOT EXISTS "placement_openings" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "description" TEXT,
  "employmentType" TEXT,
  "location" TEXT,
  "totalCtc" DECIMAL(12,2),
  "fixedCtc" DECIMAL(12,2),
  "variableCtc" DECIMAL(12,2),
  "bonus" DECIMAL(12,2),
  "stipend" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "packagePeriod" TEXT,
  "requiredSkills" JSONB,
  "eligibility" JSONB,
  "hiringBatchIds" JSONB,
  "deadline" TIMESTAMP(3),
  "applicationProcess" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_openings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "placement_openings_institutionId_companyId_deadline_idx" ON "placement_openings"("institutionId","companyId","deadline");

CREATE TABLE IF NOT EXISTS "placement_drives" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "campusId" TEXT,
  "openingId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "applicationDeadline" TIMESTAMP(3),
  "driveDate" TIMESTAMP(3),
  "venue" TEXT,
  "onlineLink" TEXT,
  "cgpaRequirement" DOUBLE PRECISION,
  "maxBacklogs" INTEGER,
  "vacancies" INTEGER,
  "eligiblePrograms" JSONB,
  "eligibleDepartments" JSONB,
  "eligibleBatches" JSONB,
  "eligibleSemesters" JSONB,
  "academicRequirements" JSONB,
  "requiredSkills" JSONB,
  "recruiterId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_drives_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "placement_drives_institutionId_status_applicationDeadline_idx" ON "placement_drives"("institutionId","status","applicationDeadline");
CREATE INDEX IF NOT EXISTS "placement_drives_institutionId_companyId_driveDate_idx" ON "placement_drives"("institutionId","companyId","driveDate");

CREATE TABLE IF NOT EXISTS "placement_visits" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "driveId" TEXT,
  "type" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "venue" TEXT,
  "purpose" TEXT,
  "representatives" JSONB,
  "participatingStudentIds" JSONB,
  "notes" TEXT,
  "followUp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_visits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "placement_visits_institutionId_startsAt_idx" ON "placement_visits"("institutionId","startsAt");
CREATE INDEX IF NOT EXISTS "placement_visits_institutionId_companyId_idx" ON "placement_visits"("institutionId","companyId");

CREATE TABLE IF NOT EXISTS "placement_interviews" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "driveId" TEXT NOT NULL,
  "roundNumber" INTEGER NOT NULL,
  "roundType" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "venue" TEXT,
  "onlineLink" TEXT,
  "interviewer" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_interviews_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "placement_interviews_driveId_roundNumber_key" ON "placement_interviews"("driveId","roundNumber");
CREATE INDEX IF NOT EXISTS "placement_interviews_institutionId_startsAt_idx" ON "placement_interviews"("institutionId","startsAt");

CREATE TABLE IF NOT EXISTS "placement_interview_participants" (
  "interviewId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "attendanceStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "resultStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_interview_participants_pkey" PRIMARY KEY ("interviewId","studentId")
);
CREATE INDEX IF NOT EXISTS "placement_interview_participants_studentId_idx" ON "placement_interview_participants"("studentId");

CREATE TABLE IF NOT EXISTS "placement_offers" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OFFERED',
  "totalCtc" DECIMAL(12,2),
  "fixedCtc" DECIMAL(12,2),
  "variableCtc" DECIMAL(12,2),
  "bonus" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "offerDate" TIMESTAMP(3) NOT NULL,
  "acceptanceAt" TIMESTAMP(3),
  "joiningDate" TIMESTAMP(3),
  "joiningStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "joiningVerifiedAt" TIMESTAMP(3),
  "joiningVerifiedById" TEXT,
  "offerDocumentUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_offers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "placement_offers_institutionId_studentId_status_idx" ON "placement_offers"("institutionId","studentId","status");
CREATE INDEX IF NOT EXISTS "placement_offers_institutionId_companyId_idx" ON "placement_offers"("institutionId","companyId");

CREATE TABLE IF NOT EXISTS "placement_profiles" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "portfolioUrl" TEXT,
  "githubUrl" TEXT,
  "linkedInUrl" TEXT,
  "otherLinks" JSONB,
  "placementStatus" TEXT NOT NULL DEFAULT 'SEEKING',
  "bio" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "placement_profiles_studentId_key" ON "placement_profiles"("studentId");
CREATE INDEX IF NOT EXISTS "placement_profiles_institutionId_placementStatus_idx" ON "placement_profiles"("institutionId","placementStatus");

CREATE TABLE IF NOT EXISTS "placement_certifications" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "issuedAt" TIMESTAMP(3),
  "credentialUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_certifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "placement_certifications_institutionId_studentId_idx" ON "placement_certifications"("institutionId","studentId");

CREATE TABLE IF NOT EXISTS "placement_projects" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "technologies" JSONB,
  "projectUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_projects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "placement_projects_institutionId_studentId_idx" ON "placement_projects"("institutionId","studentId");

CREATE TABLE IF NOT EXISTS "placement_resumes" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileName" TEXT,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "placement_resumes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "placement_resumes_institutionId_studentId_isCurrent_idx" ON "placement_resumes"("institutionId","studentId","isCurrent");

CREATE INDEX IF NOT EXISTS "applications_institutionId_placementDriveId_status_idx" ON "applications"("institutionId","placementDriveId","status");
CREATE INDEX IF NOT EXISTS "applications_institutionId_placementOpeningId_status_idx" ON "applications"("institutionId","placementOpeningId","status");

ALTER TABLE "placement_companies" ADD CONSTRAINT "placement_companies_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_companies" ADD CONSTRAINT "placement_companies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "placement_company_contacts" ADD CONSTRAINT "placement_company_contacts_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_company_contacts" ADD CONSTRAINT "placement_company_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "placement_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_openings" ADD CONSTRAINT "placement_openings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_openings" ADD CONSTRAINT "placement_openings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "placement_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "placement_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "placement_openings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "placement_visits" ADD CONSTRAINT "placement_visits_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_visits" ADD CONSTRAINT "placement_visits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "placement_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "placement_visits" ADD CONSTRAINT "placement_visits_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "placement_drives"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "placement_interviews" ADD CONSTRAINT "placement_interviews_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_interviews" ADD CONSTRAINT "placement_interviews_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "placement_drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_interview_participants" ADD CONSTRAINT "placement_interview_participants_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "placement_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_interview_participants" ADD CONSTRAINT "placement_interview_participants_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "placement_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "placement_profiles" ADD CONSTRAINT "placement_profiles_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_profiles" ADD CONSTRAINT "placement_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_certifications" ADD CONSTRAINT "placement_certifications_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_certifications" ADD CONSTRAINT "placement_certifications_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_projects" ADD CONSTRAINT "placement_projects_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_projects" ADD CONSTRAINT "placement_projects_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_resumes" ADD CONSTRAINT "placement_resumes_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_resumes" ADD CONSTRAINT "placement_resumes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "applications" ADD CONSTRAINT "applications_placementDriveId_fkey" FOREIGN KEY ("placementDriveId") REFERENCES "placement_drives"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_placementOpeningId_fkey" FOREIGN KEY ("placementOpeningId") REFERENCES "placement_openings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
