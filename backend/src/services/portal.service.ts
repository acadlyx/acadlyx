import {
  Prisma,
} from "@prisma/client";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { recordAuditLog } from "./audit.service";

type PortalActor = {
  id: string;
  roles: string[];
};

const managementRoles = new Set([
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "HOD",
  "STAFF",
]);

function assertActor(actor: PortalActor): void {
  if (!actor?.id) {
    throw new AppError("Authentication required", 401);
  }
}

function isManagement(actor: PortalActor): boolean {
  return actor.roles.some((role) => managementRoles.has(role));
}

function isParent(actor: PortalActor): boolean {
  return actor.roles.includes("PARENT");
}

function isStudent(actor: PortalActor): boolean {
  return actor.roles.includes("STUDENT");
}

async function assertInstitutionUser(
  institutionId: string,
  userId: string
) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      institutionId,
      isActive: true,
    },
    select: {
      id: true,
      institutionId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      isActive: true,
      userRoles: {
        include: {
          role: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found in this institution", 404);
  }

  return user;
}

async function assertParentChildAccess(
  institutionId: string,
  parentId: string,
  studentId: string
): Promise<void> {
  const link = await prisma.parentStudentLink.findFirst({
    where: {
      institutionId,
      parentId,
      studentId,
    },
    select: {
      parentId: true,
      studentId: true,
    },
  });

  if (!link) {
    throw new AppError(
      "You are not authorized to access this student's information",
      403
    );
  }
}

async function assertStudentSelfAccess(
  institutionId: string,
  actorId: string,
  studentId: string
): Promise<void> {
  if (actorId === studentId) {
    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        institutionId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    return;
  }

  throw new AppError(
    "You are not authorized to access this student's information",
    403
  );
}


async function assertHodStudentAccess(
  institutionId: string,
  actorId: string,
  studentId: string
): Promise<void> {
  const accesses = await prisma.departmentAccess.findMany({
    where: { userId: actorId, department: { institutionId } },
    select: { departmentId: true },
  });
  const departmentIds = accesses.map((item) => item.departmentId);

  if (!departmentIds.length) {
    throw new AppError(
      "You are not authorized to access this student's information",
      403
    );
  }

  const allowed = await prisma.studentEnrollment.findFirst({
    where: {
      institutionId,
      userId: studentId,
      program: { departmentId: { in: departmentIds } },
    },
    select: { id: true },
  });

  if (!allowed) {
    throw new AppError(
      "You are not authorized to access this student's information",
      403
    );
  }
}

async function assertStudentExists(
  institutionId: string,
  studentId: string
) {
  return assertInstitutionUser(institutionId, studentId);
}

async function getStudentEnrollment(
  institutionId: string,
  studentId: string
) {
  const currentYear = await prisma.academicYear.findFirst({
    where: {
      institutionId,
      isCurrent: true,
    },
    select: {
      id: true,
    },
  });

  if (currentYear) {
    const current = await prisma.studentEnrollment.findFirst({
      where: {
        institutionId,
        userId: studentId,
        academicYearId: currentYear.id,
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
          },
        },
        academicYear: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
            startDate: true,
            endDate: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
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
    });

    if (current) {
      return current;
    }
  }

  return prisma.studentEnrollment.findFirst({
    where: {
      institutionId,
      userId: studentId,
    },
    include: {
      program: {
        select: {
          id: true,
          name: true,
          code: true,
          level: true,
        },
      },
      academicYear: {
        select: {
          id: true,
          name: true,
          isCurrent: true,
          startDate: true,
          endDate: true,
        },
      },
      section: {
        select: {
          id: true,
          name: true,
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
    orderBy: {
      academicYear: {
        startDate: "desc",
      },
    },
  });
}

async function getAttendanceSummary(
  institutionId: string,
  studentId: string
) {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      attendanceSession: {
        institutionId,
      },
    },
    select: {
      status: true,
      attendanceSession: {
        select: {
          courseOffering: {
            select: {
              id: true,
              course: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const total = records.length;
  const present = records.filter(
    (record) =>
      record.status === "PRESENT" ||
      record.status === "LATE"
  ).length;

  const absent = records.filter(
    (record) => record.status === "ABSENT"
  ).length;

  const late = records.filter(
    (record) => record.status === "LATE"
  ).length;

  const percentage =
    total === 0
      ? 0
      : Number(((present / total) * 100).toFixed(2));

  const byCourse = new Map<
    string,
    {
      courseId: string;
      code: string;
      name: string;
      total: number;
      present: number;
      absent: number;
      late: number;
    }
  >();

  for (const record of records) {
    const course = record.attendanceSession.courseOffering.course;

    const existing = byCourse.get(course.id) ?? {
      courseId: course.id,
      code: course.code,
      name: course.name,
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
    };

    existing.total += 1;

    if (record.status === "PRESENT") {
      existing.present += 1;
    }

    if (record.status === "ABSENT") {
      existing.absent += 1;
    }

    if (record.status === "LATE") {
      existing.late += 1;
    }

    byCourse.set(course.id, existing);
  }

  return {
    total,
    present,
    absent,
    late,
    percentage,
    subjects: Array.from(byCourse.values()).map(
      (subject) => ({
        ...subject,
        percentage:
          subject.total === 0
            ? 0
            : Number(
                (
                  ((subject.present + subject.late) /
                    subject.total) *
                  100
                ).toFixed(2)
              ),
      })
    ),
  };
}

async function getMarksSummary(
  institutionId: string,
  studentId: string
) {
  const marks = await prisma.internalMark.findMany({
    where: {
      institutionId,
      studentId,
    },
    include: {
      courseOffering: {
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
        },
      },
    },
    orderBy: [
      {
        courseOffering: {
          course: {
            code: "asc",
          },
        },
      },
      {
        component: "asc",
      },
    ],
  });

  const byCourse = new Map<
    string,
    {
      courseOfferingId: string;
      course: {
        id: string;
        code: string;
        name: string;
        credits: number;
      };
      components: Array<{
        id: string;
        component: string;
        marksObtained: number;
        maxMarks: number;
        percentage: number;
      }>;
      totalObtained: number;
      totalMax: number;
    }
  >();

  for (const mark of marks) {
    const course = mark.courseOffering.course;

    const existing =
      byCourse.get(mark.courseOfferingId) ?? {
        courseOfferingId: mark.courseOfferingId,
        course,
        components: [],
        totalObtained: 0,
        totalMax: 0,
      };

    existing.components.push({
      id: mark.id,
      component: mark.component,
      marksObtained: mark.marksObtained,
      maxMarks: mark.maxMarks,
      percentage:
        mark.maxMarks === 0
          ? 0
          : Number(
              (
                (mark.marksObtained / mark.maxMarks) *
                100
              ).toFixed(2)
            ),
    });

    existing.totalObtained += mark.marksObtained;
    existing.totalMax += mark.maxMarks;

    byCourse.set(
      mark.courseOfferingId,
      existing
    );
  }

  return Array.from(byCourse.values()).map(
    (course) => ({
      ...course,
      percentage:
        course.totalMax === 0
          ? 0
          : Number(
              (
                (course.totalObtained /
                  course.totalMax) *
                100
              ).toFixed(2)
            ),
    })
  );
}

async function getAssignmentSummary(
  institutionId: string,
  studentId: string
) {
  const enrollment = await getStudentEnrollment(
    institutionId,
    studentId
  );

  const sectionId =
    enrollment?.section?.id ?? null;

  if (!sectionId) {
    return [];
  }

  const assignments =
    await prisma.assignment.findMany({
      where: {
        institutionId,
        status: "PUBLISHED",
        courseOffering: {
          sectionId,
          isActive: true,
        },
      },
      include: {
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
        submissions: {
          where: {
            studentId,
          },
          select: {
            id: true,
            status: true,
            submittedAt: true,
            marksAwarded: true,
            feedback: true,
          },
          take: 1,
        },
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 100,
    });

  return assignments.map((assignment) => {
    const submission = assignment.submissions[0] ?? null;
    const overdue =
      !submission &&
      assignment.dueDate.getTime() < Date.now();

    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate,
      maxMarks: assignment.maxMarks,
      status: assignment.status,
      overdue,
      submission,
      course: assignment.courseOffering.course,
    };
  });
}

async function getFeeSummary(
  institutionId: string,
  studentId: string
) {
  const invoices = await prisma.feeInvoice.findMany({
    where: {
      institutionId,
      studentId,
    },
    include: {
      payments: {
        select: {
          id: true,
          amount: true,
          reference: true,
          paidAt: true,
        },
        orderBy: {
          paidAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return invoices.map((invoice) => {
    const paid = invoice.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    const balance = Math.max(
      0,
      invoice.amount - paid
    );

    return {
      id: invoice.id,
      title: invoice.title,
      amount: invoice.amount,
      paid,
      balance,
      dueDate: invoice.dueDate,
      status:
        balance <= 0
          ? "PAID"
          : invoice.status,
      payments: invoice.payments,
    };
  });
}

async function getExamSummary(
  institutionId: string,
  studentId: string
) {
  const enrollment = await getStudentEnrollment(
    institutionId,
    studentId
  );

  const sectionId =
    enrollment?.section?.id ?? null;

  if (!sectionId) {
    return [];
  }

  const exams = await prisma.exam.findMany({
    where: {
      institutionId,
      courseOffering: {
        sectionId,
      },
    },
    include: {
      courseOffering: {
        select: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
      results: {
        where: {
          studentId,
        },
        select: {
          id: true,
          marks: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
        },
        take: 1,
      },
    },
    orderBy: {
      examDate: "asc",
    },
    take: 100,
  });

  return exams.map((exam) => ({
    id: exam.id,
    title: exam.title,
    examDate: exam.examDate,
    maxMarks: exam.maxMarks,
    course: exam.courseOffering.course,
    result: exam.results[0] ?? null,
  }));
}

async function getDocumentsForOwner(
  institutionId: string,
  ownerId: string
) {
  return prisma.document.findMany({
    where: {
      institutionId,
      ownerId,
    },
    select: {
      id: true,
      title: true,
      url: true,
      type: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function getNotificationsForUser(
  institutionId: string,
  userId: string,
  page: number,
  limit: number,
  unreadOnly?: boolean
) {
  const where: Prisma.NotificationWhereInput = {
    institutionId,
    userId,
    ...(unreadOnly
      ? {
          readAt: null,
        }
      : {}),
  };

  const skip = (page - 1) * limit;

  const [items, total, unread] =
    await Promise.all([
      prisma.notification.findMany({
        where,
        select: {
          id: true,
          title: true,
          body: true,
          readAt: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where,
      }),
      prisma.notification.count({
        where: {
          institutionId,
          userId,
          readAt: null,
        },
      }),
    ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    unread,
  };
}

export async function getParentChildren(
  institutionId: string,
  actor: PortalActor
) {
  assertActor(actor);

  if (!isParent(actor) && !isManagement(actor)) {
    throw new AppError(
      "Parent portal access required",
      403
    );
  }

  const links = await prisma.parentStudentLink.findMany({
    where: {
      institutionId,
      ...(isParent(actor)
        ? {
            parentId: actor.id,
          }
        : {}),
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          profile: {
            select: {
              admissionNumber: true,
              dateOfBirth: true,
              gender: true,
              status: true,
            },
          },
          studentEnrollments: {
            orderBy: {
              enrolledAt: "desc",
            },
            take: 1,
            include: {
              program: {
                select: {
                  id: true,
                  name: true,
                  code: true,
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
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return links.map((link) => ({
    relationship: link.relationship,
    linkedAt: link.createdAt,
    student: {
      id: link.student.id,
      firstName: link.student.firstName,
      lastName: link.student.lastName,
      email: link.student.email,
      phone: link.student.phone,
      profile: link.student.profile,
      enrollment:
        link.student.studentEnrollments[0] ??
        null,
    },
  }));
}

export async function getStudentPortal(
  institutionId: string,
  actor: PortalActor,
  studentId: string
) {
  assertActor(actor);

  if (isParent(actor)) {
    await assertParentChildAccess(
      institutionId,
      actor.id,
      studentId
    );
  } else if (isStudent(actor)) {
    await assertStudentSelfAccess(
      institutionId,
      actor.id,
      studentId
    );
  } else if (actor.roles.includes("HOD")) {
    await assertHodStudentAccess(
      institutionId,
      actor.id,
      studentId
    );
  } else if (!isManagement(actor)) {
    throw new AppError(
      "Student portal access denied",
      403
    );
  }

  const student = await assertStudentExists(
    institutionId,
    studentId
  );

  const [
    enrollment,
    attendance,
    marks,
    assignments,
    fees,
    exams,
    documents,
    notifications,
  ] = await Promise.all([
    getStudentEnrollment(
      institutionId,
      studentId
    ),
    getAttendanceSummary(
      institutionId,
      studentId
    ),
    getMarksSummary(
      institutionId,
      studentId
    ),
    getAssignmentSummary(
      institutionId,
      studentId
    ),
    getFeeSummary(
      institutionId,
      studentId
    ),
    getExamSummary(
      institutionId,
      studentId
    ),
    getDocumentsForOwner(
      institutionId,
      studentId
    ),
    getNotificationsForUser(
      institutionId,
      studentId,
      1,
      10
    ),
  ]);

  return {
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      profile: await prisma.studentProfile.findUnique({
        where: {
          userId: studentId,
        },
        select: {
          admissionNumber: true,
          dateOfBirth: true,
          gender: true,
          bloodGroup: true,
          nationality: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          guardianName: true,
          guardianPhone: true,
          guardianEmail: true,
          admissionDate: true,
          status: true,
        },
      }),
    },
    enrollment,
    attendance,
    marks,
    assignments,
    fees,
    exams,
    documents,
    notifications,
  };
}

export async function getParentDashboard(
  institutionId: string,
  actor: PortalActor
) {
  assertActor(actor);

  if (!isParent(actor) && !isManagement(actor)) {
    throw new AppError(
      "Parent portal access required",
      403
    );
  }

  const children = await getParentChildren(
    institutionId,
    actor
  );

  const dashboards = await Promise.all(
    children.map(async (child) =>
      getStudentPortal(
        institutionId,
        actor,
        child.student.id
      )
    )
  );

  return {
    parent: await assertInstitutionUser(
      institutionId,
      actor.id
    ),
    children: dashboards,
  };
}

export async function listMyNotifications(
  institutionId: string,
  actor: PortalActor,
  page: number,
  limit: number,
  unreadOnly?: boolean
) {
  assertActor(actor);

  return getNotificationsForUser(
    institutionId,
    actor.id,
    page,
    limit,
    unreadOnly
  );
}

export async function markNotificationRead(
  institutionId: string,
  actor: PortalActor,
  notificationId: string,
  read: boolean
) {
  assertActor(actor);

  const notification =
    await prisma.notification.findFirst({
      where: {
        id: notificationId,
        institutionId,
        userId: actor.id,
      },
    });

  if (!notification) {
    throw new AppError(
      "Notification not found",
      404
    );
  }

  const updated =
    await prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        readAt: read ? new Date() : null,
      },
      select: {
        id: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: read
      ? "NOTIFICATION_READ"
      : "NOTIFICATION_UNREAD",
    entityType: "Notification",
    entityId: notificationId,
  });

  return updated;
}

export async function markAllNotificationsRead(
  institutionId: string,
  actor: PortalActor
) {
  assertActor(actor);

  const result =
    await prisma.notification.updateMany({
      where: {
        institutionId,
        userId: actor.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "NOTIFICATIONS_MARK_ALL_READ",
    entityType: "Notification",
    metadata: {
      count: result.count,
    },
  });

  return {
    updated: result.count,
  };
}

export async function createNotification(
  institutionId: string,
  actor: PortalActor,
  input: {
    userId: string;
    title: string;
    body: string;
  }
) {
  assertActor(actor);

  if (!isManagement(actor)) {
    throw new AppError(
      "You do not have permission to create notifications",
      403
    );
  }

  const recipient =
    await assertInstitutionUser(
      institutionId,
      input.userId
    );

  const notification =
    await prisma.notification.create({
      data: {
        institutionId,
        userId: recipient.id,
        title: input.title,
        body: input.body,
      },
      select: {
        id: true,
        userId: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "NOTIFICATION_CREATED",
    entityType: "Notification",
    entityId: notification.id,
    metadata: {
      recipientId: recipient.id,
    },
  });

  return notification;
}

export async function createBulkNotifications(
  institutionId: string,
  actor: PortalActor,
  input: {
    userIds: string[];
    title: string;
    body: string;
  }
) {
  assertActor(actor);

  if (!isManagement(actor)) {
    throw new AppError(
      "You do not have permission to create notifications",
      403
    );
  }

  const recipients =
    await prisma.user.findMany({
      where: {
        id: {
          in: input.userIds,
        },
        institutionId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

  if (recipients.length !== input.userIds.length) {
    throw new AppError(
      "One or more notification recipients are invalid for this institution",
      400
    );
  }

  const result =
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        institutionId,
        userId: recipient.id,
        title: input.title,
        body: input.body,
      })),
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "NOTIFICATIONS_BULK_CREATED",
    entityType: "Notification",
    metadata: {
      count: result.count,
      recipientIds: recipients.map(
        (recipient) => recipient.id
      ),
    },
  });

  return {
    created: result.count,
  };
}

export async function listMyDocuments(
  institutionId: string,
  actor: PortalActor
) {
  assertActor(actor);

  return getDocumentsForOwner(
    institutionId,
    actor.id
  );
}

export async function listStudentDocuments(
  institutionId: string,
  actor: PortalActor,
  studentId: string
) {
  assertActor(actor);

  if (isParent(actor)) {
    await assertParentChildAccess(
      institutionId,
      actor.id,
      studentId
    );
  } else if (isStudent(actor)) {
    await assertStudentSelfAccess(
      institutionId,
      actor.id,
      studentId
    );
  } else if (!isManagement(actor)) {
    throw new AppError(
      "Document access denied",
      403
    );
  }

  return getDocumentsForOwner(
    institutionId,
    studentId
  );
}

export async function createDocument(
  institutionId: string,
  actor: PortalActor,
  input: {
    ownerId: string;
    title: string;
    url: string;
    type: string;
  }
) {
  assertActor(actor);

  if (!isManagement(actor)) {
    throw new AppError(
      "You do not have permission to upload documents",
      403
    );
  }

  const owner =
    await assertInstitutionUser(
      institutionId,
      input.ownerId
    );

  const document =
    await prisma.document.create({
      data: {
        institutionId,
        ownerId: owner.id,
        title: input.title,
        url: input.url,
        type: input.type,
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
        url: true,
        type: true,
        createdAt: true,
      },
    });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "DOCUMENT_CREATED",
    entityType: "Document",
    entityId: document.id,
    metadata: {
      ownerId: owner.id,
      type: input.type,
    },
  });

  return document;
}

export async function deleteDocument(
  institutionId: string,
  actor: PortalActor,
  documentId: string
) {
  assertActor(actor);

  const document =
    await prisma.document.findFirst({
      where: {
        id: documentId,
        institutionId,
      },
    });

  if (!document) {
    throw new AppError(
      "Document not found",
      404
    );
  }

  const ownerAllowed =
    document.ownerId === actor.id;

  if (!isManagement(actor) && !ownerAllowed) {
    throw new AppError(
      "You do not have permission to delete this document",
      403
    );
  }

  await prisma.document.delete({
    where: {
      id: document.id,
    },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "DOCUMENT_DELETED",
    entityType: "Document",
    entityId: document.id,
    metadata: {
      ownerId: document.ownerId,
      title: document.title,
    },
  });

  return {
    id: document.id,
    deleted: true,
  };
}

export async function getParentChildIds(
  institutionId: string,
  actor: PortalActor
): Promise<string[]> {
  assertActor(actor);

  if (!isParent(actor)) {
    throw new AppError(
      "Parent access required",
      403
    );
  }

  const links =
    await prisma.parentStudentLink.findMany({
      where: {
        institutionId,
        parentId: actor.id,
      },
      select: {
        studentId: true,
      },
    });

  return links.map(
    (link) => link.studentId
  );
}
