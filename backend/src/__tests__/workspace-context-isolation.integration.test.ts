import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";
import { generateRefreshToken, hashToken, signAccessToken } from "../utils/jwt";

const integrationEnabled = process.env.RUN_POSTGRES_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

const TENANT_ROLES = [
  "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN",
  "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS",
  "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "STUDENT",
  "PARENT", "CLUB_PRESIDENT",
] as const;

type TenantRole = typeof TENANT_ROLES[number];
type UserFixture = { id: string; email: string; token: string; roles: string[] };
type ContextData = {
  role: string;
  scope: {
    institutionId: string;
    campusId: string | null;
    departmentId: string | null;
    programId: string | null;
    academicYearId: string | null;
    batchId: string | null;
    semesterId: string | null;
    sectionId: string | null;
  };
  children: {
    campuses: Array<{ id: string }>;
    departments: Array<{ id: string; campus?: { id: string } | null }>;
    programs: Array<{ id: string; departmentId: string }>;
    academicYears: Array<{ id: string }>;
    batches: Array<{ id: string; programId: string }>;
    semesters: Array<{ id: string; programId: string; academicYearId: string }>;
    sections: Array<{ id: string; semesterId: string }>;
  };
};
type ApiBody = { success?: boolean; data?: unknown; error?: { message?: string } };
type ApiResult = { status: number; body: ApiBody };

function contextData(result: ApiResult): ContextData {
  assert.equal(result.status, 200, "Expected successful context API response; got " + result.status + " " + JSON.stringify(result.body));
  return result.body.data as ContextData;
}

function ids(items: Array<{ id: string }>): string[] {
  return items.map((item) => item.id).sort();
}

