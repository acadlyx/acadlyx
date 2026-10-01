CREATE TABLE "programme_outcomes" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "programme_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "programme_outcomes_programId_type_code_key" ON "programme_outcomes"("programId", "type", "code");
CREATE INDEX "programme_outcomes_institutionId_programId_type_idx" ON "programme_outcomes"("institutionId", "programId", "type");

CREATE TABLE "course_outcomes" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "bloomLevel" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_outcomes_courseId_code_key" ON "course_outcomes"("courseId", "code");
CREATE INDEX "course_outcomes_institutionId_courseId_idx" ON "course_outcomes"("institutionId", "courseId");

CREATE TABLE "course_outcome_mappings" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "programmeOutcomeId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_outcome_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_outcome_mappings_courseOutcomeId_programmeOutcomeId_key" ON "course_outcome_mappings"("courseOutcomeId", "programmeOutcomeId");
CREATE INDEX "course_outcome_mappings_institutionId_idx" ON "course_outcome_mappings"("institutionId");
CREATE INDEX "course_outcome_mappings_programmeOutcomeId_idx" ON "course_outcome_mappings"("programmeOutcomeId");

CREATE TABLE "obe_attainment_policies" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT,
    "name" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'INSTITUTION',
    "directWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "indirectWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "level1Threshold" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "level2Threshold" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "level3Threshold" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "minimumPassingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "formulaVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obe_attainment_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obe_attainment_policies_institutionId_isActive_idx" ON "obe_attainment_policies"("institutionId", "isActive");
CREATE INDEX "obe_attainment_policies_programId_idx" ON "obe_attainment_policies"("programId");

CREATE TABLE "obe_assessments" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "weightage" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "assessmentDate" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obe_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obe_assessments_institutionId_courseOfferingId_idx" ON "obe_assessments"("institutionId", "courseOfferingId");
CREATE INDEX "obe_assessments_sourceType_sourceId_idx" ON "obe_assessments"("sourceType", "sourceId");

CREATE TABLE "obe_assessment_items" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obe_assessment_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obe_assessment_items_assessmentId_itemCode_key" ON "obe_assessment_items"("assessmentId", "itemCode");
CREATE INDEX "obe_assessment_items_institutionId_courseOutcomeId_idx" ON "obe_assessment_items"("institutionId", "courseOutcomeId");

CREATE TABLE "obe_assessment_scores" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "assessmentItemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obe_assessment_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obe_assessment_scores_assessmentItemId_studentId_key" ON "obe_assessment_scores"("assessmentItemId", "studentId");
CREATE INDEX "obe_assessment_scores_institutionId_studentId_idx" ON "obe_assessment_scores"("institutionId", "studentId");

CREATE TABLE "obe_indirect_assessments" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION,
    "normalizedScore" DOUBLE PRECISION,
    "weightage" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obe_indirect_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obe_indirect_assessments_institutionId_courseOfferingId_courseOutcomeId_idx" ON "obe_indirect_assessments"("institutionId", "courseOfferingId", "courseOutcomeId");

CREATE TABLE "obe_course_attainments" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "policyId" TEXT,
    "directAttainment" DOUBLE PRECISION,
    "indirectAttainment" DOUBLE PRECISION,
    "finalAttainment" DOUBLE PRECISION,
    "attainmentLevel" INTEGER,
    "studentCount" INTEGER NOT NULL DEFAULT 0,
    "studentsAssessed" INTEGER NOT NULL DEFAULT 0,
    "studentsMeetingTarget" INTEGER NOT NULL DEFAULT 0,
    "calculationStatus" TEXT NOT NULL DEFAULT 'CALCULATED',
    "calculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obe_course_attainments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obe_course_attainments_courseOfferingId_courseOutcomeId_key" ON "obe_course_attainments"("courseOfferingId", "courseOutcomeId");
CREATE INDEX "obe_course_attainments_institutionId_idx" ON "obe_course_attainments"("institutionId");

CREATE TABLE "obe_attainment_runs" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "policyId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "formulaVersion" TEXT NOT NULL DEFAULT 'v1',
    "calculatedById" TEXT,
    "calculatedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obe_attainment_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obe_attainment_runs_institutionId_programId_academicYearId_semesterId_idx" ON "obe_attainment_runs"("institutionId", "programId", "academicYearId", "semesterId");

CREATE TABLE "obe_run_course_outcomes" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "directAttainment" DOUBLE PRECISION,
    "indirectAttainment" DOUBLE PRECISION,
    "finalAttainment" DOUBLE PRECISION,
    "attainmentLevel" INTEGER,
    "studentCount" INTEGER NOT NULL DEFAULT 0,
    "studentsAssessed" INTEGER NOT NULL DEFAULT 0,
    "studentsMeetingTarget" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "obe_run_course_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obe_run_course_outcomes_runId_courseOfferingId_courseOutcomeId_key" ON "obe_run_course_outcomes"("runId", "courseOfferingId", "courseOutcomeId");
