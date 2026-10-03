import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

export const DEFAULT_INSTITUTIONAL_CMS = {
  brand: {
    acadlyxLogoUrl: "/branding/acadlyx-logo.png",
    institutionLogoUrl: "",
    institutionName: "",
  },
  dashboard: {
    welcome: "Welcome back",
    overviewTitle: "Institution overview",
    overviewSubtitle: "Your authorized institutional workspace.",
    emptyState: "No data is available for this view yet.",
    loadingLabel: "Loading workspace",
    saveLabel: "Save changes",
    navigationLabel: "Workspace navigation",
  },
  workspaces: {} as Record<string, {
    title?: string;
    subtitle?: string;
    welcome?: string;
    description?: string;
    emptyState?: string;
    [key: string]: unknown;
  }>,
  messages: {
    noticesTitle: "Notices",
    announcementsTitle: "Announcements",
    upcomingTitle: "Upcoming",
    recentActivityTitle: "Recent activity",
    quickActionsTitle: "Quick actions",
  },
};

type JsonRecord = Record<string, unknown>;
function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function merge(defaults: JsonRecord, incoming: JsonRecord): JsonRecord {
  const result = clone(defaults);
  for (const [key, value] of Object.entries(incoming)) {
    const base = result[key];
    if (isRecord(base) && isRecord(value)) result[key] = merge(base, value);
    else if (value !== undefined) result[key] = value;
  }
  return result;
}
function normalize(content: unknown) {
  return merge(DEFAULT_INSTITUTIONAL_CMS, isRecord(content) ? content : {});
}
function assertAccess(actor: AuthenticatedUser, institutionId: string) {
  if (actor.roles.includes("SUPER_ADMIN")) return;
  if (actor.institutionId !== institutionId) {
    throw new AppError("You are not allowed to manage another institution", 403);
  }
  if (!actor.permissions.includes("site.manage")) {
    throw new AppError("Institutional CMS permission is required", 403);
  }
}

export async function getInstitutionalCms(institutionId: string, actor: AuthenticatedUser) {
  assertAccess(actor, institutionId);
  const existing = await prisma.institutionalCmsContent.findUnique({ where: { institutionId } });
  return existing
    ? { ...existing, content: normalize(existing.content) }
    : { institutionId, content: normalize({}), version: 0, publishedAt: null, updatedById: null };
}

export async function updateInstitutionalCms(
  institutionId: string,
  actor: AuthenticatedUser,
  content: unknown,
) {
  assertAccess(actor, institutionId);
  const normalized = normalize(content);
  return prisma.institutionalCmsContent.upsert({
    where: { institutionId },
    update: {
      content: normalized as object,
      version: { increment: 1 },
      publishedAt: new Date(),
      updatedById: actor.id,
    },
    create: {
      institutionId,
      content: normalized as object,
      publishedAt: new Date(),
      updatedById: actor.id,
    },
  });
}
