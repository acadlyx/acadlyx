import {
  Request,
  Response,
} from "express";

import {
  AppError,
} from "../middleware/errorHandler";

import * as assignmentService from "../services/assignment.service";
import * as attendanceStatsService from "../services/attendanceStats.service";
import * as marksService from "../services/internalMark.service";
import * as studentPortalService from "../services/studentPortal.service";
import * as intelligenceService from "../services/intelligence.service";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";

function requireUser(
  req: Request
) {
  if (!req.user) {
    throw new AppError(
      "Authentication required",
      401
    );
  }

  return req.user;
}

function formatDueLabel(
  dueDate: Date
): string {
  const now =
    new Date();

  const diffMs =
    dueDate.getTime() -
    now.getTime();

  const diffDays =
    Math.round(
      diffMs /
        (1000 *
          60 *
          60 *
          24)
    );

  if (diffDays < 0) {
    return "Overdue";
  }

  if (diffDays === 0) {
    return "Due Today";
  }

  if (diffDays === 1) {
    return "Due Tomorrow";
  }

  if (diffDays <= 7) {
    return `Due ${dueDate.toLocaleDateString(
      undefined,
      {
        weekday:
          "long",
      }
    )}`;
  }

  return `Due ${dueDate.toLocaleDateString(
    undefined,
    {
      month:
        "short",
      day: "numeric",
    }
  )}`;
}

/**
 * GET /api/v1/students/me
 */
export const me =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(
          req
        );

      const user =
        requireUser(req);

      const profile =
        await studentPortalService.getMyProfile(
          institutionId,
          user.id
        );

      res.status(200).json({
        success: true,
        data: profile,
      });
    }
  );

/**
 * GET /api/v1/students/me/attendance
 */
export const attendance =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(
          req
        );

      const user =
        requireUser(req);

      const summary =
        await attendanceStatsService.getStudentAttendanceSummary(
          institutionId,
          user.id
        );

      res.status(200).json({
        success: true,
        data: summary,
      });
    }
  );

/**
 * GET /api/v1/students/me/marks
 */
export const marks =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(
          req
        );

      const user =
        requireUser(req);

      const entries =
        await marksService.getMyMarks(
          institutionId,
          user.id
        );

      res.status(200).json({
        success: true,
        data: entries,
      });
    }
  );

/**
 * GET /api/v1/students/me/assignments
 */
export const assignments =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(
          req
        );

      const user =
        requireUser(req);

      const items =
        await assignmentService.getMyUpcomingAssignments(
          institutionId,
          user.id,
          50
        );

      res.status(200).json({
        success: true,
        data: items,
      });
    }
  );

/**
 * GET /api/v1/students/me/timetable
 */
export const timetable =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(
          req
        );

      const user =
        requireUser(req);

      const { enrollment } =
        await studentPortalService.getMyProfile(
          institutionId,
          user.id
        );

      if (
        !enrollment?.sectionId
      ) {
        res.status(200).json({
          success: true,
          data: [],
        });

        return;
      }

      const entries =
        await prisma.timetableEntry.findMany(
          {
            where: {
              institutionId,

              courseOffering: {
                sectionId:
                  enrollment.sectionId,

                isActive: true,
              },
            },

            select: {
              id: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              room: true,

              courseOffering: {
                select: {
                  course: {
                    select: {
                      code: true,
                      name: true,
                    },
                  },

                  faculty: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },

            orderBy: [
              {
                dayOfWeek:
                  "asc",
              },
              {
                startTime:
                  "asc",
              },
            ],
          }
        );

      res.status(200).json({
        success: true,
        data: entries.map(
          (entry) => ({
            id: entry.id,
            dayOfWeek:
              entry.dayOfWeek,
            startTime:
              entry.startTime,
            endTime:
              entry.endTime,
            room:
              entry.room,

            course:
              entry
                .courseOffering
                .course,

            faculty:
              entry
                .courseOffering
                .faculty
                ? `${entry.courseOffering.faculty.firstName} ${entry.courseOffering.faculty.lastName}`.trim()
                : null,
          })
        ),
      });
    }
  );

/**
 * GET /api/v1/students/me/dashboard
 *
 * FAST FIRST-PAINT CONTRACT
 *
 * This endpoint intentionally contains only information needed to render
 * the student's primary workspace.
 *
 * Career intelligence is NOT part of this critical path.
 * It belongs to a dedicated career experience.
 */
