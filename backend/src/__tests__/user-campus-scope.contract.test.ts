import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(process.cwd(), "src/services/user.service.ts"), "utf8");
const frontend = join(process.cwd(), "../frontend/src");

test("Director campus assignments are validated against active campuses in the same institution", () => {
  const start = source.indexOf("async function validateCampusIds(");
  const end = source.indexOf("\nasync function syncCampusAccess(", start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const validate = source.slice(start, end);
  assert.match(validate, /roleName === "DIRECTOR".*campusIds !== undefined/s);
  assert.match(validate, /roleName === "DIRECTOR".*campusIds === undefined/s);
  assert.match(validate, /institutionId, isActive: true/);
  assert.match(validate, /campuses\.length !== ids\.length/);
  assert.match(validate, /new Set\(campusIds \|\| \[\]\)/);
});

test("Director scope create and edit persist CampusAccess in the same transaction as role changes", () => {
  const createStart = source.indexOf("export async function createUser(");
  const updateStart = source.indexOf("export async function updateUser(");
  assert.ok(createStart >= 0 && updateStart > createStart);
  const create = source.slice(createStart, updateStart);
  const update = source.slice(updateStart);

  assert.match(create, /await validateCampusIds\(input\.campusIds, targetInstitutionId, input\.role\)/);
  assert.match(create, /await prisma\.\$transaction\(\s*async \(tx\) =>/);
  assert.match(create, /await syncCampusAccess\(tx, created\.id, targetInstitutionId, input\.role, input\.campusIds\)/);

  assert.match(update, /await validateCampusIds\(input\.campusIds, existing\.institutionId, input\.role\)/);
  assert.match(update, /await prisma\.\$transaction\(\s*async \(tx\) =>/);
  assert.match(update, /await syncCampusAccess\(tx, id, existing\.institutionId, resolvedTargetRoleName, input\.campusIds\)/);
  assert.match(source, /if \(campusIds === undefined\)[\s\S]*?const count = await tx\.campusAccess\.count/);
  assert.match(source, /await tx\.campusAccess\.deleteMany\(\{ where: \{ userId \} \}\);[\s\S]*?await tx\.campusAccess\.createMany/);
});

test("Admin create/edit screens expose campus selection and submit it with user data", () => {
  const candidates = [
    join(frontend, "app/admin/users/page.tsx"),
    join(frontend, "app/admin/users/[userId]/edit/page.tsx"),
    join(frontend, "components"),
  ];
  const files = candidates.slice(0, 2).map(path => readFileSync(path, "utf8")).join("\n");
  assert.match(files, /campusIds/);
  assert.match(files, /DIRECTOR/);
  assert.match(files, /campus/i);
});
