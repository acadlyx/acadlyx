-- Placement hardening: canonical student-to-drive application uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS applications_student_drive_unique
  ON applications ("studentId", "placementDriveId")
  WHERE "placementDriveId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS placement_drives_institution_company_status_idx
  ON placement_drives ("institutionId", "companyId", "status");

CREATE INDEX IF NOT EXISTS placement_applications_institution_drive_status_idx
  ON applications ("institutionId", "placementDriveId", "status");

CREATE INDEX IF NOT EXISTS placement_interview_participants_student_idx
  ON placement_interview_participants ("studentId", "resultStatus");

CREATE INDEX IF NOT EXISTS placement_offers_institution_joining_idx
  ON placement_offers ("institutionId", "joiningStatus", "joiningDate");
