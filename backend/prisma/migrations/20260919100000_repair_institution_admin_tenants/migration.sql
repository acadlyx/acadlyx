-- Repair legacy Institution Admin users whose tenant was lost while their
-- institution-scoped role binding still identifies exactly one institution.
-- Deliberately does not guess when an account has conflicting role tenants.
UPDATE "users" AS u
SET "institutionId" = repaired."institutionId"
FROM (
  SELECT
    ur."userId",
    MIN(r."institutionId") AS "institutionId"
  FROM "user_roles" AS ur
  INNER JOIN "roles" AS r ON r."id" = ur."roleId"
  INNER JOIN "users" AS candidate ON candidate."id" = ur."userId"
  WHERE r."name" = 'INSTITUTION_ADMIN'
    AND r."institutionId" IS NOT NULL
    AND candidate."institutionId" IS NULL
  GROUP BY ur."userId"
  HAVING COUNT(DISTINCT r."institutionId") = 1
) AS repaired
WHERE u."id" = repaired."userId"
  AND u."institutionId" IS NULL;
