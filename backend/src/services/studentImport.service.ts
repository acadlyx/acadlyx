import * as XLSX from "xlsx";
import * as crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { hashPassword } from "../utils/password";
import { assertTenantQuota } from "./entitlement.service";
import { ensureInstitutionSystemRoles } from "./institution.service";
import { parseWorkbook } from "./import.service";

type Row = Record<string, any>;
const text = (value: any): string => String(value ?? "").trim();
function normalizeRow(row: Row): Row {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[\\s_-]+/g, ""), value]));
}
function date(value: any): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") { const parsed = XLSX.SSF.parse_date_code(value); return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)) : null; }
  const raw = text(value); if (!raw) return null; const parsed = new Date(raw); return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function syntheticEmail(key: string): string { return "imported-" + key.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() + "-" + crypto.randomUUID().slice(0, 8) + "@invalid.acadlyx.local"; }
function syntheticIdNumber(key: string): string { return "IMPORT-" + (key.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase() || "STUDENT") + "-" + crypto.randomUUID().slice(0, 6); }
function syntheticAdmissionNumber(row: Row): string { return text(row.rollnumber) || "IMPORT-" + crypto.randomUUID().slice(0, 10).toUpperCase(); }

async function findRoleId(tx: Prisma.TransactionClient, institutionId: string) {
  const roles = await ensureInstitutionSystemRoles(tx, institutionId);
  const roleId = roles.get("STUDENT");
  if (!roleId) throw new AppError("STUDENT role is not initialized for this institution", 500);
  return roleId;
}

async function resolvePlacement(tx: Prisma.TransactionClient, institutionId: string, row: Row) {
  const programCode = text(row.programcode); const yearName = text(row.academicyear);
  if (!programCode || !yearName) return null;
  const program = await tx.program.findFirst({ where: { institutionId, code: programCode, isActive: true }, select: { id: true } });
  const academicYear = await tx.academicYear.findFirst({ where: { institutionId, name: yearName }, select: { id: true } });
  if (!program || !academicYear) return null;
  let semesterId: string | null = null; let sectionId: string | null = null;
  const sectionName = text(row.section);
  if (sectionName) {
    const section = await tx.section.findFirst({ where: { institutionId, name: sectionName, semester: { programId: program.id, academicYearId: academicYear.id } }, select: { id: true, semesterId: true } });
    if (section) { sectionId = section.id; semesterId = section.semesterId; }
  }
  if (!semesterId && text(row.semesternumber)) {
    const semester = await tx.semester.findFirst({ where: { institutionId, programId: program.id, academicYearId: academicYear.id, number: Number(row.semesternumber), isActive: true }, select: { id: true } });
    semesterId = semester?.id ?? null;
  }
  return { programId: program.id, academicYearId: academicYear.id, semesterId, sectionId };
}

function getMissingFields(row: Row, email: string, idNumber: string, enrollmentCreated: boolean) {
  const fields: string[] = [];
  if (!text(row.email) || email.includes("@invalid.acadlyx.local")) fields.push("email");
  if (!text(row.idnumber || row.id || row.loginid) || idNumber.startsWith("IMPORT-")) fields.push("idNumber");
  if (!text(row.firstname)) fields.push("firstName");
  if (!text(row.lastname)) fields.push("lastName");
  if (!text(row.phone)) fields.push("phone");
  if (!text(row.admissionnumber) && !text(row.rollnumber)) fields.push("admissionNumber");
  if (!text(row.dateofbirth)) fields.push("dateOfBirth");
  if (!text(row.gender)) fields.push("gender");
  if (!text(row.guardianname)) fields.push("guardianName");
  if (!text(row.guardianphone)) fields.push("guardianPhone");
  if (!enrollmentCreated) fields.push("enrollment");
  return [...new Set(fields)];
}

