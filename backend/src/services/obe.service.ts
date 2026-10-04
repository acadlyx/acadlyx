import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { getCanonicalRoleNames } from "../config/rbac";
import { getManagedDepartmentIds, isInstitutionWide } from "../config/scope";
import { assertOwnsCourseOffering } from "../utils/courseOfferingAccess";
import {
  CalculateAttainmentInput,
  CreateAssessmentInput,
  CreateCourseOutcomeInput,
  CreatePolicyInput,
  CreateProgrammeOutcomeInput,
  CreateRunInput,
  ProgrammeAttainmentInput,
  ReplaceMappingInput,
  ReplaceScoresInput,
  UpdateAssessmentInput,
  UpdateAssessmentItemsInput,
  UpdateCourseOutcomeInput,
  UpdatePolicyInput,
  UpdateProgrammeOutcomeInput,
} from "../validators/obe.validators";

function roles(user: AuthenticatedUser) {
  return getCanonicalRoleNames(user.roles);
}

function hasRole(user: AuthenticatedUser, role: string) {
  return roles(user).some((candidate) => candidate === role);
}

async function assertProgramAccess(
  institutionId: string,
  user: AuthenticatedUser,
  programId: string,
  write = false
) {
  const program = await prisma.program.findFirst({
    where: { id: programId, institutionId },
    select: { id: true, departmentId: true, name: true, code: true, isActive: true },
  });
  if (!program) throw new AppError("Programme not found in this institution", 404);

  if (isInstitutionWide(user)) return program;

  if (hasRole(user, "HOD")) {
    const managed = await getManagedDepartmentIds(institutionId, user.id);
    if (!managed.includes(program.departmentId)) {
      throw new AppError("This programme is outside your department scope", 403);
    }
    return program;
  }

  if (hasRole(user, "FACULTY")) {
    const taught = await prisma.courseOffering.findFirst({
      where: {
        institutionId,
        facultyId: user.id,
        course: { departmentId: program.departmentId },
        semester: { programId },
      },
      select: { id: true },
    });
    if (taught) return program;
  }

  if (!write && hasRole(user, "STUDENT")) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { institutionId, userId: user.id, programId, status: "ACTIVE" },
      select: { id: true },
    });
    if (enrollment) return program;
  }

  throw new AppError("This programme is outside your authorized scope", 403);
}

async function loadOffering(
  institutionId: string,
  user: AuthenticatedUser,
  courseOfferingId: string,
  write = false
) {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: courseOfferingId, institutionId },
    include: {
      course: { select: { id: true, code: true, name: true, departmentId: true } },
      semester: {
        select: {
          id: true,
          number: true,
          name: true,
          programId: true,
          academicYearId: true,
          program: { select: { id: true, name: true, code: true, departmentId: true } },
          academicYear: { select: { id: true, name: true } },
        },
      },
      section: { select: { id: true, name: true } },
    },
  });
  if (!offering) throw new AppError("Course offering not found in this institution", 404);

  if (isInstitutionWide(user)) return offering;
  if (hasRole(user, "FACULTY")) {
    assertOwnsCourseOffering(user, offering.facultyId);
    return offering;
  }
  if (hasRole(user, "HOD")) {
    const managed = await getManagedDepartmentIds(institutionId, user.id);
    if (!managed.includes(offering.course.departmentId)) {
      throw new AppError("This course offering is outside your department scope", 403);
    }
    return offering;
  }
  if (!write && hasRole(user, "STUDENT")) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        institutionId,
        userId: user.id,
        programId: offering.semester.programId,
        semesterId: offering.semesterId,
        sectionId: offering.sectionId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (enrollment) return offering;
  }

  throw new AppError("This course offering is outside your authorized scope", 403);
}

export async function listCourseOfferings(institutionId: string, user: AuthenticatedUser) {
  const where: Prisma.CourseOfferingWhereInput = { institutionId, isActive: true };
  if (isInstitutionWide(user)) {
    // unrestricted inside tenant
  } else if (hasRole(user, "FACULTY")) {
    where.facultyId = user.id;
  } else if (hasRole(user, "HOD")) {
    const departments = await getManagedDepartmentIds(institutionId, user.id);
    where.course = { departmentId: { in: departments } };
  } else if (hasRole(user, "STUDENT")) {
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { institutionId, userId: user.id, status: "ACTIVE" },
      select: { semesterId: true, sectionId: true },
    });
    const pairs = enrollments.filter((e) => e.semesterId && e.sectionId);
    where.OR = pairs.map((e) => ({ semesterId: e.semesterId!, sectionId: e.sectionId! }));
    if (!where.OR?.length) return [];
  } else {
    return [];
  }

  return prisma.courseOffering.findMany({
    where,
    orderBy: [{ semester: { number: "asc" } }, { course: { code: "asc" } }],
    include: {
      course: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, name: true } },
      semester: {
        select: {
          id: true, number: true, name: true, programId: true,
          program: { select: { id: true, name: true, code: true } },
          academicYear: { select: { id: true, name: true } },
        },
      },
      faculty: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function listProgrammeOutcomes(institutionId: string, user: AuthenticatedUser, programId: string) {
  await assertProgramAccess(institutionId, user, programId);
  return prisma.programmeOutcome.findMany({
    where: { institutionId, programId, isActive: true },
    orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { code: "asc" }],
  });
}

