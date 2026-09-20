import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

const DEFAULT_SITE_CONTENT = {
  hero: {
    title: "Welcome to our institution",
    subtitle:
      "Empowering students through education, innovation, and opportunity.",
    ctaText: "Explore",
    ctaUrl: "#",
  },
  about: {
    title: "About Us",
    description: "",
  },
  contact: {
    email: "",
    phone: "",
    address: "",
  },
  social: {
    facebook: "",
    instagram: "",
    linkedin: "",
    youtube: "",
    twitter: "",
  },
  branding: {
    logoUrl: "",
    faviconUrl: "",
    primaryColor: "",
    secondaryColor: "",
  },
  announcements: [],
  sections: [],
};

function mergeDefaults(content: unknown) {
  if (
    !content ||
    typeof content !== "object" ||
    Array.isArray(content)
  ) {
    return DEFAULT_SITE_CONTENT;
  }

  return {
    ...DEFAULT_SITE_CONTENT,
    ...(content as Record<string, unknown>),
  };
}

/**
 * Website CMS authorization is capability-based.
 *
 * SUPER_ADMIN always has platform-level authority.
 *
 * All other users must explicitly possess the dedicated `site.manage`
 * permission. The role name itself is intentionally not trusted here.
 *
 * This is important because roles such as INSTITUTION_ADMIN, DIRECTOR,
 * and MANAGEMENT must not automatically receive website CMS access.
 */
function assertCanManageSiteContent(
  actor: AuthenticatedUser
): void {
  const isPlatformAdmin =
    actor.roles.includes("SUPER_ADMIN");

  const hasCmsPermission =
    actor.permissions.includes("site.manage");

  if (!isPlatformAdmin && !hasCmsPermission) {
    throw new AppError(
      "You are not allowed to manage website content",
      403
    );
  }
}

/**
 * Read the institution website content.
 *
 * Reading published website content is intentionally separate from
 * managing/publishing it. Public-facing consumers should use the
 * public site-content endpoint rather than this authenticated management
 * operation.
 */
export async function getSiteContent(
  institutionId: string,
  actor: AuthenticatedUser
) {
  assertCanManageSiteContent(actor);

  if (
    !actor.roles.includes("SUPER_ADMIN") &&
    actor.institutionId !== institutionId
  ) {
    throw new AppError(
      "You are not allowed to access website content for another institution",
      403
    );
  }

  const existing =
    await prisma.siteContent.findUnique({
      where: {
        institutionId,
      },
    });

  if (!existing) {
    return {
      institutionId,
      content: DEFAULT_SITE_CONTENT,
      version: 0,
      publishedAt: null,
      updatedById: null,
    };
  }

  return existing;
}

/**
 * Update and publish website content.
 *
 * Authorization is deliberately based on the dedicated CMS capability,
 * not on broad institutional roles.
 */
export async function updateSiteContent(
  institutionId: string,
  actor: AuthenticatedUser,
  content: unknown
) {
  assertCanManageSiteContent(actor);

  if (
    !actor.roles.includes("SUPER_ADMIN") &&
    actor.institutionId !== institutionId
  ) {
    throw new AppError(
      "You are not allowed to manage website content for another institution",
      403
    );
  }

  const normalized =
    mergeDefaults(content);

  return prisma.siteContent.upsert({
    where: {
      institutionId,
    },
    update: {
      content:
        normalized as any,
      version: {
        increment: 1,
      },
      updatedById: actor.id,
      publishedAt: new Date(),
    },
    create: {
      institutionId,
      content:
        normalized as any,
      updatedById: actor.id,
      publishedAt: new Date(),
    },
  });
}
