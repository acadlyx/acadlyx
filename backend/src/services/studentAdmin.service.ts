import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { getCanonicalRoleNames } from "../config/rbac";
import { hashPassword } from "../utils/password";
import { recordAuditLog } from "./audit.service";
import { assertTenantQuota } from "./entitlement.service";
import { classifyStudentEnrollmentState } from "../utils/studentEnrollmentState";
import { assertAcademicYearInScope, assertCampusInScope, assertDepartmentInScope, assertProgramInScope, assertSectionInScope, assertSemesterInScope, getStudentWhereScope, getManagedDepartmentIds, getDirectorDepartmentIds, isInstitutionWide, isInstitutionWideAdmissions, isDirectorScoped, getEffectiveWorkspaceRole } from "./accessScope.service";
import {
  CreateStudentInput,
  EnrollStudentInput,
  UpdateStudentInput,
} from "../validators/studentAdmin.validators";

const studentInclude = {
  profile: { select: { id: true, institutionId: true, admissionNumber: true, dateOfBirth: true, gender: true, bloodGroup: true, nationality: true, address: true, city: true, state: true, postalCode: true, guardianName: true, guardianPhone: true, guardianEmail: true, emergencyContactName: true, emergencyContactPhone: true, admissionDate: true, status: true } },
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
          institutionId: true,
          name: true,
          code: true,
          level: true,
          isActive: true,
          department: { select: { id: true, institutionId: true, name: true, code: true, isActive: true } },
        },
      },
      academicYear: {
        select: {
          id: true,
          institutionId: true,
          name: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
        },
      },
      semester: {
        select: {
          id: true,
          institutionId: true,
          number: true,
          name: true,
        },
      },
      section: {
        select: {
          id: true,
          institutionId: true,
          name: true,
          capacity: true,
          semesterId: true,
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

const studentListInclude = {
  profile: {
    select: {
      id: true,
      institutionId: true,
      admissionNumber: true,
      dateOfBirth: true,
      gender: true,
      status: true,
    },
  },
  userRoles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  },
  studentEnrollments: {
    take: 20,
    orderBy: [
      { enrolledAt: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      institutionId: true,
      status: true,
      enrolledAt: true,
      rollNumber: true,
      program: {
        select: {
          id: true,
          name: true,
          code: true,
          level: true,
          isActive: true,
          department: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
      },
      academicYear: {
        select: {
          id: true,
          institutionId: true,
          name: true,
          isCurrent: true,
          startDate: true,
          endDate: true,
        },
      },
      semester: {
        select: {
          id: true,
          institutionId: true,
          number: true,
          name: true,
          programId: true,
          academicYearId: true,
          isActive: true,
        },
      },
      section: {
        select: {
          id: true,
          institutionId: true,
          name: true,
          isActive: true,
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

  return student;
}

function requireStudentProfile(
  student: Prisma.UserGetPayload<{ include: typeof studentInclude }>
) {
  if (!student.profile) {
    throw new AppError(
      "Student master profile is missing for this account. Complete the master profile before enrollment.",
      409
    );
  }

  return student.profile;
}

export async function validateAcademicPlacement(
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
        departmentId: true,
        department: { select: { id: true, name: true, isActive: true } },
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

  if (!program.department?.isActive) {
    throw new AppError("The selected program belongs to an inactive department", 400);
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
  /*
   * Student creation already runs inside a short-lived transaction.
   * Do not rebuild the entire institution role/permission catalog here:
   * ensureInstitutionSystemRoles() touches every system role and can
   * exhaust the transaction timeout on Supabase's pooled connection.
   *
   * Production startup/RBAC synchronization is responsible for repairing
   * the complete catalog. The student transaction only needs its own role.
   */
  const existing = await tx.role.findFirst({
    where: {
      institutionId,
      name: "STUDENT",
    },
    select: {
      id: true,
    },
  });

  if (existing) return existing.id;

  const created = await tx.role.create({
    data: {
      institutionId,
      name: "STUDENT",
      isSystem: true,
      description: "STUDENT role",
    },
    select: {
      id: true,
    },
  });

  return created.id;
}


async function getAcademicDepartmentScope(
  institutionId: string,
  actor: AuthenticatedUser,
): Promise<string[] | null> {
  if (isDirectorScoped(actor)) {
    const ids = await getDirectorDepartmentIds(institutionId, actor.id);
    if (!ids.length) throw new AppError("No campus scope is assigned to this Director", 403);
    return ids;
  }
  const roles = new Set<string>(getCanonicalRoleNames(actor.roles));
  if (roles.has("DEAN") || roles.has("HOD")) {
    const ids = await getManagedDepartmentIds(institutionId, actor.id);
    if (!ids.length) throw new AppError("No department scope is assigned to this account", 403);
    return ids;
  }
  // Admissions is institution-wide only inside its own intake pipeline.
  if (isInstitutionWide(actor) || isInstitutionWideAdmissions(actor)) return null;
  throw new AppError("This account cannot manage authoritative academic placements", 403);
}

async function assertAcademicPlacementInActorScope(institutionId: string, actor: AuthenticatedUser, departmentId: string): Promise<void> {
  const allowedDepartmentIds = await getAcademicDepartmentScope(institutionId, actor);
  if (allowedDepartmentIds && !allowedDepartmentIds.includes(departmentId)) {
    throw new AppError("The selected program is outside your assigned campus/department scope", 403);
  }
}
async function assertStudentReadAccess(
  institutionId: string,
  userId: string,
  actor: AuthenticatedUser
) {
  const scope = await getStudentWhereScope(institutionId, actor);
  const allowed = await prisma.user.findFirst({
    where: { id: userId, institutionId, ...scope },
    select: { id: true },
  });
  if (!allowed) throw new AppError("You are not authorized to access this student", 403);
}

function serializeStudent(student: any, actor?: AuthenticatedUser) {
  const {
    passwordHash: _passwordHash,
    userRoles,
    ...safeUser
  } = student;

  const enrollments = student.studentEnrollments ?? [];
  const currentEnrollment =
    enrollments.find((item: any) => item.academicYear?.isCurrent) ?? null;

  const enrollmentState =
    !student.profile
      ? "PROFILE_MISSING"
      : !currentEnrollment
        ? "MISSING"
        : classifyStudentEnrollmentState(student.profile, currentEnrollment);

  const restrictedProfileRoles = new Set<string>([
    "PLACEMENT",
    "LIBRARIAN",
    "ACCOUNTS",
    "EXAMINATION",
  ]);
  const hasRestrictedProfileAccess = actor
    ? restrictedProfileRoles.has(getEffectiveWorkspaceRole(actor))
    : false;

  const profile = hasRestrictedProfileAccess && student.profile
    ? {
        id: student.profile.id,
        institutionId: student.profile.institutionId,
        admissionNumber: student.profile.admissionNumber,
        status: student.profile.status,
      }
    : student.profile;

  return {
    ...safeUser,
    roles: userRoles?.map((binding: any) => binding.role) ?? [],
    profile,
    enrollments,
    currentEnrollment,
    enrollmentState,
  };
}

async function assertStudentListContext(
  institutionId: string,
  actor: AuthenticatedUser,
  params: {
    campusId?: string;
    academicYearId?: string;
    departmentId?: string;
    programId?: string;
    batchId?: string;
    semesterId?: string;
    sectionId?: string;
  }
) {
  const [campus, department, program, year, semester, section, batch] = await Promise.all([
    params.campusId
      ? prisma.campus.findFirst({ where: { id: params.campusId, institutionId, isActive: true }, select: { id: true } })
      : null,
    params.departmentId
      ? prisma.department.findFirst({ where: { id: params.departmentId, institutionId, isActive: true }, select: { id: true, campusId: true } })
      : null,
    params.programId
      ? prisma.program.findFirst({ where: { id: params.programId, institutionId, isActive: true }, select: { id: true, departmentId: true, department: { select: { campusId: true } } } })
      : null,
    params.academicYearId
      ? prisma.academicYear.findFirst({ where: { id: params.academicYearId, institutionId }, select: { id: true } })
      : null,
    params.semesterId
      ? prisma.semester.findFirst({ where: { id: params.semesterId, institutionId, isActive: true }, select: { id: true, programId: true, academicYearId: true, program: { select: { departmentId: true, department: { select: { campusId: true } } } } } })
      : null,
    params.sectionId
      ? prisma.section.findFirst({ where: { id: params.sectionId, institutionId, isActive: true }, select: { id: true, semesterId: true, semester: { select: { programId: true, academicYearId: true, program: { select: { departmentId: true, department: { select: { campusId: true } } } } } } } })
      : null,
    params.batchId
      ? prisma.batch.findFirst({ where: { id: params.batchId, institutionId, isActive: true }, select: { id: true, programId: true, program: { select: { departmentId: true, department: { select: { campusId: true } } } } } })
      : null,
  ]);

  if (params.campusId && !campus) throw new AppError("Selected campus is not available in this institution", 404);
  if (params.departmentId && !department) throw new AppError("Selected department is not available in this institution", 404);
  if (params.programId && !program) throw new AppError("Selected program is not available in this institution", 404);
  if (params.academicYearId && !year) throw new AppError("Selected academic year is not available in this institution", 404);
  if (params.semesterId && !semester) throw new AppError("Selected semester is not available in this institution", 404);
  if (params.sectionId && !section) throw new AppError("Selected section is not available in this institution", 404);
  if (params.batchId && !batch) throw new AppError("Selected batch is not available in this institution", 404);

  if (params.campusId) await assertCampusInScope(institutionId, actor, params.campusId);
  if (params.departmentId) await assertDepartmentInScope(institutionId, actor, params.departmentId);
  if (params.programId) await assertProgramInScope(institutionId, actor, params.programId);
  if (params.academicYearId) await assertAcademicYearInScope(institutionId, actor, params.academicYearId);
  if (params.semesterId) await assertSemesterInScope(institutionId, actor, params.semesterId);
  if (params.sectionId) await assertSectionInScope(institutionId, actor, params.sectionId);
  if (batch) await assertProgramInScope(institutionId, actor, batch.programId);

  if (program && department && program.departmentId !== department.id) {
    throw new AppError("Selected program does not belong to the selected department", 400);
  }
  if (campus && program && program.department.campusId !== params.campusId) {
    throw new AppError("Selected program does not belong to the selected campus", 400);
  }
  if (campus && department && department.campusId !== params.campusId) {
    throw new AppError("Selected department does not belong to the selected campus", 400);
  }

  if (semester && section && section.semesterId !== semester.id) {
    throw new AppError("Selected section does not belong to the selected semester", 400);
  }
  if (program && year) {
    const matchingSemester = await prisma.semester.findFirst({
      where: {
        institutionId,
        programId: program.id,
        academicYearId: year.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!matchingSemester) {
      throw new AppError("Selected academic year does not contain an active semester for the selected program", 400);
    }
  }

  const semesterProgramId = semester?.programId ?? section?.semester.programId;
  const semesterYearId = semester?.academicYearId ?? section?.semester.academicYearId;
  const semesterDepartmentId = semester?.program.departmentId ?? section?.semester.program.departmentId;
  const semesterCampusId = semester?.program.department.campusId ?? section?.semester.program.department.campusId;
  if (semesterProgramId && params.programId && semesterProgramId !== params.programId) {
    throw new AppError("Selected semester or section does not belong to the selected program", 400);
  }
  if (semesterYearId && params.academicYearId && semesterYearId !== params.academicYearId) {
    throw new AppError("Selected semester or section does not belong to the selected academic year", 400);
  }
  if (semesterDepartmentId && department && semesterDepartmentId !== department.id) {
    throw new AppError("Selected semester or section does not belong to the selected department", 400);
  }
  if (semesterCampusId && campus && semesterCampusId !== params.campusId) {
    throw new AppError("Selected semester or section does not belong to the selected campus", 400);
  }
  if (batch && params.programId && batch.programId !== params.programId) {
    throw new AppError("Selected batch does not belong to the selected program", 400);
  }
  if (batch && department && batch.program.departmentId !== department.id) {
    throw new AppError("Selected batch does not belong to the selected department", 400);
  }
  if (batch && campus && batch.program.department.campusId !== params.campusId) {
    throw new AppError("Selected batch does not belong to the selected campus", 400);
  }
}

export async function listStudents(
  institutionId: string,
  actor: AuthenticatedUser,
  params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    campusId?: string;
    academicYearId?: string;
    departmentId?: string;
    programId?: string;
    batchId?: string;
    semesterId?: string;
    sectionId?: string;
  }
) {
  const search = params.search?.trim();
  await assertStudentListContext(institutionId, actor, params);
  const scope = await getStudentWhereScope(institutionId, actor);
  const {
    studentEnrollments: scopedEnrollments,
    ...scopeWithoutEnrollment
  } = scope;

  const enrollmentPredicates: Prisma.StudentEnrollmentWhereInput[] = [];
  const serverEnrollmentPredicate =
    scopedEnrollments && "some" in scopedEnrollments
      ? scopedEnrollments.some
      : undefined;
  if (serverEnrollmentPredicate) enrollmentPredicates.push(serverEnrollmentPredicate);

  const hasRequestedAcademicFilter = Boolean(
    params.campusId || params.departmentId || params.academicYearId || params.programId ||
    params.batchId || params.semesterId || params.sectionId
  );
  if (hasRequestedAcademicFilter) {
    enrollmentPredicates.push({
      institutionId,
      ...((params.campusId || params.departmentId) ? {
        program: {
          ...(params.departmentId ? { departmentId: params.departmentId } : {}),
          ...(params.campusId ? { department: { campusId: params.campusId } } : {}),
        },
      } : {}),
      ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
      ...(params.programId ? { programId: params.programId } : {}),
      ...(params.batchId ? { batchId: params.batchId } : {}),
      ...(params.semesterId ? { semesterId: params.semesterId } : {}),
      ...(params.sectionId ? { sectionId: params.sectionId } : {}),
    });
  }

  // Scope and query filters are ANDed. A request filter is never allowed to
  // replace the server-derived enrollment predicate.
  const scopedStudentListInclude: Prisma.UserInclude = enrollmentPredicates.length
    ? {
        ...studentListInclude,
        studentEnrollments: {
          ...studentListInclude.studentEnrollments,
          where: { AND: enrollmentPredicates },
        },
      }
    : studentListInclude;

  const where: Prisma.UserWhereInput = {
    institutionId,
    ...scopeWithoutEnrollment,
    ...(enrollmentPredicates.length
      ? { studentEnrollments: { some: { AND: enrollmentPredicates } } }
      : {}),

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
      include: scopedStudentListInclude,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map((student) => serializeStudent(student, actor)),
    total,
  };
}

export async function getStudent(
  institutionId: string,
  userId: string,
  actor?: AuthenticatedUser
) {
  if (!actor) return serializeStudent(await getStudentOrThrow(institutionId, userId));

  await assertStudentReadAccess(institutionId, userId, actor);
  const scope = await getStudentWhereScope(institutionId, actor);
  const {
    studentEnrollments: scopeEnrollments,
    ...scopeWithoutEnrollments
  } = scope;
  const enrollmentScope =
    scopeEnrollments && "some" in scopeEnrollments
      ? scopeEnrollments.some
      : undefined;

  // Visibility of a student record does not imply visibility of every
  // enrollment attached to that student. Keep the included academic history
  // within the same scope used to authorize the student itself.
  const include = enrollmentScope
    ? {
        ...studentInclude,
        studentEnrollments: {
          ...studentInclude.studentEnrollments,
          where: {
            AND: [enrollmentScope],
          },
        },
      }
    : studentInclude;

  const student = await prisma.user.findFirst({
    where: {
      id: userId,
      institutionId,
      ...scopeWithoutEnrollments,
    },
    include,
  });
  if (!student) throw new AppError("Student not found in the authorized scope", 404);
  return serializeStudent(student, actor);
}

export async function createStudent(
  institutionId: string,
  input: CreateStudentInput,
  actor: AuthenticatedUser
) {
  await assertTenantQuota(institutionId, "users");
  await assertTenantQuota(institutionId, "students");
  const email = input.email.trim().toLowerCase();
  const idNumber = input.idNumber.trim().toUpperCase();
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

  const existingIdNumber = await prisma.user.findUnique({ where: { idNumber }, select: { id: true } });
  if (existingIdNumber) throw new AppError(`ID number "${idNumber}" already exists`, 409);

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
  await assertAcademicPlacementInActorScope(institutionId, actor, placement.program.departmentId);

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
              idNumber,
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
    created.id,
    actor
  );
}

export async function updateStudent(
  institutionId: string,
  userId: string,
  input: UpdateStudentInput,
  actor: AuthenticatedUser
) {
  await assertStudentReadAccess(institutionId, userId, actor);
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

  if (!existing.profile && !nextAdmission) {
    throw new AppError(
      "Admission number is required to create the student master profile",
      400
    );
  }

  if (
    nextAdmission &&
    nextAdmission !==
      existing.profile?.admissionNumber
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

  if (input.idNumber !== undefined && input.idNumber.trim().toUpperCase() !== existing.idNumber) {
    const duplicate = await prisma.user.findUnique({ where: { idNumber: input.idNumber.trim().toUpperCase() }, select: { id: true } });
    if (duplicate && duplicate.id !== userId) throw new AppError(`ID number "${input.idNumber.trim().toUpperCase()}" already exists`, 409);
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
            ...(input.idNumber !== undefined ? { idNumber: input.idNumber.trim().toUpperCase() } : {}),
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

        const profileData = {
          admissionNumber: nextAdmission ?? existing.profile?.admissionNumber ?? "",
          ...(input.dateOfBirth !== undefined ? { dateOfBirth: parseDate(input.dateOfBirth) || null } : {}),
          ...(input.gender !== undefined ? { gender: clean(input.gender) } : {}),
          ...(input.bloodGroup !== undefined ? { bloodGroup: clean(input.bloodGroup) } : {}),
          ...(input.nationality !== undefined ? { nationality: clean(input.nationality) } : {}),
          ...(input.address !== undefined ? { address: clean(input.address) } : {}),
          ...(input.city !== undefined ? { city: clean(input.city) } : {}),
          ...(input.state !== undefined ? { state: clean(input.state) } : {}),
          ...(input.postalCode !== undefined ? { postalCode: clean(input.postalCode) } : {}),
          ...(input.guardianName !== undefined ? { guardianName: clean(input.guardianName) } : {}),
          ...(input.guardianPhone !== undefined ? { guardianPhone: clean(input.guardianPhone) } : {}),
          ...(input.guardianEmail !== undefined ? { guardianEmail: clean(input.guardianEmail) } : {}),
          ...(input.emergencyContactName !== undefined ? { emergencyContactName: clean(input.emergencyContactName) } : {}),
          ...(input.emergencyContactPhone !== undefined ? { emergencyContactPhone: clean(input.emergencyContactPhone) } : {}),
          ...(input.admissionDate !== undefined ? { admissionDate: parseDate(input.admissionDate) || null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        };

        await tx.studentProfile.upsert({
          where: { userId },
          create: {
            institutionId,
            userId,
            ...profileData,
          },
          update: profileData,
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
        idNumber: existing.idNumber,
        admissionNumber:
          existing.profile?.admissionNumber ?? null,
        email:
          existing.email,
      },
      after: {
        idNumber: updated.idNumber,
        admissionNumber:
          updated.profile?.admissionNumber ?? null,
        email:
          updated.email,
      },
    },
  });

  return serializeStudent(updated, actor);
}

export async function enrollStudent(
  institutionId: string,
  userId: string,
  input: EnrollStudentInput,
  actor: AuthenticatedUser
) {
  const student = await getStudentOrThrow(institutionId, userId);
  requireStudentProfile(student);

  const placement = await validateAcademicPlacement(institutionId, input);
  await assertAcademicPlacementInActorScope(institutionId, actor, placement.program.departmentId);

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

  // A fresh enrollment may target this caller’s assigned program. Updating an
  // existing active enrollment from another department/campus is a movement,
  // and must pass through the authorized student-movement workflow.
  if (existing?.status === "ACTIVE") {
    const existingProgram = await prisma.program.findFirst({
      where: { id: existing.programId, institutionId },
      select: { departmentId: true },
    });
    const activeScope = await getAcademicDepartmentScope(institutionId, actor);
    if (activeScope && (!existingProgram || !activeScope.includes(existingProgram.departmentId))) {
      throw new AppError("This student has an active enrollment outside your scope. Use the approved student-movement workflow.", 403);
    }
  }

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
  userId: string,
  actor: AuthenticatedUser
) {
  await assertStudentReadAccess(institutionId, userId, actor);
  await getStudentOrThrow(institutionId, userId);

  const scope = await getStudentWhereScope(institutionId, actor);
  const scopedEnrollments = scope.studentEnrollments;
  const scopedEnrollmentWhere =
    scopedEnrollments && "some" in scopedEnrollments
      ? scopedEnrollments.some
      : undefined;

  return prisma.studentEnrollment.findMany({
    where: {
      institutionId,
      userId,
      ...(scopedEnrollmentWhere || {}),
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
