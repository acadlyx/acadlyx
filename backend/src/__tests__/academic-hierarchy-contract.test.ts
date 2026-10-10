import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

test("department queries accept a validated campus filter and apply it with institution and role scope", () => {
  const validator = fs.readFileSync(path.join(root, "src/validators/department.validators.ts"), "utf8");
  const controller = fs.readFileSync(path.join(root, "src/controllers/department.controller.ts"), "utf8");
  const service = fs.readFileSync(path.join(root, "src/services/department.service.ts"), "utf8");

  assert.match(validator, /listDepartmentsQuerySchema[\s\S]*?campusId:\s*optionalUuid/);
  assert.match(controller, /departmentIds:\s*allowedDepartmentIds,[\s\S]*?campusId:\s*req\.query\.campusId as string \| undefined/);
  assert.match(service, /institutionId,[\s\S]*?filters\.departmentIds[\s\S]*?filters\.campusId \? \{ campusId: filters\.campusId \} : \{\}/);
});

test("campus and department workspaces preserve the real campus-to-department hierarchy", () => {
  const campusService = fs.readFileSync(path.join(root, "src/services/campus.service.ts"), "utf8");
  const departmentService = fs.readFileSync(path.join(root, "src/services/department.service.ts"), "utf8");
  assert.match(campusService, /where:\s*\{[\s\S]*?id,[\s\S]*?institutionId/);
  assert.match(departmentService, /where:[\s\S]*?institutionId,[\s\S]*?filters\.campusId \? \{ campusId: filters\.campusId \} : \{\}/);
});
