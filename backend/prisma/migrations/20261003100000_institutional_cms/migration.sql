CREATE TABLE "institutional_cms_contents" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "institutional_cms_contents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "institutional_cms_contents_institutionId_key" ON "institutional_cms_contents"("institutionId");
CREATE INDEX "institutional_cms_contents_institutionId_updatedAt_idx" ON "institutional_cms_contents"("institutionId","updatedAt");
ALTER TABLE "institutional_cms_contents" ADD CONSTRAINT "institutional_cms_contents_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
