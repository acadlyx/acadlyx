-- ACADLYX: first-class Director -> Campus authorization
CREATE TABLE "campus_accesses" (
  "userId" TEXT NOT NULL,
  "campusId" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'DIRECTOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "campus_accesses_pkey" PRIMARY KEY ("userId","campusId"),
  CONSTRAINT "campus_accesses_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campus_accesses_campusId_fkey"
    FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "campus_accesses_campusId_idx" ON "campus_accesses"("campusId");
