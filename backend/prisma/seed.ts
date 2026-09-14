/**
 * ACADLYX demo seed data.
 *
 * Idempotent — safe to run multiple times (uses upsert / find-or-create).
 * Creates:
 *   - AIMT institution
 *   - the full Phase 1 permission catalog
 *   - SUPER_ADMIN (platform role) + AIMT's institution roles
 *   - one demo user per required role
 *
 * Run with: npm run prisma:seed
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { repairInstitutionRbac } from "./rbac";

const prisma = new PrismaClient();

function requireDemoPassword(): string {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) {
    throw new Error("SEED_DEMO_PASSWORD must be set before running the demo seed.");
  }
  return password;
}

const PERMISSIONS: Array<{ key: string; module: string; description: string }> = [
  { key: "users.read", module: "users", description: "View users" },
  { key: "users.create", module: "users", description: "Create users" },
  { key: "users.update", module: "users", description: "Update users" },
  { key: "users.delete", module: "users", description: "Delete/deactivate users" },

  { key: "students.read", module: "students", description: "View students" },
  { key: "students.create", module: "students", description: "Create students" },
  { key: "students.update", module: "students", description: "Update students" },

  { key: "attendance.read", module: "attendance", description: "View attendance" },
  { key: "attendance.mark", module: "attendance", description: "Mark attendance" },

  { key: "assignments.read", module: "assignments", description: "View assignments" },
  { key: "assignments.create", module: "assignments", description: "Create assignments" },
  { key: "assignments.update", module: "assignments", description: "Edit/publish assignments" },
  { key: "assignments.review", module: "assignments", description: "Review/grade assignments" },
  { key: "assignments.submit", module: "assignments", description: "Submit assignment work" },

  { key: "marks.read", module: "marks", description: "View academic marks" },
  { key: "marks.enter", module: "marks", description: "Enter academic marks" },

  { key: "reports.read", module: "reports", description: "View reports" },
  { key: "intelligence.read", module: "intelligence", description: "View institutional intelligence" },

  { key: "institutions.manage", module: "institutions", description: "Manage institutions (platform-level)" },

  { key: "departments.read", module: "academics", description: "View departments" },
  { key: "departments.create", module: "academics", description: "Create departments" },
  { key: "departments.update", module: "academics", description: "Update departments" },
  { key: "departments.delete", module: "academics", description: "Deactivate departments" },

  { key: "programs.read", module: "academics", description: "View programs" },
  { key: "programs.create", module: "academics", description: "Create programs" },
  { key: "programs.update", module: "academics", description: "Update programs" },
  { key: "programs.delete", module: "academics", description: "Deactivate programs" },

  { key: "academic-years.read", module: "academics", description: "View academic years" },
  { key: "academic-years.create", module: "academics", description: "Create academic years" },
  { key: "academic-years.update", module: "academics", description: "Update academic years" },

  { key: "semesters.read", module: "academics", description: "View semesters" },
  { key: "semesters.create", module: "academics", description: "Create semesters" },
  { key: "semesters.update", module: "academics", description: "Update semesters" },
  { key: "semesters.delete", module: "academics", description: "Deactivate semesters" },

  { key: "sections.read", module: "academics", description: "View sections" },
  { key: "sections.create", module: "academics", description: "Create sections" },
  { key: "sections.update", module: "academics", description: "Update sections" },
  { key: "sections.delete", module: "academics", description: "Deactivate sections" },

  { key: "courses.read", module: "academics", description: "View courses" },
  { key: "courses.create", module: "academics", description: "Create courses" },
  { key: "courses.update", module: "academics", description: "Update courses" },
  { key: "courses.delete", module: "academics", description: "Deactivate courses" },

  { key: "course-offerings.read", module: "academics", description: "View course offerings" },
  { key: "course-offerings.create", module: "academics", description: "Create course offerings" },
  { key: "course-offerings.update", module: "academics", description: "Update course offerings (e.g. reassign faculty)" },
  { key: "course-offerings.delete", module: "academics", description: "Close/deactivate course offerings" },
];

/** Every academic-structure read permission — granted to nearly every role. */
const ACADEMIC_READ_PERMISSIONS = [
  "departments.read",
  "programs.read",
  "academic-years.read",
  "semesters.read",
  "sections.read",
  "courses.read",
  "course-offerings.read",
];

