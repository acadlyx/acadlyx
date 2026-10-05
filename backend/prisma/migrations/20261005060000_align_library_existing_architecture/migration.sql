-- Correct the initial library-finance migration to preserve the repository's
-- existing aggregate-copy circulation model. No second copy/reservation
-- subsystem is retained.
ALTER TABLE "library_books"
  ADD COLUMN IF NOT EXISTS "totalCopies" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "availableCopies" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "library_issues"
  ADD COLUMN IF NOT EXISTS "issuedById" TEXT,
  ADD COLUMN IF NOT EXISTS "fineAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "library_issues" DROP COLUMN IF EXISTS "copyId";
DROP TABLE IF EXISTS "library_reservations";
DROP TABLE IF EXISTS "library_copies";
ALTER TABLE "library_books"
  DROP COLUMN IF EXISTS "description";
ALTER TABLE "library_issues"
  DROP COLUMN IF EXISTS "notes";


-- Seed a configurable baseline fee-head catalogue for every tenant. These
-- are defaults, not a closed enum; administrators may add or deactivate heads.
INSERT INTO "fee_heads" ("id","institutionId","name","code","description")
SELECT md5(i."id" || d.code)::uuid, i."id", d.name, d.code, d.description
FROM "institutions" i
CROSS JOIN (VALUES
  ('Tuition Fee','TUITION_FEE','Academic tuition'),
  ('Admission Fee','ADMISSION_FEE','Admission charge'),
  ('Registration Fee','REGISTRATION_FEE','Registration charge'),
  ('Semester Fee','SEMESTER_FEE','Semester charge'),
  ('Annual Fee','ANNUAL_FEE','Annual institutional charge'),
  ('Development Fee','DEVELOPMENT_FEE','Institutional development charge'),
  ('Programme Fee','PROGRAMME_FEE','Programme-specific charge'),
  ('Examination Fee','EXAMINATION_FEE','Examination charge'),
  ('Back/Supplementary Exam Fee','SUPPLEMENTARY_EXAM_FEE','Back or supplementary examination'),
  ('Revaluation Fee','REVALUATION_FEE','Examination revaluation'),
  ('Exam Form Late Fee','EXAM_FORM_LATE_FEE','Late examination form charge'),
  ('Library Fee','LIBRARY_FEE','Library service fee'),
  ('Library Fine','LIBRARY_FINE','Library circulation fine'),
  ('Lost Book Charge','LOST_BOOK_CHARGE','Lost book replacement charge'),
  ('Damaged Book Charge','DAMAGED_BOOK_CHARGE','Damaged book charge'),
  ('Replacement Charge','REPLACEMENT_CHARGE','Replacement charge'),
  ('Transport Fee','TRANSPORT_FEE','Transport service fee'),
  ('Transport Fine','TRANSPORT_FINE','Transport penalty'),
  ('Route Change Charge','ROUTE_CHANGE_CHARGE','Transport route change'),
  ('Hostel Fee','HOSTEL_FEE','Hostel accommodation fee'),
  ('Hostel Admission Fee','HOSTEL_ADMISSION_FEE','Hostel admission'),
  ('Hostel Security','HOSTEL_SECURITY','Hostel security deposit'),
  ('Mess Fee','MESS_FEE','Mess charges'),
  ('Hostel Fine','HOSTEL_FINE','Hostel penalty'),
  ('ID Card Fee','ID_CARD_FEE','Student identity card'),
  ('Student Welfare Fee','STUDENT_WELFARE_FEE','Student welfare'),
  ('Sports Fee','SPORTS_FEE','Sports activities'),
  ('Cultural/Event Fee','CULTURAL_EVENT_FEE','Cultural and events'),
  ('Club Fee','CLUB_FEE','Club activities'),
  ('Activity Fee','ACTIVITY_FEE','Student activities'),
  ('Certificate Fee','CERTIFICATE_FEE','Certificate/document service'),
  ('Transcript Fee','TRANSCRIPT_FEE','Transcript service'),
  ('Migration Fee','MIGRATION_FEE','Migration document'),
  ('Duplicate Document Fee','DUPLICATE_DOCUMENT_FEE','Duplicate document'),
  ('Enrollment Charge','ENROLLMENT_CHARGE','Enrollment charge'),
  ('Late Administrative Charge','LATE_ADMIN_CHARGE','Administrative late charge'),
  ('Late Payment Fine','LATE_PAYMENT_FINE','Late payment penalty'),
  ('Attendance Fine','ATTENDANCE_FINE','Approved attendance penalty'),
  ('Discipline Fine','DISCIPLINE_FINE','Approved discipline penalty'),
  ('Other Institutional Fine','OTHER_INSTITUTIONAL_FINE','Other approved institutional penalty'),
  ('Miscellaneous Fee','MISCELLANEOUS_FEE','Configurable miscellaneous charge')
) AS d(name,code,description) ON TRUE
ON CONFLICT ("institutionId","code") DO NOTHING;
