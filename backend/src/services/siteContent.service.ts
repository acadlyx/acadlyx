import { getEffectiveWorkspaceRole } from "./accessScope.service";
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

  pages: {
    about: {
      eyebrow: "ABOUT ACADLYX",
      title: "How ACADLYX supports institutional workflows.",
      description: "Coordinate admissions, academic delivery, fees and payments, assessments, learning, library and placements through role-scoped workspaces. Each account sees the data and actions assigned to its responsibility.",
      imageUrl: "",
    },
    team: {
      eyebrow: "OUR TEAM",
      title: "ACADLYX team profiles",
      description: "Profiles appear here only when added and published by an authorized site administrator.",
      members: [],
    },
    partners: {
      eyebrow: "OUR PARTNERS",
      title: "Published partner information",
      description: "Partner information published by the institution.",
      items: [],
    },
    updates: {
      eyebrow: "UPDATES",
      title: "ACADLYX updates",
      description: "News and announcements published by the institution.",
      items: [],
    },
    contact: {
      eyebrow: "CONTACT",
      title: "Contact the ACADLYX team.",
      description: "Use the institution's published contact details to reach the team.",
    },
  },

  navigation: [
    { label: "HOME", href: "/" },
    { label: "ABOUT", href: "/about" },
    { label: "OUR PARTNERS", href: "/partners" },
    { label: "OUR TEAM", href: "/team" },
    { label: "UPDATES", href: "/updates" },
    { label: "CONTACT US", href: "/contact" },
  ],

  hero: {
    eyebrow: "EDUCATION ERP & INSTITUTIONAL OPERATIONS",
    title: "Admissions, academics and finance in one institutional workspace.",
    description:
      "ACADLYX connects enrolment, academic delivery, fees and payments, examinations, learning, library and placements through role-scoped institutional workflows.",
    primaryCtaLabel: "Sign in to ACADLYX",
    primaryCtaHref: "/login",
    secondaryCtaLabel: "About the platform",
    secondaryCtaHref: "/about",
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
        label: "Access model",
        value: "RBAC",
      },
      {
        label: "Tenant scope",
        value: "Isolated",
      },
      {
        label: "Configuration",
        value: "Institutional",
      },
    ],

    capabilitiesEyebrow: "CAPABILITIES",
    capabilitiesTitle:
      "Operational workflows connected across the institution.",
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
      "Open your ACADLYX workspace.",
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

  // Platform-owned, ordered content for /about-acadlyx. This lives in the
  // existing JSON CMS document so editors can publish changes without a code
  // release or a tenant-specific content record.
  productPage: {
    seo: {
      title: "About ACADLYX | Education ERP & Institutional Intelligence",
      description: "Learn how ACADLYX connects academic management, institutional operations and institutional intelligence for colleges and universities.",
    },
    title: "ACADLYX, in context.",
    introduction: "An institutional operating platform for the academic, administrative and decision-making work that needs to stay connected.",
    media: [],
    sections: [
      { id: "vision", visible: true, title: "A clearer operational foundation.", body: "ACADLYX is built for colleges, universities and educational groups that need their people, academic activity and operational information to work together without flattening the responsibilities between them.", imageUrl: "", imageAlt: "", layout: "statement" },
      { id: "problems", visible: true, title: "The work behind the institution.", body: "Admissions, student records, teaching activity, attendance, examinations, finance and communication are connected in practice. When their information is separated, teams spend time rebuilding context instead of acting on it.", imageUrl: "", imageAlt: "", layout: "split" },
      { id: "capabilities", visible: true, title: "Connected capabilities.", body: "The platform supports student information, admissions, academic management, attendance, examinations, fees and finance, faculty and HR, library, learning management, outcome-based education, placements, communication, documentation and institutional analytics.", imageUrl: "", imageAlt: "", layout: "statement" },
      { id: "intelligence", visible: true, title: "Institutional intelligence.", body: "ACADLYX brings reporting and operational visibility closer to the work that creates the underlying information, helping institutional leadership and teams develop a more complete picture of performance and activity.", imageUrl: "", imageAlt: "", layout: "split" },
      { id: "philosophy", visible: true, title: "Designed around responsibility.", body: "The platform is role-aware by design. Its workspaces, access controls and information boundaries reflect the fact that an institution depends on many different responsibilities working together, without every user needing every record.", imageUrl: "", imageAlt: "", layout: "statement" },
    ],
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

function assertCanManageSiteContent(actor: AuthenticatedUser): void {
  const activeRole = getEffectiveWorkspaceRole(actor);
  const hasPlatformCmsRole = actor.roles.some((role) => role === "SUPER_ADMIN" || role === "CMS");
  if (
    actor.institutionId !== null ||
    !hasPlatformCmsRole ||
    !["SUPER_ADMIN", "CMS"].includes(activeRole) ||
    !actor.permissions.includes("site.manage")
  ) {
    throw new AppError("Platform-scoped CMS access is required", 403);
  }
}

function platformContent(existing: { content: unknown; version: number; publishedAt: Date; updatedAt: Date; updatedById: string | null } | null) {
  if (!existing) {
    return {
      content: mergeDefaults(DEFAULT_SITE_CONTENT),
      version: 0,
      publishedAt: null,
      updatedAt: null,
      updatedById: null,
    };
  }
  return { ...existing, content: mergeDefaults(existing.content) };
}

/** Public reads always serve the platform-owned ACADLYX website content. */
export async function getPublicSiteContent() {
  const existing = await prisma.platformSiteContent.findUnique({
    where: { id: "platform" },
    select: { content: true, version: true, publishedAt: true, updatedAt: true, updatedById: true },
  });
  return platformContent(existing);
}

/** Read the singleton public website document from the platform CMS workspace. */
export async function getSiteContent(actor: AuthenticatedUser) {
  assertCanManageSiteContent(actor);
  const existing = await prisma.platformSiteContent.findUnique({
    where: { id: "platform" },
  });
  return platformContent(existing);
}

/** Publish platform website content without requiring a tenant or tenant entitlement. */
export async function updateSiteContent(actor: AuthenticatedUser, content: unknown) {
  assertCanManageSiteContent(actor);
  const normalized = mergeDefaults(content);
  const saved = await prisma.platformSiteContent.upsert({
    where: { id: "platform" },
    update: {
      content: normalized as object,
      version: { increment: 1 },
      updatedById: actor.id,
      publishedAt: new Date(),
    },
    create: {
      id: "platform",
      content: normalized as object,
      updatedById: actor.id,
      publishedAt: new Date(),
    },
  });
  return platformContent(saved);
}