/** name -> permission keys granted */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.key), // everything
  INSTITUTION_ADMIN: PERMISSIONS.map((p) => p.key).filter(
    (k) => k !== "institutions.manage"
  ),
  DIRECTOR: [
    "users.read",
    "students.read",
    "attendance.read",
    "assignments.read",
    "marks.read",
    "reports.read",
    "intelligence.read",
    ...ACADEMIC_READ_PERMISSIONS,
  ],
  MANAGEMENT: [
    "users.read",
    "students.read",
    "attendance.read",
    "assignments.read",
    "marks.read",
    "reports.read",
    "intelligence.read",
    ...ACADEMIC_READ_PERMISSIONS,
  ],
  HOD: [
    "users.read",
    "students.read",
    "attendance.read",
    "assignments.read",
    "assignments.review",
    "marks.read",
    "reports.read",
    "intelligence.read",
    ...ACADEMIC_READ_PERMISSIONS,
    "sections.update",
    "course-offerings.update",
  ],
  FACULTY: [
    "students.read",
    "attendance.read",
    "attendance.mark",
    "assignments.read",
    "assignments.create",
    "assignments.update",
    "assignments.review",
    "marks.read",
    "marks.enter",
    ...ACADEMIC_READ_PERMISSIONS,
  ],
  STAFF: ["students.read", "users.read", ...ACADEMIC_READ_PERMISSIONS],
  STUDENT: [
    "attendance.read",
    "assignments.read",
    "assignments.submit",
    "marks.read",
    ...ACADEMIC_READ_PERMISSIONS,
  ],
  PARENT: [
    "attendance.read",
    "assignments.read",
    "marks.read",
    ...ACADEMIC_READ_PERMISSIONS,
  ],
};

const DEMO_USERS: Array<{
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  scopedToInstitution: boolean;
}> = [
  { email: "superadmin@acadlyx.com", firstName: "Platform", lastName: "Admin", role: "SUPER_ADMIN", scopedToInstitution: false },
  { email: "management@aimt.acadlyx.com", firstName: "Meera", lastName: "Kapoor", role: "MANAGEMENT", scopedToInstitution: true },
  { email: "hod@aimt.acadlyx.com", firstName: "Rajesh", lastName: "Sharma", role: "HOD", scopedToInstitution: true },
  { email: "faculty@aimt.acadlyx.com", firstName: "Anita", lastName: "Verma", role: "FACULTY", scopedToInstitution: true },
  { email: "student@aimt.acadlyx.com", firstName: "Rohan", lastName: "Gupta", role: "STUDENT", scopedToInstitution: true },
  { email: "parent@aimt.acadlyx.com", firstName: "Suresh", lastName: "Gupta", role: "PARENT", scopedToInstitution: true },
];

