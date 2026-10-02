CREATE TABLE IF NOT EXISTS "user_deletion_requests" (
  "id" UUID NOT NULL,

  "institution_id" UUID,

  "target_user_id" UUID,
  "target_first_name" TEXT NOT NULL,
  "target_last_name" TEXT NOT NULL,
  "target_email" TEXT NOT NULL,
  "target_role" TEXT NOT NULL,

  "requester_user_id" UUID,
  "requester_first_name" TEXT NOT NULL,
  "requester_last_name" TEXT NOT NULL,
  "requester_email" TEXT NOT NULL,
  "requester_role" TEXT NOT NULL,
  "requester_rank" INTEGER NOT NULL,

  "target_rank" INTEGER NOT NULL,

  "approver_user_id" UUID,
  "approver_first_name" TEXT,
  "approver_last_name" TEXT,
  "approver_email" TEXT,
  "approver_role" TEXT,

  "status" TEXT NOT NULL DEFAULT 'PENDING',

  "reason" TEXT,

  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_deletion_requests_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "user_deletion_requests_institution_id_fkey"
    FOREIGN KEY ("institution_id")
    REFERENCES "institutions"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT "user_deletion_requests_target_user_id_fkey"
    FOREIGN KEY ("target_user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT "user_deletion_requests_requester_user_id_fkey"
    FOREIGN KEY ("requester_user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT "user_deletion_requests_approver_user_id_fkey"
    FOREIGN KEY ("approver_user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT "user_deletion_requests_status_check"
    CHECK (
      "status" IN (
        'PENDING',
        'APPROVED',
        'REJECTED'
      )
    )
);

CREATE INDEX IF NOT EXISTS
  "user_deletion_requests_institution_id_idx"
ON "user_deletion_requests"("institution_id");

CREATE INDEX IF NOT EXISTS
  "user_deletion_requests_target_user_id_idx"
ON "user_deletion_requests"("target_user_id");

CREATE INDEX IF NOT EXISTS
  "user_deletion_requests_requester_user_id_idx"
ON "user_deletion_requests"("requester_user_id");

CREATE INDEX IF NOT EXISTS
  "user_deletion_requests_status_idx"
ON "user_deletion_requests"("status");

CREATE INDEX IF NOT EXISTS
  "user_deletion_requests_created_at_idx"
ON "user_deletion_requests"("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS
  "user_deletion_requests_pending_target_unique"
ON "user_deletion_requests"("target_user_id")
WHERE "status" = 'PENDING';
