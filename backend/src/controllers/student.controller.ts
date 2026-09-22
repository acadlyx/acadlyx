import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import * as assignmentService from "../services/assignment.service";
import * as attendanceStatsService from "../services/attendanceStats.service";
import * as marksService from "../services/internalMark.service";
import * as studentPortalService from "../services/studentPortal.service";
import * as intelligenceService from "../services/intelligence.service";
import * as careerIntelligenceService from "../services/careerIntelligence.service";
import { prisma } from "../lib/prisma";
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

/** GET /api/v1/students/me/timetable — the authenticated student's weekly schedule. */
export const timetable = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const { enrollment } = await studentPortalService.getMyProfile(
    institutionId,
    user.id
  );

  if (!enrollment?.sectionId) {
    res.status(200).json({ success: true, data: [] });
    return;
  }

  const entries = await prisma.timetableEntry.findMany({
    where: {
      institutionId,
      courseOffering: {
        sectionId: enrollment.sectionId,
        isActive: true,
      },
    },
    include: {
      courseOffering: {
        include: {
          course: {
            select: { code: true, name: true },
          },
          faculty: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  res.status(200).json({
    success: true,
    data: entries.map((entry) => ({
      id: entry.id,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room,
      course: entry.courseOffering.course,
      faculty: entry.courseOffering.faculty
        ? `${entry.courseOffering.faculty.firstName} ${entry.courseOffering.faculty.lastName}`.trim()
        : null,
    })),
  });
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
 * offerings, institution branding, attendance, assignments, marks,
 * timetable entries, institutional notices, upcoming exams, and
 * rule-based academic/career intelligence from tenant-scoped data.
 */
export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);

  const { user: profileUser, enrollment } = await studentPortalService.getMyProfile(
    institutionId,
    user.id
  );

  // A valid student account may be awaiting enrollment.  The dashboard is a
  // workspace, not an enrollment validator: return a safe empty state rather
  // than turning optional academic data into a failed login destination.
  if (!enrollment) {
    const institution = await studentPortalService.getInstitutionBranding(institutionId);
    return res.status(200).json({ success: true, data: {
      institution,
      student: { firstName: profileUser.firstName, lastName: profileUser.lastName, email: profileUser.email, rollNumber: null },
      program: null, academicYear: null, section: null, courseOfferings: [], attendancePercentage: 0, subjectAttendance: [],
      assignments: [], todaysClasses: [], announcements: [], upcomingEvents: [],
      academicHealth: { attendance: 0, assignments: 0, internalMarks: 0, engagement: 0, academicHealth: 0 },
      academicRisk: "LOW", recommendations: ["Your academic enrollment is being set up. Please contact your institution if this persists."],
      career: null,
    } });
  }

  const courseOfferings = enrollment.sectionId
    ? await studentPortalService.getSectionCourseOfferings(
        institutionId,
        enrollment.sectionId
      )
    : [];

  const [institution, attendanceSummary, upcomingAssignments, intelligence, timetable, notices, exams] =
    await Promise.all([
      studentPortalService.getInstitutionBranding(institutionId),
      attendanceStatsService.getStudentAttendanceSummary(institutionId, user.id),
      assignmentService.getMyUpcomingAssignments(institutionId, user.id, 5),
      intelligenceService.getStudentIntelligence(institutionId, user.id),
      prisma.timetableEntry.findMany({ where: { institutionId, dayOfWeek: new Date().getDay(), courseOffering: { sectionId: enrollment.sectionId || "" } }, include: { courseOffering: { include: { course: true } } }, orderBy: { startTime: "asc" } }),
      prisma.notice.findMany({ where: { institutionId, publishedAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], audience: { in: ["ALL", "STUDENT"] } }, orderBy: { publishedAt: "desc" }, take: 5 }),
      prisma.exam.findMany({ where: { institutionId, courseOffering: { sectionId: enrollment.sectionId || "" }, examDate: { gte: new Date() } }, orderBy: { examDate: "asc" }, take: 5 }),
    ]);

  // Intelligence is derived from optional records. It must never make the
  // primary student workspace unavailable.
  const intelligenceData = intelligence ?? {
    scores: { attendance: attendanceSummary.overallPercentage, assignments: 100, internalMarks: 0, engagement: 0, academicHealth: 0 },
    risk: "LOW" as const,
    recommendations: [] as string[],
  };
  const academicHealth = intelligenceData.scores;
  const career = await careerIntelligenceService.getCareerIntelligence(
    institutionId, user.id, academicHealth.academicHealth
  );

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

      attendancePercentage: attendanceSummary.overallPercentage,
      subjectAttendance: attendanceSummary.subjects,
      assignments: upcomingAssignments.map((a) => ({
        id: a.id,
        courseCode: a.courseCode,
        title: a.title,
        dueLabel: formatDueLabel(a.dueDate),
        status: a.submission ? "submitted" : new Date() > a.dueDate ? "overdue" : "pending",
      })),

      todaysClasses: timetable.map((entry) => ({ time: `${entry.startTime}–${entry.endTime}`, courseCode: entry.courseOffering.course.code, courseName: entry.courseOffering.course.name, location: entry.room || "Location not specified" })),
      announcements: notices.map((notice) => ({ id: notice.id, title: notice.title, postedLabel: notice.publishedAt.toLocaleDateString() })),
      upcomingEvents: exams.map((exam) => ({ id: exam.id, title: exam.title, date: exam.examDate.toISOString(), whenLabel: exam.examDate.toLocaleDateString() })),
      academicHealth,
      academicRisk: intelligenceData.risk,
      recommendations: intelligenceData.recommendations,
      career,
    },
  });
});