export async function createProgrammeOutcome(institutionId: string, user: AuthenticatedUser, programId: string, input: CreateProgrammeOutcomeInput) {
  await assertProgramAccess(institutionId, user, programId, true);
  const existing = await prisma.programmeOutcome.findFirst({ where: { programId, type: input.type, code: input.code } });
  if (existing) throw new AppError("This PO/PSO code already exists for the programme", 409);
  return prisma.programmeOutcome.create({
    data: { institutionId, programId, ...input },
  });
}

export async function updateProgrammeOutcome(institutionId: string, user: AuthenticatedUser, id: string, input: UpdateProgrammeOutcomeInput) {
  const row = await prisma.programmeOutcome.findFirst({ where: { id, institutionId } });
  if (!row) throw new AppError("Programme outcome not found", 404);
  await assertProgramAccess(institutionId, user, row.programId, true);
  if (input.code || input.type) {
    const duplicate = await prisma.programmeOutcome.findFirst({
      where: { programId: row.programId, type: input.type ?? row.type, code: input.code ?? row.code, NOT: { id } },
    });
    if (duplicate) throw new AppError("This PO/PSO code already exists for the programme", 409);
  }
  return prisma.programmeOutcome.update({ where: { id }, data: input });
}

export async function listCourseOutcomes(institutionId: string, user: AuthenticatedUser, courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, institutionId }, select: { id: true } });
  if (!course) throw new AppError("Course not found in this institution", 404);
  if (!isInstitutionWide(user) && !hasRole(user, "HOD") && !hasRole(user, "FACULTY")) {
    throw new AppError("You are not authorized to view course outcomes", 403);
  }
  if (hasRole(user, "HOD")) {
    const departments = await getManagedDepartmentIds(institutionId, user.id);
    const owned = await prisma.course.findFirst({ where: { id: courseId, institutionId, departmentId: { in: departments } }, select: { id: true } });
    if (!owned) throw new AppError("This course is outside your department scope", 403);
  }
  if (hasRole(user, "FACULTY")) {
    const taught = await prisma.courseOffering.findFirst({ where: { institutionId, facultyId: user.id, courseId }, select: { id: true } });
    if (!taught) throw new AppError("You are not assigned to this course", 403);
  }
  return prisma.courseOutcome.findMany({ where: { institutionId, courseId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { code: "asc" }] });
}

export async function createCourseOutcome(institutionId: string, user: AuthenticatedUser, courseId: string, input: CreateCourseOutcomeInput) {
  await listCourseOutcomes(institutionId, user, courseId);
  const duplicate = await prisma.courseOutcome.findFirst({ where: { courseId, code: input.code } });
  if (duplicate) throw new AppError("This CO code already exists for the course", 409);
  return prisma.courseOutcome.create({ data: { institutionId, courseId, ...input } });
}

export async function updateCourseOutcome(institutionId: string, user: AuthenticatedUser, id: string, input: UpdateCourseOutcomeInput) {
  const row = await prisma.courseOutcome.findFirst({ where: { id, institutionId }, select: { id: true, courseId: true, code: true } });
  if (!row) throw new AppError("Course outcome not found", 404);
  await listCourseOutcomes(institutionId, user, row.courseId);
  if (input.code) {
    const duplicate = await prisma.courseOutcome.findFirst({ where: { courseId: row.courseId, code: input.code, NOT: { id } } });
    if (duplicate) throw new AppError("This CO code already exists for the course", 409);
  }
  return prisma.courseOutcome.update({ where: { id }, data: input });
}

