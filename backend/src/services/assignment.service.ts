import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import {
  assertOwnsCourseOffering,
  loadCourseOfferingOrThrow,
} from "../utils/courseOfferingAccess";
import { PaginationParams } from "../utils/pagination";
import {
  CreateAssignmentInput,
  ReviewSubmissionInput,
  SubmitAssignmentInput,
  UpdateAssignmentInput,
} from "../validators/assignment.validators";

const ADMIN_ROLES = ["SUPER_ADMIN", "INSTITUTION_ADMIN"];
const isAdmin = (user: AuthenticatedUser) =>
  user.roles.some((r) => ADMIN_ROLES.includes(r));
const isFaculty = (user: AuthenticatedUser) => user.roles.includes("FACULTY");

const assignmentInclude = {
  courseOffering: {
    include: {
      course: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AssignmentInclude;

/** The section ids a student is currently (ACTIVE) enrolled in. */
async function getStudentSectionIds(
  institutionId: string,
  studentId: string
): Promise<string[]> {
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { institutionId, userId: studentId, status: "ACTIVE", sectionId: { not: null } },
    select: { sectionId: true },
  });
  return enrollments
    .map((e) => e.sectionId)
    .filter((id): id is string => id !== null);
}

export interface ListFilters extends PaginationParams {
  search?: string;
  courseOfferingId?: string;
  status?: "DRAFT" | "PUBLISHED";
}

/**
 * Visibility differs by role, not just by permission:
 * - Admins see every assignment in the institution.
 * - Faculty see assignments for course offerings THEY teach (any status).
 * - Everyone else (student/parent) sees only PUBLISHED assignments
 *   for sections the student is actually enrolled in.
 */
export async function listAssignments(
  institutionId: string,
  user: AuthenticatedUser,
  filters: ListFilters
) {
  let where: Prisma.AssignmentWhereInput = {
    institutionId,
    ...(filters.courseOfferingId ? { courseOfferingId: filters.courseOfferingId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? { title: { contains: filters.search, mode: "insensitive" } }
      : {}),
  };

  if (isAdmin(user)) {
    // no extra scoping
  } else if (isFaculty(user)) {
    where = { ...where, courseOffering: { facultyId: user.id } };
  } else {
    const sectionIds = await getStudentSectionIds(institutionId, user.id);
    where = {
      ...where,
      status: "PUBLISHED",
      courseOffering: { sectionId: { in: sectionIds } },
    };
  }

  const [items, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { dueDate: "asc" },
      include: assignmentInclude,
    }),
    prisma.assignment.count({ where }),
  ]);

  return { items, total };
}

async function loadAssignmentOrThrow(institutionId: string, id: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { id, institutionId },
    include: assignmentInclude,
  });
  if (!assignment) {
    throw new AppError("Assignment not found", 404);
  }
  return assignment;
}

export async function getAssignmentById(
  institutionId: string,
  user: AuthenticatedUser,
  id: string
) {
  const assignment = await loadAssignmentOrThrow(institutionId, id);

  if (isAdmin(user)) return { ...assignment, mySubmission: null };
  if (isFaculty(user)) {
    assertOwnsCourseOffering(user, assignment.courseOffering.facultyId);
    return { ...assignment, mySubmission: null };
  }

  // Student/parent: only if published and enrolled in that section.
  const sectionIds = await getStudentSectionIds(institutionId, user.id);
  if (
    assignment.status !== "PUBLISHED" ||
    !sectionIds.includes(assignment.courseOffering.sectionId)
  ) {
    throw new AppError("Assignment not found", 404);
  }

  const mySubmission = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId: id, studentId: user.id } },
  });

  return { ...assignment, mySubmission };
}

export async function createAssignment(
  institutionId: string,
  user: AuthenticatedUser,
  input: CreateAssignmentInput
) {
  const offering = await loadCourseOfferingOrThrow(institutionId, input.courseOfferingId);
  assertOwnsCourseOffering(user, offering.facultyId);

  return prisma.assignment.create({
    data: { institutionId, createdById: user.id, ...input },
    include: assignmentInclude,
  });
}

export async function updateAssignment(
  institutionId: string,
  user: AuthenticatedUser,
  id: string,
  input: UpdateAssignmentInput
) {
  const assignment = await loadAssignmentOrThrow(institutionId, id);
  assertOwnsCourseOffering(user, assignment.courseOffering.facultyId);

  return prisma.assignment.update({
    where: { id },
    data: input,
    include: assignmentInclude,
  });
}

/**
 * Faculty view of an assignment's submissions: the FULL section
 * roster, joined with each student's submission if one exists (so
 * "hasn't submitted" is visible, not just silently absent from a list).
 */
