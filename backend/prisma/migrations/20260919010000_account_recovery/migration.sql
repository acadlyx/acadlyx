ALTER TABLE "institutions" ADD COLUMN "adminOfficeEmail" TEXT;

-- Institution creation has always required an administrator. Existing tenants
-- receive that address as a recoverable contact until it is explicitly changed.
UPDATE "institutions" i
SET "adminOfficeEmail" = u."email"
FROM "users" u
JOIN "user_roles" ur ON ur."userId" = u."id"
JOIN "roles" r ON r."id" = ur."roleId"
WHERE u."institutionId" = i."id"
  AND r."name" = 'INSTITUTION_ADMIN'
  AND i."adminOfficeEmail" IS NULL;