async function assertMappingOwnership(
  institutionId: string,
  user: AuthenticatedUser,
  courseId: string
) {
  if (isInstitutionWide(user)) return;

  if (hasRole(user, "HOD")) {
    const departments = await getManagedDepartmentIds(institutionId, user.id);
    const course = await prisma.course.findFirst({
      where: { id: courseId, institutionId },
      select: { departmentId: true },
    });
    if (!course || !departments.includes(course.departmentId)) {
      throw new AppError("This CO is outside your department scope", 403);
    }
    return;
  }

  if (hasRole(user, "FACULTY")) {
    const taught = await prisma.courseOffering.findFirst({
      where: { institutionId, facultyId: user.id, courseId, isActive: true },
      select: { id: true },
    });
    if (!taught) throw new AppError("You are not assigned to this course", 403);
    return;
  }

  throw new AppError("You are not authorized to manage CO mapping", 403);
}

export async function getMapping(institutionId: string, user: AuthenticatedUser, courseOfferingId: string) {
  const offering = await loadOffering(institutionId, user, courseOfferingId);

  const [outcomes, programmeOutcomes] = await Promise.all([
    prisma.courseOutcome.findMany({
      where: { institutionId, courseId: offering.courseId, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    }),
    prisma.programmeOutcome.findMany({
      where: { institutionId, programId: offering.semester.programId, isActive: true },
      orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { code: "asc" }],
    }),
  ]);

  const [courseOutcomeIds, programmeOutcomeIds] = [
    outcomes.map((row) => row.id),
    programmeOutcomes.map((row) => row.id),
  ];

  const mappings =
    courseOutcomeIds.length && programmeOutcomeIds.length
      ? await prisma.courseOutcomeMapping.findMany({
          where: {
            institutionId,
            courseOutcomeId: { in: courseOutcomeIds },
            programmeOutcomeId: { in: programmeOutcomeIds },
          },
          orderBy: { createdAt: "asc" },
        })
      : [];

  return { offering, outcomes, programmeOutcomes, mappings };
}

export async function replaceMapping(
  institutionId: string,
  user: AuthenticatedUser,
  courseOfferingId: string,
  input: ReplaceMappingInput
) {
  const offering = await loadOffering(institutionId, user, courseOfferingId, true);

  // Authorize the course once, not once per matrix cell. A CO×PO matrix can
  // contain hundreds of cells; doing DB-backed ownership checks for every
  // cell was the primary source of request amplification/timeouts.
  await assertMappingOwnership(institutionId, user, offering.courseId);

  const [courseOutcomes, programmeOutcomes] = await Promise.all([
    prisma.courseOutcome.findMany({
      where: { institutionId, courseId: offering.courseId, isActive: true },
      select: { id: true },
    }),
    prisma.programmeOutcome.findMany({
      where: { institutionId, programId: offering.semester.programId, isActive: true },
      select: { id: true },
    }),
  ]);

  const coIds = new Set(courseOutcomes.map((x) => x.id));
  const poIds = new Set(programmeOutcomes.map((x) => x.id));

  const seen = new Set<string>();
  for (const row of input.mappings) {
    if (!coIds.has(row.courseOutcomeId) || !poIds.has(row.programmeOutcomeId)) {
      throw new AppError("One or more mapping rows do not belong to this course/programme", 400);
    }
    if (!Number.isInteger(row.level) || row.level < 0 || row.level > 3) {
      throw new AppError("Mapping level must be an integer from 0 to 3", 400);
    }
    const key = `${row.courseOutcomeId}:${row.programmeOutcomeId}`;
    if (seen.has(key)) throw new AppError("Duplicate CO–PO/PSO mapping row", 400);
    seen.add(key);
  }

  // Mapping is defined by Course + Programme, not by a particular offering.
  // Use scalar foreign-key filters so PostgreSQL can use the tenant/ID indexes
  // directly instead of resolving a relation predicate during the delete.
  const validCoIds = [...coIds];
  const validPoIds = [...poIds];

  await prisma.$transaction(async (tx) => {
    if (validCoIds.length && validPoIds.length) {
      await tx.courseOutcomeMapping.deleteMany({
        where: {
          institutionId,
          courseOutcomeId: { in: validCoIds },
          programmeOutcomeId: { in: validPoIds },
        },
      });
    }

    if (input.mappings.length) {
      await tx.courseOutcomeMapping.createMany({
        data: input.mappings.map((row) => ({
          institutionId,
          courseOutcomeId: row.courseOutcomeId,
          programmeOutcomeId: row.programmeOutcomeId,
          level: row.level,
          remarks: row.remarks,
          status: "DRAFT",
          createdById: user.id,
        })),
      });
    }
  });

  return getMapping(institutionId, user, courseOfferingId);
}

