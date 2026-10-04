-- Enterprise hot-path indexes for registration concurrency, reporting and lifecycle queries.
CREATE INDEX IF NOT EXISTS "course_registrations_offering_status_idx"
  ON "course_registrations" ("courseOfferingId", "status");

CREATE INDEX IF NOT EXISTS "course_registrations_institution_student_status_idx"
  ON "course_registrations" ("institutionId", "studentId", "status");

CREATE INDEX IF NOT EXISTS "course_registrations_institution_created_idx"
  ON "course_registrations" ("institutionId", "createdAt");

CREATE INDEX IF NOT EXISTS "exam_results_institution_student_created_idx"
  ON "exam_results" ("institutionId", "studentId", "createdAt");

CREATE INDEX IF NOT EXISTS "fee_payments_invoice_created_idx"
  ON "fee_payments" ("invoiceId", "createdAt");
