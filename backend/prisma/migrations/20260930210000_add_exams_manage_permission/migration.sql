/*
  Add examination-management RBAC permission.

  This migration is intentionally idempotent so the permission
  can safely be introduced into an existing production database.
*/

INSERT INTO "permissions" (
  "id",
  "key",
  "module",
  "description"
)
SELECT
  gen_random_uuid()::text,
  'exams.manage',
  'exams',
  'Create, view, update, delete examinations and manage examination results'
WHERE NOT EXISTS (
  SELECT 1
  FROM "permissions"
  WHERE "key" = 'exams.manage'
);

/*
  Grant exams.manage to the institution roles that are already
  intended by the ERP frontend/backend to manage examinations.
 */

INSERT INTO "role_permissions" (
  "roleId",
  "permissionId"
)
SELECT
  r."id",
  p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."key" = 'exams.manage'
  AND r."name" IN (
    'INSTITUTION_ADMIN',
    'DIRECTOR',
    'MANAGEMENT',
    'HOD',
    'FACULTY'
  )
ON CONFLICT ("roleId", "permissionId")
DO NOTHING;

/*
  SUPER_ADMIN already bypasses permission checks in the backend,
  but also receives the permission in the RBAC catalogue.
 */
INSERT INTO "role_permissions" (
  "roleId",
  "permissionId"
)
SELECT
  r."id",
  p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'SUPER_ADMIN'
  AND r."institutionId" IS NULL
  AND p."key" = 'exams.manage'
ON CONFLICT ("roleId", "permissionId")
DO NOTHING;
