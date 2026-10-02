-- Centralized provider-agnostic file metadata.
CREATE TABLE "file_assets" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "ownerId" TEXT,
  "provider" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "folder" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "referenceId" TEXT,
  "originalName" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_assets_provider_publicId_key" ON "file_assets"("provider", "publicId");
CREATE INDEX "file_assets_institutionId_module_idx" ON "file_assets"("institutionId", "module");
CREATE INDEX "file_assets_institutionId_ownerId_idx" ON "file_assets"("institutionId", "ownerId");
CREATE INDEX "file_assets_institutionId_module_referenceId_idx" ON "file_assets"("institutionId", "module", "referenceId");

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
