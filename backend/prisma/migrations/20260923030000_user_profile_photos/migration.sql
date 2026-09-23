CREATE TABLE "user_profile_photos" (
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profile_photos_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "user_profile_photos_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "user_profile_photos_publicId_idx"
  ON "user_profile_photos"("publicId");
