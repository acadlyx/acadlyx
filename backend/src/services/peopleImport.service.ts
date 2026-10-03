import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { hashPassword } from "../utils/password";
import { getCanonicalRoleNames } from "../config/rbac";
import { getManagedDepartmentIds, isInstitutionWide } from "./accessScope.service";

export const PEOPLE_IMPORT_TYPES = ["students", "faculty", "staff"] as const;
export type PeopleImportType = typeof PEOPLE_IMPORT_TYPES[number];

type Row = Record<string, any>;

const STAFF_ROLES = [
  "HOD",
  "ACCOUNTS",
  "HR",
  "ADMISSIONS",
  "EXAMINATION",
  "LIBRARIAN",
  "PLACEMENT",
  "IT",
] as const;

function text(v: any): string {
  return String(v ?? "").trim();
}

function date(v: any): Date {
  if (v instanceof Date) return v;

  if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);

    if (p) {
      return new Date(Date.UTC(p.y, p.m - 1, p.d));
    }
  }

  const d = new Date(v);

  if (Number.isNaN(d.getTime())) {
    throw new AppError(`Invalid date: ${v}`, 400);
  }

  return d;
}

function normalizeRow(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.toLowerCase().replace(/[\s_-]+/g, ""),
      v,
    ]),
  );
}

function parse(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheet = workbook.SheetNames[0];

  if (!sheet) {
    throw new AppError("Workbook has no sheets", 400);
  }

  const rows = XLSX.utils
    .sheet_to_json<Row>(workbook.Sheets[sheet], {
      defval: "",
    })
    .map(normalizeRow);

  return rows;
}

function assertType(type: PeopleImportType) {
  if (!PEOPLE_IMPORT_TYPES.includes(type)) {
    throw new AppError(`Unsupported people import type: ${type}`, 400);
  }
}

function assertPermission(actor: AuthenticatedUser) {
  if (!actor.permissions.includes("people.import")) {
    throw new AppError("People import permission required", 403);
  }
}

async function scopeFor(
  actor: AuthenticatedUser,
  institutionId: string,
) {
  if (isInstitutionWide(actor)) {
    return null;
  }

  if (getCanonicalRoleNames(actor.roles).includes("HOD")) {
    const ids = await getManagedDepartmentIds(institutionId, actor.id);

    if (!ids.length) {
      throw new AppError(
        "You have no department scope assigned",
        403,
      );
    }

    return new Set(ids);
  }

  throw new AppError(
    "People import is not available for this role",
    403,
  );
}

async function resolveDepartment(
  tx: Prisma.TransactionClient,
  institutionId: string,
  code: string,
) {
  if (!code) {
    throw new AppError("departmentCode is required", 400);
  }

  const department = await tx.department.findFirst({
    where: {
      institutionId,
      code,
    },
  });

  if (!department) {
    throw new AppError(
      `Department not found: ${code}`,
      400,
    );
  }

  return department;
}

async function resolveProgram(
  tx: Prisma.TransactionClient,
  institutionId: string,
  code: string,
) {
  if (!code) {
    throw new AppError("programCode is required", 400);
  }

  const program = await tx.program.findFirst({
    where: {
      institutionId,
      code,
    },
    select: {
      id: true,
      code: true,
      departmentId: true,
    },
  });

  if (!program) {
    throw new AppError(
      `Program not found: ${code}`,
      400,
    );
  }

  return program;
}

