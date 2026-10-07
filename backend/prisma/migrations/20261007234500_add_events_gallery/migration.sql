CREATE TABLE "event_categories" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_categories_institutionId_slug_key" ON "event_categories"("institutionId","slug");
CREATE INDEX "event_categories_institutionId_isActive_idx" ON "event_categories"("institutionId","isActive");
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "institutional_events" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "categoryId" TEXT,
  "departmentId" TEXT,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "shortDescription" TEXT,
  "description" TEXT,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "venue" TEXT,
  "organizers" JSONB,
  "speakers" JSONB,
  "highlights" JSONB,
  "videoUrls" JSONB,
  "tags" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "coverImageUrl" TEXT,
  "coverFileId" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "institutional_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institutional_events_institutionId_slug_key" ON "institutional_events"("institutionId","slug");
CREATE INDEX "institutional_events_institutionId_publicationStatus_eventDate_idx" ON "institutional_events"("institutionId","publicationStatus","eventDate");
CREATE INDEX "institutional_events_institutionId_categoryId_idx" ON "institutional_events"("institutionId","categoryId");
CREATE INDEX "institutional_events_institutionId_departmentId_idx" ON "institutional_events"("institutionId","departmentId");
CREATE INDEX "institutional_events_institutionId_isFeatured_eventDate_idx" ON "institutional_events"("institutionId","isFeatured","eventDate");
ALTER TABLE "institutional_events" ADD CONSTRAINT "institutional_events_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "institutional_events" ADD CONSTRAINT "institutional_events_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "event_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "institutional_events" ADD CONSTRAINT "institutional_events_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "institutional_events" ADD CONSTRAINT "institutional_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "institutional_events" ADD CONSTRAINT "institutional_events_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "event_media" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publicId" TEXT,
  "title" TEXT,
  "altText" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_media_eventId_displayOrder_idx" ON "event_media"("eventId","displayOrder");
CREATE INDEX "event_media_institutionId_fileAssetId_idx" ON "event_media"("institutionId","fileAssetId");
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "institutional_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
