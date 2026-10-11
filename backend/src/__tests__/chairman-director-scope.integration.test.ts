import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../lib/prisma";
import { getDirectorDepartmentIds } from "../services/accessScope.service";

test("Director CampusAccess resolves only departments inside assigned campuses", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const suffix = randomUUID();
  const institution = await prisma.institution.create({
    data: { name: `Scope integration ${suffix}`, slug: `scope-${suffix}` },
  });

  try {
    const [campusA, campusB] = await Promise.all([
      prisma.campus.create({
        data: { institutionId: institution.id, name: "Assigned campus", code: `A-${suffix.slice(0, 8)}` },
      }),
      prisma.campus.create({
        data: { institutionId: institution.id, name: "Unassigned campus", code: `B-${suffix.slice(0, 8)}` },
      }),
    ]);
    const [departmentA, departmentB] = await Promise.all([
      prisma.department.create({
        data: { institutionId: institution.id, campusId: campusA.id, name: "Assigned department", code: `DA-${suffix.slice(0, 8)}` },
      }),
      prisma.department.create({
        data: { institutionId: institution.id, campusId: campusB.id, name: "Unassigned department", code: `DB-${suffix.slice(0, 8)}` },
      }),
    ]);
    const director = await prisma.user.create({
      data: {
        institutionId: institution.id,
        email: `director-${suffix}@scope-test.invalid`,
        idNumber: `DIR-${suffix}`,
        passwordHash: "integration-test-not-a-real-password",
        firstName: "Scope",
        lastName: "Director",
      },
    });
    await prisma.campusAccess.create({
      data: { userId: director.id, campusId: campusA.id, scope: "DIRECTOR" },
    });

    const assigned = await getDirectorDepartmentIds(institution.id, director.id);
    assert.deepEqual(assigned, [departmentA.id]);
    assert.ok(!assigned.includes(departmentB.id), "departments at an unassigned campus must never be inferred as authorized");
    assert.deepEqual(await getDirectorDepartmentIds(institution.id, `no-access-${suffix}`), []);
  } finally {
    await prisma.institution.delete({ where: { id: institution.id } });
  }
});
