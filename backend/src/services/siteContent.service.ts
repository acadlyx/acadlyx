import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

const DEFAULT_SITE_CONTENT = {
  brand: {
    siteName: "ACADLYX",
    tagline: "Education ERP",
    logoUrl: "/branding/acadlyx-logo.png",
    faviconUrl: "",
  },

  navigation: [
    {
      label: "Platform",
      href: "#platform",
    },
    {
      label: "Capabilities",
      href: "#capabilities",
    },
    {
      label: "Workspaces",
      href: "#workspaces",
    },
  ],

  hero: {
    eyebrow: "EDUCATION ERP & INSTITUTIONAL OPERATIONS",
    title: "One platform for the entire institution.",
    description:
      "ACADLYX connects academic administration, student experience, faculty workflows, institutional operations and intelligence in one secure education ERP.",
    primaryCtaLabel: "Access ACADLYX",
    primaryCtaHref: "/login",
    secondaryCtaLabel: "Explore platform",
    secondaryCtaHref: "#platform",
    dashboardImageUrl: "",
    dashboardCaption:
      "A connected view of institutional operations.",
  },

  sections: {
    statsEyebrow: "THE PLATFORM",
    statsTitle: "Everything important, connected.",
    statsDescription:
      "A unified operational layer for the people, academic structures and workflows that keep an institution moving.",

    stats: [
      {
        label: "Core workspaces",
        value: "07",
      },
      {
        label: "Role-aware access",
        value: "RBAC",
      },
      {
        label: "Institution scope",
        value: "100%",
      },
      {
        label: "Connected modules",
        value: "20+",
      },
    ],

    capabilitiesEyebrow: "CAPABILITIES",
    capabilitiesTitle:
      "ERP functionality without the ERP clutter.",
    capabilitiesDescription:
      "Each capability is designed around a real institutional workflow, with permissions and data boundaries built into the experience.",

    features: [
      {
        eyebrow: "PEOPLE",
        title: "Student & faculty management",
        text:
          "Keep institutional people, profiles, enrollment and academic relationships organized in one system.",
      },
      {
        eyebrow: "ACADEMICS",
        title: "Academic operations",
        text:
          "Connect programs, departments, courses, sections, timetable, assessments and academic records.",
      },
      {
        eyebrow: "ATTENDANCE",
        title: "Attendance intelligence",
        text:
          "Capture attendance and make the information useful to students, faculty and institutional leadership.",
      },
      {
        eyebrow: "EXAMINATIONS",
        title: "Examinations & results",
        text:
          "Manage examination workflows, marks, results and academic outcomes through controlled workspaces.",
      },
      {
        eyebrow: "FINANCE",
        title: "Fees & payments",
        text:
          "Bring invoices, fee structures, payments and student financial records into the same operational platform.",
      },
      {
        eyebrow: "INTELLIGENCE",
        title: "Institutional insights",
        text:
          "Give leadership meaningful operational visibility without exposing information outside the user's scope.",
      },
    ],

    rolesEyebrow: "WORKSPACES",
    rolesTitle:
      "A different experience for every responsibility.",
    rolesDescription:
      "ACADLYX adapts the application around the role, permissions and institutional scope of each user.",

    roles: [
      "Super Admin",
      "Institution Admin",
      "Management",
      "HOD",
      "Faculty",
      "Student",
      "Parent",
    ],

    ctaEyebrow: "ACADLYX",
    ctaTitle:
      "Bring the institution into one connected workspace.",
    ctaDescription:
      "Sign in to continue to the ACADLYX workspace available to your account.",
    ctaLabel: "Sign in to ACADLYX",
    ctaHref: "/login",
  },

  contact: {
    email: "",
    phone: "",
    address: "",
    website: "",
  },

  footer: {
    text:
      "Education ERP & institutional operations platform.",
  },
};

type JsonRecord = Record<string, unknown>;

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function clone<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}

function mergeRecord(
  defaults: JsonRecord,
  incoming: JsonRecord,
): JsonRecord {
  const result: JsonRecord = {
    ...clone(defaults),
  };

  for (const [key, value] of Object.entries(
    incoming,
  )) {
    const defaultValue = result[key];

    if (
      isRecord(defaultValue) &&
      isRecord(value)
    ) {
      result[key] = mergeRecord(
        defaultValue,
        value,
      );
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value;
      continue;
    }

    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function mergeDefaults(
  content: unknown,
) {
  if (!isRecord(content)) {
    return clone(DEFAULT_SITE_CONTENT);
  }

  return mergeRecord(
    DEFAULT_SITE_CONTENT,
    content,
  );
}

function assertCanManageSiteContent(
  actor: AuthenticatedUser,
): void {
  const isPlatformAdmin =
    actor.roles.includes("SUPER_ADMIN");

  const hasCmsPermission =
    actor.permissions.includes("site.manage");

  if (
    !isPlatformAdmin &&
    !hasCmsPermission
  ) {
    throw new AppError(
      "You are not allowed to manage website content",
      403,
    );
  }
}

export async function getPublicSiteContent(
  institutionId: string,
) {
  const existing =
    await prisma.siteContent.findUnique({
      where: {
        institutionId,
      },
      select: {
        institutionId: true,
        content: true,
        version: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

  if (!existing) {
    return {
      institutionId,
      content: DEFAULT_SITE_CONTENT,
      version: 0,
      publishedAt: null,
      updatedAt: null,
    };
  }

  return {
    ...existing,
    content: mergeDefaults(
      existing.content,
    ),
  };
}

export async function getSiteContent(
  institutionId: string,
  actor: AuthenticatedUser,
) {
  assertCanManageSiteContent(actor);

  if (
    !actor.roles.includes("SUPER_ADMIN") &&
    actor.institutionId !== institutionId
  ) {
    throw new AppError(
      "You are not allowed to access website content for another institution",
      403,
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

  return {
    ...existing,
    content: mergeDefaults(
      existing.content,
    ),
  };
}

export async function updateSiteContent(
  institutionId: string,
  actor: AuthenticatedUser,
  content: unknown,
) {
  assertCanManageSiteContent(actor);

  if (
    !actor.roles.includes("SUPER_ADMIN") &&
    actor.institutionId !== institutionId
  ) {
    throw new AppError(
      "You are not allowed to manage website content for another institution",
      403,
    );
  }

  const normalized =
    mergeDefaults(content);

  return prisma.siteContent.upsert({
    where: {
      institutionId,
    },

    update: {
      content: normalized as object,
      version: {
        increment: 1,
      },
      updatedById: actor.id,
      publishedAt: new Date(),
    },

    create: {
      institutionId,
      content: normalized as object,
      updatedById: actor.id,
      publishedAt: new Date(),
    },
  });
}
