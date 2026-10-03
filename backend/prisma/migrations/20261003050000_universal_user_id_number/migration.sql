-- Universal institution/user ID number used as the login identifier.
ALTER TABLE "users" ADD COLUMN "idNumber" TEXT;

-- Existing accounts receive a deterministic temporary ID number derived from
-- their immutable UUID. Administrators can replace it with the institution's
-- preferred human-readable ID number.
UPDATE "users"
SET "idNumber" = 'LEGACY-' || "id"
WHERE "idNumber" IS NULL;

ALTER TABLE "users" ALTER COLUMN "idNumber" SET NOT NULL;

CREATE UNIQUE INDEX "users_idNumber_key" ON "users"("idNumber");
