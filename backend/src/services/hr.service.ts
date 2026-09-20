import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "../validators/hr.validators";
import { recordAuditLog } from "./audit.service";

const EMPLOYEE_ROLES = [
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "HOD",
  "FACULTY",
  "STAFF",
];

const include = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      isActive: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  },
  department: { select: { id: true, name: true, code: true } },
} satisfies Prisma.EmployeeProfileInclude;

type Meta = { ipAddress?: string; userAgent?: string };

async function assertDepartment(institutionId: string, departmentId?: string | null) {
  if (!departmentId) return;
  const department = await prisma.department.findFirst({
    where: { id: departmentId, institutionId },
    select: { id: true },
  });
  if (!department) throw new AppError("Department not found in this institution", 404);
}

type EmployeeRow = Prisma.EmployeeProfileGetPayload<{ include: typeof include }>;

function shape(row: EmployeeRow) {
  const { userRoles, ...user } = row.user;
  return {
    ...row,
    user: { ...user, roles: userRoles.map((binding) => binding.role.name) },
  };
}

export async function listEmployees(
  institutionId: string,
  pagination: PaginationParams,
  filters: {
    search?: string;
    departmentId?: string;
    status?: string;
    employmentType?: string;
  }
) {
  const where: Prisma.EmployeeProfileWhereInput = {
    institutionId,
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.employmentType ? { employmentType: filters.employmentType } : {}),
    ...(filters.search
      ? {
          OR: [
            { employeeCode: { contains: filters.search, mode: "insensitive" } },
            { designation: { contains: filters.search, mode: "insensitive" } },
            { user: { firstName: { contains: filters.search, mode: "insensitive" } } },
            { user: { lastName: { contains: filters.search, mode: "insensitive" } } },
            { user: { email: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total, byStatus, byDepartment] = await Promise.all([
    prisma.employeeProfile.findMany({
      where,
      include,
      orderBy: { employeeCode: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.employeeProfile.count({ where }),
    prisma.employeeProfile.groupBy({
      by: ["status"],
      where: { institutionId },
      _count: { _all: true },
    }),
    prisma.employeeProfile.groupBy({
      by: ["departmentId"],
      where: { institutionId },
      _count: { _all: true },
    }),
  ]);

  return {
    items: rows.map(shape),
    total,
    summary: {
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
      departments: byDepartment.length,
    },
  };
}

export async function getMyProfile(institutionId: string, userId: string) {
  const row = await prisma.employeeProfile.findFirst({
    where: { institutionId, userId },
    include,
  });
  return row ? shape(row) : null;
}

export async function getEmployee(institutionId: string, id: string) {
  const row = await prisma.employeeProfile.findFirst({
    where: { id, institutionId },
    include,
  });
  if (!row) throw new AppError("Employee record not found", 404);
  return shape(row);
}

/** Staff-type users of the tenant that do not yet have an employee record. */
export async function listEligibleUsers(institutionId: string) {
  return prisma.user.findMany({
    where: {
      institutionId,
      isActive: true,
      employeeProfile: null,
      userRoles: { some: { role: { name: { in: EMPLOYEE_ROLES } } } },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 500,
  });
}

export async function createEmployee(
  institutionId: string,
  actor: AuthenticatedUser,
  input: CreateEmployeeInput,
  meta: Meta
) {
  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      institutionId,
      userRoles: { some: { role: { name: { in: EMPLOYEE_ROLES } } } },
    },
    select: { id: true, employeeProfile: { select: { id: true } } },
  });
  if (!user) {
    throw new AppError("Employee user not found in this institution or has no staff role", 404);
  }
  if (user.employeeProfile) throw new AppError("This user already has an employee record", 409);
  await assertDepartment(institutionId, input.departmentId);

  const duplicate = await prisma.employeeProfile.findFirst({
    where: { institutionId, employeeCode: input.employeeCode },
    select: { id: true },
  });
  if (duplicate) throw new AppError("Employee code already exists in this institution", 409);

  const row = await prisma.employeeProfile.create({
    data: {
      institutionId,
      userId: input.userId,
      employeeCode: input.employeeCode,
      departmentId: input.departmentId,
      designation: input.designation,
      employmentType: input.employmentType,
      joiningDate: input.joiningDate,
      qualification: input.qualification,
      address: input.address,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "hr.employee.create",
    entityType: "EmployeeProfile",
    entityId: row.id,
    metadata: { employeeUserId: input.userId, employeeCode: input.employeeCode },
    ...meta,
  });
  return shape(row);
}

export async function updateEmployee(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: UpdateEmployeeInput,
  meta: Meta
) {
  const existing = await prisma.employeeProfile.findFirst({
    where: { id, institutionId },
    select: { id: true, employeeCode: true },
  });
  if (!existing) throw new AppError("Employee record not found", 404);
  await assertDepartment(institutionId, input.departmentId);

  if (input.employeeCode && input.employeeCode !== existing.employeeCode) {
    const duplicate = await prisma.employeeProfile.findFirst({
      where: { institutionId, employeeCode: input.employeeCode, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new AppError("Employee code already exists in this institution", 409);
  }

  const row = await prisma.employeeProfile.update({
    where: { id },
    data: {
      employeeCode: input.employeeCode,
      departmentId: input.departmentId,
      designation: input.designation,
      employmentType: input.employmentType,
      joiningDate: input.joiningDate,
      status: input.status,
      qualification: input.qualification,
      address: input.address,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "hr.employee.update",
    entityType: "EmployeeProfile",
    entityId: id,
    metadata: { changed: Object.keys(input) },
    ...meta,
  });
  return shape(row);
}
