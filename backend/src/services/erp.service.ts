import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { getCanonicalRoleNames } from "../config/rbac";
import { recordAuditLog } from "./audit.service";
import { getManagementWorkspace } from "./managementWorkspace.service";
import { getManagedDepartmentIds, getDirectorDepartmentIds } from "./accessScope.service";

const MANAGEMENT_ROLES = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "CHAIRMAN",
  "ACCOUNTS",
];

/** Evaluated per call: a module-level constant would freeze the weekday at process start. */
const todayWeekday = () => new Date().getDay();

function assertRole(
  user: AuthenticatedUser,
  allowed: string[]
): void {
  const actorRoles = getCanonicalRoleNames(user.roles);
  const allowedRoles = getCanonicalRoleNames(allowed);
  if (!actorRoles.some((role) => allowedRoles.includes(role))) {
    throw new AppError(
      "Not authorized for this ERP operation",
      403
    );
  }
}

function hasAnyRole(
  user: AuthenticatedUser,
  roles: string[]
): boolean {
  const actorRoles = getCanonicalRoleNames(user.roles);
  const allowedRoles = getCanonicalRoleNames(roles);
  return actorRoles.some((role) => allowedRoles.includes(role));
}

async function assertDepartmentScope(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId?: string,
  departmentId?: string
): Promise<void> {
  if (!hasAnyRole(actor, ["HOD"])) {
    return;
  }

  let scopedDepartmentId = departmentId;

  if (courseOfferingId) {
    const offering =
      await prisma.courseOffering.findFirst({
        where: {
          id: courseOfferingId,
          institutionId,
        },
        select: {
          course: {
            select: {
              departmentId: true,
            },
          },
        },
      });

    if (!offering) {
      throw new AppError(
        "Course offering not found in this institution",
        404
      );
    }

    scopedDepartmentId =
      offering.course.departmentId;
  }

  if (!scopedDepartmentId) {
    throw new AppError(
      "HOD actions require a department scope",
      403
    );
  }

  const access =
    await prisma.departmentAccess.findFirst({
      where: {
        userId: actor.id,
        departmentId: scopedDepartmentId,
        department: {
          institutionId,
        },
      },
    });

  if (!access) {
    throw new AppError(
      "Department is outside your authorized scope",
      403
    );
  }
}