async function main() {
  console.log("Seeding ACADLYX demo data...");

  // --- Institution ---
  const aimt = await prisma.institution.upsert({
    where: { slug: "aimt" },
    update: { logoUrl: "/branding/aimt-logo.png" },
    create: {
      name: "Accurate Institute of Management & Technology",
      slug: "aimt",
      logoUrl: "/branding/aimt-logo.png",
      primaryColor: "#0f172a",
      secondaryColor: "#64748b",
      isActive: true,
    },
  });
  console.log(`Institution ready: ${aimt.name} (${aimt.id})`);
  await repairInstitutionRbac(prisma, aimt.id);

  // --- Permissions ---
  const permissionRecords = new Map<string, string>(); // key -> id
  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { key: perm.key },
      update: { module: perm.module, description: perm.description },
      create: perm,
    });
    permissionRecords.set(record.key, record.id);
  }
  console.log(`Permissions ready: ${permissionRecords.size}`);

  // --- Roles + RolePermissions ---
  const roleRecords = new Map<string, string>(); // name -> id
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const isPlatformRole = roleName === "SUPER_ADMIN";
    const institutionId = isPlatformRole ? null : aimt.id;

    let role = await prisma.role.findFirst({
      where: { name: roleName, institutionId },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleName,
          institutionId,
          isSystem: true,
          description: `${roleName.replace(/_/g, " ")} role`,
        },
      });
    }
    roleRecords.set(roleName, role.id);

    for (const permKey of permKeys) {
      const permissionId = permissionRecords.get(permKey);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }
  console.log(`Roles ready: ${roleRecords.size}`);

  // --- Demo users ---
  const passwordHash = await hashPassword(requireDemoPassword());

  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {},
      create: {
        email: demo.email,
        passwordHash,
        firstName: demo.firstName,
        lastName: demo.lastName,
        institutionId: demo.scopedToInstitution ? aimt.id : null,
        isActive: true,
      },
    });

    const roleId = roleRecords.get(demo.role);
    if (roleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });
    }

    console.log(`  - ${demo.role.padEnd(16)} ${demo.email}`);
  }

  // --- Academic structure demo data (Phase 2) ---
  const facultyUser = await prisma.user.findUnique({
    where: { email: "faculty@aimt.acadlyx.com" },
  });
  const hodUser = await prisma.user.findUnique({ where: { email: "hod@aimt.acadlyx.com" } });

  const cse = await upsertDepartment(aimt.id, "Computer Science & Engineering", "CSE");
  const ece = await upsertDepartment(aimt.id, "Electronics & Communication Engineering", "ECE");

  const btechCse = await upsertProgram(aimt.id, cse.id, "B.Tech Computer Science & Engineering", "BTECH-CSE", "UG", 4);
  await upsertProgram(aimt.id, ece.id, "B.Tech Electronics & Communication Engineering", "BTECH-ECE", "UG", 4);

  const ay2025 = await upsertAcademicYear(
    aimt.id,
    "2025-2026",
    new Date("2025-07-01"),
    new Date("2026-06-30"),
    true
  );

  const sem3 = await upsertSemester(aimt.id, btechCse.id, ay2025.id, 3, "Semester 3");

  const sectionA = await upsertSection(aimt.id, sem3.id, "A", 60);
  await upsertSection(aimt.id, sem3.id, "B", 60);

  const dbms = await upsertCourse(aimt.id, cse.id, "CS301", "Database Management Systems", 4);
  const os = await upsertCourse(aimt.id, cse.id, "CS302", "Operating Systems", 4);
  await upsertCourse(aimt.id, cse.id, "CS303", "Computer Networks", 3);

  await upsertCourseOffering(aimt.id, dbms.id, sem3.id, sectionA.id, facultyUser?.id);
  await upsertCourseOffering(aimt.id, os.id, sem3.id, sectionA.id, facultyUser?.id);
  if (hodUser) {
    await prisma.departmentAccess.upsert({
      where: { userId_departmentId: { userId: hodUser.id, departmentId: cse.id } },
      update: { scope: "HOD" }, create: { userId: hodUser.id, departmentId: cse.id, scope: "HOD" },
    });
  }

  const studentUser = await prisma.user.findUnique({
    where: { email: "student@aimt.acadlyx.com" },
  });
  if (studentUser) {
    await prisma.studentEnrollment.upsert({
      where: {
        userId_academicYearId: { userId: studentUser.id, academicYearId: ay2025.id },
      },
      update: {
        programId: btechCse.id,
        sectionId: sectionA.id,
        rollNumber: "AIMT-CSE-2023-001",
      },
      create: {
        institutionId: aimt.id,
        userId: studentUser.id,
        programId: btechCse.id,
        academicYearId: ay2025.id,
        sectionId: sectionA.id,
        rollNumber: "AIMT-CSE-2023-001",
        status: "ACTIVE",
      },
    });
    console.log("  - Student enrollment ready: student@aimt.acadlyx.com -> B.Tech CSE, Sem 3, Section A");
  }

  console.log("Academic structure demo data ready: CSE/ECE depts, B.Tech CSE program,");
  console.log("  2025-2026 academic year, Semester 3 (Sections A/B), 3 courses, 2 course offerings.");

  // --- Attendance roster + demo history (Phase 4) ---
  // A handful of extra students so the faculty attendance UI has a
  // real roster to check off, rather than a roster of one.
  const rosterNames: Array<[string, string]> = [
    ["Rahul", "Verma"],
    ["Priya", "Iyer"],
    ["Aman", "Khan"],
    ["Ayush", "Sharma"],
    ["Neha", "Joshi"],
    ["Kabir", "Rao"],
  ];

  const rosterStudentIds: string[] = [];
  const studentRoleId = roleRecords.get("STUDENT");
  const studentPasswordHash = await hashPassword(requireDemoPassword());

  for (const [firstName, lastName] of rosterNames) {
    const email = `${firstName}.${lastName}@aimt.acadlyx.com`.toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: studentPasswordHash,
        firstName,
        lastName,
        institutionId: aimt.id,
        isActive: true,
      },
    });

    if (studentRoleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: studentRoleId } },
        update: {},
        create: { userId: user.id, roleId: studentRoleId },
      });
    }

    await prisma.studentEnrollment.upsert({
      where: {
        userId_academicYearId: { userId: user.id, academicYearId: ay2025.id },
      },
      update: { programId: btechCse.id, sectionId: sectionA.id },
      create: {
        institutionId: aimt.id,
        userId: user.id,
        programId: btechCse.id,
        academicYearId: ay2025.id,
        sectionId: sectionA.id,
        status: "ACTIVE",
      },
    });

    rosterStudentIds.push(user.id);
  }
  console.log(`  - Roster ready: ${rosterNames.length} additional students enrolled in Section A`);

  // One submitted historical session for DBMS/Section A (a few days
  // ago) with a mix of present/absent, so "students below 75%
  // attendance" has something real to compute against instead of
  // always reading zero on a fresh seed.
  if (facultyUser && rosterStudentIds.length > 0) {
    const historicalDate = new Date();
    historicalDate.setDate(historicalDate.getDate() - 3);
    historicalDate.setHours(0, 0, 0, 0);

    const dbmsOffering = await prisma.courseOffering.findFirstOrThrow({
      where: { institutionId: aimt.id, courseId: dbms.id, sectionId: sectionA.id },
    });

    const historicalSession = await prisma.attendanceSession.upsert({
      where: {
        courseOfferingId_sessionDate: {
          courseOfferingId: dbmsOffering.id,
          sessionDate: historicalDate,
        },
      },
      update: {},
      create: {
        institutionId: aimt.id,
        courseOfferingId: dbmsOffering.id,
        facultyId: facultyUser.id,
        sessionDate: historicalDate,
        isSubmitted: true,
        submittedAt: historicalDate,
      },
    });

    // Mark the first two roster students absent (so they show up
    // "at risk"), everyone else present.
    const absentIds = new Set(rosterStudentIds.slice(0, 2));
    for (const studentId of rosterStudentIds) {
      await prisma.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: historicalSession.id,
            studentId,
          },
        },
        update: {},
        create: {
          attendanceSessionId: historicalSession.id,
          studentId,
          status: absentIds.has(studentId) ? "ABSENT" : "PRESENT",
        },
      });
    }
    console.log("  - Historical attendance session seeded (DBMS/Section A, 3 days ago)");
  }

  // --- Assignments + submissions + internal marks (Phase 5) ---
  if (facultyUser) {
    const dbmsOffering = await prisma.courseOffering.findFirstOrThrow({
      where: { institutionId: aimt.id, courseId: dbms.id, sectionId: sectionA.id },
    });
    const primaryStudent = await prisma.user.findUnique({
      where: { email: "student@aimt.acadlyx.com" },
    });
    const sectionAStudentIds = [
      ...(primaryStudent ? [primaryStudent.id] : []),
      ...rosterStudentIds,
    ];

    const dueSoon = new Date();
    dueSoon.setDate(dueSoon.getDate() + 3);
    const overdue = new Date();
    overdue.setDate(overdue.getDate() - 2);

    let assignment4 = await prisma.assignment.findFirst({
      where: { institutionId: aimt.id, courseOfferingId: dbmsOffering.id, title: "Assignment #4" },
    });
    if (!assignment4) {
      assignment4 = await prisma.assignment.create({
        data: {
          institutionId: aimt.id,
          courseOfferingId: dbmsOffering.id,
          createdById: facultyUser.id,
          title: "Assignment #4",
          description: "Normalize the given schema to 3NF and submit your ER diagram.",
          dueDate: dueSoon,
          maxMarks: 50,
          status: "PUBLISHED",
        },
      });
    }

    let assignment3 = await prisma.assignment.findFirst({
      where: { institutionId: aimt.id, courseOfferingId: dbmsOffering.id, title: "Assignment #3" },
    });
    if (!assignment3) {
      assignment3 = await prisma.assignment.create({
        data: {
          institutionId: aimt.id,
          courseOfferingId: dbmsOffering.id,
          createdById: facultyUser.id,
          title: "Assignment #3",
          description: "SQL joins and subqueries problem set.",
          dueDate: overdue,
          maxMarks: 50,
          status: "PUBLISHED",
        },
      });
    }

    // 3 of 7 students have submitted Assignment #3; 4 have not —
    // matches the "4 students haven't submitted Assignment #3"
    // smart-insight example from the faculty dashboard mockup.
    const submittedIds = sectionAStudentIds.slice(0, 3);
    for (const studentId of submittedIds) {
      await prisma.assignmentSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId: assignment3.id, studentId } },
        update: {},
        create: {
          institutionId: aimt.id,
          assignmentId: assignment3.id,
          studentId,
          content: "Submitted via seed data — SQL join queries attached.",
          status: "SUBMITTED",
        },
      });
    }
    console.log(`  - Assignments seeded: Assignment #3 (3/${sectionAStudentIds.length} submitted), Assignment #4 (open)`);

    // Internal marks: "Internal 1" component for every Section A student.
    const markValues = [42, 38, 45, 30, 40, 35, 44]; // out of 50
    for (let i = 0; i < sectionAStudentIds.length; i++) {
      await prisma.internalMark.upsert({
        where: {
          courseOfferingId_studentId_component: {
            courseOfferingId: dbmsOffering.id,
            studentId: sectionAStudentIds[i],
            component: "Internal 1",
          },
        },
        update: {},
        create: {
          institutionId: aimt.id,
          courseOfferingId: dbmsOffering.id,
          studentId: sectionAStudentIds[i],
          enteredById: facultyUser.id,
          component: "Internal 1",
          marksObtained: markValues[i % markValues.length],
          maxMarks: 50,
        },
      });
    }
    console.log("  - Internal marks seeded: 'Internal 1' component, DBMS/Section A");
  }

  // Career intelligence demo data is explicitly scoped to AIMT and is
  // deterministic input for readiness calculations, never invented at read time.
  const studentForCareer = await prisma.user.findUnique({ where: { email: "student@aimt.acadlyx.com" } });
  if (studentForCareer) {
    const skillRows = await Promise.all([
      upsertSkill(aimt.id, "SQL", "Technical"), upsertSkill(aimt.id, "Python", "Technical"),
      upsertSkill(aimt.id, "Data Structures", "Technical"), upsertSkill(aimt.id, "Communication", "Professional"),
    ]);
    const role = await prisma.targetRole.upsert({ where: { institutionId_name: { institutionId: aimt.id, name: "Junior Data Analyst" } }, update: {}, create: { institutionId: aimt.id, name: "Junior Data Analyst", description: "Entry-level analytics role" } });
    for (const [skill, weight, minimumLevel] of [[skillRows[0], 3, 70], [skillRows[1], 3, 65], [skillRows[2], 2, 65], [skillRows[3], 2, 60]] as const) {
      await prisma.roleSkill.upsert({ where: { targetRoleId_skillId: { targetRoleId: role.id, skillId: skill.id } }, update: { weight, minimumLevel }, create: { targetRoleId: role.id, skillId: skill.id, weight, minimumLevel } });
    }
    await prisma.careerPath.upsert({ where: { studentId_targetRoleId: { studentId: studentForCareer.id, targetRoleId: role.id } }, update: { isPrimary: true }, create: { studentId: studentForCareer.id, targetRoleId: role.id, isPrimary: true } });
    for (const [skill, proficiency] of [[skillRows[0], 72], [skillRows[1], 55], [skillRows[2], 68], [skillRows[3], 70]] as const) {
      await prisma.studentSkill.upsert({ where: { studentId_skillId: { studentId: studentForCareer.id, skillId: skill.id } }, update: { proficiency }, create: { institutionId: aimt.id, studentId: studentForCareer.id, skillId: skill.id, proficiency } });
    }
    await prisma.opportunity.upsert({ where: { id: "aimt-demo-data-analyst-opportunity" }, update: { isActive: true }, create: { id: "aimt-demo-data-analyst-opportunity", institutionId: aimt.id, targetRoleId: role.id, title: "Data Analyst Intern", organization: "AIMT Career Cell", isActive: true } });
  }

  console.log("\nSeed complete.");
  console.log("Demo users seeded with the configured SEED_DEMO_PASSWORD.");
}