export const dashboard =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(
          req
        );

      const user =
        requireUser(req);

      const profile =
        await studentPortalService.getMyProfile(
          institutionId,
          user.id
        );

      const {
        user: profileUser,
        enrollment,
      } = profile;

      if (!enrollment) {
        const institution =
          await studentPortalService.getInstitutionBranding(
            institutionId
          );

        res.status(200).json({
          success: true,
          data: {
            institution,

            student: {
              firstName:
                profileUser.firstName,
              lastName:
                profileUser.lastName,
              email:
                profileUser.email,
              rollNumber:
                null,
            },

            program: null,
            academicYear: null,
            section: null,
            courseOfferings: [],

            attendancePercentage:
              0,

            subjectAttendance:
              [],

            assignments: [],
            todaysClasses: [],
            announcements: [],
            upcomingEvents: [],

            academicHealth: {
              attendance: 0,
              assignments: 0,
              internalMarks: 0,
              engagement: 0,
              academicHealth: 0,
            },

            academicRisk:
              "LOW",

            recommendations: [
              "Your academic enrollment is being set up. Please contact your institution if this persists.",
            ],

            career: null,
          },
        });

        return;
      }

      const sectionId =
        enrollment.sectionId;

      const now =
        new Date();

      /*
       * Everything that does not depend on another result is fetched
       * concurrently.
       *
       * Previously course offerings were fetched first and career
       * intelligence was fetched after the main dashboard data.
       */
      const [
        institution,
        courseOfferings,
        attendanceSummary,
        upcomingAssignments,
        intelligence,
        timetable,
        notices,
        exams,
      ] = await Promise.all([
        studentPortalService.getInstitutionBranding(
          institutionId
        ),

        sectionId
          ? studentPortalService.getSectionCourseOfferings(
              institutionId,
              sectionId
            )
          : Promise.resolve([]),

        attendanceStatsService.getStudentAttendanceSummary(
          institutionId,
          user.id
        ),

        assignmentService.getMyUpcomingAssignments(
          institutionId,
          user.id,
          5
        ),

        /*
         * Intelligence remains useful for the dashboard,
         * but is now parallel with the other requests.
         */
        intelligenceService.getStudentIntelligence(
          institutionId,
          user.id
        ),

        sectionId
          ? prisma.timetableEntry.findMany(
              {
                where: {
                  institutionId,
                  dayOfWeek:
                    now.getDay(),

                  courseOffering: {
                    sectionId,
                    isActive: true,
                  },
                },

                select: {
                  id: true,
                  startTime: true,
                  endTime: true,
                  room: true,

                  courseOffering: {
                    select: {
                      course: {
                        select: {
                          code: true,
                          name: true,
                        },
                      },
                    },
                  },
                },

                orderBy: {
                  startTime:
                    "asc",
                },
              }
            )
          : Promise.resolve([]),

        prisma.notice.findMany(
          {
            where: {
              institutionId,

              publishedAt: {
                lte: now,
              },

              AND: [
                {
                  OR: [
                    {
                      expiresAt:
                        null,
                    },
                    {
                      expiresAt: {
                        gt: now,
                      },
                    },
                  ],
                },
                {
                  audience: {
                    in: [
                      "ALL",
                      "STUDENT",
                    ],
                  },
                },
              ],
            },

            select: {
              id: true,
              title: true,
              publishedAt: true,
            },

            orderBy: {
              publishedAt:
                "desc",
            },

            take: 5,
          }
        ),

        sectionId
          ? prisma.exam.findMany(
              {
                where: {
                  institutionId,

                  courseOffering: {
                    sectionId,
                  },

                  examDate: {
                    gte: now,
                  },
                },

                select: {
                  id: true,
                  title: true,
                  examDate: true,
                },

                orderBy: {
                  examDate:
                    "asc",
                },

                take: 5,
              }
            )
          : Promise.resolve([]),
      ]);

      const intelligenceData =
        intelligence ?? {
          scores: {
            attendance:
              attendanceSummary.overallPercentage,

            assignments: 100,

            internalMarks: 0,

            engagement: 0,

            academicHealth: 0,
          },

          risk: "LOW" as const,

          recommendations:
            [] as string[],
        };

      const academicHealth =
        intelligenceData.scores;

      const currentTime =
        new Date();

      res.status(200).json({
        success: true,

        data: {
          institution,

          student: {
            firstName:
              profileUser.firstName,
            lastName:
              profileUser.lastName,
            email:
              profileUser.email,
            rollNumber:
              enrollment.rollNumber,
          },

          program:
            enrollment.program,

          academicYear:
            enrollment.academicYear,

          section:
            enrollment.section
              ? {
                  id:
                    enrollment
                      .section
                      .id,

                  name:
                    enrollment
                      .section
                      .name,

                  semester:
                    enrollment
                      .section
                      .semester,
                }
              : null,

          courseOfferings:
            courseOfferings.map(
              (offering) => ({
                id:
                  offering.id,
                course:
                  offering.course,
                faculty:
                  offering.faculty,
              })
            ),

          attendancePercentage:
            attendanceSummary.overallPercentage,

          subjectAttendance:
            attendanceSummary.subjects,

          assignments:
            upcomingAssignments.map(
              (assignment) => ({
                id:
                  assignment.id,

                courseCode:
                  assignment.courseCode,

                title:
                  assignment.title,

                dueLabel:
                  formatDueLabel(
                    assignment.dueDate
                  ),

                status:
                  assignment.submission
                    ? "submitted"
                    : currentTime >
                        assignment.dueDate
                      ? "overdue"
                      : "pending",
              })
            ),

          todaysClasses:
            timetable.map(
              (entry) => ({
                time: `${entry.startTime}–${entry.endTime}`,

                courseCode:
                  entry
                    .courseOffering
                    .course
                    .code,

                courseName:
                  entry
                    .courseOffering
                    .course
                    .name,

                location:
                  entry.room ||
                  "Location not specified",
              })
            ),

          announcements:
            notices.map(
              (notice) => ({
                id:
                  notice.id,

                title:
                  notice.title,

                postedLabel:
                  notice.publishedAt.toLocaleDateString(),
              })
            ),

          upcomingEvents:
            exams.map(
              (exam) => ({
                id:
                  exam.id,

                title:
                  exam.title,

                date:
                  exam.examDate.toISOString(),

                whenLabel:
                  exam.examDate.toLocaleDateString(),
              })
            ),

          academicHealth,

          academicRisk:
            intelligenceData.risk,

          recommendations:
            intelligenceData.recommendations,

          /*
           * Deliberately omitted from the critical dashboard request.
           *
           * The frontend type already makes career optional.
           */
        },
      });
    }
  );