async function assertStudentExists(
  institutionId: string,
  studentId: string
): Promise<void> {
  const student =
    await prisma.user.findFirst({
      where: {
        id: studentId,
        institutionId,
        isActive: true,
        userRoles: {
          some: {
            role: {
              name: "STUDENT",
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

  if (!student) {
    throw new AppError(
      "Student not found in this institution",
      404
    );
  }
}

async function assertParentExists(
  institutionId: string,
  parentId: string
): Promise<void> {
  const parent =
    await prisma.user.findFirst({
      where: {
        id: parentId,
        institutionId,
        isActive: true,
        userRoles: {
          some: {
            role: {
              name: "PARENT",
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

  if (!parent) {
    throw new AppError(
      "Parent not found in this institution",
      404
    );
  }
}

async function assertStudentScope(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
): Promise<void> {
  if (actor.id === studentId) {
    return;
  }

  if (
    hasAnyRole(actor, MANAGEMENT_ROLES)
  ) {
    return;
  }

  if (actor.roles.includes("PARENT")) {
    const linked =
      await prisma.parentStudentLink.findFirst({
        where: {
          institutionId,
          parentId: actor.id,
          studentId,
        },
      });

    if (linked) {
      return;
    }
  }

  throw new AppError(
    "Student data is outside your authorized scope",
    403
  );
}

async function getStudentSection(
  institutionId: string,
  studentId: string
) {
  return prisma.studentEnrollment.findFirst({
    where: {
      institutionId,
      userId: studentId,
      status: "ACTIVE",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      sectionId: true,
      programId: true,
      academicYearId: true,
      rollNumber: true,
      status: true,
      program: {
        select: {
          id: true,
          name: true,
          code: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      academicYear: {
        select: {
          id: true,
          name: true,
          isCurrent: true,
        },
      },
      section: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

async function getFacultyOfferings(
  institutionId: string,
  facultyId: string
) {
  return prisma.courseOffering.findMany({
    where: {
      institutionId,
      facultyId,
      isActive: true,
    },
    select: {
      id: true,
      courseId: true,
      semesterId: true,
      sectionId: true,
      course: {
        select: {
          id: true,
          code: true,
          name: true,
          credits: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      semester: {
        select: {
          id: true,
          name: true,
          number: true,
        },
      },
      section: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 100,
  });
}

async function getHodDepartments(
  institutionId: string,
  actor: AuthenticatedUser
) {
  if (!hasAnyRole(actor, ["HOD"])) return [];
  const ids = await getManagedDepartmentIds(institutionId, actor.id);
  if (!ids.length) return [];
  return prisma.department.findMany({
    where: { institutionId, id: { in: ids }, isActive: true },
    select: { id: true, name: true, code: true },
  }).then(rows => rows.map(department => ({
    departmentId: department.id,
    scope: "HOD",
    department,
  })));
}

export async function getMyWorkspace(
  institutionId: string,
  actor: AuthenticatedUser
) {
  const now = new Date();

  /*
   * LEADERSHIP WORKSPACES
   *
   * These roles share the institution-level KPI source for the dashboard
   * summary, but their actionable modules remain permission-controlled by
   * the authenticated role. Department/school-specific authority is not
   * inferred here; it is enforced by the underlying module APIs.
   */
  if (
    hasAnyRole(actor, [
      "INSTITUTION_ADMIN",
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
    ])
  ) {
    return getManagementWorkspace(institutionId, actor);
  }

  /*
   * HOD
   */
  if (actor.roles.includes("HOD")) {
    const departments =
      await getHodDepartments(
        institutionId,
        actor
      );

    const departmentIds =
      departments.map(
        (item) => item.departmentId
      );

    const [
      faculty,
      students,
      offerings,
      timetable,
      exams,
      notices,
      notifications,
      documents,
    ] = await Promise.all([
      prisma.user.findMany({
        where: {
          institutionId,
          isActive: true,
          userRoles: {
            some: {
              role: {
                name: "FACULTY",
              },
            },
          },
          facultyCourseOfferings: {
            some: {
              course: {
                departmentId: {
                  in: departmentIds,
                },
              },
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
        distinct: ["id"],
        take: 200,
      }),

      prisma.user.findMany({
        where: {
          institutionId,
          isActive: true,
          userRoles: {
            some: {
              role: {
                name: "STUDENT",
              },
            },
          },
          studentEnrollments: {
            some: {
              status: "ACTIVE",
              program: {
                departmentId: {
                  in: departmentIds,
                },
              },
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
        distinct: ["id"],
        take: 100,
      }),

      prisma.courseOffering.findMany({
        where: {
          institutionId,
          isActive: true,
          course: {
            departmentId: {
              in: departmentIds,
            },
          },
        },
        select: {
          id: true,
          course: {
            select: {
              code: true,
              name: true,
            },
          },
          section: {
            select: {
              name: true,
            },
          },
          faculty: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        take: 100,
      }),

      prisma.timetableEntry.findMany({
        where: {
          institutionId,
          dayOfWeek: todayWeekday(),
          courseOffering: {
            course: {
              departmentId: {
                in: departmentIds,
              },
            },
          },
        },
        include: {
          courseOffering: {
            include: {
              course: {
                select: {
                  code: true,
                  name: true,
                },
              },
              section: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          startTime: "asc",
        },
        take: 100,
      }),

      prisma.exam.findMany({
        where: {
          institutionId,
          courseOffering: {
            course: {
              departmentId: {
                in: departmentIds,
              },
            },
          },
        },
        include: {
          courseOffering: {
            include: {
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
          examDate: "desc",
        },
        take: 20,
      }),

      /*
       * IMPORTANT:
       * Prisma objects cannot contain two OR properties.
       * Both logical conditions are therefore combined
       * through AND, with one OR for expiry and one OR
       * for department scope.
       */
                        prisma.notice.findMany({
        where: {
          institutionId,
          AND: [
            { publishedAt: { lte: now } },
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
            },
            {
              OR: [
                { departmentId: null },
                ...(departmentIds.length
                  ? [{ departmentId: { in: departmentIds } }]
                  : []),
              ],
            },
          ],
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
      }),

      prisma.notification.findMany({
        where: {
          institutionId,
          userId: actor.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      }),

      prisma.document.findMany({
        where: {
          institutionId,
          ownerId: actor.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),
    ]);

    return {
      workspaceType: "HOD",
      stats: {
        departments: departments.length,
        faculty: faculty.length,
        students: students.length,
        offerings: offerings.length,
        exams: exams.length,
      },
      departments,
      faculty,
      students,
      facultyOfferings: offerings,
      timetable,
      notices,
      notifications,
      documents,
      fees: [],
      exams,
    };
  }

  /*
   * FACULTY
   */
  if (actor.roles.includes("FACULTY")) {
    const offerings =
      await getFacultyOfferings(
        institutionId,
        actor.id
      );

    const offeringIds =
      offerings.map(
        (offering) => offering.id
      );

    const [
      timetable,
      assignments,
      exams,
      students,
      notifications,
      documents,
      notices,
    ] = await Promise.all([
      prisma.timetableEntry.findMany({
        where: {
          institutionId,
          dayOfWeek: todayWeekday(),
          courseOfferingId: {
            in: offeringIds,
          },
        },
        include: {
          courseOffering: {
            include: {
              course: {
                select: {
                  code: true,
                  name: true,
                },
              },
              section: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          startTime: "asc",
        },
      }),

      prisma.assignment.findMany({
        where: {
          institutionId,
          courseOfferingId: {
            in: offeringIds,
          },
        },
        orderBy: {
          dueDate: "asc",
        },
        take: 20,
      }),

      prisma.exam.findMany({
        where: {
          institutionId,
          courseOfferingId: {
            in: offeringIds,
          },
        },
        include: {
          courseOffering: {
            include: {
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
          examDate: "desc",
        },
        take: 20,
      }),

      prisma.user.findMany({
        where: {
          institutionId,
          isActive: true,
          studentEnrollments: {
            some: {
              status: "ACTIVE",
              sectionId: {
                in: offerings
                  .map(
                    (item) =>
                      item.sectionId
                  )
                  .filter(
                    (
                      id
                    ): id is string =>
                      Boolean(id)
                  ),
              },
            },
          },
          userRoles: {
            some: {
              role: {
                name: "STUDENT",
              },
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
        distinct: ["id"],
        take: 200,
      }),

      prisma.notification.findMany({
        where: {
          institutionId,
          userId: actor.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      }),

      prisma.document.findMany({
        where: {
          institutionId,
          ownerId: actor.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),

      prisma.notice.findMany({
        where: {
          institutionId,
          publishedAt: {
            lte: now,
          },
          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: now,
              },
            },
          ],
          audience: {
            in: [
              "ALL",
              "FACULTY",
            ],
          },
        },
        orderBy: {
          publishedAt: "desc",
        },
        take: 10,
      }),
    ]);

    return {
      workspaceType: "FACULTY",
      stats: {
        offerings: offerings.length,
        students: students.length,
        assignments: assignments.length,
        exams: exams.length,
      },
      facultyOfferings: offerings,
      students,
      timetable,
      assignments,
      exams,
      notices,
      notifications,
      documents,
      fees: [],
    };
  }

  /*
   * PARENT
   */
  if (actor.roles.includes("PARENT")) {
    const children =
      await prisma.parentStudentLink.findMany({
        where: {
          institutionId,
          parentId: actor.id,
        },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              studentEnrollments: {
                where: {
                  status: "ACTIVE",
                },
                orderBy: {
                  createdAt: "desc",
                },
                take: 1,
                include: {
                  program: {
                    select: {
                      name: true,
                      code: true,
                      departmentId: true,
                    },
                  },
                  section: {
                    select: {
                      name: true,
                    },
                  },
                  academicYear: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    const studentIds =
      children.map(
        (child) => child.studentId
      );

    const [
      fees,
      exams,
      notices,
      notifications,
    ] = await Promise.all([
      prisma.feeInvoice.findMany({
        where: {
          institutionId,
          studentId: {
            in: studentIds,
          },
        },
        include: {
          payments: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.examResult.findMany({
        where: {
          institutionId,
          studentId: {
            in: studentIds,
          },
        },
        include: {
          exam: {
            include: {
              courseOffering: {
                include: {
                  course: {
                    select: {
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      }),

            prisma.notice.findMany({
        where: {
          institutionId,
          AND: [
            { publishedAt: { lte: now } },
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
            },
            {
              audience: {
                in: ["ALL", "PARENT", "PARENTS"],
              },
            },
            {
              OR: [
                { departmentId: null },
                {
                  departmentId: {
                    in: Array.from(
                      new Set(
                        children.flatMap((child) =>
                          child.student.studentEnrollments.map(
                            (enrollment) => enrollment.program.departmentId,
                          ),
                        ),
                      ),
                    ),
                  },
                },
              ],
            },
          ],
        },
        orderBy: { publishedAt: "desc" },
        take: 10,
      }),

      prisma.notification.findMany({
        where: {
          institutionId,
          userId: actor.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      }),
    ]);

    return {
      workspaceType: "PARENT",
      stats: {
        children: children.length,
        fees: fees.length,
        exams: exams.length,
      },
      children,
      timetable: [],
      notices,
      notifications,
      documents: [],
      fees,
      exams,
    };
  }

  /*
   * STUDENT
   */
  if (actor.roles.includes("STUDENT")) {
    const enrollment =
      await getStudentSection(
        institutionId,
        actor.id
      );

    const sectionId =
      enrollment?.sectionId;

    const offerings =
      sectionId
        ? await prisma.courseOffering.findMany({
            where: {
              institutionId,
              sectionId,
              isActive: true,
            },
            select: {
              id: true,
              course: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  credits: true,
                },
              },
              faculty: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          })
        : [];

    const offeringIds =
      offerings.map(
        (offering) => offering.id
      );

    const [
      timetable,
      assignments,
      marks,
      exams,
      fees,
      notices,
      notifications,
      documents,
      libraryLoans,
    ] = await Promise.all([
      prisma.timetableEntry.findMany({
        where: {
          institutionId,
          courseOfferingId: {
            in: offeringIds,
          },
        },
        include: {
          courseOffering: {
            include: {
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
            dayOfWeek: "asc",
          },
          {
            startTime: "asc",
          },
        ],
      }),

      prisma.assignment.findMany({
        where: {
          institutionId,
          courseOfferingId: {
            in: offeringIds,
          },
          status: "PUBLISHED",
        },
        orderBy: {
          dueDate: "asc",
        },
        take: 30,
      }),

      prisma.internalMark.findMany({
        where: {
          institutionId,
          studentId: actor.id,
        },
        include: {
          courseOffering: {
            include: {
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
          createdAt: "desc",
        },
        take: 50,
      }),

      prisma.examResult.findMany({
        where: {
          institutionId,
          studentId: actor.id,
        },
        include: {
          exam: {
            include: {
              courseOffering: {
                include: {
                  course: {
                    select: {
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
      }),

      prisma.feeInvoice.findMany({
        where: {
          institutionId,
          studentId: actor.id,
        },
        include: {
          payments: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.notice.findMany({
        where: {
          institutionId,
          AND: [
            { publishedAt: { lte: now } },
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
            },
            {
              audience: {
                in: ["ALL", "STUDENT", "STUDENTS"],
              },
            },
            {
              OR: [
                { departmentId: null },
                ...(enrollment
                  ? [{ departmentId: enrollment.program.departmentId }]
                  : []),
              ],
            },
          ],
        },
        orderBy: { publishedAt: "desc" },
        take: 10,
      }),

      prisma.notification.findMany({
        where: {
          institutionId,
          userId: actor.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      }),

      prisma.document.findMany({
        where: {
          institutionId,
          ownerId: actor.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),
      prisma.libraryIssue.findMany({
        where: {
          institutionId,
          borrowerId: actor.id,
        },
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return {
      workspaceType: "STUDENT",
      stats: {
        courses: offerings.length,
        assignments: assignments.length,
        marks: marks.length,
        exams: exams.length,
        fees: fees.length,
      },
      enrollment,
      offerings,
      timetable,
      assignments,
      marks,
      exams,
      fees,
      notices,
      notifications,
      documents,
      libraryLoans,
    };
  }

  /*
   * SPECIALIST WORKSPACES
   *
   * Specialists use focused KPI summaries at the workspace root. Detail
   * screens remain the source of truth and enforce their own permissions.
   */
  const canonicalRoles = getCanonicalRoleNames(actor.roles);

  if (canonicalRoles.includes("ACCOUNTS")) {
    const [students, invoices, payments, invoiceTotals] =
      await Promise.all([
        prisma.user.count({
          where: {
            institutionId,
            isActive: true,
            userRoles: { some: { role: { name: "STUDENT" } } },
          },
        }),
        prisma.feeInvoice.count({ where: { institutionId } }),
        prisma.feePayment.count({ where: { institutionId } }),
        prisma.feeInvoice.aggregate({
          where: { institutionId },
          _sum: { amount: true, paidAmount: true },
        }),
      ]);

    return {
      workspaceType: "ACCOUNTS",
      stats: {
        students,
        invoices,
        payments,
        outstanding: Math.max(
          0,
          Number(invoiceTotals._sum.amount ?? 0) -
            Number(invoiceTotals._sum.paidAmount ?? 0)
        ),
      },
    };
  }

  if (canonicalRoles.includes("HR")) {
    const [employees, activeEmployees, pendingLeave] = await Promise.all([
      prisma.employeeProfile.count({ where: { institutionId } }),
      prisma.employeeProfile.count({
        where: { institutionId, status: "ACTIVE" },
      }),
      prisma.leaveRequest.count({
        where: { institutionId, status: "PENDING" },
      }),
    ]);

    return {
      workspaceType: "HR",
      stats: {
        employees,
        activeEmployees,
        pendingLeave,
      },
    };
  }

  if (canonicalRoles.includes("ADMISSIONS")) {
    const [applications, submitted, selected, enrolled] = await Promise.all([
      prisma.admissionApplication.count({
        where: { institutionId },
      }),
      prisma.admissionApplication.count({
        where: { institutionId, status: "SUBMITTED" },
      }),
      prisma.admissionApplication.count({
        where: { institutionId, status: "SELECTED" },
      }),
      prisma.admissionApplication.count({
        where: { institutionId, status: "ENROLLED" },
      }),
    ]);

    return {
      workspaceType: "ADMISSIONS",
      stats: {
        applications,
        submitted,
        selected,
        enrolled,
      },
    };
  }

  if (canonicalRoles.includes("EXAMINATION")) {
    const [exams, upcomingExams, results] = await Promise.all([
      prisma.exam.count({ where: { institutionId } }),
      prisma.exam.count({
        where: {
          institutionId,
          examDate: { gte: now },
        },
      }),
      prisma.examResult.count({ where: { institutionId } }),
    ]);

    return {
      workspaceType: "EXAMINATION",
      stats: {
        exams,
        upcomingExams,
        results,
      },
    };
  }

  if (canonicalRoles.includes("LIBRARIAN")) {
    const [books, issued, overdue] = await Promise.all([
      prisma.libraryBook.count({
        where: { institutionId, isActive: true },
      }),
      prisma.libraryIssue.count({
        where: { institutionId, status: "ISSUED" },
      }),
      prisma.libraryIssue.count({
        where: {
          institutionId,
          status: "ISSUED",
          dueDate: { lt: now },
        },
      }),
    ]);

    return {
      workspaceType: "LIBRARIAN",
      stats: {
        books,
        issued,
        overdue,
      },
    };
  }

  if (canonicalRoles.includes("PLACEMENT")) {
    const [opportunities, applications] = await Promise.all([
      prisma.opportunity.count({
        where: { institutionId, isActive: true },
      }),
      prisma.application.count({
        where: { institutionId },
      }),
    ]);

    return {
      workspaceType: "PLACEMENT",
      stats: {
        opportunities,
        applications,
      },
    };
  }

  if (canonicalRoles.includes("IT")) {
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [users, activeUsers, recentAuditEvents] = await Promise.all([
      prisma.user.count({ where: { institutionId } }),
      prisma.user.count({ where: { institutionId, isActive: true } }),
      prisma.auditLog.count({
        where: {
          institutionId,
          createdAt: { gte: since },
        },
      }),
    ]);

    return {
      workspaceType: "IT",
      stats: {
        users,
        activeUsers,
        recentAuditEvents,
      },
    };
  }

  if (canonicalRoles.includes("CMS")) {
    const [notices, notifications] = await Promise.all([
      prisma.notice.count({ where: { institutionId } }),
      prisma.notification.count({ where: { institutionId } }),
    ]);

    return {
      workspaceType: "CMS",
      stats: {
        notices,
        notifications,
      },
    };
  }

  if (canonicalRoles.includes("CLUB_PRESIDENT")) {
    const notifications = await prisma.notification.count({
      where: { institutionId, userId: actor.id },
    });

    return {
      workspaceType: "CLUB_PRESIDENT",
      stats: {
        notifications,
      },
    };
  }

  throw new AppError(
    "No supported ERP workspace is assigned to this user",
    403
  );
}

export async function createTimetableEntry(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    courseOfferingId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
  }
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "HOD",
    "ACCOUNTS",
  ]);

  if (
    input.dayOfWeek < 0 ||
    input.dayOfWeek > 6
  ) {
    throw new AppError(
      "dayOfWeek must be between 0 and 6",
      400
    );
  }

  if (
    !input.startTime ||
    !input.endTime
  ) {
    throw new AppError(
      "startTime and endTime are required",
      400
    );
  }

  if (input.endTime <= input.startTime) {
    throw new AppError(
      "endTime must be after startTime",
      400
    );
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    input.courseOfferingId
  );

  const offering =
    await prisma.courseOffering.findFirst({
      where: {
        id: input.courseOfferingId,
        institutionId,
        isActive: true,
      },
    });

  if (!offering) {
    throw new AppError(
      "Course offering not found in this institution",
      404
    );
  }

  const sameDayEntries =
    await prisma.timetableEntry.findMany({
      where: {
        institutionId,
        dayOfWeek: input.dayOfWeek,
      },
      include: {
        courseOffering: {
          select: {
            facultyId: true,
            sectionId: true,
          },
        },
      },
    });

  const overlaps = (entry: { startTime: string; endTime: string }) =>
    input.startTime < entry.endTime && entry.startTime < input.endTime;

  const conflict = sameDayEntries.find((entry) => {
    // The row with the same composite key is the upsert target itself.
    if (entry.courseOfferingId === input.courseOfferingId && entry.startTime === input.startTime) {
      return false;
    }
    if (!overlaps(entry)) return false;
    return (
      entry.courseOffering.sectionId === offering.sectionId ||
      (offering.facultyId && entry.courseOffering.facultyId === offering.facultyId) ||
      Boolean(input.room && entry.room && entry.room.trim().toLowerCase() === input.room.trim().toLowerCase())
    );
  });

  if (conflict) {
    throw new AppError(
      "Timetable conflicts with an existing section, faculty, or room allocation",
      409
    );
  }

  const row =
    await prisma.timetableEntry.upsert({
      where: {
        courseOfferingId_dayOfWeek_startTime: {
          courseOfferingId:
            input.courseOfferingId,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
        },
      },
      update: {
        endTime: input.endTime,
        room: input.room || null,
      },
      create: {
        institutionId,
        courseOfferingId:
          input.courseOfferingId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room || null,
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "timetable.upsert",
    entityType: "TimetableEntry",
    entityId: row.id,
  });

  return row;
}

export async function createNotice(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    title: string;
    body: string;
    audience?: string;
    departmentId?: string;
    expiresAt?: string;
  }
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "DIRECTOR",
    "CHAIRMAN",
    "HOD",
    "ACCOUNTS",
  ]);

  if (!input.title?.trim()) {
    throw new AppError(
      "Notice title is required",
      400
    );
  }

  if (!input.body?.trim()) {
    throw new AppError(
      "Notice body is required",
      400
    );
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    undefined,
    input.departmentId
  );

  if (input.departmentId) {
    const department =
      await prisma.department.findFirst({
        where: {
          id: input.departmentId,
          institutionId,
          isActive: true,
        },
      });

    if (!department) {
      throw new AppError(
        "Department not found in this institution",
        404
      );
    }
  }

  const row =
    await prisma.notice.create({
      data: {
        institutionId,
        createdById: actor.id,
        title: input.title.trim(),
        body: input.body.trim(),
        audience:
          input.audience || "ALL",
        departmentId:
          input.departmentId || null,
        expiresAt: input.expiresAt
          ? new Date(input.expiresAt)
          : null,
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "notice.create",
    entityType: "Notice",
    entityId: row.id,
  });

  return row;
}

export async function createExam(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    courseOfferingId: string;
    title: string;
    examDate: string;
    maxMarks: number;
  }
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "HOD",
    "FACULTY",
  ]);

  if (!input.title?.trim()) {
    throw new AppError(
      "Exam title is required",
      400
    );
  }

  if (
    !Number.isFinite(input.maxMarks) ||
    input.maxMarks <= 0
  ) {
    throw new AppError(
      "maxMarks must be greater than zero",
      400
    );
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    input.courseOfferingId
  );

  const offeringWhere: Prisma.CourseOfferingWhereInput = {
    id: input.courseOfferingId,
    institutionId,
    isActive: true,
  };

  if (actor.roles.includes("FACULTY")) {
    offeringWhere.facultyId = actor.id;
  }

  const offering =
    await prisma.courseOffering.findFirst({
      where: offeringWhere,
    });

  if (!offering) {
    throw new AppError(
      "Course offering is not authorized",
      403
    );
  }

  const row =
    await prisma.exam.create({
      data: {
        institutionId,
        createdById: actor.id,
        courseOfferingId:
          input.courseOfferingId,
        title: input.title.trim(),
        examDate: new Date(input.examDate),
        maxMarks: input.maxMarks,
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.create",
    entityType: "Exam",
    entityId: row.id,
  });

  return row;
}

export async function upsertExamResult(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    examId: string;
    studentId: string;
    marks: number;
    remarks?: string;
  }
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "HOD",
    "FACULTY",
  ]);

  const exam =
    await prisma.exam.findFirst({
      where: {
        id: input.examId,
        institutionId,
      },
      include: {
        courseOffering: {
          include: {
            course: true,
            section: true,
          },
        },
      },
    });

  if (!exam) {
    throw new AppError(
      "Exam not found",
      404
    );
  }

  if (
    actor.roles.includes("FACULTY") &&
    exam.courseOffering.facultyId !== actor.id
  ) {
    throw new AppError(
      "You are not assigned to this course offering",
      403
    );
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    exam.courseOfferingId
  );

  if (
    input.marks < 0 ||
    input.marks > exam.maxMarks
  ) {
    throw new AppError(
      "Marks must be within the exam maximum",
      400
    );
  }

  await assertStudentExists(
    institutionId,
    input.studentId
  );

  const enrolled =
    await prisma.studentEnrollment.findFirst({
      where: {
        institutionId,
        userId: input.studentId,
        status: "ACTIVE",
        sectionId:
          exam.courseOffering.sectionId,
      },
      select: {
        id: true,
      },
    });

  if (!enrolled) {
    throw new AppError(
      "Student is not enrolled in this exam's section",
      403
    );
  }

  const result =
    await prisma.examResult.upsert({
      where: {
        examId_studentId: {
          examId: input.examId,
          studentId: input.studentId,
        },
      },
      update: {
        marks: input.marks,
        remarks:
          input.remarks || null,
        enteredById: actor.id,
      },
      create: {
        institutionId,
        examId: input.examId,
        studentId: input.studentId,
        marks: input.marks,
        remarks:
          input.remarks || null,
        enteredById: actor.id,
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam-result.upsert",
    entityType: "ExamResult",
    entityId: result.id,
  });

  return result;
}

export async function createInvoice(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    studentId: string;
    title: string;
    amount: number;
    dueDate?: string;
  }
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "ACCOUNTS",
  ]);

  if (!input.title?.trim()) {
    throw new AppError(
      "Invoice title is required",
      400
    );
  }

  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    throw new AppError(
      "Invoice amount must be greater than zero",
      400
    );
  }

  await assertStudentExists(
    institutionId,
    input.studentId
  );

  const invoice =
    await prisma.feeInvoice.create({
      data: {
        institutionId,
        studentId: input.studentId,
        title: input.title.trim(),
        amount: input.amount,
        dueDate: input.dueDate
          ? new Date(input.dueDate)
          : null,
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fee-invoice.create",
    entityType: "FeeInvoice",
    entityId: invoice.id,
  });

  return invoice;
}

export async function recordPayment(
  institutionId: string,
  actor: AuthenticatedUser,
  invoiceId: string,
  amount: number,
  reference?: string,
  options?: { idempotencyKey?: string; method?: string }
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Payment amount must be greater than zero", 400);
  }
  if (!actor.permissions.includes("fees.payment.record") && !actor.permissions.includes("fees.pay")) {
    throw new AppError("Only authorized finance users may record payments", 403);
  }

  const invoice = await prisma.feeInvoice.findFirst({
    where: { id: invoiceId, institutionId },
    select: { id: true, studentId: true, amount: true, status: true },
  });
  if (!invoice) throw new AppError("Invoice not found", 404);
  await assertStudentScope(institutionId, actor, invoice.studentId);

  const idempotencyKey = options?.idempotencyKey?.trim() || undefined;
  const method = options?.method?.trim().toUpperCase() || "OFFLINE";

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const prior = await tx.feePayment.findFirst({
          where: { institutionId, idempotencyKey },
          include: { receipt: true },
        });
        if (prior) {
          if (
            Math.abs(Number(prior.amount) - amount) > 0.005 ||
            prior.invoiceId !== invoiceId
          ) {
            throw new AppError(
              "Idempotency key was already used for a different payment request",
              409
            );
          }
          return { payment: prior, invoiceId, duplicate: true };
        }
      }

      const current = await tx.feeInvoice.findFirst({
        where: { id: invoiceId, institutionId },
      });
      if (!current) throw new AppError("Invoice not found", 404);

      const paymentTotals = await tx.feePayment.aggregate({ where: { institutionId, invoiceId, status: "SUCCESS" }, _sum: { amount: true } });
      const alreadyPaid = Math.max(Number(current.paidAmount || 0), Number(paymentTotals._sum.amount || 0));
      const outstanding = Math.max(0, Number(current.amount) - alreadyPaid);
      if (amount > outstanding + 0.005) {
        throw new AppError("Payment exceeds the outstanding invoice balance", 400);
      }

      const payment = await tx.feePayment.create({
        data: {
          institutionId,
          invoiceId,
          amount,
          reference: reference || null,
          userId: actor.id,
          recordedById: actor.id,
          method,
          status: "SUCCESS",
          idempotencyKey: idempotencyKey || null,
        },
      });

      const totalPaid = alreadyPaid + amount;
      const newStatus = totalPaid >= Number(current.amount) - 0.005 ? "PAID" : "PARTIALLY_PAID";

      await tx.feeInvoice.update({
        where: { id: invoiceId },
        data: { paidAmount: totalPaid, status: newStatus },
      });

      const transaction = await tx.feeTransaction.create({
        data: {
          institutionId,
          studentId: current.studentId,
          invoiceId,
          paymentId: payment.id,
          amount,
          type: "PAYMENT",
          reference: reference || payment.id,
          createdById: actor.id,
          metadata: {
            method,
            sourceModule: current.sourceModule || "ACCOUNTS",
            sourceType: current.sourceType || "FEE_PAYMENT",
          },
        },
      });

      const receiptNumber = `RCT-${new Date().toISOString().replace(/\\D/g, "").slice(0, 14)}-${payment.id.slice(0, 8).toUpperCase()}`;
      await tx.feePayment.update({
        where: { id: payment.id },
        data: { receiptNumber },
      });
      const receipt = await tx.feeReceipt.create({
        data: {
          institutionId,
          paymentId: payment.id,
          invoiceId,
          studentId: current.studentId,
          receiptNumber,
          issuedById: actor.id,
        },
      });

      return { payment: { ...payment, receiptNumber }, transaction, receipt, invoiceId, duplicate: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const paidInvoice = await prisma.feeInvoice.findFirst({
      where: { id: invoiceId, institutionId },
      select: { status: true, paidAmount: true, amount: true },
    });
    if (paidInvoice) {
      const feeStatus = paidInvoice.status === "PAID"
        ? "PAID"
        : Number(paidInvoice.paidAmount || 0) > 0
          ? "PARTIALLY_PAID"
          : "PENDING";
      await prisma.$executeRaw`
        UPDATE "exam_registrations"
        SET "feeStatus"=${feeStatus}, "updatedAt"=CURRENT_TIMESTAMP
        WHERE "institutionId"=${institutionId} AND "feeInvoiceId"=${invoiceId}
      `;
    }

    await recordAuditLog({
      institutionId,
      userId: actor.id,
      action: result.duplicate ? "fee-payment.idempotent-replay" : "fee-payment.create",
      entityType: "FeePayment",
      entityId: result.payment.id,
      metadata: { invoiceId, amount, reference: reference ?? null, method, receiptNumber: result.payment.receiptNumber ?? null },
    });

    return result.payment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new AppError("Payment could not be recorded because the invoice changed; retry the request", 409);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && idempotencyKey) {
      const prior = await prisma.feePayment.findFirst({ where: { institutionId, idempotencyKey } });
      if (prior) return prior;
    }
    throw error;
  }
}
export async function linkParent(
  institutionId: string,
  actor: AuthenticatedUser,
  parentId: string,
  studentId: string,
  relationship?: string
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "ACCOUNTS",
  ]);

  if (parentId === studentId) {
    throw new AppError(
      "Parent and student cannot be the same user",
      400
    );
  }

  await assertParentExists(
    institutionId,
    parentId
  );

  await assertStudentExists(
    institutionId,
    studentId
  );

  const link =
    await prisma.parentStudentLink.upsert({
      where: {
        parentId_studentId: {
          parentId,
          studentId,
        },
      },
      update: {
        relationship:
          relationship || null,
      },
      create: {
        institutionId,
        parentId,
        studentId,
        relationship:
          relationship || null,
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "parent-link.upsert",
    entityType: "ParentStudentLink",
    entityId:
      `${parentId}:${studentId}`,
  });

  return link;
}


/* ============================================================
 * ERP MANAGEMENT READ / UPDATE / DELETE OPERATIONS
 * These functions intentionally use the existing Prisma schema
 * and add no new database requirements.
 * ============================================================ */

async function getHodDepartmentIds(
  institutionId: string,
  actor: AuthenticatedUser
): Promise<string[]> {
  if (!actor.roles.includes("HOD")) {
    return [];
  }

  const rows = await prisma.departmentAccess.findMany({
    where: {
      userId: actor.id,
      department: {
        institutionId,
      },
    },
    select: {
      departmentId: true,
    },
  });

  return rows.map((row) => row.departmentId);
}

export async function listTimetableEntries(
  institutionId: string,
  actor: AuthenticatedUser,
  filters: {
    dayOfWeek?: number;
    courseOfferingId?: string;
  } = {}
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "DIRECTOR",
    "CHAIRMAN",
    "HOD",
    "ACCOUNTS",
    "FACULTY",
  ]);

  const hodDepartmentIds = actor.roles.includes("HOD")
    ? await getManagedDepartmentIds(institutionId, actor.id)
    : [];

  return prisma.timetableEntry.findMany({
    where: {
      institutionId,
      ...(filters.dayOfWeek !== undefined
        ? { dayOfWeek: filters.dayOfWeek }
        : {}),
      ...(filters.courseOfferingId
        ? { courseOfferingId: filters.courseOfferingId }
        : {}),
      ...(actor.roles.includes("HOD") || actor.roles.includes("FACULTY")
        ? {
            courseOffering: {
              ...(actor.roles.includes("HOD")
                ? {
                    course: {
                      departmentId: {
                        in: hodDepartmentIds,
                      },
                    },
                  }
                : {}),
              ...(actor.roles.includes("FACULTY")
                ? { facultyId: actor.id }
                : {}),
            },
          }
        : {}),
    },
    include: {
      courseOffering: {
        include: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              departmentId: true,
            },
          },
          section: {
            select: {
              id: true,
              name: true,
            },
          },
          faculty: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          semester: {
            select: {
              id: true,
              name: true,
              number: true,
            },
          },
        },
      },
    },
    orderBy: [
      { dayOfWeek: "asc" },
      { startTime: "asc" },
    ],
  });
}

export async function updateTimetableEntry(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: {
    courseOfferingId?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    room?: string | null;
  }
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "HOD",
    "ACCOUNTS",
  ]);

  const existing = await prisma.timetableEntry.findFirst({
    where: {
      id,
      institutionId,
    },
    include: {
      courseOffering: true,
    },
  });

  if (!existing) {
    throw new AppError("Timetable entry not found", 404);
  }

  const courseOfferingId =
    input.courseOfferingId ?? existing.courseOfferingId;
  const dayOfWeek =
    input.dayOfWeek ?? existing.dayOfWeek;
  const startTime =
    input.startTime ?? existing.startTime;
  const endTime =
    input.endTime ?? existing.endTime;
  const room =
    input.room === undefined ? existing.room : input.room;

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    throw new AppError(
      "dayOfWeek must be between 0 and 6",
      400
    );
  }

  if (endTime <= startTime) {
    throw new AppError(
      "endTime must be after startTime",
      400
    );
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    courseOfferingId
  );

  const offering = await prisma.courseOffering.findFirst({
    where: {
      id: courseOfferingId,
      institutionId,
      isActive: true,
    },
  });

  if (!offering) {
    throw new AppError(
      "Course offering not found in this institution",
      404
    );
  }

  const sameDayEntries =
    await prisma.timetableEntry.findMany({
      where: {
        institutionId,
        dayOfWeek,
        NOT: {
          id,
        },
      },
      include: {
        courseOffering: {
          select: {
            facultyId: true,
            sectionId: true,
          },
        },
      },
    });

  const conflict = sameDayEntries.find((entry) => {
    const overlaps =
      startTime < entry.endTime &&
      entry.startTime < endTime;

    if (!overlaps) {
      return false;
    }

    const roomConflict = Boolean(
      room &&
        entry.room &&
        entry.room.trim().toLowerCase() ===
          room.trim().toLowerCase()
    );

    return (
      entry.courseOffering.sectionId === offering.sectionId ||
      Boolean(
        offering.facultyId &&
          entry.courseOffering.facultyId === offering.facultyId
      ) ||
      roomConflict
    );
  });

  if (conflict) {
    throw new AppError(
      "Timetable conflicts with an existing section, faculty, or room allocation",
      409
    );
  }

  const row = await prisma.timetableEntry.update({
    where: { id },
    data: {
      courseOfferingId,
      dayOfWeek,
      startTime,
      endTime,
      room: room || null,
    },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "timetable.update",
    entityType: "TimetableEntry",
    entityId: row.id,
  });

  return row;
}

export async function deleteTimetableEntry(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "HOD",
    "ACCOUNTS",
  ]);

  const existing = await prisma.timetableEntry.findFirst({
    where: {
      id,
      institutionId,
    },
    select: {
      id: true,
      courseOfferingId: true,
    },
  });

  if (!existing) {
    throw new AppError("Timetable entry not found", 404);
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    existing.courseOfferingId
  );

  await prisma.timetableEntry.delete({
    where: { id },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "timetable.delete",
    entityType: "TimetableEntry",
    entityId: id,
  });

  return { id, deleted: true };
}

export async function listNotices(
  institutionId: string,
  actor: AuthenticatedUser,
  includeExpired = true
) {
  const roles = actor.roles.map((role) => role.toUpperCase());
  const now = new Date();

  const isStudent = roles.includes("STUDENT");
  const isParent = roles.includes("PARENT");
  const isFaculty = roles.includes("FACULTY");
  const isHod = roles.includes("HOD");

  if (
    !isStudent &&
    !isParent &&
    !isFaculty &&
    !isHod &&
    !hasAnyRole(actor, [
      "INSTITUTION_ADMIN",
      "DIRECTOR",
      "CHAIRMAN",
      "DEAN",
      "REGISTRAR",
      "ACCOUNTS",
      "HR",
      "ADMISSIONS",
      "EXAMINATION",
      "LIBRARIAN",
      "PLACEMENT",
      "IT",
      "STAFF",
    ])
  ) {
    throw new AppError("You are not allowed to view notices", 403);
  }

  let departmentIds: string[] = [];

  if (isStudent) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        institutionId,
        userId: actor.id,
        status: "ACTIVE",
      },
      orderBy: { academicYear: { startDate: "desc" } },
      select: {
        program: { select: { departmentId: true } },
      },
    });

    if (enrollment?.program.departmentId) {
      departmentIds = [enrollment.program.departmentId];
    }
  } else if (isParent) {
    const links = await prisma.parentStudentLink.findMany({
      where: {
        institutionId,
        parentId: actor.id,
      },
      select: {
        student: {
          select: {
            studentEnrollments: {
              where: { institutionId, status: "ACTIVE" },
              orderBy: { academicYear: { startDate: "desc" } },
              take: 1,
              select: {
                program: { select: { departmentId: true } },
              },
            },
          },
        },
      },
    });

    departmentIds = Array.from(
      new Set(
        links.flatMap((link) =>
          link.student.studentEnrollments.map(
            (enrollment) => enrollment.program.departmentId,
          ),
        ),
      ),
    );
  } else if (isHod) {
    departmentIds = await getHodDepartmentIds(institutionId, actor);
  }

  const audience =
    isStudent
      ? ["ALL", "STUDENT", "STUDENTS"]
      : isParent
        ? ["ALL", "PARENT", "PARENTS"]
        : isFaculty
          ? ["ALL", "FACULTY", "TEACHERS"]
          : isHod
            ? ["ALL", "HOD", "STAFF", "FACULTY", "TEACHERS"]
            : undefined;

  const where: Prisma.NoticeWhereInput = {
    institutionId,
    AND: [
      ...(includeExpired
        ? []
        : [
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
            },
          ]),
      ...(audience ? [{ audience: { in: audience } }] : []),
      ...(isHod || isStudent || isParent
        ? [
            {
              OR: [
                { departmentId: null },
                ...(departmentIds.length
                  ? [{ departmentId: { in: departmentIds } }]
                  : []),
              ],
            },
          ]
        : []),
    ],
  };

  return prisma.notice.findMany({
    where,
    orderBy: { publishedAt: "desc" },
  });
}

export async function updateNotice(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: {
    title?: string;
    body?: string;
    audience?: string;
    departmentId?: string | null;
    expiresAt?: Date | null;
  }
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "DIRECTOR",
    "CHAIRMAN",
    "HOD",
    "ACCOUNTS",
  ]);

  const existing = await prisma.notice.findFirst({
    where: {
      id,
      institutionId,
    },
  });

  if (!existing) {
    throw new AppError("Notice not found", 404);
  }

  const departmentId =
    input.departmentId === undefined
      ? existing.departmentId
      : input.departmentId;

  await assertDepartmentScope(
    institutionId,
    actor,
    undefined,
    departmentId || undefined
  );

  if (departmentId) {
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        institutionId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!department) {
      throw new AppError(
        "Department not found in this institution",
        404
      );
    }
  }

  const row = await prisma.notice.update({
    where: { id },
    data: {
      ...(input.title !== undefined
        ? { title: input.title.trim() }
        : {}),
      ...(input.body !== undefined
        ? { body: input.body.trim() }
        : {}),
      ...(input.audience !== undefined
        ? { audience: input.audience }
        : {}),
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId }
        : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt }
        : {}),
    },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "notice.update",
    entityType: "Notice",
    entityId: row.id,
  });

  return row;
}

export async function deleteNotice(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "DIRECTOR",
    "CHAIRMAN",
    "HOD",
    "ACCOUNTS",
  ]);

  const existing = await prisma.notice.findFirst({
    where: {
      id,
      institutionId,
    },
  });

  if (!existing) {
    throw new AppError("Notice not found", 404);
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    undefined,
    existing.departmentId || undefined
  );

  await prisma.notice.delete({
    where: { id },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "notice.delete",
    entityType: "Notice",
    entityId: id,
  });

  return { id, deleted: true };
}

export async function listExams(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId?: string
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "DIRECTOR",
    "CHAIRMAN",
    "HOD",
    "ACCOUNTS",
    "FACULTY",
  ]);

  const hodDepartmentIds = await getHodDepartmentIds(
    institutionId,
    actor
  );

  return prisma.exam.findMany({
    where: {
      institutionId,
      ...(courseOfferingId
        ? { courseOfferingId }
        : {}),
      ...(actor.roles.includes("HOD") || actor.roles.includes("FACULTY")
        ? {
            courseOffering: {
              ...(actor.roles.includes("HOD")
                ? {
                    course: {
                      departmentId: {
                        in: hodDepartmentIds,
                      },
                    },
                  }
                : {}),
              ...(actor.roles.includes("FACULTY")
                ? { facultyId: actor.id }
                : {}),
            },
          }
        : {}),
    },
    include: {
      courseOffering: {
        include: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              departmentId: true,
            },
          },
          section: {
            select: {
              id: true,
              name: true,
            },
          },
          faculty: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      _count: {
        select: {
          results: true,
        },
      },
    },
    orderBy: {
      examDate: "desc",
    },
  });
}

export async function getExamDetails(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string
) {
  const exam = await prisma.exam.findFirst({
    where: {
      id,
      institutionId,
    },
    include: {
      courseOffering: {
        include: {
          course: true,
          section: true,
          faculty: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      results: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          student: {
            firstName: "asc",
          },
        },
      },
    },
  });

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }

  if (
    actor.roles.includes("FACULTY") &&
    exam.courseOffering.facultyId !== actor.id
  ) {
    throw new AppError(
      "You are not assigned to this course offering",
      403
    );
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    exam.courseOfferingId
  );

  if (
    !hasAnyRole(actor, [
      "INSTITUTION_ADMIN",
      "DIRECTOR",
      "CHAIRMAN",
      "HOD",
      "ACCOUNTS",
      "FACULTY",
    ])
  ) {
    throw new AppError(
      "Not authorized for this ERP operation",
      403
    );
  }

  return exam;
}

export async function updateExam(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: {
    title?: string;
    examDate?: Date;
    maxMarks?: number;
  }
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "HOD",
    "FACULTY",
  ]);

  const existing = await prisma.exam.findFirst({
    where: {
      id,
      institutionId,
    },
    include: {
      courseOffering: true,
    },
  });

  if (!existing) {
    throw new AppError("Exam not found", 404);
  }

  if (
    actor.roles.includes("FACULTY") &&
    existing.courseOffering.facultyId !== actor.id
  ) {
    throw new AppError(
      "You are not assigned to this course offering",
      403
    );
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    existing.courseOfferingId
  );

  if (
    input.maxMarks !== undefined &&
    input.maxMarks <= 0
  ) {
    throw new AppError(
      "maxMarks must be greater than zero",
      400
    );
  }

  if (input.maxMarks !== undefined) {
    const invalidResult = await prisma.examResult.findFirst({
      where: {
        examId: id,
        marks: {
          gt: input.maxMarks,
        },
      },
      select: {
        id: true,
      },
    });

    if (invalidResult) {
      throw new AppError(
        "maxMarks cannot be lower than marks already entered",
        409
      );
    }
  }

  const row = await prisma.exam.update({
    where: { id },
    data: {
      ...(input.title !== undefined
        ? { title: input.title.trim() }
        : {}),
      ...(input.examDate !== undefined
        ? { examDate: input.examDate }
        : {}),
      ...(input.maxMarks !== undefined
        ? { maxMarks: input.maxMarks }
        : {}),
    },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.update",
    entityType: "Exam",
    entityId: row.id,
  });

  return row;
}

export async function deleteExam(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "HOD",
    "FACULTY",
  ]);

  const existing = await prisma.exam.findFirst({
    where: {
      id,
      institutionId,
    },
    include: {
      courseOffering: true,
      _count: {
        select: {
          results: true,
        },
      },
    },
  });

  if (!existing) {
    throw new AppError("Exam not found", 404);
  }

  if (
    actor.roles.includes("FACULTY") &&
    existing.courseOffering.facultyId !== actor.id
  ) {
    throw new AppError(
      "You are not assigned to this course offering",
      403
    );
  }

  await assertDepartmentScope(
    institutionId,
    actor,
    existing.courseOfferingId
  );

  if (existing._count.results > 0) {
    throw new AppError(
      "Cannot delete an exam after results have been entered",
      409
    );
  }

  await prisma.exam.delete({
    where: { id },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.delete",
    entityType: "Exam",
    entityId: id,
  });

  return { id, deleted: true };
}

export async function listFeeInvoices(
  institutionId: string,
  actor: AuthenticatedUser,
  filters: { studentId?: string; status?: string } = {}
) {
  const roles = getCanonicalRoleNames(actor.roles);
  const institutionWide = roles.some(role => ["SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","ACCOUNTS"].includes(role));

  if (!institutionWide && !roles.some(role => ["DIRECTOR","DEAN","HOD"].includes(role))) {
    throw new AppError("Not authorized to view fee invoices", 403);
  }

  const where: Prisma.FeeInvoiceWhereInput = {
    institutionId,
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  if (!institutionWide && roles.includes("DIRECTOR")) {
    const departmentIds = await getDirectorDepartmentIds(institutionId, actor.id);
    if (!departmentIds.length) throw new AppError("No campus scope is assigned to this director", 403);
    where.student = { studentEnrollments: { some: { institutionId, status: "ACTIVE", program: { departmentId: { in: departmentIds } } } } };
  } else if (!institutionWide && (roles.includes("DEAN") || roles.includes("HOD"))) {
    const departmentIds = await getManagedDepartmentIds(institutionId, actor.id);
    if (!departmentIds.length) throw new AppError("No department scope is assigned to this account", 403);
    where.student = { studentEnrollments: { some: { institutionId, status: "ACTIVE", program: { departmentId: { in: departmentIds } } } } };
  }

  return prisma.feeInvoice.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      payments: { orderBy: { paidAt: "desc" } },
      items: { include: { feeHead: { select: { id: true, name: true, code: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
export async function getFeeInvoice(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string
) {
  const invoice = await prisma.feeInvoice.findFirst({
    where: {
      id,
      institutionId,
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      payments: {
        orderBy: {
          paidAt: "desc",
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError("Invoice not found", 404);
  }

  await assertStudentScope(
    institutionId,
    actor,
    invoice.studentId
  );

  if (
    actor.id !== invoice.studentId &&
    !actor.roles.some((role) =>
      [
        "INSTITUTION_ADMIN",
        "DIRECTOR",
        "CHAIRMAN",
        "ACCOUNTS",
        "DEAN",
        "HOD",
        "PARENT",
      ].includes(role)
    )
  ) {
    throw new AppError(
      "Not authorized to view this invoice",
      403
    );
  }

  const paid = invoice.payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  return {
    ...invoice,
    paid,
    balance: Math.max(
      0,
      Number(invoice.amount) - paid
    ),
  };
}

export async function updateFeeInvoice(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: {
    title?: string;
    amount?: number;
    dueDate?: Date | null;
  }
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "ACCOUNTS",
  ]);

  const invoice = await prisma.feeInvoice.findFirst({
    where: {
      id,
      institutionId,
    },
    include: {
      payments: {
        select: {
          amount: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError("Invoice not found", 404);
  }

  const paid = invoice.payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  if (
    input.amount !== undefined &&
    input.amount < paid
  ) {
    throw new AppError(
      "Invoice amount cannot be lower than payments already recorded",
      409
    );
  }

  const nextAmount =
    input.amount ?? Number(invoice.amount);

  const row = await prisma.feeInvoice.update({
    where: { id },
    data: {
      ...(input.title !== undefined
        ? { title: input.title.trim() }
        : {}),
      ...(input.amount !== undefined
        ? { amount: input.amount }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate }
        : {}),
      status:
        paid <= 0
          ? "PENDING"
          : paid >= nextAmount
            ? "PAID"
            : "PARTIALLY_PAID",
    },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fee-invoice.update",
    entityType: "FeeInvoice",
    entityId: row.id,
  });

  return row;
}

export async function deleteFeeInvoice(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "ACCOUNTS",
  ]);

  const invoice = await prisma.feeInvoice.findFirst({
    where: {
      id,
      institutionId,
    },
    include: {
      _count: {
        select: {
          payments: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError("Invoice not found", 404);
  }

  if (invoice._count.payments > 0) {
    throw new AppError(
      "Cannot delete an invoice after a payment has been recorded",
      409
    );
  }

  await prisma.feeInvoice.delete({
    where: { id },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fee-invoice.delete",
    entityType: "FeeInvoice",
    entityId: id,
  });

  return { id, deleted: true };
}

export async function listParentLinks(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId?: string
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "DIRECTOR",
    "CHAIRMAN",
    "ACCOUNTS",
  ]);

  return prisma.parentStudentLink.findMany({
    where: {
      institutionId,
      ...(studentId
        ? { studentId }
        : {}),
    },
    include: {
      parent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profile: {
            select: {
              admissionNumber: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function deleteParentLink(
  institutionId: string,
  actor: AuthenticatedUser,
  parentId: string,
  studentId: string
) {
  assertRole(actor, [
    "INSTITUTION_ADMIN",
    "ACCOUNTS",
  ]);

  const existing = await prisma.parentStudentLink.findFirst({
    where: {
      institutionId,
      parentId,
      studentId,
    },
  });

  if (!existing) {
    throw new AppError(
      "Parent-student link not found",
      404
    );
  }

  await prisma.parentStudentLink.delete({
    where: {
      parentId_studentId: {
        parentId,
        studentId,
      },
    },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "parent-link.delete",
    entityType: "ParentStudentLink",
    entityId: `${parentId}:${studentId}`,
  });

  return {
    parentId,
    studentId,
    deleted: true,
  };
}
