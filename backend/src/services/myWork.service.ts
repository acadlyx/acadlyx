import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";

export type WorkPriority = "critical" | "high" | "normal";

export interface WorkItem {
  id: string;
  title: string;
  count: number;
  priority: WorkPriority;
  href: string;
  detail: string;
}

export interface MyWorkSummary {
  generatedAt: string;
  total: number;
  critical: number;
  high: number;
  items: WorkItem[];
}

const MANAGEMENT_ROLES = new Set([
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "REGISTRAR",
  "INSTITUTION_ADMIN",
]);

function hasRole(actor: AuthenticatedUser, role: string): boolean {
  return actor.roles.some((value) => value.toUpperCase() === role);
}

export async function getMyWork(
  institutionId: string,
  actor: AuthenticatedUser,
): Promise<MyWorkSummary> {
  const items: WorkItem[] = [];

  const unreadNotifications = await prisma.notification.count({
    where: { institutionId, userId: actor.id, readAt: null },
  });

  if (unreadNotifications > 0) {
    items.push({
      id: "notifications",
      title: "Unread notifications",
      count: unreadNotifications,
      priority: "high",
      href: "/notifications",
      detail: "Review messages and changes that may require action.",
    });
  }

  if (hasRole(actor, "FACULTY")) {
    const [pendingAttendance, pendingReviews, upcomingExams] =
      await Promise.all([
        prisma.attendanceSession.count({
          where: {
            institutionId,
            facultyId: actor.id,
            isSubmitted: false,
          },
        }),
        prisma.assignmentSubmission.count({
          where: {
            institutionId,
            status: { in: ["SUBMITTED", "LATE"] },
            assignment: { createdById: actor.id },
          },
        }),
        prisma.exam.count({
          where: {
            institutionId,
            examDate: { gte: new Date() },
            courseOffering: { facultyId: actor.id },
          },
        }),
      ]);

    if (pendingAttendance) {
      items.push({
        id: "faculty-attendance",
        title: "Attendance records pending",
        count: pendingAttendance,
        priority: "high",
        href: "/faculty/attendance",
        detail: "Submit today's attendance before it becomes stale.",
      });
    }

    if (pendingReviews) {
      items.push({
        id: "faculty-reviews",
        title: "Assignments awaiting evaluation",
        count: pendingReviews,
        priority: "high",
        href: "/faculty/assignments",
        detail: "Student submissions are waiting for review.",
      });
    }

    if (upcomingExams) {
      items.push({
        id: "faculty-exams",
        title: "Upcoming examinations",
        count: upcomingExams,
        priority: "normal",
        href: "/faculty/examinations",
        detail: "Review upcoming examinations for your assigned courses.",
      });
    }
  }

  if (hasRole(actor, "HOD")) {
    const departmentIds = (
      await prisma.departmentAccess.findMany({
        where: { userId: actor.id },
        select: { departmentId: true },
      })
    ).map((row) => row.departmentId);

    if (departmentIds.length) {
      const [attendance, marks] = await Promise.all([
        prisma.attendanceSession.count({
          where: {
            institutionId,
            isSubmitted: false,
            courseOffering: {
              course: { departmentId: { in: departmentIds } },
            },
          },
        }),
        prisma.internalMark.count({
          where: {
            institutionId,
            courseOffering: {
              course: { departmentId: { in: departmentIds } },
            },
          },
        }),
      ]);

      if (attendance) {
        items.push({
          id: "hod-attendance",
          title: "Department attendance pending",
          count: attendance,
          priority: "high",
          href: "/hod/operations",
          detail: "Faculty attendance submissions are incomplete.",
        });
      }

      if (marks) {
        items.push({
          id: "hod-marks",
          title: "Department marks records",
          count: marks,
          priority: "normal",
          href: "/hod/examinations",
          detail: "Open the department examination workspace to review marks.",
        });
      }
    }
  }

  if (hasRole(actor, "ACCOUNTS")) {
    const overdue = await prisma.feeInvoice.count({
      where: {
        institutionId,
        dueDate: { lt: new Date() },
        status: { notIn: ["PAID", "CANCELLED", "REFUNDED"] },
      },
    });

    if (overdue) {
      items.push({
        id: "accounts-overdue",
        title: "Overdue fee invoices",
        count: overdue,
        priority: "critical",
        href: "/accounts/fees",
        detail: "Review defaulters and start collection actions.",
      });
    }
  }

  if (hasRole(actor, "HR")) {
    const pending = await prisma.leaveRequest.count({
      where: { institutionId, status: "PENDING" },
    });

    if (pending) {
      items.push({
        id: "hr-leave",
        title: "Leave approvals pending",
        count: pending,
        priority: "high",
        href: "/leave-management",
        detail: "Review employee leave requests awaiting a decision.",
      });
    }
  }

  if (hasRole(actor, "ADMISSIONS")) {
    const pending = await prisma.admissionApplication.count({
      where: {
        institutionId,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING"] },
      },
    });

    if (pending) {
      items.push({
        id: "admissions-pending",
        title: "Admission applications need attention",
        count: pending,
        priority: "high",
        href: "/admissions",
        detail: "Review applicants and resolve pending documents.",
      });
    }
  }

  if (hasRole(actor, "EXAMINATION")) {
    const [upcoming, resultRows] = await Promise.all([
      prisma.exam.count({
        where: { institutionId, examDate: { gte: new Date() } },
      }),
      prisma.examResult.count({ where: { institutionId } }),
    ]);

    if (upcoming) {
      items.push({
        id: "exam-upcoming",
        title: "Upcoming examinations",
        count: upcoming,
        priority: "high",
        href: "/examination",
        detail: "Open the examination workspace and continue the active workflow.",
      });
    }

    if (resultRows === 0 && upcoming > 0) {
      items.push({
        id: "exam-results",
        title: "Results not started",
        count: upcoming,
        priority: "normal",
        href: "/examination",
        detail: "Results will become available after examination marks are entered.",
      });
    }
  }

  if (hasRole(actor, "STUDENT")) {
    const [assignments, exams, fees] = await Promise.all([
      prisma.assignment.count({
        where: {
          institutionId,
          dueDate: { gte: new Date() },
          status: "PUBLISHED",
          courseOffering: {
            registrations: { some: { studentId: actor.id } },
          },
        },
      }),
      prisma.exam.count({
        where: {
          institutionId,
          examDate: { gte: new Date() },
          courseOffering: {
            registrations: { some: { studentId: actor.id } },
          },
        },
      }),
      prisma.feeInvoice.count({
        where: {
          institutionId,
          studentId: actor.id,
          status: { notIn: ["PAID", "CANCELLED", "REFUNDED"] },
        },
      }),
    ]);

    if (assignments) {
      items.push({
        id: "student-assignments",
        title: "Upcoming assignments",
        count: assignments,
        priority: "normal",
        href: "/student/assignments",
        detail: "Review deadlines and complete your pending work.",
      });
    }

    if (exams) {
      items.push({
        id: "student-exams",
        title: "Upcoming examinations",
        count: exams,
        priority: "high",
        href: "/student/examinations",
        detail: "Review your next examinations and admit-card status.",
      });
    }

    if (fees) {
      items.push({
        id: "student-fees",
        title: "Fee items requiring attention",
        count: fees,
        priority: "high",
        href: "/student/fees",
        detail: "Review outstanding fee invoices.",
      });
    }
  }

  if (MANAGEMENT_ROLES.has(actor.roles[0]?.toUpperCase() || "")) {
    const [students, faculty, overdue, pendingAdmissions] = await Promise.all([
      prisma.user.count({
        where: {
          institutionId,
          isActive: true,
          userRoles: { some: { role: { name: "STUDENT" } } },
        },
      }),
      prisma.user.count({
        where: {
          institutionId,
          isActive: true,
          userRoles: { some: { role: { name: "FACULTY" } } },
        },
      }),
      prisma.feeInvoice.count({
        where: {
          institutionId,
          dueDate: { lt: new Date() },
          status: { notIn: ["PAID", "CANCELLED", "REFUNDED"] },
        },
      }),
      prisma.admissionApplication.count({
        where: {
          institutionId,
          status: { in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING"] },
        },
      }),
    ]);

    if (overdue) {
      items.push({
        id: "management-fees",
        title: "Institution fee exceptions",
        count: overdue,
        priority: "high",
        href: "/chairman/fees",
        detail: "Outstanding invoices require financial attention.",
      });
    }

    if (pendingAdmissions) {
      items.push({
        id: "management-admissions",
        title: "Admissions awaiting action",
        count: pendingAdmissions,
        priority: "normal",
        href: "/admissions",
        detail: "Pending applications are visible for institutional oversight.",
      });
    }

    if (students + faculty === 0) {
      items.push({
        id: "management-empty",
        title: "Institution setup needs attention",
        count: 1,
        priority: "critical",
        href: "/admin",
        detail: "No active student or faculty population is currently visible.",
      });
    }
  }

  items.sort((a, b) => {
    const weight: Record<WorkPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
    };
    return weight[a.priority] - weight[b.priority] || b.count - a.count;
  });

  return {
    generatedAt: new Date().toISOString(),
    total: items.reduce((sum, item) => sum + item.count, 0),
    critical: items.filter((item) => item.priority === "critical").reduce((sum, item) => sum + item.count, 0),
    high: items.filter((item) => item.priority === "high").reduce((sum, item) => sum + item.count, 0),
    items,
  };
}
