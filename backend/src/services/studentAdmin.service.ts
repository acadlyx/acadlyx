import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { hashPassword } from "../utils/password";
import { recordAuditLog } from "./audit.service";
import { ensureInstitutionSystemRoles } from "./institution.service";
import { assertTenantQuota } from "./entitlement.service";
import {
  CreateStudentInput,
  EnrollStudentInput,
  UpdateStudentInput,
} from "../validators/studentAdmin.validators";

const studentInclude = {
  profile: true,
  userRoles: {
    include: {
      role: true,
    },
  },
  studentEnrollments: {
    orderBy: [
      { enrolledAt: "desc" },
      { createdAt: "desc" },
    ],
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
          startDate: true,
          endDate: true,
          isCurrent: true,
        },
      },
      semester: {
        select: {
          id: true,
          number: true,
          name: true,
        },
      },
      section: {
        select: {
          id: true,
          name: true,
          capacity: true,
          semesterId: true,
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

function parseDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid date: ${value}`, 400);
  }

  return date;
}

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function getStudentOrThrow(
  institutionId: string,
  userId: string
) {
  const student = await prisma.user.findFirst({
    where: {
      id: userId,
      institutionId,
      userRoles: {
        some: {
          role: {
            name: "STUDENT",
            institutionId,
          },
        },
      },
    },
    include: studentInclude,
  });

  if (!student) {
    throw new AppError("Student not found", 404);
  }

  if (!student.profile) {
    throw new AppError(
      "Student master profile is missing for this account",
      409
    );
  }

  return student;
}

async function validateAcademicPlacement(
  institutionId: string,
  input: {
    programId: string;
    academicYearId: string;
    semesterId: string;
    sectionId?: string;
  }
) {
  const [program, academicYear, semester] = await Promise.all([
    prisma.program.findFirst({
      where: {
        id: input.programId,
        institutionId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    }),

    prisma.academicYear.findFirst({
      where: {
        id: input.academicYearId,
        institutionId,
      },
      select: {
        id: true,
        name: true,
      },
    }),

    prisma.semester.findFirst({
      where: {
        id: input.semesterId,
        institutionId,
        isActive: true,
      },
      select: {
        id: true,
        programId: true,
        academicYearId: true,
        name: true,
      },
    }),
  ]);

  if (!program) {
    throw new AppError("Program not found or inactive", 404);
  }

  if (!academicYear) {
    throw new AppError("Academic year not found", 404);
  }

  if (!semester) {
    throw new AppError("Semester not found or inactive", 404);
  }

  if (semester.programId !== program.id) {
    throw new AppError(
      "The selected semester does not belong to the selected program",
      400
    );
  }

  if (semester.academicYearId !== academicYear.id) {
    throw new AppError(
      "The selected semester does not belong to the selected academic year",
      400
    );
  }

  let section: {
    id: string;
    name: string;
    semesterId: string;
    capacity: number | null;
  } | null = null;

  if (input.sectionId) {
    section = await prisma.section.findFirst({
      where: {
        id: input.sectionId,
        institutionId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        semesterId: true,
        capacity: true,
      },
    });

    if (!section) {
      throw new AppError(
        "Section not found or inactive",
        404
      );
    }

    if (section.semesterId !== semester.id) {
      throw new AppError(
        "The selected section does not belong to the selected semester",
        400
      );
    }
  }

  return {
    program,
    academicYear,
    semester,
    section,
  };
}

async function ensureStudentRole(
  tx: Prisma.TransactionClient,
  institutionId: string
) {
  const roles = await ensureInstitutionSystemRoles(
    tx,
    institutionId
  );

  const roleId = roles.get("STUDENT");

  if (!roleId) {
    throw new AppError(
      "STUDENT role is not initialized for this institution",
      500
    );
  }

  return roleId;
}

function serializeStudent(student: any) {
  const {
    passwordHash: _passwordHash,
    userRoles,
    ...safeUser
  } = student;

  return {
    ...safeUser,
    roles: userRoles?.map(
      (binding: any) => binding.role
    ) ?? [],
    profile: student.profile,
    enrollments: student.studentEnrollments ?? [],
    currentEnrollment:
      student.studentEnrollments?.[0] ?? null,
  };
}

export async function listStudents(
  institutionId: string,
  params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    academicYearId?: string;
    programId?: string;
    semesterId?: string;
    sectionId?: string;
  }
) {
  const search = params.search?.trim();

  const where: Prisma.UserWhereInput = {
    institutionId,

    userRoles: {
      some: {
        role: {
          name: "STUDENT",
          institutionId,
        },
      },
    },

    ...(search
      ? {
          OR: [
            {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              firstName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              lastName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              profile: {
                admissionNumber: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {}),

    ...(params.status
      ? {
          profile: {
            status: params.status,
          },
        }
      : {}),

    ...(params.academicYearId ||
    params.programId ||
    params.semesterId ||
    params.sectionId
      ? {
          studentEnrollments: {
            some: {
              ...(params.academicYearId
                ? {
                    academicYearId:
                      params.academicYearId,
                  }
                : {}),
              ...(params.programId
                ? {
                    programId:
                      params.programId,
                  }
                : {}),
              ...(params.semesterId
                ? {
                    semesterId:
                      params.semesterId,
                  }
                : {}),
              ...(params.sectionId
                ? {
                    sectionId:
                      params.sectionId,
                  }
                : {}),
            },
          },
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: [
        {
          profile: {
            admissionNumber: "asc",
          },
        },
        {
          lastName: "asc",
        },
        {
          firstName: "asc",
        },
      ],
      include: studentInclude,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map(serializeStudent),
    total,
  };
}

export async function getStudent(
  institutionId: string,
  userId: string
) {
  return serializeStudent(
    await getStudentOrThrow(
      institutionId,
      userId
    )
  );
}

export async function createStudent(
  institutionId: string,
  input: CreateStudentInput,
  actor: AuthenticatedUser
) {
  await assertTenantQuota(institutionId, "users");
  await assertTenantQuota(institutionId, "students");
  const email = input.email.trim().toLowerCase();
  const admissionNumber =
    input.admissionNumber.trim().toUpperCase();

  const existingUser =
    await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

  if (existingUser) {
    throw new AppError(
      "A user with this email already exists",
      409
    );
  }

  const existingAdmission =
    await prisma.studentProfile.findFirst({
      where: {
        institutionId,
        admissionNumber,
      },
      select: { id: true },
    });

  if (existingAdmission) {
    throw new AppError(
      `Admission number "${admissionNumber}" already exists in this institution`,
      409
    );
  }

  const placement =
    await validateAcademicPlacement(
      institutionId,
      input
    );

  if (placement.section) {
    if (
      placement.section.capacity !== null
    ) {
      const enrolledCount =
        await prisma.studentEnrollment.count({
          where: {
            institutionId,
            sectionId:
              placement.section.id,
            status: "ACTIVE",
          },
        });

      if (
        enrolledCount >=
        placement.section.capacity
      ) {
        throw new AppError(
          `Section "${placement.section.name}" has reached its capacity`,
          409
        );
      }
    }
  }

  const passwordHash =
    await hashPassword(
      input.password
    );

  const created =
    await prisma.$transaction(
      async (tx) => {
        const roleId =
          await ensureStudentRole(
            tx,
            institutionId
          );

        const user =
          await tx.user.create({
            data: {
              institutionId,
              email,
              passwordHash,
              firstName:
                input.firstName.trim(),
              lastName:
                input.lastName.trim(),
              phone:
                clean(input.phone),
              isActive:
                input.status !==
                "INACTIVE",
            },
          });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId,
          },
        });

        await tx.studentProfile.create({
          data: {
            institutionId,
            userId: user.id,
            admissionNumber,
            dateOfBirth:
              parseDate(
                input.dateOfBirth
              ),
            gender:
              clean(input.gender),
            bloodGroup:
              clean(
                input.bloodGroup
              ),
            nationality:
              clean(
                input.nationality
              ),
            address:
              clean(input.address),
            city:
              clean(input.city),
            state:
              clean(input.state),
            postalCode:
              clean(
                input.postalCode
              ),
            guardianName:
              clean(
                input.guardianName
              ),
            guardianPhone:
              clean(
                input.guardianPhone
              ),
            guardianEmail:
              clean(
                input.guardianEmail
              ),
            emergencyContactName:
              clean(
                input.emergencyContactName
              ),
            emergencyContactPhone:
              clean(
                input.emergencyContactPhone
              ),
            admissionDate:
              parseDate(
                input.admissionDate
              ),
            status:
              input.status,
          },
        });

        await tx.studentEnrollment.create({
          data: {
            institutionId,
            userId: user.id,
            programId:
              placement.program.id,
            academicYearId:
              placement.academicYear.id,
            semesterId:
              placement.semester.id,
            sectionId:
              placement.section?.id ||
              null,
            rollNumber:
              clean(
                input.rollNumber
              ),
            status:
              input.status === "ACTIVE"
                ? "ACTIVE"
                : input.status === "GRADUATED"
                  ? "COMPLETED"
                  : input.status === "TRANSFERRED"
                    ? "TRANSFERRED"
                    : "DROPPED",
          },
        });

        return user;
      }
    );

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "student.create",
    entityType: "Student",
    entityId: created.id,
    metadata: {
      admissionNumber,
      programId:
        input.programId,
      academicYearId:
        input.academicYearId,
      semesterId:
        input.semesterId,
      sectionId:
        input.sectionId || null,
    },
  });

  return getStudent(
    institutionId,
    created.id
  );
}

export async function updateStudent(
  institutionId: string,
  userId: string,
  input: UpdateStudentInput,
  actor: AuthenticatedUser
) {
  const existing =
    await getStudentOrThrow(
      institutionId,
      userId
    );

  const nextAdmission =
    input.admissionNumber ===
    undefined
      ? undefined
      : input.admissionNumber
          .trim()
          .toUpperCase();

  if (
    nextAdmission &&
    nextAdmission !==
      existing.profile!.admissionNumber
  ) {
    const duplicate =
      await prisma.studentProfile.findFirst({
        where: {
          institutionId,
          admissionNumber:
            nextAdmission,
          NOT: {
            userId,
          },
        },
        select: { id: true },
      });

    if (duplicate) {
      throw new AppError(
        `Admission number "${nextAdmission}" already exists in this institution`,
        409
      );
    }
  }

  if (
    input.email &&
    input.email.trim().toLowerCase() !==
      existing.email
  ) {
    const duplicate =
      await prisma.user.findUnique({
        where: {
          email:
            input.email
              .trim()
              .toLowerCase(),
        },
        select: { id: true },
      });

    if (duplicate) {
      throw new AppError(
        "A user with this email already exists",
        409
      );
    }
  }

  const updated =
    await prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(input.email !==
            undefined
              ? {
                  email:
                    input.email
                      .trim()
                      .toLowerCase(),
                }
              : {}),
            ...(input.firstName !==
            undefined
              ? {
                  firstName:
                    input.firstName.trim(),
                }
              : {}),
            ...(input.lastName !==
            undefined
              ? {
                  lastName:
                    input.lastName.trim(),
                }
              : {}),
            ...(input.phone !==
            undefined
              ? {
                  phone:
                    clean(input.phone),
                }
              : {}),
            ...(input.status !==
            undefined
              ? {
                  isActive:
                    input.status !==
                    "INACTIVE",
                }
              : {}),
          },
        });

        await tx.studentProfile.update({
          where: {
            userId,
          },
          data: {
            ...(nextAdmission !==
            undefined
              ? {
                  admissionNumber:
                    nextAdmission,
                }
              : {}),
            ...(input.dateOfBirth !==
            undefined
              ? {
                  dateOfBirth:
                    parseDate(
                      input.dateOfBirth
                    ) || null,
                }
              : {}),
            ...(input.gender !==
            undefined
              ? {
                  gender:
                    clean(
                      input.gender
                    ),
                }
              : {}),
            ...(input.bloodGroup !==
            undefined
              ? {
                  bloodGroup:
                    clean(
                      input.bloodGroup
                    ),
                }
              : {}),
            ...(input.nationality !==
            undefined
              ? {
                  nationality:
                    clean(
                      input.nationality
                    ),
                }
              : {}),
            ...(input.address !==
            undefined
              ? {
                  address:
                    clean(
                      input.address
                    ),
                }
              : {}),
            ...(input.city !==
            undefined
              ? {
                  city:
                    clean(input.city),
                }
              : {}),
            ...(input.state !==
            undefined
              ? {
                  state:
                    clean(
                      input.state
                    ),
                }
              : {}),
            ...(input.postalCode !==
            undefined
              ? {
                  postalCode:
                    clean(
                      input.postalCode
                    ),
                }
              : {}),
            ...(input.guardianName !==
            undefined
              ? {
                  guardianName:
                    clean(
                      input.guardianName
                    ),
                }
              : {}),
            ...(input.guardianPhone !==
            undefined
              ? {
                  guardianPhone:
                    clean(
                      input.guardianPhone
                    ),
                }
              : {}),
            ...(input.guardianEmail !==
            undefined
              ? {
                  guardianEmail:
                    clean(
                      input.guardianEmail
                    ),
                }
              : {}),
            ...(input.emergencyContactName !==
            undefined
              ? {
                  emergencyContactName:
                    clean(
                      input.emergencyContactName
                    ),
                }
              : {}),
            ...(input.emergencyContactPhone !==
            undefined
              ? {
                  emergencyContactPhone:
                    clean(
                      input.emergencyContactPhone
                    ),
                }
              : {}),
            ...(input.admissionDate !==
            undefined
              ? {
                  admissionDate:
                    parseDate(
                      input.admissionDate
                    ) || null,
                }
              : {}),
            ...(input.status !==
            undefined
              ? {
                  status:
                    input.status,
                }
              : {}),
          },
        });

        return tx.user.findFirstOrThrow({
          where: {
            id: userId,
            institutionId,
          },
          include: studentInclude,
        });
      }
    );

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "student.update",
    entityType: "Student",
    entityId: userId,
    metadata: {
      before: {
        admissionNumber:
          existing.profile!
            .admissionNumber,
        email:
          existing.email,
      },
      after: {
        admissionNumber:
          updated.profile!
            .admissionNumber,
        email:
          updated.email,
      },
    },
  });

  return serializeStudent(
    updated
  );
}

export async function enrollStudent(
  institutionId: string,
  userId: string,
  input: EnrollStudentInput,
  actor: AuthenticatedUser
) {
  await getStudentOrThrow(
    institutionId,
    userId
  );

  const placement =
    await validateAcademicPlacement(
      institutionId,
      input
    );

  if (placement.section) {
    const enrolledCount =
      await prisma.studentEnrollment.count({
        where: {
          institutionId,
          sectionId:
            placement.section.id,
          status: "ACTIVE",
          userId: {
            not: userId,
          },
        },
      });

    if (
      placement.section.capacity !==
        null &&
      enrolledCount >=
        placement.section.capacity
    ) {
      throw new AppError(
        `Section "${placement.section.name}" has reached its capacity`,
        409
      );
    }
  }

  const existing =
    await prisma.studentEnrollment.findUnique({
      where: {
        userId_academicYearId: {
          userId,
          academicYearId:
            input.academicYearId,
        },
      },
    });

  const enrollment =
    await prisma.studentEnrollment.upsert({
      where: {
        userId_academicYearId: {
          userId,
          academicYearId:
            input.academicYearId,
        },
      },
      create: {
        institutionId,
        userId,
        programId:
          input.programId,
        academicYearId:
          input.academicYearId,
        semesterId:
          input.semesterId,
        sectionId:
          input.sectionId || null,
        rollNumber:
          clean(input.rollNumber),
        status:
          input.status,
      },
      update: {
        programId:
          input.programId,
        semesterId:
          input.semesterId,
        sectionId:
          input.sectionId || null,
        rollNumber:
          clean(input.rollNumber),
        status:
          input.status,
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
          },
        },
        semester: {
          select: {
            id: true,
            number: true,
            name: true,
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

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: existing
      ? "student.enrollment.update"
      : "student.enrollment.create",
    entityType: "StudentEnrollment",
    entityId: enrollment.id,
    metadata: {
      studentId: userId,
      academicYearId:
        input.academicYearId,
      programId:
        input.programId,
      semesterId:
        input.semesterId,
      sectionId:
        input.sectionId || null,
    },
  });

  return enrollment;
}

export async function listStudentEnrollments(
  institutionId: string,
  userId: string
) {
  await getStudentOrThrow(
    institutionId,
    userId
  );

  return prisma.studentEnrollment.findMany({
    where: {
      institutionId,
      userId,
    },
    orderBy: {
      enrolledAt: "desc",
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
          startDate: true,
          endDate: true,
          isCurrent: true,
        },
      },
      semester: {
        select: {
          id: true,
          number: true,
          name: true,
        },
      },
      section: {
        select: {
          id: true,
          name: true,
          capacity: true,
        },
      },
    },
  });
}