export async function getSubmissionsForAssignment(
  institutionId: string,
  user: AuthenticatedUser,
  assignmentId: string
) {
  const assignment = await loadAssignmentOrThrow(institutionId, assignmentId);
  assertOwnsCourseOffering(user, assignment.courseOffering.facultyId);

  const [roster, submissions] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        sectionId: assignment.courseOffering.sectionId,
        status: "ACTIVE",
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { user: { firstName: "asc" } },
    }),
    prisma.assignmentSubmission.findMany({ where: { assignmentId } }),
  ]);

  const byStudent = new Map(submissions.map((s) => [s.studentId, s]));

  return roster.map((enrollment) => {
    const submission = byStudent.get(enrollment.userId) ?? null;
    return {
      studentId: enrollment.userId,
      firstName: enrollment.user.firstName,
      lastName: enrollment.user.lastName,
      rollNumber: enrollment.rollNumber,
      submission,
    };
  });
}

export async function submitAssignment(
  institutionId: string,
  user: AuthenticatedUser,
  assignmentId: string,
  input: SubmitAssignmentInput
) {
  const assignment = await loadAssignmentOrThrow(institutionId, assignmentId);

  if (assignment.status !== "PUBLISHED") {
    throw new AppError("This assignment is not open for submission", 400);
  }

  const sectionIds = await getStudentSectionIds(institutionId, user.id);
  if (!sectionIds.includes(assignment.courseOffering.sectionId)) {
    throw new AppError("You are not enrolled in this assignment's section", 403);
  }

  const isLate = new Date() > assignment.dueDate;

  return prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    update: {
      content: input.content,
      status: isLate ? "LATE" : "SUBMITTED",
      submittedAt: new Date(),
      // Resubmitting clears any prior review — it's new work to grade.
      marksAwarded: null,
      feedback: null,
      reviewedAt: null,
      reviewedById: null,
    },
    create: {
      institutionId,
      assignmentId,
      studentId: user.id,
      content: input.content,
      status: isLate ? "LATE" : "SUBMITTED",
    },
  });
}

export async function reviewSubmission(
  institutionId: string,
  user: AuthenticatedUser,
  assignmentId: string,
  studentId: string,
  input: ReviewSubmissionInput
) {
  const assignment = await loadAssignmentOrThrow(institutionId, assignmentId);
  assertOwnsCourseOffering(user, assignment.courseOffering.facultyId);

  if (input.marksAwarded > assignment.maxMarks) {
    throw new AppError(
      `marksAwarded cannot exceed this assignment's maxMarks (${assignment.maxMarks})`,
      400
    );
  }

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
  });
  if (!submission) {
    throw new AppError("This student has not submitted this assignment", 404);
  }

  return prisma.assignmentSubmission.update({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    data: {
      marksAwarded: input.marksAwarded,
      feedback: input.feedback,
      status: "REVIEWED",
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
  });
}

/** Real data for the student dashboard: assignments due soon + this student's own status. */
export async function getMyUpcomingAssignments(
  institutionId: string,
  studentId: string,
  limit = 5
) {
  const sectionIds = await getStudentSectionIds(institutionId, studentId);
  if (sectionIds.length === 0) return [];

  const assignments = await prisma.assignment.findMany({
    where: {
      institutionId,
      status: "PUBLISHED",
      courseOffering: { sectionId: { in: sectionIds } },
    },
    include: assignmentInclude,
    orderBy: { dueDate: "asc" },
    take: limit,
  });

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { studentId, assignmentId: { in: assignments.map((a) => a.id) } },
  });
  const byAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));

  return assignments.map((a) => ({
    id: a.id,
    courseCode: a.courseOffering.course.code,
    title: a.title,
    dueDate: a.dueDate,
    submission: byAssignment.get(a.id) ?? null,
  }));
}

/** Percentage of this student's PUBLISHED assignments that have a submission on record. */
export async function getMySubmissionCompletionPercent(
  institutionId: string,
  studentId: string
): Promise<number> {
  const sectionIds = await getStudentSectionIds(institutionId, studentId);
  if (sectionIds.length === 0) return 0;

  const assignments = await prisma.assignment.findMany({
    where: {
      institutionId,
      status: "PUBLISHED",
      courseOffering: { sectionId: { in: sectionIds } },
    },
    select: { id: true },
  });
  if (assignments.length === 0) return 0;

  const submittedCount = await prisma.assignmentSubmission.count({
    where: { studentId, assignmentId: { in: assignments.map((a) => a.id) } },
  });

  return Math.round((submittedCount / assignments.length) * 100);
}
