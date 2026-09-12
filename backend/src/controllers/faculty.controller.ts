import { Request, Response } from "express";
import * as demo from "../services/demo/facultyDashboard.demo";
import * as facultyService from "../services/faculty.service";
import { AppError } from "../middleware/errorHandler";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { prisma } from "../lib/prisma";

function requireUser(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return req.user;
}

/**
 * GET /api/v1/faculty/me/course-offerings
 * Real assigned courses + sections.
 */
export const myCourseOfferings = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const offerings = await facultyService.getMyCourseOfferings(
    institutionId,
    user.id
  );
  res.status(200).json({ success: true, data: offerings });
});

/**
 * GET /api/v1/faculty/me/dashboard
 * Combines real data — identity, assigned courses/sections, live
 * attendance overview, at-risk students, pending assignment reviews,
 * and assignment submission gaps (all computed from real database
 * rows as of Phase 5) — with demo data for what's still unbuilt:
 * class scheduling (Phase 7 Timetable) and lecture plans (no model
 * yet). See src/services/demo/facultyDashboard.demo.ts and
 * docs/PHASE-5.md.
 */
export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);

  const facultyUser = await prisma.user.findFirst({
    where: { id: user.id, institutionId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!facultyUser) {
    throw new AppError("Faculty user not found", 404);
  }

  const offerings = await facultyService.getMyCourseOfferings(
    institutionId,
    user.id
  );

  const realCourseRefs = offerings.map((o) => ({
    code: o.course.code,
    name: o.course.name,
    sectionName: o.section.name,
  }));

  const [
    attendanceOverview,
    atRisk,
    pendingAttendanceCount,
    pendingReviewCount,
    submissionGaps,
  ] = await Promise.all([
    facultyService.getAttendanceOverview(institutionId, user.id),
    facultyService.getAtRiskStudents(institutionId, user.id),
    facultyService.getPendingAttendanceCount(institutionId, user.id),
    facultyService.getPendingAssignmentReviewCount(institutionId, user.id),
    facultyService.getAssignmentSubmissionGaps(institutionId, user.id),
  ]);

  const todaysClasses = demo.getDemoTodaysClasses(realCourseRefs);
  const lecturePlansPending = demo.getDemoLecturePlansPending();

  res.status(200).json({
    success: true,
    data: {
      faculty: facultyUser,

      // --- real ---
      assignedCourseOfferings: offerings.map((o) => ({
        id: o.id,
        course: o.course,
        section: o.section,
        semester: o.semester,
      })),
      attendanceOverview,
      pending: {
        attendanceSessions: pendingAttendanceCount,
        assignmentsToReview: pendingReviewCount,
        lecturePlansPending, // demo — no Lecture Plans model yet
      },
      smartInsights: {
        studentsBelowAttendanceThreshold: atRisk,
        assignmentSubmissionGaps: submissionGaps,
      },

      // --- demo (course/section names are real; time slots are not) ---
      todaysClassCount: todaysClasses.length,
      todaysClasses,
    },
  });
});