CREATE INDEX "obe_run_course_outcomes_institutionId_courseOfferingId_idx" ON "obe_run_course_outcomes"("institutionId", "courseOfferingId");

CREATE TABLE "obe_run_programme_outcomes" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "programmeOutcomeId" TEXT NOT NULL,
    "attainment" DOUBLE PRECISION,
    "attainmentLevel" INTEGER,
    "courseCount" INTEGER NOT NULL DEFAULT 0,
    "contributingCourseCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "obe_run_programme_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obe_run_programme_outcomes_runId_programmeOutcomeId_key" ON "obe_run_programme_outcomes"("runId", "programmeOutcomeId");
CREATE INDEX "obe_run_programme_outcomes_institutionId_programmeOutcomeId_idx" ON "obe_run_programme_outcomes"("institutionId", "programmeOutcomeId");

ALTER TABLE "programme_outcomes" ADD CONSTRAINT "programme_outcomes_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "programme_outcomes" ADD CONSTRAINT "programme_outcomes_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_outcomes" ADD CONSTRAINT "course_outcomes_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_outcomes" ADD CONSTRAINT "course_outcomes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_outcome_mappings" ADD CONSTRAINT "course_outcome_mappings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_outcome_mappings" ADD CONSTRAINT "course_outcome_mappings_courseOutcomeId_fkey" FOREIGN KEY ("courseOutcomeId") REFERENCES "course_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_outcome_mappings" ADD CONSTRAINT "course_outcome_mappings_programmeOutcomeId_fkey" FOREIGN KEY ("programmeOutcomeId") REFERENCES "programme_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_outcome_mappings" ADD CONSTRAINT "course_outcome_mappings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_outcome_mappings" ADD CONSTRAINT "course_outcome_mappings_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obe_attainment_policies" ADD CONSTRAINT "obe_attainment_policies_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_attainment_policies" ADD CONSTRAINT "obe_attainment_policies_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obe_assessments" ADD CONSTRAINT "obe_assessments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_assessments" ADD CONSTRAINT "obe_assessments_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_assessments" ADD CONSTRAINT "obe_assessments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "obe_assessment_items" ADD CONSTRAINT "obe_assessment_items_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_assessment_items" ADD CONSTRAINT "obe_assessment_items_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "obe_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_assessment_items" ADD CONSTRAINT "obe_assessment_items_courseOutcomeId_fkey" FOREIGN KEY ("courseOutcomeId") REFERENCES "course_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "obe_assessment_scores" ADD CONSTRAINT "obe_assessment_scores_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_assessment_scores" ADD CONSTRAINT "obe_assessment_scores_assessmentItemId_fkey" FOREIGN KEY ("assessmentItemId") REFERENCES "obe_assessment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_assessment_scores" ADD CONSTRAINT "obe_assessment_scores_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_assessment_scores" ADD CONSTRAINT "obe_assessment_scores_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "obe_indirect_assessments" ADD CONSTRAINT "obe_indirect_assessments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_indirect_assessments" ADD CONSTRAINT "obe_indirect_assessments_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_indirect_assessments" ADD CONSTRAINT "obe_indirect_assessments_courseOutcomeId_fkey" FOREIGN KEY ("courseOutcomeId") REFERENCES "course_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "obe_course_attainments" ADD CONSTRAINT "obe_course_attainments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_course_attainments" ADD CONSTRAINT "obe_course_attainments_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_course_attainments" ADD CONSTRAINT "obe_course_attainments_courseOutcomeId_fkey" FOREIGN KEY ("courseOutcomeId") REFERENCES "course_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "obe_attainment_runs" ADD CONSTRAINT "obe_attainment_runs_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_attainment_runs" ADD CONSTRAINT "obe_attainment_runs_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_attainment_runs" ADD CONSTRAINT "obe_attainment_runs_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "obe_attainment_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obe_attainment_runs" ADD CONSTRAINT "obe_attainment_runs_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obe_attainment_runs" ADD CONSTRAINT "obe_attainment_runs_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obe_run_course_outcomes" ADD CONSTRAINT "obe_run_course_outcomes_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_run_course_outcomes" ADD CONSTRAINT "obe_run_course_outcomes_runId_fkey" FOREIGN KEY ("runId") REFERENCES "obe_attainment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_run_course_outcomes" ADD CONSTRAINT "obe_run_course_outcomes_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_run_course_outcomes" ADD CONSTRAINT "obe_run_course_outcomes_courseOutcomeId_fkey" FOREIGN KEY ("courseOutcomeId") REFERENCES "course_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "obe_run_programme_outcomes" ADD CONSTRAINT "obe_run_programme_outcomes_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_run_programme_outcomes" ADD CONSTRAINT "obe_run_programme_outcomes_runId_fkey" FOREIGN KEY ("runId") REFERENCES "obe_attainment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obe_run_programme_outcomes" ADD CONSTRAINT "obe_run_programme_outcomes_programmeOutcomeId_fkey" FOREIGN KEY ("programmeOutcomeId") REFERENCES "programme_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