export async function submitMapping(institutionId: string, user: AuthenticatedUser, courseOfferingId: string) {
  const offering = await loadOffering(institutionId, user, courseOfferingId, true);
  const count = await prisma.courseOutcomeMapping.count({ where: { institutionId, courseOutcome: { courseId: offering.courseId }, programmeOutcome: { programId: offering.semester.programId }, level: { gt: 0 } } });
  if (!count) throw new AppError("Add at least one CO–PO/PSO mapping before submitting", 400);
  await prisma.courseOutcomeMapping.updateMany({ where: { institutionId, courseOutcome: { courseId: offering.courseId }, programmeOutcome: { programId: offering.semester.programId } }, data: { status: "SUBMITTED" } });
  return getMapping(institutionId, user, courseOfferingId);
}

export async function reviewMapping(institutionId: string, user: AuthenticatedUser, courseOfferingId: string, decision: "APPROVED" | "RETURNED") {
  const offering = await loadOffering(institutionId, user, courseOfferingId, true);
  const mappings = await prisma.courseOutcomeMapping.findMany({ where: { institutionId, courseOutcome: { courseId: offering.courseId }, programmeOutcome: { programId: offering.semester.programId } }, select: { id: true, status: true } });
  if (!mappings.length) throw new AppError("No CO–PO/PSO mapping exists", 400);
  await prisma.courseOutcomeMapping.updateMany({
    where: { institutionId, courseOutcome: { courseId: offering.courseId }, programmeOutcome: { programId: offering.semester.programId } },
    data: { status: decision, approvedById: decision === "APPROVED" ? user.id : null, approvedAt: decision === "APPROVED" ? new Date() : null },
  });
  return getMapping(institutionId, user, courseOfferingId);
}

export async function listAssessments(institutionId: string, user: AuthenticatedUser, courseOfferingId: string) {
  await loadOffering(institutionId, user, courseOfferingId);
  return prisma.obeAssessment.findMany({
    where: { institutionId, courseOfferingId },
    orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
    include: { items: { orderBy: { displayOrder: "asc" }, include: { courseOutcome: { select: { id: true, code: true, statement: true } } } } },
  });
}

export async function createAssessment(institutionId: string, user: AuthenticatedUser, input: CreateAssessmentInput) {
  await loadOffering(institutionId, user, input.courseOfferingId, true);
  return prisma.obeAssessment.create({ data: { institutionId, ...input, createdById: user.id } });
}

export async function updateAssessment(institutionId: string, user: AuthenticatedUser, assessmentId: string, input: UpdateAssessmentInput) {
  const assessment = await prisma.obeAssessment.findFirst({ where: { id: assessmentId, institutionId }, select: { id: true, courseOfferingId: true, status: true } });
  if (!assessment) throw new AppError("OBE assessment not found", 404);
  await loadOffering(institutionId, user, assessment.courseOfferingId, true);
  if (assessment.status === "LOCKED" && input.status !== "LOCKED") throw new AppError("Locked assessment cannot be reopened", 409);
  if (input.status === "PUBLISHED") {
    const itemCount = await prisma.obeAssessmentItem.count({ where: { institutionId, assessmentId } });
    if (!itemCount) throw new AppError("Map at least one assessment item to a CO before publishing", 400);
  }
  return prisma.obeAssessment.update({ where: { id: assessmentId }, data: { status: input.status } });
}

export async function replaceAssessmentItems(institutionId: string, user: AuthenticatedUser, assessmentId: string, input: UpdateAssessmentItemsInput) {
  const assessment = await prisma.obeAssessment.findFirst({ where: { id: assessmentId, institutionId }, select: { id: true, courseOfferingId: true } });
  if (!assessment) throw new AppError("OBE assessment not found", 404);
  const offering = await loadOffering(institutionId, user, assessment.courseOfferingId, true);
  const assessmentState = await prisma.obeAssessment.findUnique({ where: { id: assessmentId }, select: { status: true } });
  if (assessmentState?.status === "LOCKED") throw new AppError("Locked assessment cannot be remapped", 409);
  const coIds = new Set((await prisma.courseOutcome.findMany({ where: { institutionId, courseId: offering.courseId, isActive: true }, select: { id: true } })).map((x) => x.id));
  for (const item of input.items) if (!coIds.has(item.courseOutcomeId)) throw new AppError("Assessment item references a CO outside this course", 400);
  await prisma.$transaction(async (tx) => {
    await tx.obeAssessmentItem.deleteMany({ where: { institutionId, assessmentId } });
    if (input.items.length) await tx.obeAssessmentItem.createMany({ data: input.items.map((item) => ({ institutionId, assessmentId, itemCode: item.itemCode, description: item.description, maxMarks: item.maxMarks, courseOutcomeId: item.courseOutcomeId, displayOrder: item.displayOrder ?? 0 })) });
  });
  return prisma.obeAssessment.findUnique({ where: { id: assessmentId }, include: { items: { orderBy: { displayOrder: "asc" }, include: { courseOutcome: { select: { id: true, code: true, statement: true } } } } } });
}

