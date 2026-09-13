import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";

const MANAGEMENT_ROLES = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "STAFF",
];

const weekday = new Date().getDay();

function assertRole(
  user: AuthenticatedUser,
  allowed: string[]
): void {
  if (!user.roles.some((role) => allowed.includes(role))) {
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
  return user.roles.some((role) => roles.includes(role));
}

async function assertDepartmentScope(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId?: string,
  departmentId?: string
): Promise<void> {
  if (!actor.roles.includes("HOD")) {
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
  });
}

async function getHodDepartments(
  institutionId: string,
  actor: AuthenticatedUser
) {
  if (!actor.roles.includes("HOD")) {
    return [];
  }

  const access =
    await prisma.departmentAccess.findMany({
      where: {
        userId: actor.id,
        department: {
          institutionId,
        },
      },
      select: {
        departmentId: true,
        scope: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

  return access;
}

async function getManagementWorkspace(
  institutionId: string
) {
  const [
    users,
    students,
    faculty,
    departments,
    programs,
    sections,
    courses,
    offerings,
    attendanceSessions,
    assignments,
    internalMarks,
    exams,
    examResults,
    invoices,
    notices,
    documents,
    notifications,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.user.count({
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
      },
    }),

    prisma.user.count({
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
      },
    }),

    prisma.department.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.program.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.section.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.course.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.courseOffering.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.attendanceSession.count({
      where: {
        institutionId,
      },
    }),

    prisma.assignment.count({
      where: {
        institutionId,
      },
    }),

    prisma.internalMark.count({
      where: {
        institutionId,
      },
    }),

    prisma.exam.count({
      where: {
        institutionId,
      },
    }),

    prisma.examResult.count({
      where: {
        institutionId,
      },
    }),

    prisma.feeInvoice.findMany({
      where: {
        institutionId,
      },
      select: {
        amount: true,
        status: true,
      },
    }),

    prisma.notice.findMany({
      where: {
        institutionId,
        publishedAt: {
          lte: new Date(),
        },
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: new Date(),
            },
          },
        ],
      },
      orderBy: {
        publishedAt: "desc",
      },
      take: 10,
    }),

    prisma.document.count({
      where: {
        institutionId,
      },
    }),

    prisma.notification.count({
      where: {
        institutionId,
      },
    }),
  ]);

  const totalInvoiced =
    invoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount),
      0
    );

  const paidInvoices =
    invoices.filter(
      (invoice) => invoice.status === "PAID"
    );

  const totalPaidCount =
    paidInvoices.length;

  return {
    stats: {
      users,
      students,
      faculty,
      departments,
      programs,
      sections,
      courses,
      offerings,
      attendanceSessions,
      assignments,
      internalMarks,
      exams,
      examResults,
      documents,
      notifications,
      totalInvoices: invoices.length,
      totalInvoiced,
      paidInvoices: totalPaidCount,
    },
    notices,
  };
}

export async function getMyWorkspace(
  institutionId: string,
  actor: AuthenticatedUser
) {
  const now = new Date();

  /*
   * MANAGEMENT / DIRECTOR / INSTITUTION ADMIN / STAFF
   *
   * These users need institutional information rather than
   * student-specific fee/result records.
   */
  if (
    hasAnyRole(actor, [
      "INSTITUTION_ADMIN",
      "DIRECTOR",
      "MANAGEMENT",
      "STAFF",
    ])
  ) {
    const management =
      await getManagementWorkspace(
        institutionId
      );

    const notices =
      await prisma.notice.findMany({
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
              ...actor.roles,
            ],
          },
        },
        orderBy: {
          publishedAt: "desc",
        },
        take: 10,
      });

    return {
      workspaceType: "MANAGEMENT",
      stats: management.stats,
      timetable: [],
      notices,
      notifications: [],
      documents: [],
      fees: [],
      exams: [],
      students: [],
      facultyOfferings: [],
      departments: [],
    };
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
      }),

      prisma.timetableEntry.findMany({
        where: {
          institutionId,
          dayOfWeek: weekday,
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
              "HOD",
            ],
          },
          OR: [
            {
              departmentId: null,
            },
            {
              departmentId: {
                in: departmentIds,
              },
            },
          ],
        },
        orderBy: {
          publishedAt: "desc",
        },
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
          dayOfWeek: weekday,
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
              "PARENT",
            ],
          },
        },
        orderBy: {
          publishedAt: "desc",
        },
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
              "STUDENT",
            ],
          },
        },
        orderBy: {
          publishedAt: "desc",
        },
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
    "STAFF",
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
    "MANAGEMENT",
    "HOD",
    "STAFF",
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

  const offeringWhere: any = {
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

  /*
   * Critical protection:
   * the student must actually belong to the
   * section for which this exam was created.
   */
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
    "STAFF",
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
  reference?: string
) {
  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new AppError(
      "Payment amount must be greater than zero",
      400
    );
  }

  const invoice =
    await prisma.feeInvoice.findFirst({
      where: {
        id: invoiceId,
        institutionId,
      },
    });

  if (!invoice) {
    throw new AppError(
      "Invoice not found",
      404
    );
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
        "STAFF",
        "PARENT",
      ].includes(role)
    )
  ) {
    throw new AppError(
      "Not authorized to record this payment",
      403
    );
  }

  const existing =
    await prisma.feePayment.aggregate({
      where: {
        invoiceId,
      },
      _sum: {
        amount: true,
      },
    });

  const alreadyPaid =
    Number(existing._sum.amount || 0);

  if (
    alreadyPaid + amount >
    Number(invoice.amount)
  ) {
    throw new AppError(
      "Payment exceeds the outstanding invoice balance",
      400
    );
  }

  const payment =
    await prisma.feePayment.create({
      data: {
        institutionId,
        invoiceId,
        amount,
        reference:
          reference || null,
        userId: actor.id,
      },
    });

  const paid =
    await prisma.feePayment.aggregate({
      where: {
        invoiceId,
      },
      _sum: {
        amount: true,
      },
    });

  await prisma.feeInvoice.update({
    where: {
      id: invoiceId,
    },
    data: {
      status:
        Number(paid._sum.amount || 0) >=
        Number(invoice.amount)
          ? "PAID"
          : "PARTIAL",
    },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fee-payment.create",
    entityType: "FeePayment",
    entityId: payment.id,
  });

  return payment;
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
    "STAFF",
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