// --- Phase 2 upsert helpers (Prisma composite-unique upserts) ---

async function upsertDepartment(institutionId: string, name: string, code: string) {
  return prisma.department.upsert({
    where: { institutionId_code: { institutionId, code } },
    update: { name },
    create: { institutionId, name, code },
  });
}

async function upsertProgram(
  institutionId: string,
  departmentId: string,
  name: string,
  code: string,
  level: string,
  durationYears: number
) {
  return prisma.program.upsert({
    where: { institutionId_code: { institutionId, code } },
    update: { name, departmentId, level, durationYears },
    create: { institutionId, departmentId, name, code, level, durationYears },
  });
}

async function upsertAcademicYear(
  institutionId: string,
  name: string,
  startDate: Date,
  endDate: Date,
  isCurrent: boolean
) {
  const year = await prisma.academicYear.upsert({
    where: { institutionId_name: { institutionId, name } },
    update: { startDate, endDate },
    create: { institutionId, name, startDate, endDate, isCurrent },
  });
  if (isCurrent) {
    await prisma.academicYear.updateMany({
      where: { institutionId, isCurrent: true, NOT: { id: year.id } },
      data: { isCurrent: false },
    });
    if (!year.isCurrent) {
      await prisma.academicYear.update({ where: { id: year.id }, data: { isCurrent: true } });
    }
  }
  return year;
}