async function assertStudentInOffering(institutionId: string, offeringId: string, studentId: string) {
  const offering = await prisma.courseOffering.findFirst({ where: { id: offeringId, institutionId }, select: { semesterId: true, sectionId: true, semester: { select: { programId: true, academicYearId: true } } } });
  if (!offering) throw new AppError("Course offering not found", 404);
  const enrollment = await prisma.studentEnrollment.findFirst({ where: { institutionId, userId: studentId, programId: offering.semester.programId, academicYearId: offering.semester.academicYearId, semesterId: offering.semesterId, sectionId: offering.sectionId, status: "ACTIVE" }, select: { id: true } });
  if (!enrollment) throw new AppError("Student is not enrolled in this course offering", 400);
}

export async function replaceScores(institutionId: string, user: AuthenticatedUser, assessmentId: string, input: ReplaceScoresInput) {
  const assessment = await prisma.obeAssessment.findFirst({ where: { id: assessmentId, institutionId }, include: { items: { select: { id: true, maxMarks: true } } } });
  if (!assessment) throw new AppError("OBE assessment not found", 404);
  await loadOffering(institutionId, user, assessment.courseOfferingId, true);
  if (assessment.status === "LOCKED") throw new AppError("Locked assessment scores cannot be changed", 409);
  const itemIds = new Set(assessment.items.map((x) => x.id));
  // Scores are currently sent per item via separate endpoint in the controller.
  // This method is retained for future bulk assessment-wide score import.
  for (const row of input.scores) {
    if (!row.studentId || !itemIds.size) throw new AppError("Invalid score payload", 400);
    await assertStudentInOffering(institutionId, assessment.courseOfferingId, row.studentId);
  }
  throw new AppError("Use the assessment-item score endpoint for this version", 400);
}

export async function getAssessmentItemScores(institutionId: string, user: AuthenticatedUser, assessmentItemId: string) {
  const item = await prisma.obeAssessmentItem.findFirst({
    where: { id: assessmentItemId, institutionId },
    include: { assessment: { select: { courseOfferingId: true } }, courseOutcome: { select: { id: true, code: true, statement: true } }, scores: { select: { studentId: true, marksObtained: true, isAbsent: true } } },
  });
  if (!item) throw new AppError("Assessment item not found", 404);
  const offering = await loadOffering(institutionId, user, item.assessment.courseOfferingId);
  const rosterIds = await getOfferingRosterIds(institutionId, offering);
  const roster = await prisma.studentEnrollment.findMany({
    where: { institutionId, userId: { in: rosterIds }, programId: offering.semester.programId, academicYearId: offering.semester.academicYearId, semesterId: offering.semesterId, sectionId: offering.sectionId, status: "ACTIVE" },
    select: { userId: true, rollNumber: true, user: { select: { firstName: true, lastName: true } } },
    orderBy: [{ rollNumber: "asc" }, { user: { firstName: "asc" } }],
  });
  return { item, roster: roster.map((r) => ({ studentId: r.userId, firstName: r.user.firstName, lastName: r.user.lastName, rollNumber: r.rollNumber })), scores: item.scores };
}

export async function replaceItemScores(institutionId: string, user: AuthenticatedUser, assessmentItemId: string, input: ReplaceScoresInput) {
  const item = await prisma.obeAssessmentItem.findFirst({ where: { id: assessmentItemId, institutionId }, include: { assessment: { select: { courseOfferingId: true, status: true } } } });
  if (!item) throw new AppError("Assessment item not found", 404);
  await loadOffering(institutionId, user, item.assessment.courseOfferingId, true);
  if (item.assessment.status === "LOCKED") throw new AppError("Locked assessment scores cannot be changed", 409);
  for (const row of input.scores) {
    if (row.marksObtained > item.maxMarks) throw new AppError(`Marks for ${item.itemCode} cannot exceed ${item.maxMarks}`, 400);
    await assertStudentInOffering(institutionId, item.assessment.courseOfferingId, row.studentId);
  }
  await prisma.$transaction(async (tx) => {
    await tx.obeAssessmentScore.deleteMany({ where: { institutionId, assessmentItemId } });
    if (input.scores.length) await tx.obeAssessmentScore.createMany({ data: input.scores.map((row) => ({ institutionId, assessmentItemId, studentId: row.studentId, marksObtained: row.marksObtained, isAbsent: row.isAbsent ?? false, remarks: row.remarks, enteredById: user.id })) });
  });
  return prisma.obeAssessmentItem.findUnique({ where: { id: assessmentItemId }, include: { scores: true } });
}

