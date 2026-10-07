import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";

export const DEFAULT_INSTITUTIONAL_CMS = {
  brand: { acadlyxLogoUrl: "/branding/acadlyx-logo.png", institutionLogoUrl: "", institutionName: "" },
  dashboard: {
    welcome: "Welcome back", overviewTitle: "Institution overview",
    overviewSubtitle: "Your authorized institutional workspace.",
    emptyState: "No data is available for this view yet.", loadingLabel: "Loading workspace",
    saveLabel: "Save changes", navigationLabel: "Workspace navigation",
  },
  workspaces: {} as Record<string, { title?: string; subtitle?: string; welcome?: string; description?: string; emptyState?: string; [key: string]: unknown }>,
  messages: { noticesTitle: "Notices", announcementsTitle: "Announcements", upcomingTitle: "Upcoming", recentActivityTitle: "Recent activity", quickActionsTitle: "Quick actions" },
};

type JsonRecord = Record<string, unknown>;
function isRecord(value: unknown): value is JsonRecord { return typeof value === "object" && value !== null && !Array.isArray(value); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function merge(defaults: JsonRecord, incoming: JsonRecord): JsonRecord {
  const result = clone(defaults);
  for (const [key, value] of Object.entries(incoming)) {
    const base = result[key];
    if (isRecord(base) && isRecord(value)) result[key] = merge(base, value);
    else if (value !== undefined) result[key] = value;
  }
  return result;
}
function normalize(content: unknown) { return merge(DEFAULT_INSTITUTIONAL_CMS, isRecord(content) ? content : {}); }

function assertInstitution(actor: AuthenticatedUser, institutionId: string) {
  if (actor.roles.includes("SUPER_ADMIN")) return;
  if (actor.institutionId !== institutionId) throw new AppError("You are not allowed to manage another institution", 403);
}
function assertManage(actor: AuthenticatedUser) {
  if (!actor.permissions.includes("site.manage")) throw new AppError("Institutional CMS permission is required", 403);
}
function canApprove(actor: AuthenticatedUser) {
  return actor.roles.some(role => ["CHAIRMAN", "DIRECTOR", "MANAGEMENT"].includes(role));
}
function assertApprovalAuthority(actor: AuthenticatedUser) {
  if (!canApprove(actor)) throw new AppError("Institutional CMS approval authority is required", 403);
}

export async function getInstitutionalCms(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  if (!actor.permissions.includes("site.manage") && !canApprove(actor)) throw new AppError("Institutional CMS access is required", 403);
  const existing = await prisma.institutionalCmsContent.findUnique({ where: { institutionId } });
  if (!existing) return { institutionId, content: normalize({}), draftContent: null, version: 0, approvalStatus: "PUBLISHED", publishedAt: null, submittedAt: null, reviewedAt: null, rejectionReason: null };
  return { ...existing, content: normalize(existing.content), draftContent: existing.draftContent ? normalize(existing.draftContent) : null };
}

export async function updateInstitutionalCms(institutionId: string, actor: AuthenticatedUser, content: unknown) {
  assertInstitution(actor, institutionId);
  assertManage(actor);
  const normalized = normalize(content);
  const existing = await prisma.institutionalCmsContent.findUnique({ where: { institutionId } });
  const saved = await prisma.institutionalCmsContent.upsert({
    where: { institutionId },
    update: {
      draftContent: normalized as Prisma.InputJsonObject,
      approvalStatus: existing?.approvalStatus === "SUBMITTED" ? "DRAFT" : (existing?.approvalStatus ?? "DRAFT") === "PUBLISHED" ? "DRAFT" : "DRAFT",
      submittedById: null, submittedAt: null, reviewedById: null, reviewedAt: null, rejectionReason: null,
      version: { increment: 1 }, updatedById: actor.id,
    },
    create: {
      institutionId, content: normalize({}) as Prisma.InputJsonObject, draftContent: normalized as Prisma.InputJsonObject,
      approvalStatus: "DRAFT", version: 1, updatedById: actor.id,
    },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "cms.draft.updated", entityType: "InstitutionalCmsContent", entityId: saved.id, metadata: { approvalStatus: saved.approvalStatus } });
  return { ...saved, content: normalize(saved.content), draftContent: normalize(saved.draftContent ?? normalized) };
}

export async function submitInstitutionalCms(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId); assertManage(actor);
  const existing = await prisma.institutionalCmsContent.findUnique({ where: { institutionId } });
  if (!existing?.draftContent) throw new AppError("Save a CMS draft before submitting it for approval.", 409);
  const updated = await prisma.institutionalCmsContent.update({
    where: { institutionId },
    data: { approvalStatus: "SUBMITTED", submittedById: actor.id, submittedAt: new Date(), rejectionReason: null },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "cms.submitted", entityType: "InstitutionalCmsContent", entityId: updated.id });
  return updated;
}

export async function approveInstitutionalCms(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId); assertApprovalAuthority(actor);
  const existing = await prisma.institutionalCmsContent.findUnique({ where: { institutionId } });
  if (!existing?.draftContent || existing.approvalStatus !== "SUBMITTED") throw new AppError("No submitted CMS change is awaiting approval.", 409);
  const updated = await prisma.institutionalCmsContent.update({
    where: { institutionId },
    data: { content: existing.draftContent as Prisma.InputJsonValue, draftContent: Prisma.JsonNull, approvalStatus: "PUBLISHED", publishedAt: new Date(), reviewedById: actor.id, reviewedAt: new Date(), rejectionReason: null },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "cms.approved", entityType: "InstitutionalCmsContent", entityId: updated.id, metadata: { submittedById: existing.submittedById } });
  return updated;
}

export async function rejectInstitutionalCms(institutionId: string, actor: AuthenticatedUser, reason: string) {
  assertInstitution(actor, institutionId); assertApprovalAuthority(actor);
  const existing = await prisma.institutionalCmsContent.findUnique({ where: { institutionId } });
  if (!existing?.draftContent || existing.approvalStatus !== "SUBMITTED") throw new AppError("No submitted CMS change is awaiting approval.", 409);
  const rejectionReason = reason.trim();
  if (rejectionReason.length < 3) throw new AppError("A rejection reason is required.", 400);
  const updated = await prisma.institutionalCmsContent.update({
    where: { institutionId },
    data: { approvalStatus: "REJECTED", reviewedById: actor.id, reviewedAt: new Date(), rejectionReason },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "cms.rejected", entityType: "InstitutionalCmsContent", entityId: updated.id, metadata: { reason: rejectionReason, submittedById: existing.submittedById } });
  return updated;
}
