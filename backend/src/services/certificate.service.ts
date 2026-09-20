import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { recordAuditLog } from "./audit.service";
import { assertCanViewStudent } from "./accessScope.service";
import { RequestCertificateInput } from "../validators/certificate.validators";

type Meta = { ipAddress?: string; userAgent?: string };

const include = {
  student: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} satisfies Prisma.CertificateInclude;

const TYPE_PREFIX: Record<string, string> = {
  BONAFIDE: "BON",
  CHARACTER: "CHR",
  TRANSFER: "TRF",
  MARKSHEET: "MRK",
  COURSE_COMPLETION: "CCM",
};

/**
 * Certificate numbers are human-readable and unique per institution:
 *   <TYPE>-<YEAR>-<SEQUENCE>
 * The sequence is derived inside the issuing transaction from the count
 * of certificates already issued for that type and year.
 */
async function nextCertificateNumber(
  tx: Prisma.TransactionClient,
  institutionId: string,
  certificateType: string
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `${TYPE_PREFIX[certificateType] ?? "CRT"}-${year}-`;

  const last = await tx.certificate.findFirst({
    where: { institutionId, certificateNumber: { startsWith: prefix } },
    orderBy: { certificateNumber: "desc" },
    select: { certificateNumber: true },
  });

  const lastSequence = last?.certificateNumber
    ? parseInt(last.certificateNumber.slice(prefix.length), 10)
    : 0;
  const next = (Number.isFinite(lastSequence) ? lastSequence : 0) + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

/** Tamper-evident digest over the immutable facts of the certificate. */
function verificationHash(
  certificateNumber: string,
  payload: Record<string, unknown>
): string {
  return createHash("sha256")
    .update(`${certificateNumber}|${JSON.stringify(payload)}`)
    .digest("hex")
    .slice(0, 32);
}

/** Snapshot of everything the certificate asserts, frozen at issue time. */
async function buildPayload(
  institutionId: string,
  studentId: string,
  certificateType: string
): Promise<Record<string, unknown>> {
  const [student, institution, enrollment, profile] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, institutionId },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, name: true, slug: true },
    }),
    prisma.studentEnrollment.findFirst({
      where: { institutionId, userId: studentId },
      orderBy: { enrolledAt: "desc" },
      include: {
        program: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    }),
    prisma.studentProfile.findFirst({
      where: { institutionId, userId: studentId },
      select: {
        admissionNumber: true,
        dateOfBirth: true,
        admissionDate: true,
        status: true,
        guardianName: true,
      },
    }),
  ]);

  if (!student) throw new AppError("Student not found in this institution", 404);

  const payload: Record<string, unknown> = {
    issuedAt: new Date().toISOString(),
    institution,
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
      admissionNumber: profile?.admissionNumber ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
      guardianName: profile?.guardianName ?? null,
      status: profile?.status ?? null,
    },
    enrollment: enrollment
      ? {
          program: enrollment.program,
          academicYear: enrollment.academicYear,
          semester: enrollment.semester,
          section: enrollment.section,
          rollNumber: enrollment.rollNumber,
          status: enrollment.status,
        }
      : null,
  };

  /* A marksheet must certify the actual results, not just enrollment. */
  if (certificateType === "MARKSHEET" || certificateType === "COURSE_COMPLETION") {
    const results = await prisma.examResult.findMany({
      where: { institutionId, studentId },
      include: {
        exam: {
          select: {
            title: true,
            maxMarks: true,
            courseOffering: {
              select: {
                course: { select: { code: true, name: true, credits: true } },
                semester: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    payload.results = results.map((row) => ({
      exam: row.exam.title,
      course: row.exam.courseOffering.course.code,
      courseName: row.exam.courseOffering.course.name,
      credits: row.exam.courseOffering.course.credits,
      semester: row.exam.courseOffering.semester.name,
      marks: row.marks,
      maxMarks: row.exam.maxMarks,
    }));
  }

  return payload;
}

export async function requestCertificate(
  institutionId: string,
  actor: AuthenticatedUser,
  input: RequestCertificateInput,
  meta: Meta
) {
  const studentId = input.studentId ?? actor.id;

  if (studentId !== actor.id) {
    if (!actor.permissions.includes("certificates.read")) {
      throw new AppError("You may only request certificates for yourself", 403);
    }
    await assertCanViewStudent(institutionId, actor, studentId);
  }

  const pending = await prisma.certificate.findFirst({
    where: {
      institutionId,
      studentId,
      certificateType: input.certificateType,
      status: "REQUESTED",
    },
    select: { id: true },
  });
  if (pending) {
    throw new AppError(
      "A request for this certificate type is already pending",
      409
    );
  }

  const certificate = await prisma.certificate.create({
    data: {
      institutionId,
      studentId,
      certificateType: input.certificateType,
      purpose: input.purpose,
      status: "REQUESTED",
      requestedById: actor.id,
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "certificate.request",
    entityType: "Certificate",
    entityId: certificate.id,
    metadata: { studentId, certificateType: input.certificateType },
    ...meta,
  });

  return certificate;
}

export async function issueCertificate(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  remarks: string | undefined,
  meta: Meta
) {
  const existing = await prisma.certificate.findFirst({
    where: { id, institutionId },
  });
  if (!existing) throw new AppError("Certificate request not found", 404);
  if (existing.status !== "REQUESTED") {
    throw new AppError("Only pending requests can be issued", 422);
  }

  const payload = await buildPayload(
    institutionId,
    existing.studentId,
    existing.certificateType
  );

  const issued = await prisma.$transaction(async (tx) => {
    const certificateNumber = await nextCertificateNumber(
      tx,
      institutionId,
      existing.certificateType
    );
    const finalPayload = {
      ...payload,
      verificationCode: verificationHash(certificateNumber, payload),
    };

    return tx.certificate.update({
      where: { id },
      data: {
        status: "ISSUED",
        certificateNumber,
        issuedById: actor.id,
        issuedAt: new Date(),
        remarks: remarks ?? null,
        payload: finalPayload as Prisma.InputJsonValue,
      },
      include,
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "certificate.issue",
    entityType: "Certificate",
    entityId: id,
    metadata: {
      studentId: existing.studentId,
      certificateNumber: issued.certificateNumber,
    },
    ...meta,
  });

  return issued;
}

export async function rejectCertificate(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  remarks: string,
  meta: Meta
) {
  const existing = await prisma.certificate.findFirst({
    where: { id, institutionId },
    select: { id: true, status: true, studentId: true },
  });
  if (!existing) throw new AppError("Certificate request not found", 404);
  if (existing.status !== "REQUESTED") {
    throw new AppError("Only pending requests can be rejected", 422);
  }

  const rejected = await prisma.certificate.update({
    where: { id },
    data: {
      status: "REJECTED",
      issuedById: actor.id,
      remarks,
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "certificate.reject",
    entityType: "Certificate",
    entityId: id,
    metadata: { studentId: existing.studentId, remarks },
    ...meta,
  });

  return rejected;
}

export async function listCertificates(
  institutionId: string,
  pagination: PaginationParams,
  filters: {
    status?: string;
    certificateType?: string;
    studentId?: string;
    search?: string;
  }
) {
  const where: Prisma.CertificateWhereInput = {
    institutionId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.certificateType
      ? { certificateType: filters.certificateType }
      : {}),
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.search
      ? {
          OR: [
            { certificateNumber: { contains: filters.search, mode: "insensitive" } },
            {
              student: {
                OR: [
                  { firstName: { contains: filters.search, mode: "insensitive" } },
                  { lastName: { contains: filters.search, mode: "insensitive" } },
                  { email: { contains: filters.search, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [items, total, grouped] = await Promise.all([
    prisma.certificate.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.certificate.count({ where }),
    prisma.certificate.groupBy({
      by: ["status"],
      where: { institutionId },
      _count: { _all: true },
    }),
  ]);

  return {
    items,
    total,
    summary: Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all])
    ) as Record<string, number>,
  };
}

export async function listMine(institutionId: string, studentId: string) {
  return prisma.certificate.findMany({
    where: { institutionId, studentId },
    include,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getCertificate(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string
) {
  const certificate = await prisma.certificate.findFirst({
    where: { id, institutionId },
    include,
  });
  if (!certificate) throw new AppError("Certificate not found", 404);

  if (
    certificate.studentId !== actor.id &&
    !actor.permissions.includes("certificates.read")
  ) {
    throw new AppError("You may only view your own certificates", 403);
  }
  return certificate;
}

/**
 * Public verification. Returns only the facts needed to confirm that a
 * presented certificate is genuine — never contact details or academic
 * records beyond what the certificate itself states.
 */
export async function verifyCertificate(certificateNumber: string) {
  const certificate = await prisma.certificate.findFirst({
    where: { certificateNumber, status: "ISSUED" },
    select: {
      certificateNumber: true,
      certificateType: true,
      issuedAt: true,
      payload: true,
      student: { select: { firstName: true, lastName: true } },
      institution: { select: { name: true, slug: true } },
    },
  });

  if (!certificate || !certificate.certificateNumber) {
    return { valid: false as const };
  }

  const payload = (certificate.payload ?? {}) as Record<string, unknown>;
  const { verificationCode, ...facts } = payload;
  const expected = verificationHash(certificate.certificateNumber, facts);

  return {
    valid: expected === verificationCode,
    certificateNumber: certificate.certificateNumber,
    certificateType: certificate.certificateType,
    issuedAt: certificate.issuedAt,
    studentName: `${certificate.student.firstName} ${certificate.student.lastName}`,
    institution: certificate.institution.name,
  };
}