function attainmentLevel(percentage: number, policy: { level1Threshold: number; level2Threshold: number; level3Threshold: number }) {
  if (percentage >= policy.level3Threshold) return 3;
  if (percentage >= policy.level2Threshold) return 2;
  if (percentage >= policy.level1Threshold) return 1;
  return 0;
}

async function resolvePolicy(institutionId: string, programId: string, policyId?: string) {
  if (policyId) {
    const policy = await prisma.obeAttainmentPolicy.findFirst({ where: { id: policyId, institutionId, isActive: true } });
    if (!policy) throw new AppError("OBE attainment policy not found", 404);
    if (policy.scopeType === "PROGRAM" && policy.programId !== programId) throw new AppError("The selected OBE policy does not belong to this programme", 400);
    return policy;
  }
  return prisma.obeAttainmentPolicy.findFirst({ where: { institutionId, isActive: true, OR: [{ scopeType: "PROGRAM", programId }, { scopeType: "INSTITUTION" }], }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
}

async function getOfferingRosterIds(institutionId: string, offering: { semesterId: string; sectionId: string }) {
  const semester = await prisma.semester.findFirst({ where: { id: offering.semesterId, institutionId }, select: { programId: true, academicYearId: true } });
  if (!semester) throw new AppError("Offering semester not found", 404);
  const rows = await prisma.studentEnrollment.findMany({ where: { institutionId, programId: semester.programId, academicYearId: semester.academicYearId, semesterId: offering.semesterId, sectionId: offering.sectionId, status: "ACTIVE", user: { isActive: true } }, select: { userId: true } });
  return rows.map((x) => x.userId);
}

export async function calculateAttainment(institutionId: string, user: AuthenticatedUser, courseOfferingId: string, input: CalculateAttainmentInput) {
  const offering = await loadOffering(institutionId, user, courseOfferingId, true);
  const policy = await resolvePolicy(institutionId, offering.semester.programId, input.policyId);
  if (!policy) throw new AppError("No active OBE attainment policy is configured", 409);

  const rosterIds = await getOfferingRosterIds(institutionId, offering);
  const outcomes = await prisma.courseOutcome.findMany({ where: { institutionId, courseId: offering.courseId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { code: "asc" }] });
  const assessments = await prisma.obeAssessment.findMany({ where: { institutionId, courseOfferingId, status: { in: ["PUBLISHED", "LOCKED"] } }, include: { items: { include: { scores: true } } } });
  if (!assessments.length) throw new AppError("Publish at least one OBE assessment before calculating attainment", 400);

  const results = [] as Array<Record<string, unknown>>;
  for (const outcome of outcomes) {
    const items = assessments.flatMap((a) => a.items.filter((i) => i.courseOutcomeId === outcome.id));
    if (!items.length) {
      results.push({ courseOutcomeId: outcome.id, directAttainment: null, indirectAttainment: null, finalAttainment: null, attainmentLevel: null, studentCount: rosterIds.length, studentsAssessed: 0, studentsMeetingTarget: 0 });
      continue;
    }

    const studentPercentages: number[] = [];
    for (const studentId of rosterIds) {
      let total = 0; let max = 0; let hasScore = false;
      for (const item of items) {
        const score = item.scores.find((x) => x.studentId === studentId);
        if (!score || score.isAbsent) continue;
        hasScore = true;
        total += score.marksObtained;
        max += item.maxMarks;
      }
      if (hasScore && max > 0) studentPercentages.push((total / max) * 100);
    }

    const assessed = studentPercentages.length;
    const meeting = studentPercentages.filter((p) => p >= policy.minimumPassingPercentage).length;
    const directPercent = assessed ? (meeting / assessed) * 100 : null;
    const directLevel = directPercent === null ? null : attainmentLevel(directPercent, policy);

    const indirectRows = await prisma.obeIndirectAssessment.findMany({ where: { institutionId, courseOfferingId, courseOutcomeId: outcome.id, status: { in: ["SUBMITTED", "APPROVED"] }, normalizedScore: { not: null } }, select: { normalizedScore: true, weightage: true } });
    const indirect = indirectRows.length ? indirectRows.reduce((sum, row) => sum + (row.normalizedScore ?? 0) * row.weightage, 0) / indirectRows.reduce((sum, row) => sum + row.weightage, 0) : null;

    let finalAttainment: number | null = directLevel === null ? null : directLevel;
    if (directLevel !== null && indirect !== null) {
      const totalWeight = policy.directWeight + policy.indirectWeight || 1;
      finalAttainment = ((directLevel * policy.directWeight) + (indirect * policy.indirectWeight)) / totalWeight;
    }
    const finalLevel = finalAttainment === null ? null : Math.max(0, Math.min(3, Math.round(finalAttainment)));
    results.push({ courseOutcomeId: outcome.id, directAttainment: directLevel, indirectAttainment: indirect, finalAttainment, attainmentLevel: finalLevel, studentCount: rosterIds.length, studentsAssessed: assessed, studentsMeetingTarget: meeting });
  }

  await prisma.$transaction(async (tx) => {
    for (const result of results) {
      await tx.obeCourseAttainment.upsert({
        where: { courseOfferingId_courseOutcomeId: { courseOfferingId, courseOutcomeId: result.courseOutcomeId as string } },
        create: { institutionId, courseOfferingId, courseOutcomeId: result.courseOutcomeId as string, policyId: policy.id, directAttainment: result.directAttainment as number | null, indirectAttainment: result.indirectAttainment as number | null, finalAttainment: result.finalAttainment as number | null, attainmentLevel: result.attainmentLevel as number | null, studentCount: result.studentCount as number, studentsAssessed: result.studentsAssessed as number, studentsMeetingTarget: result.studentsMeetingTarget as number, calculatedAt: new Date() },
        update: { policyId: policy.id, directAttainment: result.directAttainment as number | null, indirectAttainment: result.indirectAttainment as number | null, finalAttainment: result.finalAttainment as number | null, attainmentLevel: result.attainmentLevel as number | null, studentCount: result.studentCount as number, studentsAssessed: result.studentsAssessed as number, studentsMeetingTarget: result.studentsMeetingTarget as number, calculationStatus: "CALCULATED", calculatedAt: new Date() },
      });
    }
  });

  return getAttainment(institutionId, user, courseOfferingId);
}

export async function getAttainment(institutionId: string, user: AuthenticatedUser, courseOfferingId: string) {
  const offering = await loadOffering(institutionId, user, courseOfferingId);
  const rows = await prisma.obeCourseAttainment.findMany({ where: { institutionId, courseOfferingId }, include: { courseOutcome: { select: { id: true, code: true, statement: true, bloomLevel: true } } }, orderBy: { courseOutcome: { displayOrder: "asc" } } });
  return { offering, items: rows };
}

export async function calculateProgrammeAttainment(institutionId: string, user: AuthenticatedUser, input: ProgrammeAttainmentInput) {
  const program = await assertProgramAccess(institutionId, user, input.programId, false);
  if (!isInstitutionWide(user) && !hasRole(user, "HOD")) {
    throw new AppError("Programme-level attainment is managed by academic leadership or the HOD", 403);
  }
  const semester = await prisma.semester.findFirst({
    where: { id: input.semesterId, institutionId, programId: input.programId, academicYearId: input.academicYearId, isActive: true },
    select: { id: true, number: true, name: true },
  });
  if (!semester) throw new AppError("Semester does not belong to the selected programme and academic year", 400);
  const policy = await resolvePolicy(institutionId, input.programId, input.policyId);
  if (!policy) throw new AppError("No active OBE attainment policy is configured", 409);

  const offerings = await prisma.courseOffering.findMany({
    where: { institutionId, semesterId: input.semesterId, isActive: true },
    select: { id: true, courseId: true },
  });
  if (!offerings.length) throw new AppError("No active course offerings exist for this programme semester", 400);

  const coAttainments = await prisma.obeCourseAttainment.findMany({
    where: { institutionId, courseOfferingId: { in: offerings.map((x) => x.id) }, finalAttainment: { not: null } },
    select: { courseOfferingId: true, courseOutcomeId: true, finalAttainment: true },
  });
  const outcomes = await prisma.programmeOutcome.findMany({ where: { institutionId, programId: input.programId, isActive: true }, orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { code: "asc" }] });
  if (!outcomes.length) throw new AppError("No PO/PSO definitions exist for this programme", 400);

  const mappings = await prisma.courseOutcomeMapping.findMany({
    where: { institutionId, status: "APPROVED", programmeOutcome: { programId: input.programId } },
    select: { programmeOutcomeId: true, courseOutcomeId: true, level: true },
  });
  const attainmentByKey = new Map(coAttainments.map((row) => [`${row.courseOfferingId}:${row.courseOutcomeId}`, row.finalAttainment ?? null]));
  const courseOutcomeToOfferings = new Map<string, string[]>();
  for (const offering of offerings) {
    for (const row of coAttainments.filter((item) => item.courseOfferingId === offering.id)) {
      const current = courseOutcomeToOfferings.get(row.courseOutcomeId) ?? [];
      current.push(offering.id);
      courseOutcomeToOfferings.set(row.courseOutcomeId, current);
    }
  }

  const results = outcomes.map((outcome) => {
    const contributions: number[] = [];
    const relevant = mappings.filter((mapping) => mapping.programmeOutcomeId === outcome.id && mapping.level > 0);
    for (const mapping of relevant) {
      const offeringIds = courseOutcomeToOfferings.get(mapping.courseOutcomeId) ?? [];
      for (const offeringId of offeringIds) {
        const attainment = attainmentByKey.get(`${offeringId}:${mapping.courseOutcomeId}`);
        if (attainment === null || attainment === undefined) continue;
        contributions.push(attainment * (mapping.level / 3));
      }
    }
    const value = contributions.length ? contributions.reduce((a, b) => a + b, 0) / contributions.length : null;
    return { programmeOutcomeId: outcome.id, attainment: value, attainmentLevel: value === null ? null : Math.max(0, Math.min(3, Math.round(value))), courseCount: relevant.length, contributingCourseCount: contributions.length };
  });

  const run = await prisma.obeAttainmentRun.create({ data: { institutionId, programId: input.programId, academicYearId: input.academicYearId, semesterId: input.semesterId, policyId: policy.id, name: `${program.name} · ${semester.name} OBE Attainment`, status: "CALCULATED", formulaVersion: policy.formulaVersion, calculatedById: user.id, calculatedAt: new Date(), courseResults: { create: coAttainments.map((row) => ({ institutionId, courseOfferingId: row.courseOfferingId, courseOutcomeId: row.courseOutcomeId, finalAttainment: row.finalAttainment })) }, programmeResults: { create: results.map((row) => ({ institutionId, programmeOutcomeId: row.programmeOutcomeId, attainment: row.attainment, attainmentLevel: row.attainmentLevel, courseCount: row.courseCount, contributingCourseCount: row.contributingCourseCount })) } }, include: { programmeResults: { include: { programmeOutcome: true } }, courseResults: true } });
  return run;
}

export async function listPolicies(institutionId: string, user: AuthenticatedUser) {
  if (!isInstitutionWide(user) && !hasRole(user, "HOD")) throw new AppError("You are not authorized to view OBE policies", 403);
  return prisma.obeAttainmentPolicy.findMany({ where: { institutionId, isActive: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
}

export async function createPolicy(institutionId: string, user: AuthenticatedUser, input: CreatePolicyInput) {
  if (!isInstitutionWide(user)) throw new AppError("Only institution-level academic administration may configure OBE policies", 403);
  if (input.scopeType === "PROGRAM" && !input.programId) throw new AppError("programId is required for a programme-scoped policy", 400);
  if (input.programId) await assertProgramAccess(institutionId, user, input.programId, true);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.obeAttainmentPolicy.updateMany({ where: { institutionId, ...(input.scopeType === "PROGRAM" ? { programId: input.programId } : { scopeType: "INSTITUTION" }) }, data: { isDefault: false } });
    return tx.obeAttainmentPolicy.create({ data: { institutionId, ...input } });
  });
}

export async function updatePolicy(institutionId: string, user: AuthenticatedUser, id: string, input: UpdatePolicyInput) {
  if (!isInstitutionWide(user)) throw new AppError("Only institution-level academic administration may configure OBE policies", 403);
  const row = await prisma.obeAttainmentPolicy.findFirst({ where: { id, institutionId } });
  if (!row) throw new AppError("OBE policy not found", 404);
  if (input.programId) await assertProgramAccess(institutionId, user, input.programId, true);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.obeAttainmentPolicy.updateMany({ where: { institutionId, id: { not: id }, ...(input.scopeType === "PROGRAM" || row.scopeType === "PROGRAM" ? { programId: input.programId ?? row.programId } : { scopeType: "INSTITUTION" }) }, data: { isDefault: false } });
    return tx.obeAttainmentPolicy.update({ where: { id }, data: input });
  });
}

export async function createRun(institutionId: string, user: AuthenticatedUser, input: CreateRunInput) {
  await assertProgramAccess(institutionId, user, input.programId, true);
  const semester = await prisma.semester.findFirst({ where: { id: input.semesterId, institutionId, programId: input.programId, academicYearId: input.academicYearId }, select: { id: true } });
  if (!semester) throw new AppError("Semester does not belong to the selected programme and academic year", 400);
  const policy = await resolvePolicy(institutionId, input.programId, input.policyId);
  return prisma.obeAttainmentRun.create({ data: { institutionId, programId: input.programId, academicYearId: input.academicYearId, semesterId: input.semesterId, policyId: policy?.id, name: input.name, status: "DRAFT", formulaVersion: policy?.formulaVersion ?? "v1" } });
}
