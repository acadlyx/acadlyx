-- ERP expansion: admissions, HR, leave, library, calendar, course registration,
-- promotion/transfer and certificates. All tables are tenant scoped.

CREATE TABLE "admission_applications" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "applicationNumber" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "gender" TEXT,
  "guardianName" TEXT,
  "guardianPhone" TEXT,
  "previousInstitution" TEXT,
  "previousPercentage" DOUBLE PRECISION,
  "programId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "remarks" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "enrolledUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admission_applications_institutionId_applicationNumber_key" ON "admission_applications"("institutionId", "applicationNumber");
CREATE UNIQUE INDEX "admission_applications_enrolledUserId_key" ON "admission_applications"("enrolledUserId");
CREATE INDEX "admission_applications_institutionId_status_idx" ON "admission_applications"("institutionId", "status");
CREATE INDEX "admission_applications_programId_idx" ON "admission_applications"("programId");
CREATE INDEX "admission_applications_academicYearId_idx" ON "admission_applications"("academicYearId");
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "employee_profiles" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeCode" TEXT NOT NULL,
  "departmentId" TEXT,
  "designation" TEXT NOT NULL,
  "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
  "joiningDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "qualification" TEXT,
  "address" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employee_profiles_userId_key" ON "employee_profiles"("userId");
CREATE UNIQUE INDEX "employee_profiles_institutionId_employeeCode_key" ON "employee_profiles"("institutionId", "employeeCode");
CREATE INDEX "employee_profiles_institutionId_status_idx" ON "employee_profiles"("institutionId", "status");
CREATE INDEX "employee_profiles_departmentId_idx" ON "employee_profiles"("departmentId");
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "leave_types" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "annualQuota" INTEGER NOT NULL DEFAULT 0,
  "applicableRoles" TEXT[] NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_types_institutionId_code_key" ON "leave_types"("institutionId", "code");
CREATE INDEX "leave_types_institutionId_idx" ON "leave_types"("institutionId");
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "leave_requests" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "fromDate" TIMESTAMP(3) NOT NULL,
  "toDate" TIMESTAMP(3) NOT NULL,
  "days" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "leave_requests_institutionId_status_idx" ON "leave_requests"("institutionId", "status");
CREATE INDEX "leave_requests_applicantId_idx" ON "leave_requests"("applicantId");
CREATE INDEX "leave_requests_leaveTypeId_idx" ON "leave_requests"("leaveTypeId");
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "library_books" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "isbn" TEXT,
  "category" TEXT,
  "publisher" TEXT,
  "shelfLocation" TEXT,
  "totalCopies" INTEGER NOT NULL DEFAULT 1,
  "availableCopies" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "library_books_institutionId_isbn_key" ON "library_books"("institutionId", "isbn");
CREATE INDEX "library_books_institutionId_title_idx" ON "library_books"("institutionId", "title");
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "library_issues" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "borrowerId" TEXT NOT NULL,
  "issuedById" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "returnedAt" TIMESTAMP(3),
  "fineAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "library_issues_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "library_issues_institutionId_status_idx" ON "library_issues"("institutionId", "status");
CREATE INDEX "library_issues_borrowerId_idx" ON "library_issues"("borrowerId");
CREATE INDEX "library_issues_bookId_idx" ON "library_issues"("bookId");
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "calendar_events" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "eventType" TEXT NOT NULL DEFAULT 'EVENT',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "academicYearId" TEXT,
  "audience" TEXT NOT NULL DEFAULT 'ALL',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "calendar_events_institutionId_startDate_idx" ON "calendar_events"("institutionId", "startDate");
CREATE INDEX "calendar_events_academicYearId_idx" ON "calendar_events"("academicYearId");
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "course_registrations" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "courseOfferingId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_registrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "course_registrations_studentId_courseOfferingId_key" ON "course_registrations"("studentId", "courseOfferingId");
CREATE INDEX "course_registrations_institutionId_status_idx" ON "course_registrations"("institutionId", "status");
CREATE INDEX "course_registrations_courseOfferingId_idx" ON "course_registrations"("courseOfferingId");
ALTER TABLE "course_registrations" ADD CONSTRAINT "course_registrations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_registrations" ADD CONSTRAINT "course_registrations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_registrations" ADD CONSTRAINT "course_registrations_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "student_movement_requests" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "fromEnrollmentId" TEXT NOT NULL,
  "targetProgramId" TEXT,
  "targetAcademicYearId" TEXT,
  "targetSemesterId" TEXT,
  "targetSectionId" TEXT,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "appliedEnrollmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_movement_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "student_movement_requests_institutionId_status_idx" ON "student_movement_requests"("institutionId", "status");
CREATE INDEX "student_movement_requests_studentId_idx" ON "student_movement_requests"("studentId");
ALTER TABLE "student_movement_requests" ADD CONSTRAINT "student_movement_requests_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_movement_requests" ADD CONSTRAINT "student_movement_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "certificates" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "certificateType" TEXT NOT NULL,
  "certificateNumber" TEXT,
  "purpose" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "requestedById" TEXT NOT NULL,
  "issuedById" TEXT,
  "issuedAt" TIMESTAMP(3),
  "remarks" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "certificates_institutionId_certificateNumber_key" ON "certificates"("institutionId", "certificateNumber");
CREATE INDEX "certificates_institutionId_status_idx" ON "certificates"("institutionId", "status");
CREATE INDEX "certificates_studentId_idx" ON "certificates"("studentId");
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
