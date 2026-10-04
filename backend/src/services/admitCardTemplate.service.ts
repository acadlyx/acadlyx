import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { assertExaminationController } from "./workflowAuthority.service";
import { recordAuditLog } from "./audit.service";

export type AdmitCardTemplateConfig = {
  paperSize?: "A4";
  orientation?: "portrait" | "landscape";
  showPhoto?: boolean;
  showQr?: boolean;
  showInstitutionAddress?: boolean;
  showEnrollmentNumber?: boolean;
  showProgram?: boolean;
  showDepartment?: boolean;
  showSemester?: boolean;
  showInstructions?: boolean;
  showSignatures?: boolean;
  showVerificationCode?: boolean;
  accent?: string;
  title?: string;
  subtitle?: string;
  footer?: string;
  instructions?: string;
};

export async function getActiveAdmitCardTemplate(institutionId: string) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT "id", "name", "description", "status", "config", "createdById", "updatedById",
           "createdAt", "updatedAt"
    FROM "admit_card_templates"
    WHERE "institutionId" = ${institutionId} AND "status" = 'ACTIVE'
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function listAdmitCardTemplates(institutionId: string) {
  return prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT "id", "name", "description", "status", "config", "createdById", "updatedById",
           "createdAt", "updatedAt"
    FROM "admit_card_templates"
    WHERE "institutionId" = ${institutionId}
    ORDER BY "updatedAt" DESC, "name" ASC
  `);
}

export async function createAdmitCardTemplate(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { name: string; description?: string; config?: AdmitCardTemplateConfig },
) {
  assertExaminationController(actor);
  const name = input.name.trim();
  if (!name) throw new AppError("Template name is required.", 400);

  const id = randomUUID();
  try {
    await prisma.$executeRaw`
      INSERT INTO "admit_card_templates"
        ("id", "institutionId", "name", "description", "status", "config", "createdById")
      VALUES
        (${id}, ${institutionId}, ${name}, ${input.description ?? null}, 'DRAFT',
         ${JSON.stringify(input.config ?? {})}::jsonb, ${actor.id})
    `;
  } catch (error) {
    throw new AppError("An admit-card template with this name already exists.", 409);
  }

  await recordAuditLog({
    institutionId, userId: actor.id, action: "exam.admit_card_template_created",
    entityType: "AdmitCardTemplate", entityId: id, metadata: { name },
  });

  return getAdmitCardTemplate(institutionId, id);
}

export async function getAdmitCardTemplate(institutionId: string, id: string) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT "id", "name", "description", "status", "config", "createdById", "updatedById",
           "createdAt", "updatedAt"
    FROM "admit_card_templates"
    WHERE "id" = ${id} AND "institutionId" = ${institutionId}
    LIMIT 1
  `);
  if (!rows[0]) throw new AppError("Admit-card template not found.", 404);
  return rows[0];
}

export async function updateAdmitCardTemplate(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: { name?: string; description?: string; status?: "DRAFT" | "ACTIVE" | "INACTIVE"; config?: AdmitCardTemplateConfig },
) {
  assertExaminationController(actor);
  const existing = await getAdmitCardTemplate(institutionId, id);
  if (input.status && !["DRAFT", "ACTIVE", "INACTIVE"].includes(input.status)) {
    throw new AppError("Invalid template status.", 400);
  }

  await prisma.$transaction(async (tx) => {
    if (input.status === "ACTIVE") {
      await tx.$executeRaw`
        UPDATE "admit_card_templates"
        SET "status" = 'INACTIVE', "updatedAt" = CURRENT_TIMESTAMP, "updatedById" = ${actor.id}
        WHERE "institutionId" = ${institutionId} AND "status" = 'ACTIVE' AND "id" <> ${id}
      `;
    }
    await tx.$executeRaw`
    UPDATE "admit_card_templates"
    SET "name" = COALESCE(${input.name?.trim() || null}, "name"),
        "description" = COALESCE(${input.description ?? null}, "description"),
        "status" = COALESCE(${input.status ?? null}, "status"),
        "config" = COALESCE(${input.config ? JSON.stringify(input.config) : null}::jsonb, "config"),
        "updatedById" = ${actor.id},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "institutionId" = ${institutionId}
    `;
  });

  if (input.status === "ACTIVE" && existing.status !== "ACTIVE") {
    await recordAuditLog({
      institutionId, userId: actor.id, action: "exam.admit_card_template_activated",
      entityType: "AdmitCardTemplate", entityId: id, metadata: { name: input.name ?? String(existing.name ?? "") },
    });
  }

  await recordAuditLog({
    institutionId, userId: actor.id, action: "exam.admit_card_template_updated",
    entityType: "AdmitCardTemplate", entityId: id, metadata: { changed: Object.keys(input) },
  });

  return getAdmitCardTemplate(institutionId, id);
}

export async function deleteAdmitCardTemplate(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
) {
  assertExaminationController(actor);
  await getAdmitCardTemplate(institutionId, id);
  await prisma.$executeRaw`
    DELETE FROM "admit_card_templates"
    WHERE "id" = ${id} AND "institutionId" = ${institutionId}
  `;
  await recordAuditLog({
    institutionId, userId: actor.id, action: "exam.admit_card_template_deleted",
    entityType: "AdmitCardTemplate", entityId: id, metadata: {},
  });
  return { deleted: true };
}