test("real API enforces all role scopes, multi-role precedence, revocation, deleted selections and tenant/student isolation", {
  skip: !integrationEnabled,
}, async () => {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12).toLowerCase();
  const userIds: string[] = [];
  const institutionIds: string[] = [];
  let globalSuperAdminRoleId: string | null = null;
  let createdGlobalSuperAdminRole = false;
  let server: Server | undefined;
  let baseUrl = "";

  const createdTokens = new Map<string, UserFixture>();

  async function createTenantRoleMap(institutionId: string): Promise<Record<TenantRole, string>> {
    const map = {} as Record<TenantRole, string>;
    for (const name of TENANT_ROLES) {
      const role = await prisma.role.create({
        data: { institutionId, name, description: "Temporary workspace integration role", isSystem: true },
        select: { id: true },
      });
      map[name] = role.id;
    }
    return map;
  }

  async function createUserFixture(
    label: string,
    institutionId: string | null,
    roleNames: string[],
    roleMap: Record<string, string>,
  ): Promise<UserFixture> {
    const user = await prisma.user.create({
      data: {
        institutionId,
        email: `scope-${label}-${suffix}@integration.invalid`,
        idNumber: `SCOPE-${suffix}-${label.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16)}`,
        passwordHash: "integration-only-invalid-password-hash",
        firstName: "Scope",
        lastName: label,
        isActive: true,
      },
      select: { id: true, email: true },
    });
    userIds.push(user.id);
    await prisma.userRole.createMany({
      data: roleNames.map((name) => {
        const roleId = roleMap[name];
        assert.ok(roleId, "Missing test role mapping for " + name);
        return { userId: user.id, roleId };
      }),
    });
    const refreshToken = generateRefreshToken();
    const session = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      select: { id: true },
    });
    const token = signAccessToken({
      sub: user.id,
      institutionId,
      email: user.email,
      roles: roleNames,
      permissions: [],
      sid: session.id,
    });
    const fixture = { id: user.id, email: user.email, token, roles: roleNames };
    createdTokens.set(label, fixture);
    return fixture;
  }

  async function request(path: string, token: string): Promise<ApiResult> {
    const response = await fetch(baseUrl + "/api/v1" + path, {
      method: "GET",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    let body: ApiBody;
    try {
      body = await response.json() as ApiBody;
    } catch {
      body = {};
    }
    return { status: response.status, body };
  }

  function contextPath(values: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
    return "/workspace/context" + (params.size ? "?" + params.toString() : "");
  }

  try {
    server = createApp().listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server?.once("listening", resolve);
      server?.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = "http://127.0.0.1:" + address.port;

    const institutionA = await prisma.institution.create({
      data: { name: "Workspace Scope A " + suffix, slug: "scope-a-" + suffix },
      select: { id: true },
    });
    const institutionB = await prisma.institution.create({
      data: { name: "Workspace Scope B " + suffix, slug: "scope-b-" + suffix },
      select: { id: true },
    });
    institutionIds.push(institutionA.id, institutionB.id);

    for (const institutionId of institutionIds) {
      const subscription = await prisma.tenantSubscription.create({
        data: { institutionId, plan: "STANDARD", status: "ACTIVE" },
        select: { id: true },
      });
      await prisma.tenantFeatureEntitlement.createMany({
        data: ["academics", "students", "assignments", "attendance", "results", "timetable"].map((featureKey) => ({
          institutionId,
          subscriptionId: subscription.id,
          featureKey,
          isEnabled: true,
        })),
      });
    }

    const [campusA1, campusA2, campusB] = await Promise.all([
      prisma.campus.create({ data: { institutionId: institutionA.id, name: "Campus A1 " + suffix, code: "A1" + suffix }, select: { id: true } }),
      prisma.campus.create({ data: { institutionId: institutionA.id, name: "Campus A2 " + suffix, code: "A2" + suffix }, select: { id: true } }),
      prisma.campus.create({ data: { institutionId: institutionB.id, name: "Campus B " + suffix, code: "B" + suffix }, select: { id: true } }),
    ]);
    const [departmentA1, departmentA2, departmentB] = await Promise.all([
      prisma.department.create({ data: { institutionId: institutionA.id, campusId: campusA1.id, name: "Department A1 " + suffix, code: "DA1" + suffix }, select: { id: true } }),
      prisma.department.create({ data: { institutionId: institutionA.id, campusId: campusA2.id, name: "Department A2 " + suffix, code: "DA2" + suffix }, select: { id: true } }),
      prisma.department.create({ data: { institutionId: institutionB.id, campusId: campusB.id, name: "Department B " + suffix, code: "DB" + suffix }, select: { id: true } }),
    ]);
    const [programA1, programA2, programB] = await Promise.all([
      prisma.program.create({ data: { institutionId: institutionA.id, departmentId: departmentA1.id, name: "Program A1 " + suffix, code: "PA1" + suffix, level: "UG", durationYears: 3 }, select: { id: true } }),
      prisma.program.create({ data: { institutionId: institutionA.id, departmentId: departmentA2.id, name: "Program A2 " + suffix, code: "PA2" + suffix, level: "UG", durationYears: 3 }, select: { id: true } }),
      prisma.program.create({ data: { institutionId: institutionB.id, departmentId: departmentB.id, name: "Program B " + suffix, code: "PB" + suffix, level: "UG", durationYears: 3 }, select: { id: true } }),
    ]);
    const now = new Date("2026-01-01T00:00:00.000Z");
    const [yearA1, yearA2, yearB] = await Promise.all([
      prisma.academicYear.create({ data: { institutionId: institutionA.id, name: "AY1-" + suffix, startDate: now, endDate: new Date("2027-01-01T00:00:00.000Z"), isCurrent: true }, select: { id: true } }),
      prisma.academicYear.create({ data: { institutionId: institutionA.id, name: "AY2-" + suffix, startDate: now, endDate: new Date("2027-01-01T00:00:00.000Z"), isCurrent: false }, select: { id: true } }),
      prisma.academicYear.create({ data: { institutionId: institutionB.id, name: "AYB-" + suffix, startDate: now, endDate: new Date("2027-01-01T00:00:00.000Z"), isCurrent: true }, select: { id: true } }),
    ]);
    const [semesterA1, semesterA2, semesterB] = await Promise.all([
      prisma.semester.create({ data: { institutionId: institutionA.id, programId: programA1.id, academicYearId: yearA1.id, number: 1, name: "Semester A1 " + suffix }, select: { id: true } }),
      prisma.semester.create({ data: { institutionId: institutionA.id, programId: programA2.id, academicYearId: yearA2.id, number: 1, name: "Semester A2 " + suffix }, select: { id: true } }),
      prisma.semester.create({ data: { institutionId: institutionB.id, programId: programB.id, academicYearId: yearB.id, number: 1, name: "Semester B " + suffix }, select: { id: true } }),
    ]);
    const [sectionA1, sectionA2, sectionB] = await Promise.all([
      prisma.section.create({ data: { institutionId: institutionA.id, semesterId: semesterA1.id, name: "Section A1 " + suffix }, select: { id: true } }),
      prisma.section.create({ data: { institutionId: institutionA.id, semesterId: semesterA2.id, name: "Section A2 " + suffix }, select: { id: true } }),
      prisma.section.create({ data: { institutionId: institutionB.id, semesterId: semesterB.id, name: "Section B " + suffix }, select: { id: true } }),
    ]);
    const [batchA1, batchA2, batchB] = await Promise.all([
      prisma.batch.create({ data: { institutionId: institutionA.id, programId: programA1.id, name: "Batch A1 " + suffix, code: "BA1" + suffix, admissionYear: 2024, completionYear: 2027 }, select: { id: true } }),
      prisma.batch.create({ data: { institutionId: institutionA.id, programId: programA2.id, name: "Batch A2 " + suffix, code: "BA2" + suffix, admissionYear: 2024, completionYear: 2027 }, select: { id: true } }),
      prisma.batch.create({ data: { institutionId: institutionB.id, programId: programB.id, name: "Batch B " + suffix, code: "BB" + suffix, admissionYear: 2024, completionYear: 2027 }, select: { id: true } }),
    ]);
    const [courseA1, courseA2] = await Promise.all([
      prisma.course.create({ data: { institutionId: institutionA.id, departmentId: departmentA1.id, name: "Course A1 " + suffix, code: "CA1" + suffix, credits: 3 }, select: { id: true } }),
      prisma.course.create({ data: { institutionId: institutionA.id, departmentId: departmentA2.id, name: "Course A2 " + suffix, code: "CA2" + suffix, credits: 3 }, select: { id: true } }),
      prisma.course.create({ data: { institutionId: institutionB.id, departmentId: departmentB.id, name: "Course B " + suffix, code: "CB" + suffix, credits: 3 }, select: { id: true } }),
    ]);

    const tenantRolesA = await createTenantRoleMap(institutionA.id);
    const tenantRolesB: Record<string, string> = {};
    const roleStudentB = await prisma.role.create({
      data: { institutionId: institutionB.id, name: "STUDENT", description: "Temporary student role", isSystem: true },
      select: { id: true },
    });
    tenantRolesB.STUDENT = roleStudentB.id;
    const globalSuperRole = await prisma.role.findFirst({
      where: { institutionId: null, name: "SUPER_ADMIN" },
      select: { id: true },
    });
    if (globalSuperRole) {
      globalSuperAdminRoleId = globalSuperRole.id;
    } else {
      const created = await prisma.role.create({
        data: { institutionId: null, name: "SUPER_ADMIN", description: "Temporary platform role", isSystem: true },
        select: { id: true },
      });
      globalSuperAdminRoleId = created.id;
      createdGlobalSuperAdminRole = true;
    }

    const roleUsers: Record<string, UserFixture> = {};
    for (const name of TENANT_ROLES) {
      roleUsers[name] = await createUserFixture(name.toLowerCase(), institutionA.id, [name], tenantRolesA);
    }
    const facultyA2 = await createUserFixture("faculty-a2", institutionA.id, ["FACULTY"], tenantRolesA);
    const superAdmin = await createUserFixture("super-admin", null, ["SUPER_ADMIN"], { SUPER_ADMIN: globalSuperAdminRoleId });

    const multiDirectorAdmin = await createUserFixture("multi-director-admin", institutionA.id, ["DIRECTOR", "INSTITUTION_ADMIN"], tenantRolesA);
    const multiHodRegistrar = await createUserFixture("multi-hod-registrar", institutionA.id, ["HOD", "REGISTRAR"], tenantRolesA);
    const multiDeanAccounts = await createUserFixture("multi-dean-accounts", institutionA.id, ["DEAN", "ACCOUNTS"], tenantRolesA);
    const multiChairmanDirector = await createUserFixture("multi-chairman-director", institutionA.id, ["CHAIRMAN", "DIRECTOR"], tenantRolesA);
    const multiFacultyStudent = await createUserFixture("multi-faculty-student", institutionA.id, ["FACULTY", "STUDENT"], tenantRolesA);

    await prisma.campusAccess.createMany({
      data: [
        { userId: roleUsers.DIRECTOR.id, campusId: campusA1.id, scope: "DIRECTOR" },
        { userId: multiDirectorAdmin.id, campusId: campusA1.id, scope: "DIRECTOR" },
        { userId: multiChairmanDirector.id, campusId: campusA1.id, scope: "DIRECTOR" },
      ],
    });
    await prisma.departmentAccess.createMany({
      data: [
        { userId: roleUsers.DEAN.id, departmentId: departmentA1.id, scope: "DEAN" },
        { userId: roleUsers.HOD.id, departmentId: departmentA1.id, scope: "HOD" },
        { userId: multiHodRegistrar.id, departmentId: departmentA1.id, scope: "HOD" },
        { userId: multiDeanAccounts.id, departmentId: departmentA1.id, scope: "DEAN" },
      ],
    });

    const studentA1 = roleUsers.STUDENT;
    const studentA2 = await createUserFixture("student-a2", institutionA.id, ["STUDENT"], tenantRolesA);
    const studentB = await createUserFixture("student-b", institutionB.id, ["STUDENT"], tenantRolesB);
    await prisma.studentEnrollment.createMany({
      data: [
        { institutionId: institutionA.id, userId: studentA1.id, programId: programA1.id, academicYearId: yearA1.id, batchId: batchA1.id, semesterId: semesterA1.id, sectionId: sectionA1.id, status: "ACTIVE" },
        { institutionId: institutionA.id, userId: studentA2.id, programId: programA2.id, academicYearId: yearA2.id, batchId: batchA2.id, semesterId: semesterA2.id, sectionId: sectionA2.id, status: "ACTIVE" },
        { institutionId: institutionB.id, userId: studentB.id, programId: programB.id, academicYearId: yearB.id, batchId: batchB.id, semesterId: semesterB.id, sectionId: sectionB.id, status: "ACTIVE" },
        { institutionId: institutionA.id, userId: multiFacultyStudent.id, programId: programA1.id, academicYearId: yearA1.id, batchId: batchA1.id, semesterId: semesterA1.id, sectionId: sectionA1.id, status: "ACTIVE" },
      ],
    });

    const multiFacultyCourse = await prisma.course.create({
      data: { institutionId: institutionA.id, departmentId: departmentA1.id, name: "Course A1 Multi " + suffix, code: "CAM" + suffix, credits: 3 },
      select: { id: true },
    });
    await prisma.courseOffering.createMany({
      data: [
        { institutionId: institutionA.id, courseId: courseA1.id, semesterId: semesterA1.id, sectionId: sectionA1.id, facultyId: roleUsers.FACULTY.id },
        { institutionId: institutionA.id, courseId: multiFacultyCourse.id, semesterId: semesterA1.id, sectionId: sectionA1.id, facultyId: multiFacultyStudent.id },
        { institutionId: institutionA.id, courseId: courseA2.id, semesterId: semesterA2.id, sectionId: sectionA2.id, facultyId: facultyA2.id },
      ],
    });
    const offeringA1 = await prisma.courseOffering.findFirstOrThrow({
      where: { institutionId: institutionA.id, courseId: courseA1.id, semesterId: semesterA1.id, sectionId: sectionA1.id },
      select: { id: true },
    });
    const offeringA2 = await prisma.courseOffering.findFirstOrThrow({
      where: { institutionId: institutionA.id, courseId: courseA2.id, semesterId: semesterA2.id, sectionId: sectionA2.id },
      select: { id: true },
    });
    await prisma.assignment.createMany({
      data: [
        { institutionId: institutionA.id, courseOfferingId: offeringA1.id, createdById: roleUsers.FACULTY.id, title: "Scope Assignment A1 " + suffix, description: "Context isolation fixture", dueDate: new Date("2026-12-01T00:00:00.000Z"), maxMarks: 10, status: "PUBLISHED" },
        { institutionId: institutionA.id, courseOfferingId: offeringA2.id, createdById: facultyA2.id, title: "Scope Assignment A2 " + suffix, description: "Context isolation fixture", dueDate: new Date("2026-12-01T00:00:00.000Z"), maxMarks: 10, status: "PUBLISHED" },
      ],
    });
    await prisma.attendanceSession.createMany({
      data: [
        { institutionId: institutionA.id, courseOfferingId: offeringA1.id, facultyId: roleUsers.FACULTY.id, sessionDate: new Date("2026-10-10T00:00:00.000Z") },
        { institutionId: institutionA.id, courseOfferingId: offeringA2.id, facultyId: facultyA2.id, sessionDate: new Date("2026-10-11T00:00:00.000Z") },
      ],
    });
    await prisma.internalMark.createMany({
      data: [
        { institutionId: institutionA.id, courseOfferingId: offeringA1.id, studentId: studentA1.id, enteredById: roleUsers.FACULTY.id, component: "Scope fixture", marksObtained: 8, maxMarks: 10 },
        { institutionId: institutionA.id, courseOfferingId: offeringA2.id, studentId: studentA2.id, enteredById: facultyA2.id, component: "Scope fixture", marksObtained: 7, maxMarks: 10 },
      ],
    });
    await prisma.timetableEntry.createMany({
      data: [
        { institutionId: institutionA.id, courseOfferingId: offeringA1.id, dayOfWeek: 1, startTime: "09:00", endTime: "10:00", room: "Scope A1" },
        { institutionId: institutionA.id, courseOfferingId: offeringA2.id, dayOfWeek: 1, startTime: "10:00", endTime: "11:00", room: "Scope A2" },
      ],
    });

    // All twenty canonical roles are exercised through the actual Express API.
    // Platform Super Admin is expected to be denied tenant-scoped context.
    for (const role of TENANT_ROLES) {
      const response = await request("/workspace/context", roleUsers[role].token);
      const data = contextData(response);
      assert.equal(data.role, role, "Wrong effective role selected for " + role);
      const campusIds = ids(data.children.campuses);
      const departmentIds = ids(data.children.departments);
      if (["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "REGISTRAR"].includes(role)) {
        assert.deepEqual(campusIds, [campusA1.id, campusA2.id].sort(), role + " should see both active campuses in its tenant.");
        assert.deepEqual(departmentIds, [departmentA1.id, departmentA2.id].sort(), role + " should see both departments in its tenant.");
      } else if (role === "DIRECTOR" || role === "DEAN" || role === "HOD" || role === "FACULTY" || role === "STUDENT") {
        assert.deepEqual(campusIds, [campusA1.id], role + " must remain within its authorized campus.");
        assert.deepEqual(departmentIds, [departmentA1.id], role + " must remain within its authorized department/enrollment.");
      } else {
        assert.deepEqual(campusIds, [], role + " must not inherit generic academic campus options without an explicit scope contract.");
        assert.deepEqual(departmentIds, [], role + " must not inherit generic academic department options without an explicit scope contract.");
      }
    }
    assert.equal((await request("/workspace/context", superAdmin.token)).status, 403, "Platform Super Admin must not use a tenant-scoped workspace endpoint without institution context.");
    assert.equal((await request("/institutions?page=1&pageSize=100", superAdmin.token)).status, 200, "The same platform account must retain its authorized platform API.");
    assert.equal((await request("/institutions?page=1&pageSize=100", roleUsers.INSTITUTION_ADMIN.token)).status, 403, "Institution roles must not gain platform-level institution administration.");
    const studentBHome = contextData(await request("/workspace/context", studentB.token));
    assert.equal(studentBHome.role, "STUDENT");
    assert.equal(studentBHome.scope.campusId, campusB.id);
    assert.notEqual((await request(contextPath({ campusId: campusA1.id }), studentB.token)).status, 200, "A tenant B student must not restore a campus saved from tenant A.");

    // Canonical role priority for accounts with multiple role bindings.
    const multiCases = [
      { fixture: multiDirectorAdmin, role: "DIRECTOR", campuses: [campusA1.id], departments: [departmentA1.id] },
      { fixture: multiHodRegistrar, role: "HOD", campuses: [campusA1.id], departments: [departmentA1.id] },
      { fixture: multiDeanAccounts, role: "DEAN", campuses: [campusA1.id], departments: [departmentA1.id] },
      { fixture: multiChairmanDirector, role: "CHAIRMAN", campuses: [campusA1.id, campusA2.id], departments: [departmentA1.id, departmentA2.id] },
      { fixture: multiFacultyStudent, role: "FACULTY", campuses: [campusA1.id], departments: [departmentA1.id] },
    ];
    for (const item of multiCases) {
      const data = contextData(await request("/workspace/context", item.fixture.token));
      assert.equal(data.role, item.role, "Wrong precedence for multi-role account " + item.fixture.email);
      assert.deepEqual(ids(data.children.campuses), item.campuses.sort());
      assert.deepEqual(ids(data.children.departments), item.departments.sort());
    }

    // A valid selector must return exactly the requested, server-approved scope.
    const validSelection = {
      campusId: campusA1.id,
      departmentId: departmentA1.id,
      programId: programA1.id,
      academicYearId: yearA1.id,
      batchId: batchA1.id,
      semesterId: semesterA1.id,
      sectionId: sectionA1.id,
    };
    const validContext = contextData(await request(contextPath(validSelection), roleUsers.INSTITUTION_ADMIN.token));
    assert.deepEqual(validContext.scope, { institutionId: institutionA.id, ...validSelection });
    assert.notEqual(
      (await request(contextPath({ programId: programA2.id }), roleUsers.STUDENT.token)).status,
      200,
      "A Student must not switch away from their active enrollment by supplying a different programme ID."
    );
    assert.notEqual(
      (await request("/students?departmentId=" + departmentA1.id + "&programId=" + programA1.id + "&academicYearId=" + yearA1.id + "&semesterId=" + semesterA1.id + "&sectionId=" + sectionA2.id, roleUsers.INSTITUTION_ADMIN.token)).status,
      200,
      "A student list filter must reject a section that does not belong to its selected semester."
    );

    const invalidCases: Array<{ label: string; values: Record<string, string | undefined> }> = [
      { label: "foreign/deleted campus", values: { ...validSelection, campusId: campusB.id } },
      { label: "department outside selected campus", values: { ...validSelection, departmentId: departmentA2.id } },
      { label: "programme outside selected department", values: { ...validSelection, programId: programA2.id } },
      { label: "academic year outside selected programme", values: { campusId: campusA1.id, departmentId: departmentA1.id, programId: programA1.id, academicYearId: yearB.id, batchId: batchA1.id } },
      { label: "batch outside selected programme", values: { ...validSelection, batchId: batchA2.id } },
      { label: "semester outside selected programme", values: { ...validSelection, semesterId: semesterA2.id } },
      { label: "section outside selected semester", values: { ...validSelection, sectionId: sectionA2.id } },
    ];
    for (const item of invalidCases) {
      const response = await request(contextPath(item.values), roleUsers.INSTITUTION_ADMIN.token);
      assert.notEqual(response.status, 200, "Stale/unauthorized " + item.label + " was accepted: " + JSON.stringify(response.body));
    }

    // Scoped list routes must apply context and server-side role isolation,
    // including routes that previously calculated but ignored allowed IDs.
    const facultyToken = roleUsers.FACULTY.token;
    const courses = await request("/courses?page=1&pageSize=100&campusId=" + campusA1.id + "&departmentId=" + departmentA1.id, facultyToken);
    assert.equal(courses.status, 200, JSON.stringify(courses.body));
    const courseRows = courses.body.data as Array<{ id: string; departmentId: string }>;
    assert.ok(courseRows.length > 0 && courseRows.every((row) => row.departmentId === departmentA1.id));
    assert.equal((await request("/courses?departmentId=" + departmentA2.id, facultyToken)).status, 403);
    assert.equal((await request("/courses?campusId=" + campusA2.id, facultyToken)).status, 403);

    const programmes = await request("/programs?page=1&pageSize=100", facultyToken);
    assert.equal(programmes.status, 200, JSON.stringify(programmes.body));
    const programmeRows = programmes.body.data as Array<{ id: string; departmentId: string }>;
    assert.ok(programmeRows.length > 0 && programmeRows.every((row) => row.departmentId === departmentA1.id));

    const years = await request("/academic-years?page=1&pageSize=100&campusId=" + campusA1.id + "&departmentId=" + departmentA1.id + "&programId=" + programA1.id, facultyToken);
    assert.equal(years.status, 200, JSON.stringify(years.body));
    const yearRows = years.body.data as Array<{ id: string }>;
    assert.deepEqual(ids(yearRows), [yearA1.id]);
    assert.equal((await request("/academic-years?campusId=" + campusA2.id, facultyToken)).status, 403);

    const semesters = await request("/semesters?page=1&pageSize=100&campusId=" + campusA1.id + "&programId=" + programA1.id + "&departmentId=" + departmentA1.id + "&academicYearId=" + yearA1.id, facultyToken);
    assert.equal(semesters.status, 200, JSON.stringify(semesters.body));
    const semesterRows = semesters.body.data as Array<{ id: string; programId: string }>;
    assert.ok(semesterRows.length > 0 && semesterRows.every((row) => row.programId === programA1.id));

    const sections = await request("/sections?page=1&pageSize=100&campusId=" + campusA1.id + "&semesterId=" + semesterA1.id + "&departmentId=" + departmentA1.id, facultyToken);
    assert.equal(sections.status, 200, JSON.stringify(sections.body));
    const sectionRows = sections.body.data as Array<{ id: string; semesterId: string }>;
    assert.ok(sectionRows.length > 0 && sectionRows.every((row) => row.semesterId === semesterA1.id));

    const offerings = await request("/course-offerings?page=1&pageSize=100&campusId=" + campusA1.id + "&semesterId=" + semesterA1.id + "&sectionId=" + sectionA1.id + "&departmentId=" + departmentA1.id, facultyToken);
    assert.equal(offerings.status, 200, JSON.stringify(offerings.body));
    const offeringRows = offerings.body.data as Array<{ id: string; semesterId: string }>;
    assert.ok(offeringRows.length > 0 && offeringRows.every((row) => row.semesterId === semesterA1.id));
    assert.equal((await request("/course-offerings?semesterId=" + semesterA2.id, facultyToken)).status, 403);

    const scopedPath = (pathname: string, context: Record<string, string>) => {
      const params = new URLSearchParams({ page: "1", pageSize: "100", ...context });
      return pathname + "?" + params.toString();
    };
    const workflowContextA1 = {
      campusId: campusA1.id,
      departmentId: departmentA1.id,
      programId: programA1.id,
      academicYearId: yearA1.id,
      batchId: batchA1.id,
      semesterId: semesterA1.id,
      sectionId: sectionA1.id,
    };
    const workflowContextA2 = {
      campusId: campusA2.id,
      departmentId: departmentA2.id,
      programId: programA2.id,
      academicYearId: yearA2.id,
      batchId: batchA2.id,
      semesterId: semesterA2.id,
      sectionId: sectionA2.id,
    };
    for (const [label, path] of [
      ["assignments", "/assignments"],
      ["attendance sessions", "/attendance-sessions"],
      ["internal marks", "/internal-marks"],
      ["timetable", "/erp/timetable"],
    ] as const) {
      const first = await request(scopedPath(path, workflowContextA1), roleUsers.CHAIRMAN.token);
      assert.equal(first.status, 200, label + " A1 context rejected: " + JSON.stringify(first.body));
      const second = await request(scopedPath(path, workflowContextA2), roleUsers.CHAIRMAN.token);
      assert.equal(second.status, 200, label + " A2 context rejected: " + JSON.stringify(second.body));
      const firstRows = first.body.data as Array<Record<string, unknown>>;
      const secondRows = second.body.data as Array<Record<string, unknown>>;
      assert.ok(firstRows.length > 0, label + " must return seeded A1 data under the A1 context.");
      assert.ok(secondRows.length > 0, label + " must return seeded A2 data under the A2 context.");
      const a1Ids = new Set(firstRows.map((row) => {
        const offering = row.courseOffering as { id?: string } | undefined;
        return typeof row.courseOfferingId === "string" ? row.courseOfferingId : offering?.id;
      }));
      const a2Ids = new Set(secondRows.map((row) => {
        const offering = row.courseOffering as { id?: string } | undefined;
        return typeof row.courseOfferingId === "string" ? row.courseOfferingId : offering?.id;
      }));
      assert.ok(a1Ids.has(offeringA1.id), label + " did not return the selected A1 offering.");
      assert.ok(!a1Ids.has(offeringA2.id), label + " leaked an A2 offering into the A1 query.");
      assert.ok(a2Ids.has(offeringA2.id), label + " did not return the selected A2 offering.");
      assert.ok(!a2Ids.has(offeringA1.id), label + " leaked an A1 offering into the A2 query.");
    }
    const studentAssignments = await request(scopedPath("/assignments", workflowContextA1), studentA1.token);
    assert.equal(studentAssignments.status, 200, "A Student's own active enrollment context should be accepted.");
    const studentAssignmentRows = studentAssignments.body.data as Array<{ courseOfferingId: string }>;
    assert.ok(studentAssignmentRows.every((row) => row.courseOfferingId === offeringA1.id));
    assert.equal(
      (await request(scopedPath("/assignments", workflowContextA2), studentA1.token)).status,
      403,
      "A Student must not use the list filters to switch to a different batch/programme/section."
    );

    for (const path of [
      "/assignments?campusId=" + campusA2.id,
      "/attendance-sessions?campusId=" + campusA2.id,
      "/internal-marks?campusId=" + campusA2.id,
      "/erp/timetable?campusId=" + campusA2.id,
    ]) {
      assert.equal((await request(path, facultyToken)).status, 403, "Faculty must not force another campus via " + path);
    }
    assert.notEqual(
      (await request("/assignments?programId=" + programA1.id + "&academicYearId=" + yearA2.id, roleUsers.CHAIRMAN.token)).status,
      200,
      "Assignment list must reject a programme/year combination that has no matching active semester."
    );
    assert.notEqual(
      (await request("/internal-marks?semesterId=" + semesterA1.id + "&sectionId=" + sectionA2.id, roleUsers.CHAIRMAN.token)).status,
      200,
      "Marks list must reject a section outside the selected semester."
    );
    assert.notEqual(
      (await request("/attendance-sessions?batchId=" + batchA2.id + "&sectionId=" + sectionA1.id, roleUsers.CHAIRMAN.token)).status,
      200,
      "Attendance list must reject a batch outside the selected section's programme."
    );

    const batches = await request("/batches?page=1&pageSize=100&campusId=" + campusA1.id + "&departmentId=" + departmentA1.id + "&programId=" + programA1.id, roleUsers.HOD.token);
    assert.equal(batches.status, 200, JSON.stringify(batches.body));
    const batchRows = batches.body.data as Array<{ id: string; programId: string }>;
    assert.ok(batchRows.length > 0 && batchRows.every((row) => row.programId === programA1.id));
    assert.equal((await request("/batches?programId=" + programA2.id, roleUsers.HOD.token)).status, 403);
    assert.equal((await request("/batches/" + batchB.id, roleUsers.HOD.token)).status, 404);
    assert.equal((await request("/batches/" + batchA2.id, roleUsers.HOD.token)).status, 403);

    const students = await request("/students?page=1&pageSize=100&campusId=" + campusA1.id + "&departmentId=" + departmentA1.id + "&programId=" + programA1.id + "&academicYearId=" + yearA1.id + "&batchId=" + batchA1.id + "&semesterId=" + semesterA1.id + "&sectionId=" + sectionA1.id, roleUsers.HOD.token);
    assert.equal(students.status, 200, JSON.stringify(students.body));
    const studentRows = students.body.data as Array<{ id: string }>;
    assert.ok(studentRows.some((row) => row.id === studentA1.id));
    assert.ok(!studentRows.some((row) => row.id === studentA2.id));
    assert.equal((await request("/students/" + studentA2.id + "/enrollments", roleUsers.HOD.token)).status, 403, "HOD must not open another department's student record.");
    assert.equal((await request("/students/" + studentB.id + "/enrollments", roleUsers.HOD.token)).status, 403, "Tenant A must not open tenant B's student record.");

    const foreignDepartment = await request("/courses?departmentId=" + departmentB.id, roleUsers.HOD.token);
    assert.notEqual(foreignDepartment.status, 200, "Cross-tenant department ID must not produce a successful list response.");
    const foreignProgram = await request("/students?programId=" + programB.id, roleUsers.HOD.token);
    assert.notEqual(foreignProgram.status, 200, "Cross-tenant program filter must not be accepted.");
    assert.equal((await request("/students?campusId=" + campusA2.id, roleUsers.HOD.token)).status, 403);

    // A role change invalidates the account's previously valid campus scope.
    await prisma.userRole.delete({ where: { userId_roleId: { userId: multiDirectorAdmin.id, roleId: tenantRolesA.DIRECTOR } } });
    await prisma.userRole.create({ data: { userId: multiDirectorAdmin.id, roleId: tenantRolesA.PARENT } });
    const roleChanged = contextData(await request("/workspace/context", multiDirectorAdmin.token));
    assert.equal(roleChanged.role, "PARENT");
    assert.deepEqual(roleChanged.children.campuses, []);

    // Revoke the Director's CampusAccess without changing the role binding.
    // Both an explicit saved selection and the default option list must re-read
    // the database immediately; neither can revive a cached grant.
    await prisma.campusAccess.delete({ where: { userId_campusId: { userId: roleUsers.DIRECTOR.id, campusId: campusA1.id } } });
    const revokedCampus = await request(contextPath(validSelection), roleUsers.DIRECTOR.token);
    assert.notEqual(revokedCampus.status, 200, "Revoked CampusAccess must reject a previously valid persisted selection.");
    const directorDefault = contextData(await request("/workspace/context", roleUsers.DIRECTOR.token));
    assert.deepEqual(directorDefault.children.campuses, [], "Revoked campus must disappear from current selector options immediately.");

    // An equivalent stale department selection after DepartmentAccess revocation
    // must also be rejected and removed from the options.
    await prisma.departmentAccess.delete({ where: { userId_departmentId: { userId: roleUsers.HOD.id, departmentId: departmentA1.id } } });
    const revokedDepartment = await request(contextPath(validSelection), roleUsers.HOD.token);
    assert.notEqual(revokedDepartment.status, 200, "Revoked DepartmentAccess must reject a persisted selection.");
    const hodDefault = contextData(await request("/workspace/context", roleUsers.HOD.token));
    assert.deepEqual(hodDefault.children.departments, [], "Revoked department must be removed from selector options immediately.");

    // Delete a once-valid campus after selection, then replay its saved ID.
    await prisma.campus.delete({ where: { id: campusA2.id } });
    const deletedCampus = await request(contextPath({ campusId: campusA2.id }), roleUsers.INSTITUTION_ADMIN.token);
    assert.notEqual(deletedCampus.status, 200, "Deleted campus IDs must not be revived by saved client state.");
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    }
    if (institutionIds.length) {
      await prisma.institution.deleteMany({ where: { id: { in: institutionIds } } }).catch(() => undefined);
    }
    if (createdGlobalSuperAdminRole && globalSuperAdminRoleId) {
      await prisma.role.deleteMany({ where: { id: globalSuperAdminRoleId, institutionId: null, name: "SUPER_ADMIN" } }).catch(() => undefined);
    }
  }
});
