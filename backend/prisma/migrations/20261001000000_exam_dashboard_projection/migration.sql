-- ACADLYX — examination dashboard projection.
--
-- The Examination Cell is the operational source of truth for examination
-- schedules. Older ERP dashboards still read the legacy `exams` table.
-- This projection keeps those read models synchronized without changing
-- examination workflow, marks, approvals or publication rules.

CREATE OR REPLACE FUNCTION "acadlyx_sync_exam_schedule_legacy"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  legacy_id TEXT;
  exam_title TEXT;
BEGIN
  -- Draft and cancelled schedules are intentionally not exposed through the
  -- legacy student-facing exam read model. The new examination workspace
  -- remains the source for those workflow states.
  IF NEW."status" IN ('DRAFT', 'CANCELLED') THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT(
    es."name",
    ' — ',
    c."code"
  )
  INTO exam_title
  FROM "exam_sessions" es
  JOIN "course_offerings" co
    ON co."id" = NEW."courseOfferingId"
  JOIN "courses" c
    ON c."id" = co."courseId"
  WHERE es."id" = NEW."examSessionId"
    AND es."institutionId" = NEW."institutionId"
    AND co."institutionId" = NEW."institutionId"
    AND c."institutionId" = NEW."institutionId"
  LIMIT 1;

  IF exam_title IS NULL THEN
    RETURN NEW;
  END IF;

  legacy_id := NEW."legacyExamId";

  -- Reuse an existing legacy exam when the schedule was created around an
  -- older ERP exam record. This prevents duplicate exam rows.
  IF legacy_id IS NULL THEN
    SELECT e."id"
      INTO legacy_id
    FROM "exams" e
    WHERE e."institutionId" = NEW."institutionId"
      AND e."courseOfferingId" = NEW."courseOfferingId"
      AND e."examDate" = NEW."examDate"
    ORDER BY e."createdAt" DESC
    LIMIT 1;
  END IF;

  IF legacy_id IS NULL THEN
    legacy_id := gen_random_uuid()::text;

    INSERT INTO "exams"
      (
        "id",
        "institutionId",
        "courseOfferingId",
        "title",
        "examDate",
        "maxMarks",
        "createdById"
      )
    VALUES
      (
        legacy_id,
        NEW."institutionId",
        NEW."courseOfferingId",
        exam_title,
        NEW."examDate",
        NEW."maxMarks",
        NEW."createdById"
      );
  ELSE
    UPDATE "exams"
       SET "title" = exam_title,
           "examDate" = NEW."examDate",
           "maxMarks" = NEW."maxMarks",
           "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = legacy_id
       AND "institutionId" = NEW."institutionId";
  END IF;

  NEW."legacyExamId" := legacy_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "exam_schedules_legacy_projection_trigger"
BEFORE INSERT OR UPDATE OF
  "status",
  "examDate",
  "maxMarks",
  "courseOfferingId",
  "examSessionId",
  "legacyExamId"
ON "exam_schedules"
FOR EACH ROW
EXECUTE FUNCTION "acadlyx_sync_exam_schedule_legacy"();

-- Backfill all already-published/locked/result-published schedules.
-- The trigger performs the actual projection and reuses matching legacy
-- exams where one already exists.
UPDATE "exam_schedules"
SET "maxMarks" = "maxMarks"
WHERE "status" IN (
  'PUBLISHED',
  'LOCKED',
  'RESULTS_PUBLISHED'
);
