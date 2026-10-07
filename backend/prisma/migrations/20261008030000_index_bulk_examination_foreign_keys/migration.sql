CREATE INDEX IF NOT EXISTS "background_jobs_createdById_idx"
  ON "background_jobs" ("createdById");

CREATE INDEX IF NOT EXISTS "admit_card_holds_createdById_idx"
  ON "admit_card_holds" ("createdById");

CREATE INDEX IF NOT EXISTS "admit_card_holds_examSessionId_idx"
  ON "admit_card_holds" ("examSessionId");

CREATE INDEX IF NOT EXISTS "admit_card_holds_hallTicketId_idx"
  ON "admit_card_holds" ("hallTicketId");

CREATE INDEX IF NOT EXISTS "admit_card_holds_resolvedById_idx"
  ON "admit_card_holds" ("resolvedById");

CREATE INDEX IF NOT EXISTS "admit_card_holds_studentId_idx"
  ON "admit_card_holds" ("studentId");

CREATE INDEX IF NOT EXISTS "admit_card_templates_createdById_idx"
  ON "admit_card_templates" ("createdById");

CREATE INDEX IF NOT EXISTS "admit_card_templates_updatedById_idx"
  ON "admit_card_templates" ("updatedById");

CREATE INDEX IF NOT EXISTS "exam_marks_enteredById_idx"
  ON "exam_marks" ("enteredById");
