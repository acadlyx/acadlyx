-- ACADLYX
-- Examination -> legacy ERP read-model synchronization.
--
-- The Examination Cell uses exam_sessions/exam_schedules as its
-- operational examination model.
--
-- Several existing ERP dashboards still consume the legacy
-- exams/exam_results read model. This migration keeps the legacy
-- examination record synchronized whenever a schedule becomes
-- operational.
--
-- This does NOT change examination permissions, workflow transitions,
-- marks approval, seating, attendance, hall tickets or publication.
-- It only maintains the existing legacy read projection.

CREATE OR REPLACE FUNCTION "acadlyx_sync_exam_schedule_to_legacy"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  projected_exam_id TEXT;
  projected_title TEXT;
  existing_result_count BIGINT;
BEGIN
  /*
   * Only operational schedules should appear in the legacy ERP
   * examination read model.
   *
   * DRAFT schedules must remain invisible to student/faculty legacy
   * dashboards until the Examination Cell publishes them.
   */
  IF NEW."status" NOT IN (
    'PUBLISHED',
    'LOCKED',
    'RESULTS_PUBLISHED'
  ) THEN

    /*
     * If a previously published schedule is moved back to DRAFT or
     * CANCELLED before any result exists, remove the temporary legacy
     * projection. Never delete a legacy exam that already has results.
     */
    IF TG_OP = 'UPDATE'
       AND OLD."legacyExamId" IS NOT NULL
       AND NEW."status" IN ('DRAFT', 'CANCELLED') THEN

      SELECT COUNT(*)
      INTO existing_result_count
      FROM "exam_results"
      WHERE "examId" = OLD."legacyExamId";

      IF existing_result_count = 0 THEN
        DELETE FROM "exams"
        WHERE "id" = OLD."legacyExamId"
          AND "institutionId" = NEW."institutionId";

        NEW."legacyExamId" := NULL;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  /*
   * Build the same human-readable title used by the new Examination
   * publication service.
   */
  SELECT
    es."name" || ' — ' || c."code"
  INTO projected_title
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

  /*
   * If the related academic records have disappeared, fail closed.
   * The FK constraints normally make this impossible, but this keeps
   * the projection defensive.
   */
  IF projected_title IS NULL THEN
    RETURN NEW;
  END IF;

  projected_exam_id := NEW."legacyExamId";

  /*
   * Prefer the explicit projection link.
   */
  IF projected_exam_id IS NOT NULL THEN
    UPDATE "exams"
    SET
      "title" = projected_title,
      "examDate" = NEW."examDate",
      "maxMarks" = NEW."maxMarks",
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = projected_exam_id
      AND "institutionId" = NEW."institutionId";

    /*
     * If the linked legacy record disappeared, recreate it below.
     */
    IF NOT EXISTS (
      SELECT 1
      FROM "exams"
      WHERE "id" = projected_exam_id
        AND "institutionId" = NEW."institutionId"
    ) THEN
      projected_exam_id := NULL;
    END IF;
  END IF;

  /*
   * Reuse a legacy exam already created for the same institution,
   * course offering and exam date. This prevents duplicate records
   * when the old ERP workflow had already created the examination.
   */
  IF projected_exam_id IS NULL THEN
    SELECT e."id"
    INTO projected_exam_id
    FROM "exams" e
    WHERE e."institutionId" = NEW."institutionId"
      AND e."courseOfferingId" = NEW."courseOfferingId"
      AND e."examDate" = NEW."examDate"
    ORDER BY e."createdAt" DESC
    LIMIT 1;
  END IF;

  /*
   * Create the legacy projection if no matching legacy examination
   * exists.
   */
  IF projected_exam_id IS NULL THEN
    projected_exam_id := gen_random_uuid()::TEXT;

    INSERT INTO "exams" (
      "id",
      "institutionId",
      "courseOfferingId",
      "title",
      "examDate",
      "maxMarks",
      "createdById"
    )
    VALUES (
      projected_exam_id,
      NEW."institutionId",
      NEW."courseOfferingId",
      projected_title,
      NEW."examDate",
      NEW."maxMarks",
      NEW."createdById"
    );
  ELSE
    UPDATE "exams"
    SET
      "title" = projected_title,
      "examDate" = NEW."examDate",
      "maxMarks" = NEW."maxMarks",
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = projected_exam_id
      AND "institutionId" = NEW."institutionId";
  END IF;

  /*
   * Persist the bidirectional link so the existing examination
   * publication service and this projection always converge on the
   * same legacy record.
   */
  NEW."legacyExamId" := projected_exam_id;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
  "exam_schedules_legacy_projection_trigger"
ON "exam_schedules";


CREATE TRIGGER
  "exam_schedules_legacy_projection_trigger"
BEFORE INSERT OR UPDATE OF
  "status",
  "examDate",
  "maxMarks",
  "courseOfferingId",
  "examSessionId",
  "legacyExamId"
ON "exam_schedules"
FOR EACH ROW
EXECUTE FUNCTION
  "acadlyx_sync_exam_schedule_to_legacy"();


/*
 * Backfill schedules which already became operational before this
 * migration was deployed.
 *
 * The self-assignment causes the trigger to execute while preserving
 * the existing status.
 */
UPDATE "exam_schedules"
SET "status" = "status"
WHERE "status" IN (
  'PUBLISHED',
  'LOCKED',
  'RESULTS_PUBLISHED'
);
