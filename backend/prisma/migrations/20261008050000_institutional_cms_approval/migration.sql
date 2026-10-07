ALTER TABLE "institutional_cms_contents"
  ADD COLUMN "draftContent" JSONB,
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT;

CREATE INDEX "institutional_cms_contents_institutionId_approvalStatus_idx"
  ON "institutional_cms_contents" ("institutionId", "approvalStatus");

ALTER TABLE "institutional_cms_contents"
  ADD CONSTRAINT "institutional_cms_contents_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "institutional_cms_contents"
  ADD CONSTRAINT "institutional_cms_contents_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
