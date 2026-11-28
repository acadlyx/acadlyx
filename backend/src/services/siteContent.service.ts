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

  seo: {
    title: "ACADLYX | Education ERP for Colleges and Universities",
    description: "ACADLYX connects student information with admissions, academic, examination, finance and institutional workflows in one role-based Education ERP.",
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
    title: "Admissions, academics and finance, connected to the student record.",
    description:
      "ACADLYX connects student information with admissions, academic delivery, attendance, examinations and finance. Each team works with the records and tasks that belong to its responsibility.",
    primaryCtaLabel: "Learn More About ACADLYX",
    primaryCtaHref: "/about-acadlyx",
    secondaryCtaLabel: "",
    secondaryCtaHref: "",
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
      "The work that keeps an institution running.",
    capabilitiesDescription:
      "Admissions, academic delivery, attendance, examinations and finance rely on the same student and institutional records. The workflows below describe where ACADLYX supports that work.",

    features: [
      { eyebrow: "", title: "Admissions and enrolment", text: "Review applications, record admission decisions and carry student information into the academic record." },
      { eyebrow: "", title: "Academic operations", text: "Manage programmes, courses, sections, timetables and the records used by academic departments and faculty." },
      { eyebrow: "", title: "Attendance and examinations", text: "Keep attendance, assessments, examination schedules and results connected to the student’s academic journey." },
      { eyebrow: "", title: "Fees and finance", text: "Coordinate fee structures, collections, concessions and the supporting work of finance teams." },
    ],

    rolesEyebrow: "WORKSPACES",
    rolesTitle:
      "A student record, shared across the right teams.",
    rolesDescription:
      "Students, faculty, academic departments, administration, leadership and finance each work with different parts of the student record. ACADLYX gives each role a separate workspace and limits access to the information and actions their work requires.",

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
    title: "How ACADLYX connects institutional work.",
    introduction: "ACADLYX is an Education ERP for colleges and universities. It connects student records with the academic, administrative and financial work that takes place around them.",
    media: [],
    sections: [
      { id: "student-record", visible: true, title: "The student record.", body: "An applicant record becomes the student profile used by academic departments, faculty, finance and student services. Keeping those records connected reduces duplicate entry and makes each handoff easier to follow.", imageUrl: "", imageAlt: "", layout: "statement" },
      { id: "academic-work", visible: true, title: "Academic work, from programme to result.", body: "Programme structures, course offerings, sections, timetables, attendance, assessments and examination results belong to the same academic record. ACADLYX gives the relevant academic roles a place to manage that work.", imageUrl: "", imageAlt: "", layout: "split" },
      { id: "finance", visible: true, title: "Fees and financial operations.", body: "Fee structures, invoices, collections, concessions, payments and refunds are part of the institution’s student and finance records. Access remains limited to the roles authorised to work with financial information.", imageUrl: "", imageAlt: "", layout: "statement" },
      { id: "workspaces", visible: true, title: "Workspaces shaped by responsibility.", body: "Students, parents, faculty, academic departments, administrators and institutional leadership do not need the same information. Role-based workspaces and permissions separate their tasks while keeping the institution’s records connected.", imageUrl: "", imageAlt: "", layout: "split" },
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


const LEGACY_DEFAULT_FEATURES = [
  { eyebrow: "PEOPLE", title: "Student & faculty management", text: "Keep institutional people, profiles, enrollment and academic relationships organized in one system." },
  { eyebrow: "ACADEMICS", title: "Academic operations", text: "Connect programs, departments, courses, sections, timetable, assessments and academic records." },
  { eyebrow: "ATTENDANCE", title: "Attendance intelligence", text: "Capture attendance and make the information useful to students, faculty and institutional leadership." },
  { eyebrow: "EXAMINATIONS", title: "Examinations & results", text: "Manage examination workflows, marks, results and academic outcomes through controlled workspaces." },
  { eyebrow: "FINANCE", title: "Fees & payments", text: "Bring invoices, fee structures, payments and student financial records into the same operational platform." },
  { eyebrow: "INTELLIGENCE", title: "Institutional insights", text: "Give leadership meaningful operational visibility without exposing information outside the user's scope." },
];

const LEGACY_DEFAULT_PRODUCT_SECTIONS = [
  { id: "vision", title: "A clearer operational foundation.", body: "ACADLYX is built for colleges, universities and educational groups that need their people, academic activity and operational information to work together without flattening the responsibilities between them.", layout: "statement" },
  { id: "problems", title: "The work behind the institution.", body: "Admissions, student records, teaching activity, attendance, examinations, finance and communication are connected in practice. When their information is separated, teams spend time rebuilding context instead of acting on it.", layout: "split" },
  { id: "capabilities", title: "Connected capabilities.", body: "The platform supports student information, admissions, academic management, attendance, examinations, fees and finance, faculty and HR, library, learning management, outcome-based education, placements, communication, documentation and institutional analytics.", layout: "statement" },
  { id: "intelligence", title: "Institutional intelligence.", body: "ACADLYX brings reporting and operational visibility closer to the work that creates the underlying information, helping institutional leadership and teams develop a more complete picture of performance and activity.", layout: "split" },
  { id: "philosophy", title: "Designed around responsibility.", body: "The platform is role-aware by design. Its workspaces, access controls and information boundaries reflect the fact that an institution depends on many different responsibilities working together, without every user needing every record.", layout: "statement" },
];

function migrateLegacyDefaults(content: JsonRecord): JsonRecord {
  const next = clone(content);
  const hero = isRecord(next.hero) ? { ...next.hero } : {};
  const sections = isRecord(next.sections) ? { ...next.sections } : {};
  const productPage = isRecord(next.productPage) ? { ...next.productPage } : {};
  const productSeo = isRecord(productPage.seo) ? { ...productPage.seo } : {};
  const footer = isRecord(next.footer) ? { ...next.footer } : {};

  if (hero.title === "Admissions, academics and finance in one institutional workspace.") {
    hero.title = DEFAULT_SITE_CONTENT.hero.title;
  }
  if (hero.description === "ACADLYX connects enrolment, academic delivery, fees and payments, examinations, learning, library and placements through role-scoped institutional workflows.") {
    hero.description = DEFAULT_SITE_CONTENT.hero.description;
  }
  if (hero.primaryCtaLabel === "Sign in to ACADLYX") {
    hero.primaryCtaLabel = "Learn More About ACADLYX";
  }
  if (hero.primaryCtaHref === "/login") {
    hero.primaryCtaHref = "/about-acadlyx";
  }
  if (hero.secondaryCtaLabel === "About the platform") {
    hero.secondaryCtaLabel = "";
  }
  if (hero.secondaryCtaHref === "/about") {
    hero.secondaryCtaHref = "";
  }

  if (sections.capabilitiesTitle === "Operational workflows connected across the institution.") {
    sections.capabilitiesTitle = DEFAULT_SITE_CONTENT.sections.capabilitiesTitle;
  }
  if (sections.capabilitiesDescription === "Each capability is designed around a real institutional workflow, with permissions and data boundaries built into the experience.") {
    sections.capabilitiesDescription = DEFAULT_SITE_CONTENT.sections.capabilitiesDescription;
  }
  if (
    Array.isArray(sections.features) &&
    sections.features.length === LEGACY_DEFAULT_FEATURES.length &&
    sections.features.every((value, index) => {
      const item = value;
      const legacy = LEGACY_DEFAULT_FEATURES[index];
      return isRecord(item) &&
        item.eyebrow === legacy.eyebrow &&
        item.title === legacy.title &&
        item.text === legacy.text;
    })
  ) {
    sections.features = clone(DEFAULT_SITE_CONTENT.sections.features);
  }
  if (sections.rolesTitle === "A different experience for every responsibility.") {
    sections.rolesTitle = DEFAULT_SITE_CONTENT.sections.rolesTitle;
  }
  if (sections.rolesDescription === "ACADLYX adapts the application around the role, permissions and institutional scope of each user.") {
    sections.rolesDescription = DEFAULT_SITE_CONTENT.sections.rolesDescription;
  }
  if (sections.rolesTitle === "One institution, distinct responsibilities.") {
    sections.rolesTitle = DEFAULT_SITE_CONTENT.sections.rolesTitle;
  }
  if (sections.rolesDescription === "Students, faculty, academic departments, administration, leadership and finance teams work from different responsibilities. ACADLYX organises their workspaces around those roles and limits access to the information and actions each role requires.") {
    sections.rolesDescription = DEFAULT_SITE_CONTENT.sections.rolesDescription;
  }

  if (productPage.title === "ACADLYX, in context.") {
    productPage.title = DEFAULT_SITE_CONTENT.productPage.title;
  }
  if (productPage.introduction === "An institutional operating platform for the academic, administrative and decision-making work that needs to stay connected.") {
    productPage.introduction = DEFAULT_SITE_CONTENT.productPage.introduction;
  }
  if (
    Array.isArray(productPage.sections) &&
    productPage.sections.length === LEGACY_DEFAULT_PRODUCT_SECTIONS.length &&
    productPage.sections.every((value, index) => {
      const item = value;
      const legacy = LEGACY_DEFAULT_PRODUCT_SECTIONS[index];
      return isRecord(item) &&
        item.id === legacy.id &&
        item.title === legacy.title &&
        item.body === legacy.body &&
        item.layout === legacy.layout &&
        item.visible === true &&
        (!item.imageUrl || item.imageUrl === "") &&
        (!item.imageAlt || item.imageAlt === "");
    })
  ) {
    productPage.sections = clone(DEFAULT_SITE_CONTENT.productPage.sections);
  }
  if (productSeo.title === "About ACADLYX | Education ERP & Institutional Intelligence") {
    productSeo.title = DEFAULT_SITE_CONTENT.productPage.seo.title;
  }
  if (productSeo.description === "Learn how ACADLYX connects academic management, institutional operations and institutional intelligence for colleges and universities.") {
    productSeo.description = DEFAULT_SITE_CONTENT.productPage.seo.description;
  }

  if (footer.text === "Education ERP & institutional operations platform.") {
    footer.text = DEFAULT_SITE_CONTENT.footer.text;
  }

  next.hero = hero;
  next.sections = sections;
  next.productPage = { ...productPage, seo: productSeo };
  next.footer = footer;
  return next;
}

function mergeDefaults(
  content: unknown,
) {
  if (!isRecord(content)) {
    return clone(DEFAULT_SITE_CONTENT);
  }

  return mergeRecord(
    DEFAULT_SITE_CONTENT,
    migrateLegacyDefaults(content),
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
