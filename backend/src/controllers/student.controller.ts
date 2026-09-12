import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import * as assignmentService from "../services/assignment.service";
import * as attendanceStatsService from "../services/attendanceStats.service";
import * as demo from "../services/demo/studentDashboard.demo";
import * as marksService from "../services/internalMark.service";
import * as studentPortalService from "../services/studentPortal.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";

function requireUser(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return req.user;
}

/**
 * GET /api/v1/students/me
 * Real profile + current enrollment (program/section/semester/year).
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);

  const profile = await studentPortalService.getMyProfile(institutionId, user.id);

  res.status(200).json({ success: true, data: profile });
});

/** GET /api/v1/students/me/attendance — dynamic overall + per-subject percentages. */
export const attendance = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);

  const summary = await attendanceStatsService.getStudentAttendanceSummary(
    institutionId,
    user.id
  );

  res.status(200).json({ success: true, data: summary });
});

/** GET /api/v1/students/me/marks — real internal marks, all components, all courses. */
export const marks = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);

  const entries = await marksService.getMyMarks(institutionId, user.id);

  res.status(200).json({ success: true, data: entries });
});

/** GET /api/v1/students/me/assignments — real assignments for the student's section(s). */
export const assignments = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);

  const items = await assignmentService.getMyUpcomingAssignments(
    institutionId,
    user.id,
    50
  );

  res.status(200).json({ success: true, data: items });
});

function formatDueLabel(dueDate: Date): string {
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due Today";
  if (diffDays === 1) return "Due Tomorrow";
  if (diffDays <= 7) {
    return `Due ${dueDate.toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  return `Due ${dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/**
 * GET /api/v1/students/me/dashboard
 * Combines real data — identity, program, section, semester, course
 * offerings, institution branding, attendance (dynamically
 * calculated), assignments + submission status, and internal marks
 * average — with demo data for what's still unbuilt: class
 * scheduling (Phase 7 Timetable), announcements, upcoming events,
 * and "engagement". See src/services/demo/studentDashboard.demo.ts
 * and docs/PHASE-5.md for the current real-vs-demo breakdown.
 */
export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);

  const { user: profileUser, enrollment } = await studentPortalService.getMyProfile(
    institutionId,
    user.id
  );

  if (!enrollment) {
    throw new AppError(
      "No student enrollment found for this user. This account may not be a student, or has not been enrolled for any academic year yet.",
      404
    );
  }

  const courseOfferings = enrollment.sectionId
    ? await studentPortalService.getSectionCourseOfferings(
        institutionId,
        enrollment.sectionId
      )
    : [];

  const realCourses = courseOfferings.map((o) => ({
    code: o.course.code,
    name: o.course.name,
  }));

  const [institution, attendanceSummary, upcomingAssignments, marksAveragePercent] =
    await Promise.all([
      studentPortalService.getInstitutionBranding(institutionId),
      attendanceStatsService.getStudentAttendanceSummary(institutionId, user.id),
      assignmentService.getMyUpcomingAssignments(institutionId, user.id, 5),
      marksService.getMyMarksAveragePercent(institutionId, user.id),
    ]);

  const assignmentsCompletionPercent =
    await assignmentService.getMySubmissionCompletionPercent(institutionId, user.id);

  const academicHealth: demo.AcademicHealth = {
    attendance: attendanceSummary.overallPercentage,
    assignments: assignmentsCompletionPercent,
    internalMarks: marksAveragePercent,
    engagement: demo.getDemoEngagementScore(), // still demo — no real proxy yet
  };

  res.status(200).json({
    success: true,
    data: {
      institution,
      student: {
        firstName: profileUser.firstName,
        lastName: profileUser.lastName,
        email: profileUser.email,
        rollNumber: enrollment.rollNumber,
      },
      program: enrollment.program,
      academicYear: enrollment.academicYear,
      section: enrollment.section
        ? {
            id: enrollment.section.id,
            name: enrollment.section.name,
            semester: enrollment.section.semester,
          }
        : null,
      courseOfferings: courseOfferings.map((o) => ({
        id: o.id,
        course: o.course,
        faculty: o.faculty,
      })),

      // --- real (Phase 5) ---
      attendancePercentage: attendanceSummary.overallPercentage,
      subjectAttendance: attendanceSummary.subjects,
      assignments: upcomingAssignments.map((a) => ({
        id: a.id,
        courseCode: a.courseCode,
        title: a.title,
        dueLabel: formatDueLabel(a.dueDate),
        status: a.submission ? "submitted" : new Date() > a.dueDate ? "overdue" : "pending",
      })),

      // --- demo (see src/services/demo/studentDashboard.demo.ts) ---
      todaysClasses: demo.getDemoTodaysClasses(realCourses),
      announcements: demo.getDemoAnnouncements(),
      upcomingEvents: demo.getDemoUpcomingEvents(),
      academicHealth,
      academicRisk: demo.getDemoAcademicRisk(academicHealth),
      recommendations: demo.getDemoRecommendations(academicHealth, realCourses),
    },
  });
});
