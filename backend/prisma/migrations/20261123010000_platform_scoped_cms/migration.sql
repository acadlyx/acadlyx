-- Move the public ACADLYX website CMS to platform ownership.
-- Existing public-site content for the configured legacy "aimt" slug is preserved.

CREATE TABLE "platform_site_contents" (
  "id" TEXT NOT NULL DEFAULT 'platform',
  "content" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_site_contents_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_site_contents" (
  "id", "content", "version", "publishedAt", "updatedById", "createdAt", "updatedAt"
)
SELECT
  'platform', sc."content", sc."version", sc."publishedAt", sc."updatedById", sc."createdAt", sc."updatedAt"
FROM "site_contents" sc
INNER JOIN "institutions" i ON i."id" = sc."institutionId"
WHERE i."slug" = 'aimt'
ON CONFLICT ("id") DO NOTHING;

-- Platform CMS media has no tenant owner. Preserve existing tenant assets
-- while allowing new platform-owned asset metadata to use institutionId NULL.
ALTER TABLE "file_assets" DROP CONSTRAINT "file_assets_institutionId_fkey";
ALTER TABLE "file_assets" ALTER COLUMN "institutionId" DROP NOT NULL;
ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CMS is a platform role. Create the singleton platform role and carry over
-- the former CMS role's capabilities from existing tenant role bindings.
DO $$
DECLARE
  platform_cms_role_id TEXT;
BEGIN
  SELECT "id" INTO platform_cms_role_id
  FROM "roles"
  WHERE "institutionId" IS NULL AND "name" = 'CMS'
  LIMIT 1;

  IF platform_cms_role_id IS NULL THEN
    platform_cms_role_id := gen_random_uuid()::text;
    INSERT INTO "roles" (
      "id", "institutionId", "name", "description", "isSystem", "createdAt", "updatedAt"
    ) VALUES (
      platform_cms_role_id, NULL, 'CMS', 'Platform-level CMS role', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
  END IF;

  DELETE FROM "role_permissions" WHERE "roleId" = platform_cms_role_id;

  INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt")
  SELECT platform_cms_role_id, p."id", CURRENT_TIMESTAMP
  FROM "permissions" p
  WHERE p."key" IN ('site.manage')
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;

  -- Dedicated CMS-only accounts become platform-scoped accounts.
  UPDATE "users" u
  SET "institutionId" = NULL
  WHERE EXISTS (
    SELECT 1
    FROM "user_roles" ur
    INNER JOIN "roles" cms_role ON cms_role."id" = ur."roleId"
    WHERE ur."userId" = u."id"
      AND cms_role."name" = 'CMS'
      AND cms_role."institutionId" IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "user_roles" ur
    INNER JOIN "roles" other_role ON other_role."id" = ur."roleId"
    WHERE ur."userId" = u."id"
      AND other_role."name" <> 'CMS'
  );

  INSERT INTO "user_roles" ("userId", "roleId", "createdAt")
  SELECT DISTINCT ur."userId", platform_cms_role_id, CURRENT_TIMESTAMP
  FROM "user_roles" ur
  INNER JOIN "roles" legacy_role ON legacy_role."id" = ur."roleId"
  WHERE legacy_role."name" = 'CMS'
    AND legacy_role."institutionId" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "users" u
      WHERE u."id" = ur."userId" AND u."institutionId" IS NULL
    )
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  -- Mixed-role tenant accounts keep their tenant roles but lose the
  -- platform CMS binding; they must receive a dedicated platform CMS user.
  DELETE FROM "user_roles" ur
  USING "roles" legacy_role
  WHERE ur."roleId" = legacy_role."id"
    AND legacy_role."name" = 'CMS'
    AND legacy_role."institutionId" IS NOT NULL;
END $$;