export async function commitPartialStudentImport(buffer: Buffer, institutionId: string, actor: AuthenticatedUser) {
  if (!actor.permissions.includes("students.create")) throw new AppError("You are not authorized to import students", 403);
  const rows = parseWorkbook(buffer).rows.map(normalizeRow);
  if (!rows.length) throw new AppError("The first sheet contains no data rows", 400);
  await assertTenantQuota(institutionId, "users"); await assertTenantQuota(institutionId, "students");
  const imported: Array<{ id: string; row: number; name: string; missingFields: string[] }> = [];
  const errors: Array<{ row: number; message: string }> = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const admissionNumber = text(row.admissionnumber) || text(row.rollnumber) || syntheticAdmissionNumber(row);
      const suppliedEmail = text(row.email).toLowerCase();
      const email = suppliedEmail || syntheticEmail(admissionNumber);
      const suppliedId = text(row.idnumber || row.id || row.loginid).toUpperCase();
      const idNumber = suppliedId || syntheticIdNumber(admissionNumber);
      const firstName = text(row.firstname) || "Imported"; const lastName = text(row.lastname) || "Student";
      let enrollmentCreated = false;
      const result = await prisma.$transaction(async (tx) => {
        const roleId = await findRoleId(tx, institutionId);
        const existingProfile = await tx.studentProfile.findFirst({ where: { institutionId, admissionNumber }, select: { userId: true } });
        const existingEmail = suppliedEmail ? await tx.user.findUnique({ where: { email: suppliedEmail }, select: { id: true, institutionId: true } }) : null;
        if (existingEmail && existingEmail.institutionId !== institutionId) throw new AppError("The supplied email already belongs to another institution", 409);
        if (existingProfile && existingEmail && existingProfile.userId !== existingEmail.id) throw new AppError("Admission number and email refer to different users", 409);
        const existingUserId = existingProfile?.userId ?? existingEmail?.id;
        const existingUser = existingUserId ? await tx.user.findUnique({ where: { id: existingUserId }, select: { email: true, idNumber: true } }) : null;
        const finalEmail = existingUser?.email ?? email;
        const finalIdNumber = existingUser?.idNumber ?? idNumber;
        const user = existingUserId
          ? await tx.user.update({ where: { id: existingUserId }, data: { idNumber, firstName, lastName, phone: text(row.phone) || null } })
          : await tx.user.create({ data: { institutionId, email, idNumber, passwordHash: await hashPassword("Import-" + crypto.randomUUID() + "-9xA!"), firstName, lastName, phone: text(row.phone) || null, isActive: true } });
        await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId } }, update: {}, create: { userId: user.id, roleId } });
        await tx.studentProfile.upsert({
          where: { userId: user.id },
          update: { admissionNumber, dateOfBirth: date(row.dateofbirth), gender: text(row.gender) || null, bloodGroup: text(row.bloodgroup) || null, nationality: text(row.nationality) || null, address: text(row.address) || null, city: text(row.city) || null, state: text(row.state) || null, postalCode: text(row.postalcode) || null, guardianName: text(row.guardianname) || null, guardianPhone: text(row.guardianphone) || null, guardianEmail: text(row.guardianemail) || null, admissionDate: date(row.admissiondate), status: text(row.status) || "ACTIVE" },
          create: { institutionId, userId: user.id, admissionNumber, dateOfBirth: date(row.dateofbirth), gender: text(row.gender) || null, bloodGroup: text(row.bloodgroup) || null, nationality: text(row.nationality) || null, address: text(row.address) || null, city: text(row.city) || null, state: text(row.state) || null, postalCode: text(row.postalcode) || null, guardianName: text(row.guardianname) || null, guardianPhone: text(row.guardianphone) || null, guardianEmail: text(row.guardianemail) || null, admissionDate: date(row.admissiondate), status: text(row.status) || "ACTIVE" },
        });
        const placement = await resolvePlacement(tx, institutionId, row);
        if (placement?.semesterId) {
          await tx.studentEnrollment.upsert({ where: { userId_academicYearId: { userId: user.id, academicYearId: placement.academicYearId } }, update: { programId: placement.programId, semesterId: placement.semesterId, sectionId: placement.sectionId, rollNumber: text(row.rollnumber) || null, status: text(row.status) || "ACTIVE" }, create: { institutionId, userId: user.id, programId: placement.programId, academicYearId: placement.academicYearId, semesterId: placement.semesterId, sectionId: placement.sectionId, rollNumber: text(row.rollnumber) || null, status: text(row.status) || "ACTIVE" } });
          enrollmentCreated = true;
        }
        return user;
      });
      imported.push({ id: result.id, row: index + 2, name: (firstName + " " + lastName).trim(), missingFields: getMissingFields(row, (await prisma.user.findUnique({ where: { id: result.id }, select: { email: true } }))?.email || email, (await prisma.user.findUnique({ where: { id: result.id }, select: { idNumber: true } }))?.idNumber || idNumber, enrollmentCreated) });
    } catch (error) {
      errors.push({ row: index + 2, message: error instanceof Error ? error.message : "Unknown import error" });
    }
  }
  return { imported: imported.length, failed: errors.length, failedRows: errors, incomplete: imported.filter((item) => item.missingFields.length > 0), complete: imported.filter((item) => item.missingFields.length === 0) };
}