async function upsertSemester(
  institutionId: string,
  programId: string,
  academicYearId: string,
  number: number,
  name: string
) {
  return prisma.semester.upsert({
    where: { programId_academicYearId_number: { programId, academicYearId, number } },
    update: { name },
    create: { institutionId, programId, academicYearId, number, name },
  });
}

async function upsertSection(
  institutionId: string,
  semesterId: string,
  name: string,
  capacity: number
) {
  return prisma.section.upsert({
    where: { semesterId_name: { semesterId, name } },
    update: { capacity },
    create: { institutionId, semesterId, name, capacity },
  });
}

async function upsertCourse(
  institutionId: string,
  departmentId: string,
  code: string,
  name: string,
  credits: number
) {
  return prisma.course.upsert({
    where: { institutionId_code: { institutionId, code } },
    update: { name, departmentId, credits },
    create: { institutionId, departmentId, code, name, credits },
  });
}

async function upsertCourseOffering(
  institutionId: string,
  courseId: string,
  semesterId: string,
  sectionId: string,
  facultyId: string | undefined
) {
  return prisma.courseOffering.upsert({
    where: { courseId_semesterId_sectionId: { courseId, semesterId, sectionId } },
    update: { facultyId },
    create: { institutionId, courseId, semesterId, sectionId, facultyId },
  });
}

async function upsertSkill(institutionId: string, name: string, category: string) {
  return prisma.skill.upsert({ where: { institutionId_name: { institutionId, name } }, update: { category }, create: { institutionId, name, category } });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
