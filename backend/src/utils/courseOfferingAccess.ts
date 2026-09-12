import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "INSTITUTION_ADMIN"];

/**
 * Shared ownership check: a permission like `assignments.create` or
 * `marks.enter` says a role CAN act somewhere — it doesn't say
 * where. This confirms the caller is either an institution/platform
 * admin, or the faculty member actually assigned to the given
 * course offering. (Mirrors the equivalent check already living in
 * attendanceSession.service.ts — kept here as the shared version for
 * every module built from this phase onward.)
 */
export function assertOwnsCourseOffering(
  user: AuthenticatedUser,
  facultyId: string | null
): void {
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r));
  if (isAdmin) return;
  if (facultyId && facultyId === user.id) return;
  throw new AppError(
    "You are not the assigned faculty for this course offering",
    403
  );
}

/** Loads a CourseOffering scoped to the institution, or 400s. */
export async function loadCourseOfferingOrThrow(
  institutionId: string,
  courseOfferingId: string
) {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: courseOfferingId, institutionId },
    include: {
      course: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  if (!offering) {
    throw new AppError(
      "courseOfferingId does not belong to this institution",
      400
    );
  }
  return offering;
}