async function validateRows(
  buffer: Buffer,
  type: PeopleImportType,
  institutionId: string,
  actor: AuthenticatedUser,
) {
  assertType(type);
  assertPermission(actor);

  const rows = parse(buffer);

  if (!rows.length) {
    throw new AppError(
      "The first sheet contains no data rows",
      400,
    );
  }

  const scope = await scopeFor(actor, institutionId);

  const errors: {
    row: number;
    message: string;
  }[] = [];

  const seenEmails = new Set<string>();
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const n = i + 2;
    const email = text(row.email).toLowerCase();
  const idNumber = text(row.idnumber || row.id || row.loginid).toUpperCase();
  if (!idNumber) throw new AppError("Every user row needs an ID number", 400);

    if (!email) {
      errors.push({
        row: n,
        message: "email is required",
      });

      continue;
    }

    if (seenEmails.has(email)) {
      errors.push({
        row: n,
        message: `Duplicate email inside file: ${email}`,
      });
    }

    seenEmails.add(email);

    try {
      if (type === "students") {
        const admission =
          text(row.admissionnumber) ||
          text(row.rollnumber);

        const program = await resolveProgram(
          prisma,
          institutionId,
          text(row.programcode),
        );

        if (scope && !scope.has(program.departmentId)) {
          throw new AppError(
            `Program ${program.code} is outside your department scope`,
            403,
          );
        }

        const yearName = text(row.academicyear);

        if (!yearName) {
          throw new AppError(
            "academicYear is required",
            400,
          );
        }

        const year =
          await prisma.academicYear.findFirst({
            where: {
              institutionId,
              name: yearName,
            },
            select: {
              id: true,
            },
          });

        if (!year) {
          throw new AppError(
            `Academic year not found: ${yearName}`,
            400,
          );
        }

        if (!admission) {
          throw new AppError(
            "admissionNumber (or rollNumber) is required",
            400,
          );
        }

        const key = `admission:${admission}`;

        if (seenKeys.has(key)) {
          throw new AppError(
            `Duplicate admission number inside file: ${admission}`,
            409,
          );
        }

        seenKeys.add(key);

        const existingAdmission =
          await prisma.studentProfile.findFirst({
            where: {
              institutionId,
              admissionNumber: admission,
            },
            select: {
              userId: true,
            },
          });

        const emailOwner =
          await prisma.user.findFirst({
            where: {
              institutionId,
              email,
            },
            select: {
              id: true,
            },
          });

        if (
          existingAdmission &&
          emailOwner?.id !== existingAdmission.userId
        ) {
          throw new AppError(
            `Admission number already belongs to another student: ${admission}`,
            409,
          );
        }

        const existing =
          await prisma.user.findFirst({
            where: {
              institutionId,
              email,
            },
            select: {
              id: true,
              userRoles: {
                select: {
                  role: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          });

        if (
          existing &&
          existing.userRoles.some(
            (r) => r.role.name !== "STUDENT",
          )
        ) {
          throw new AppError(
            `Email ${email} already belongs to an incompatible account`,
            409,
          );
        }

        const sectionName = text(row.section);

        if (sectionName) {
          const section =
            await prisma.section.findFirst({
              where: {
                institutionId,
                name: sectionName,
                semester: {
                  programId: program.id,
                  academicYearId: year.id,
                },
              },
              select: {
                id: true,
              },
            });

          if (!section) {
            throw new AppError(
              `Section ${sectionName} does not belong to ${program.code} / ${yearName}`,
              400,
            );
          }
        }
      } else {
        const department =
          await resolveDepartment(
            prisma,
            institutionId,
            text(row.departmentcode),
          );

        if (
          scope &&
          !scope.has(department.id)
        ) {
          throw new AppError(
            `Department ${department.code} is outside your scope`,
            403,
          );
        }

        const employeeCode =
          text(row.employeecode);

        const designation =
          text(row.designation);

        const joiningDate =
          text(row.joiningdate);

        if (
          !employeeCode ||
          !designation ||
          !joiningDate
        ) {
          throw new AppError(
            "employeeCode, designation and joiningDate are required",
            400,
          );
        }

        if (
          seenKeys.has(
            `employee:${employeeCode}`,
          )
        ) {
          throw new AppError(
            `Duplicate employeeCode inside file: ${employeeCode}`,
            409,
          );
        }

        seenKeys.add(
          `employee:${employeeCode}`,
        );

        const existingEmployee =
          await prisma.employeeProfile.findFirst({
            where: {
              institutionId,
              employeeCode,
            },
            select: {
              userId: true,
            },
          });

        const existingUser =
          await prisma.user.findFirst({
            where: {
              institutionId,
              email,
            },
            select: {
              id: true,
              userRoles: {
                select: {
                  role: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          });

        if (
          existingEmployee &&
          existingEmployee.userId !==
            existingUser?.id
        ) {
          throw new AppError(
            `Employee code already belongs to another account: ${employeeCode}`,
            409,
          );
        }

        const allowed =
          type === "faculty"
            ? ["FACULTY", "HOD"]
            : [...STAFF_ROLES];

        if (
          existingUser &&
          existingUser.userRoles.some(
            (r) =>
              !allowed.includes(r.role.name),
          )
        ) {
          throw new AppError(
            `Email ${email} already belongs to an incompatible account`,
            409,
          );
        }

        if (type === "staff") {
          const role =
            text(row.role).toUpperCase();

          if (
            !(STAFF_ROLES as readonly string[]).includes(
              role,
            )
          ) {
            throw new AppError(
              `Invalid staff role: ${role || "empty"}`,
              400,
            );
          }
        }
      }
    } catch (error) {
      errors.push({
        row: n,
        message:
          error instanceof Error
            ? error.message
            : "Validation failed",
      });
    }
  }

  return {
    totalRows: rows.length,
    validRows: rows.length - errors.length,
    errors,
  };
}

export async function preview(
  buffer: Buffer,
  type: PeopleImportType,
  institutionId: string,
  actor: AuthenticatedUser,
) {
  const rows = parse(buffer);

  const validation = await validateRows(
    buffer,
    type,
    institutionId,
    actor,
  );

  return {
    type,
    totalRows: rows.length,
    sample: rows.slice(0, 5),
    validRows: validation.validRows,
    errors: validation.errors,
    canCommit: validation.errors.length === 0,
  };
}

async function upsertUser(
  tx: Prisma.TransactionClient,
  institutionId: string,
  row: Row,
  roleName: string,
) {
  const email = text(row.email).toLowerCase();

  const role = await tx.role.findFirst({
    where: {
      institutionId,
      name: roleName,
    },
  });

  if (!role) {
    throw new AppError(
      `Role ${roleName} is not configured for this institution`,
      400,
    );
  }

  const existing = await tx.user.findFirst({
    where: {
      institutionId,
      email,
    },
  });

  const password = text(row.password);
  if (!existing && password.length < 12) {
    throw new AppError("New imported users require a password of at least 12 characters", 400);
  }

  const user = existing
    ? await tx.user.update({
        where: {
          id: existing.id,
        },
        data: {
          idNumber,
          firstName:
            text(row.firstname) ||
            existing.firstName,
          lastName:
            text(row.lastname) ||
            existing.lastName,
          phone:
            text(row.phone) ||
            existing.phone,
          isActive:
            row.active === ""
              ? existing.isActive
              : [
                    true,
                    1,
                    "1",
                    "true",
                    "yes",
                    "y",
                  ].includes(
                    typeof row.active === "string"
                      ? row.active.toLowerCase()
                      : row.active,
                  ),
        },
      })
    : await tx.user.create({
        data: {
          institutionId,
          email,
          idNumber,
          passwordHash:
            await hashPassword(password),
          firstName:
            text(row.firstname) || "User",
          lastName: text(row.lastname),
          phone: text(row.phone) || null,
        },
      });

  await tx.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  return user;
}

async function assertScopeForCommit(
  actor: AuthenticatedUser,
  institutionId: string,
  departmentId: string,
) {
  if (isInstitutionWide(actor)) {
    return;
  }

  const ids = await getManagedDepartmentIds(
    institutionId,
    actor.id,
  );

  if (!ids.includes(departmentId)) {
    throw new AppError(
      "Record is outside your department scope",
      403,
    );
  }
}

export async function commit(
  buffer: Buffer,
  type: PeopleImportType,
  institutionId: string,
  actor: AuthenticatedUser,
) {
  assertType(type);
  assertPermission(actor);

  const validation = await validateRows(
    buffer,
    type,
    institutionId,
    actor,
  );

  if (validation.errors.length) {
    throw new AppError(
      `Import blocked: ${validation.errors.length} row(s) failed validation. First error: ${validation.errors[0].message}`,
      400,
    );
  }

  const rows = parse(buffer);

  let imported = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const row of rows) {
        if (type === "students") {
          const program =
            await tx.program.findFirstOrThrow({
              where: {
                institutionId,
                code: text(row.programcode),
              },
            });

          await assertScopeForCommit(
            actor,
            institutionId,
            program.departmentId,
          );

          const year =
            await tx.academicYear.findFirstOrThrow({
              where: {
                institutionId,
                name: text(row.academicyear),
              },
            });

          let semesterId: string | null =
            null;

          let sectionId: string | null =
            null;

          if (text(row.section)) {
            const section =
              await tx.section.findFirstOrThrow({
                where: {
                  institutionId,
                  name: text(row.section),
                  semester: {
                    programId: program.id,
                    academicYearId: year.id,
                  },
                },
              });

            sectionId = section.id;
            semesterId = section.semesterId;
          }

          const user = await upsertUser(
            tx,
            institutionId,
            row,
            "STUDENT",
          );

          const admissionNumber =
            text(row.admissionnumber) ||
            text(row.rollnumber);

          await tx.studentProfile.upsert({
            where: {
              userId: user.id,
            },
            update: {
              admissionNumber,
              dateOfBirth: text(row.dateofbirth)
                ? date(row.dateofbirth)
                : undefined,
              gender:
                text(row.gender) || null,
              bloodGroup:
                text(row.bloodgroup) || null,
              nationality:
                text(row.nationality) || null,
              address:
                text(row.address) || null,
              city: text(row.city) || null,
              state:
                text(row.state) || null,
              postalCode:
                text(row.postalcode) || null,
              guardianName:
                text(row.guardianname) || null,
              guardianPhone:
                text(row.guardianphone) || null,
              guardianEmail:
                text(row.guardianemail) || null,
              admissionDate:
                text(row.admissiondate)
                  ? date(row.admissiondate)
                  : undefined,
              status:
                text(row.status) || "ACTIVE",
            },
            create: {
              institutionId,
              userId: user.id,
              admissionNumber,
              dateOfBirth:
                text(row.dateofbirth)
                  ? date(row.dateofbirth)
                  : null,
              gender:
                text(row.gender) || null,
              bloodGroup:
                text(row.bloodgroup) || null,
              nationality:
                text(row.nationality) || null,
              address:
                text(row.address) || null,
              city: text(row.city) || null,
              state:
                text(row.state) || null,
              postalCode:
                text(row.postalcode) || null,
              guardianName:
                text(row.guardianname) || null,
              guardianPhone:
                text(row.guardianphone) || null,
              guardianEmail:
                text(row.guardianemail) || null,
              admissionDate:
                text(row.admissiondate)
                  ? date(row.admissiondate)
                  : null,
              status:
                text(row.status) || "ACTIVE",
            },
          });

          await tx.studentEnrollment.upsert({
            where: {
              userId_academicYearId: {
                userId: user.id,
                academicYearId: year.id,
              },
            },
            update: {
              programId: program.id,
              semesterId,
              sectionId,
              rollNumber:
                text(row.rollnumber) || null,
              status:
                text(row.status) || "ACTIVE",
            },
            create: {
              institutionId,
              userId: user.id,
              programId: program.id,
              academicYearId: year.id,
              semesterId,
              sectionId,
              rollNumber:
                text(row.rollnumber) || null,
              status:
                text(row.status) || "ACTIVE",
            },
          });
        } else {
          const role =
            type === "faculty"
              ? "FACULTY"
              : text(row.role).toUpperCase();

          const department =
            await tx.department.findFirstOrThrow({
              where: {
                institutionId,
                code: text(row.departmentcode),
              },
            });

          await assertScopeForCommit(
            actor,
            institutionId,
            department.id,
          );

          const user = await upsertUser(
            tx,
            institutionId,
            row,
            role,
          );

          await tx.employeeProfile.upsert({
            where: {
              userId: user.id,
            },
            update: {
              employeeCode:
                text(row.employeecode),
              departmentId: department.id,
              designation:
                text(row.designation),
              employmentType:
                text(row.employmenttype) ||
                "FULL_TIME",
              joiningDate:
                date(row.joiningdate),
              status:
                text(row.status) || "ACTIVE",
              qualification:
                text(row.qualification) ||
                null,
              address:
                text(row.address) || null,
              emergencyContactName:
                text(
                  row.emergencycontactname,
                ) || null,
              emergencyContactPhone:
                text(
                  row.emergencycontactphone,
                ) || null,
            },
            create: {
              institutionId,
              userId: user.id,
              employeeCode:
                text(row.employeecode),
              departmentId: department.id,
              designation:
                text(row.designation),
              employmentType:
                text(row.employmenttype) ||
                "FULL_TIME",
              joiningDate:
                date(row.joiningdate),
              status:
                text(row.status) || "ACTIVE",
              qualification:
                text(row.qualification) ||
                null,
              address:
                text(row.address) || null,
              emergencyContactName:
                text(
                  row.emergencycontactname,
                ) || null,
              emergencyContactPhone:
                text(
                  row.emergencycontactphone,
                ) || null,
            },
          });

          if (role === "HOD") {
            await tx.departmentAccess.upsert({
              where: {
                userId_departmentId: {
                  userId: user.id,
                  departmentId: department.id,
                },
              },
              update: {
                scope: "HOD",
              },
              create: {
                userId: user.id,
                departmentId: department.id,
                scope: "HOD",
              },
            });
          }
        }

        imported++;
      }
    },
    {
      timeout: 120000,
    },
  );

  return {
    imported,
    failed: 0,
    type,
  };
}
