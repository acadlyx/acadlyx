import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { assertCanViewStudent, getStudentWhereScope, hasAnyRole } from "./accessScope.service";
import { recordAuditLog } from "./audit.service";

const APPLICATION_TRANSITIONS: Record<string, string[]> = {
  APPLIED: ["SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["INTERVIEW", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["OFFERED", "REJECTED", "WITHDRAWN"],
  OFFERED: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: ["JOINED", "WITHDRAWN"],
  JOINED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

function isPlacementManager(actor: AuthenticatedUser): boolean {
  return actor.permissions.includes("placements.manage");
}

function assertInstitution(actor: AuthenticatedUser, institutionId: string): void {
  if (actor.roles.includes("SUPER_ADMIN")) return;
  if (actor.institutionId !== institutionId) throw new AppError("Institution context mismatch.", 403);
}

export async function listOpportunities(
  institutionId: string,
  actor: AuthenticatedUser,
  options: { search?: string; activeOnly?: boolean } = {},
) {
  assertInstitution(actor, institutionId);
  const now = new Date();
  return prisma.opportunity.findMany({
    where: {
      institutionId,
      ...(options.activeOnly !== false ? { isActive: true } : {}),
      ...(options.search
        ? {
            OR: [
              { title: { contains: options.search, mode: "insensitive" } },
              { organization: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(actor.roles.includes("STUDENT")
        ? {
            OR: [
              { deadline: null },
              { deadline: { gte: now } },
            ],
          }
        : {}),
    },
    include: { targetRole: { select: { id: true, name: true } } },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
  });
}

export async function createOpportunity(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    title: string;
    organization: string;
    description?: string;
    deadline?: string | null;
    targetRoleId?: string | null;
  },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  if (!input.title.trim() || !input.organization.trim()) {
    throw new AppError("Title and organization are required.", 400);
  }
  if (input.deadline && new Date(input.deadline).getTime() <= Date.now()) {
    throw new AppError("Opportunity deadline must be in the future.", 400);
  }
  if (input.targetRoleId) {
    const role = await prisma.targetRole.findFirst({ where: { id: input.targetRoleId, institutionId, isActive: true }, select: { id: true } });
    if (!role) throw new AppError("Target role not found.", 404);
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      institutionId,
      title: input.title.trim(),
      organization: input.organization.trim(),
      description: input.description?.trim() || null,
      deadline: input.deadline ? new Date(input.deadline) : null,
      targetRoleId: input.targetRoleId || null,
    },
    include: { targetRole: { select: { id: true, name: true } } },
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "placements.opportunity.created",
    entityType: "Opportunity",
    entityId: opportunity.id,
    metadata: { title: opportunity.title, organization: opportunity.organization },
  });
  return opportunity;
}

export async function updateOpportunity(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: Partial<{
    title: string;
    organization: string;
    description: string | null;
    deadline: string | null;
    isActive: boolean;
    targetRoleId: string | null;
  }>,
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const existing = await prisma.opportunity.findFirst({ where: { id, institutionId } });
  if (!existing) throw new AppError("Placement opportunity not found.", 404);
  if (input.deadline && new Date(input.deadline).getTime() <= Date.now()) {
    throw new AppError("Opportunity deadline must be in the future.", 400);
  }
  if (input.targetRoleId) {
    const role = await prisma.targetRole.findFirst({
      where: { id: input.targetRoleId, institutionId, isActive: true },
      select: { id: true },
    });
    if (!role) throw new AppError("Target role not found.", 404);
  }
  const opportunity = await prisma.opportunity.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      organization: input.organization?.trim(),
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      deadline: input.deadline === undefined ? undefined : input.deadline ? new Date(input.deadline) : null,
      isActive: input.isActive,
      targetRoleId: input.targetRoleId,
    },
    include: { targetRole: { select: { id: true, name: true } } },
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "placements.opportunity.updated",
    entityType: "Opportunity",
    entityId: id,
    metadata: { changed: Object.keys(input) },
  });
  return opportunity;
}

export async function applyToOpportunity(
  institutionId: string,
  actor: AuthenticatedUser,
  opportunityId: string,
) {
  assertInstitution(actor, institutionId);
  if (!actor.roles.includes("STUDENT") || !actor.permissions.includes("placements.apply")) {
    throw new AppError("Student placement application authority is required.", 403);
  }
  await assertCanViewStudent(institutionId, actor, actor.id);

  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, institutionId, isActive: true },
    select: { id: true, deadline: true },
  });
  if (!opportunity) throw new AppError("Placement opportunity not found.", 404);
  if (opportunity.deadline && opportunity.deadline.getTime() < Date.now()) {
    throw new AppError("The placement application deadline has passed.", 409);
  }

  try {
    const application = await prisma.application.create({
      data: { institutionId, studentId: actor.id, opportunityId },
      include: { opportunity: { select: { id: true, title: true, organization: true } } },
    });
    await recordAuditLog({
      institutionId,
      userId: actor.id,
      action: "placements.application.created",
      entityType: "Application",
      entityId: application.id,
      metadata: { opportunityId },
    });
    return application;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new AppError("You have already applied to this opportunity.", 409);
    }
    throw error;
  }
}

export async function listApplications(
  institutionId: string,
  actor: AuthenticatedUser,
  options: { opportunityId?: string; studentId?: string } = {},
) {
  assertInstitution(actor, institutionId);
  const studentId = actor.roles.includes("STUDENT") ? actor.id : options.studentId;
  if (!actor.roles.includes("STUDENT") && !isPlacementManager(actor)) {
    throw new AppError("Placement application access is not permitted.", 403);
  }
  if (studentId) await assertCanViewStudent(institutionId, actor, studentId);

  return prisma.application.findMany({
    where: {
      institutionId,
      ...(options.opportunityId ? { opportunityId: options.opportunityId } : {}),
      ...(studentId ? { studentId } : {}),
    },
    include: {
      opportunity: { select: { id: true, title: true, organization: true, deadline: true } },
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { appliedAt: "desc" },
  });
}

export async function transitionApplication(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  status: string,
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const application = await prisma.application.findFirst({ where: { id, institutionId } });
  if (!application) throw new AppError("Placement application not found.", 404);
  const next = status.trim().toUpperCase();
  if (!APPLICATION_TRANSITIONS[application.status]?.includes(next)) {
    throw new AppError(`Invalid placement application transition: ${application.status} -> ${next}`, 409);
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { status: next },
    include: { opportunity: { select: { id: true, title: true, organization: true } } },
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "placements.application.status_changed",
    entityType: "Application",
    entityId: id,
    metadata: { from: application.status, to: next, opportunityId: application.opportunityId },
  });
  return updated;
}

export async function placementMetrics(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor) && !actor.permissions.includes("placements.read")) {
    throw new AppError("Placement intelligence access is not permitted.", 403);
  }
  const institutionWide = hasAnyRole(actor, ["SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","MANAGEMENT","REGISTRAR","PLACEMENT"]);
  const studentWhere: Prisma.UserWhereInput = institutionWide ? {} : await getStudentWhereScope(institutionId, actor);
  const applicationWhere: Prisma.ApplicationWhereInput = { institutionId, student: studentWhere };
  const [opportunities, applications, statusRows, organizations, placedStudents] = await Promise.all([
    prisma.opportunity.count({ where: { institutionId, isActive: true } }),
    prisma.application.count({ where: applicationWhere }),
    prisma.application.groupBy({ by: ["status"], where: applicationWhere, _count: { _all: true } }),
    prisma.opportunity.groupBy({ by: ["organization"], where: { institutionId }, _count: { _all: true }, orderBy: { _count: { organization: "desc" } }, take: 10 }),
    prisma.application.findMany({ where: { ...applicationWhere, status: { in: ["OFFERED","ACCEPTED","JOINED"] } }, distinct: ["studentId"], select: { studentId: true } }),
  ]);
  const status = Object.fromEntries(statusRows.map(row => [row.status, row._count._all]));
  const selected = (status.OFFERED ?? 0) + (status.ACCEPTED ?? 0) + (status.JOINED ?? 0);
  return {
    opportunities,
    applications,
    status,
    organizations: organizations.map(row => ({ organization: row.organization, opportunities: row._count._all })),
    placedStudents: placedStudents.length,
    applicationSuccessRate: applications ? Math.round((selected / applications) * 1000) / 10 : 0,
  };
}


export async function listPlacementCompanies(institutionId: string, actor: AuthenticatedUser, search?: string) {
  assertInstitution(actor, institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  return prisma.placementCompany.findMany({
    where: { institutionId, ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) },
    include: { contacts: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}

export async function createPlacementCompany(institutionId: string, actor: AuthenticatedUser, input: {
  name: string; logoUrl?: string; industry?: string; companyType?: string; website?: string; description?: string; headquarters?: string;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Company name is required.", 400);
  const company = await prisma.placementCompany.create({
    data: { institutionId, name, logoUrl: input.logoUrl || null, industry: input.industry || null, companyType: input.companyType || null, website: input.website || null, description: input.description || null, headquarters: input.headquarters || null, createdById: actor.id },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.company.created", entityType: "PlacementCompany", entityId: company.id, metadata: { name } });
  return company;
}

export async function listPlacementDrives(institutionId: string, actor: AuthenticatedUser, options: { status?: string; search?: string } = {}) {
  assertInstitution(actor, institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  return prisma.placementDrive.findMany({
    where: {
      institutionId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.search ? { OR: [{ title: { contains: options.search, mode: "insensitive" } }, { company: { name: { contains: options.search, mode: "insensitive" } } }] } : {}),
      ...(actor.roles.includes("STUDENT") ? { status: { in: ["PUBLISHED", "APPLICATION_OPEN", "APPLICATION_CLOSED", "SHORTLISTING", "TEST", "INTERVIEW", "OFFERED"] } } : {}),
    },
    include: { company: { select: { id: true, name: true, logoUrl: true } }, opening: true },
    orderBy: [{ driveDate: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function createPlacementDrive(institutionId: string, actor: AuthenticatedUser, input: {
  companyId: string; title: string; openingId?: string; campusId?: string; applicationDeadline?: string; driveDate?: string;
  venue?: string; onlineLink?: string; cgpaRequirement?: number; maxBacklogs?: number; vacancies?: number;
  eligiblePrograms?: string[]; eligibleDepartments?: string[]; eligibleBatches?: string[]; eligibleSemesters?: string[]; requiredSkills?: string[];
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const company = await prisma.placementCompany.findFirst({ where: { id: input.companyId, institutionId }, select: { id: true } });
  if (!company) throw new AppError("Company not found in this institution.", 404);
  if (input.openingId && !(await prisma.placementOpening.findFirst({ where: { id: input.openingId, institutionId, companyId: input.companyId }, select: { id: true } }))) {
    throw new AppError("Opening does not belong to the selected company.", 422);
  }
  const drive = await prisma.placementDrive.create({
    data: {
      institutionId, companyId: input.companyId, title: input.title.trim(), openingId: input.openingId || null, campusId: input.campusId || null,
      applicationDeadline: input.applicationDeadline ? new Date(input.applicationDeadline) : null,
      driveDate: input.driveDate ? new Date(input.driveDate) : null, venue: input.venue || null, onlineLink: input.onlineLink || null,
      cgpaRequirement: input.cgpaRequirement, maxBacklogs: input.maxBacklogs, vacancies: input.vacancies,
      eligiblePrograms: input.eligiblePrograms ?? undefined, eligibleDepartments: input.eligibleDepartments ?? undefined,
      eligibleBatches: input.eligibleBatches ?? undefined, eligibleSemesters: input.eligibleSemesters ?? undefined,
      requiredSkills: input.requiredSkills ?? undefined,
    },
    include: { company: true, opening: true },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.drive.created", entityType: "PlacementDrive", entityId: drive.id, metadata: { title: drive.title, companyId: drive.companyId } });
  return drive;
}

const DRIVE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["APPLICATION_OPEN", "CLOSED"],
  APPLICATION_OPEN: ["APPLICATION_CLOSED", "CLOSED"],
  APPLICATION_CLOSED: ["SHORTLISTING", "CLOSED"],
  SHORTLISTING: ["TEST", "INTERVIEW", "CLOSED"],
  TEST: ["INTERVIEW", "OFFERED", "CLOSED"],
  INTERVIEW: ["OFFERED", "CLOSED"],
  OFFERED: ["ACCEPTED", "CLOSED"],
  ACCEPTED: ["JOINED", "CLOSED"],
  JOINED: ["CLOSED"],
  CLOSED: [],
};

export async function transitionPlacementDrive(institutionId: string, actor: AuthenticatedUser, id: string, status: string) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const drive = await prisma.placementDrive.findFirst({ where: { id, institutionId } });
  if (!drive) throw new AppError("Placement drive not found.", 404);
  const next = status.toUpperCase();
  if (!DRIVE_TRANSITIONS[drive.status]?.includes(next)) throw new AppError(`Invalid placement drive transition: ${drive.status} -> ${next}`, 409);
  const updated = await prisma.placementDrive.update({ where: { id }, data: { status: next } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.drive.status_changed", entityType: "PlacementDrive", entityId: id, metadata: { from: drive.status, to: next } });
  return updated;
}

export async function checkDriveEligibility(institutionId: string, actor: AuthenticatedUser, driveId: string, studentId?: string) {
  assertInstitution(actor, institutionId);
  let target = actor.roles.includes("STUDENT") ? actor.id : studentId;
  if (actor.roles.includes("PARENT") && !target) {
    const link = await prisma.parentStudentLink.findFirst({ where: { institutionId, parentId: actor.id }, select: { studentId: true } });
    target = link?.studentId;
  }
  if (!target) throw new AppError("Student scope is required.", 400);
  await assertCanViewStudent(institutionId, actor, target);
  const [drive, enrollment] = await Promise.all([
    prisma.placementDrive.findFirst({ where: { id: driveId, institutionId }, select: { id: true, status: true, applicationDeadline: true, cgpaRequirement: true, maxBacklogs: true, eligiblePrograms: true, eligibleDepartments: true, eligibleBatches: true, eligibleSemesters: true, requiredSkills: true } }),
    prisma.studentEnrollment.findFirst({ where: { institutionId, userId: target, status: "ACTIVE" }, orderBy: { enrolledAt: "desc" }, select: { programId: true, batchId: true, semesterId: true, program: { select: { departmentId: true } } } }),
  ]);
  if (!drive) throw new AppError("Placement drive not found.", 404);
  if (!enrollment) return { eligible: false, reasons: ["No active academic enrollment found."] };
  const reasons: string[] = [];
  const list = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  if (drive.status !== "APPLICATION_OPEN") reasons.push("Applications are not open for this drive.");
  if (drive.applicationDeadline && drive.applicationDeadline.getTime() < Date.now()) reasons.push("The application deadline has passed.");
  if (list(drive.eligiblePrograms).length && !list(drive.eligiblePrograms).includes(enrollment.programId)) reasons.push("Program is not eligible.");
  if (list(drive.eligibleDepartments).length && !list(drive.eligibleDepartments).includes(enrollment.program.departmentId)) reasons.push("Department is not eligible.");
  if (list(drive.eligibleBatches).length && (!enrollment.batchId || !list(drive.eligibleBatches).includes(enrollment.batchId))) reasons.push("Batch is not eligible.");
  if (list(drive.eligibleSemesters).length && (!enrollment.semesterId || !list(drive.eligibleSemesters).includes(enrollment.semesterId))) reasons.push("Semester is not eligible.");
  return { eligible: reasons.length === 0, reasons, studentId: target };
}

export async function applyToDrive(institutionId: string, actor: AuthenticatedUser, driveId: string) {
  assertInstitution(actor, institutionId);
  if (!actor.roles.includes("STUDENT") || !actor.permissions.includes("placements.apply")) throw new AppError("Student placement application authority is required.", 403);
  const eligibility = await checkDriveEligibility(institutionId, actor, driveId);
  if (!eligibility.eligible) throw new AppError(eligibility.reasons.join(" "), 409);
  const drive = await prisma.placementDrive.findFirst({ where: { id: driveId, institutionId }, select: { id: true, openingId: true } });
  if (!drive) throw new AppError("Placement drive not found.", 404);
  let opportunity = await prisma.opportunity.findFirst({ where: { institutionId, title: "Drive:" + drive.id }, select: { id: true } });
  if (!opportunity) {
    const company = await prisma.placementDrive.findFirst({ where: { id: drive.id, institutionId }, select: { company: { select: { name: true } }, title: true, applicationDeadline: true } });
    if (!company) throw new AppError("Placement drive not found.", 404);
    opportunity = await prisma.opportunity.create({
      data: { institutionId, title: "Drive:" + drive.id, organization: company.company.name, description: company.title, deadline: company.applicationDeadline },
      select: { id: true },
    });
  }
  return applyToOpportunity(institutionId, actor, opportunity.id);
}

export async function placementProfile(institutionId: string, actor: AuthenticatedUser, studentId?: string) {
  assertInstitution(actor, institutionId);
  const target = actor.roles.includes("STUDENT") ? actor.id : studentId;
  if (!target) throw new AppError("Student scope is required.", 400);
  await assertCanViewStudent(institutionId, actor, target);
  const [profile, enrollment, skills, certifications, projects, resumes] = await Promise.all([
    prisma.placementProfile.findUnique({ where: { studentId: target } }),
    prisma.studentEnrollment.findFirst({ where: { institutionId, userId: target, status: "ACTIVE" }, orderBy: { enrolledAt: "desc" }, include: { program: { include: { department: true } }, batch: true, semester: true } }),
    prisma.studentSkill.findMany({ where: { institutionId, studentId: target }, include: { skill: true }, orderBy: { updatedAt: "desc" } }),
    prisma.placementCertification.findMany({ where: { institutionId, studentId: target }, orderBy: { createdAt: "desc" } }),
    prisma.placementProject.findMany({ where: { institutionId, studentId: target }, orderBy: { createdAt: "desc" } }),
    prisma.placementResume.findMany({ where: { institutionId, studentId: target }, orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }] }),
  ]);
  return { profile, enrollment, skills, certifications, projects, resumes };
}

export async function updatePlacementProfile(institutionId: string, actor: AuthenticatedUser, input: { portfolioUrl?: string|null; githubUrl?: string|null; linkedInUrl?: string|null; bio?: string|null }) {
  assertInstitution(actor, institutionId);
  if (!actor.roles.includes("STUDENT")) throw new AppError("Only students may edit their placement profile.", 403);
  const profile = await prisma.placementProfile.upsert({
    where: { studentId: actor.id },
    create: { institutionId, studentId: actor.id, portfolioUrl: input.portfolioUrl ?? null, githubUrl: input.githubUrl ?? null, linkedInUrl: input.linkedInUrl ?? null, bio: input.bio ?? null },
    update: { portfolioUrl: input.portfolioUrl, githubUrl: input.githubUrl, linkedInUrl: input.linkedInUrl, bio: input.bio },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.profile.updated", entityType: "PlacementProfile", entityId: profile.id, metadata: { fields: Object.keys(input) } });
  return profile;
}

export async function createPlacementCompanyContact(institutionId: string, actor: AuthenticatedUser, companyId: string, input: { name: string; designation?: string; email?: string; phone?: string; isPrimary?: boolean; notes?: string }) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const company = await prisma.placementCompany.findFirst({ where: { id: companyId, institutionId }, select: { id: true } });
  if (!company) throw new AppError("Company not found in this institution.", 404);
  if (!input.name.trim()) throw new AppError("Contact name is required.", 400);
  if (input.isPrimary) await prisma.placementCompanyContact.updateMany({ where: { institutionId, companyId }, data: { isPrimary: false } });
  const contact = await prisma.placementCompanyContact.create({ data: { institutionId, companyId, name: input.name.trim(), designation: input.designation?.trim() || null, email: input.email?.trim() || null, phone: input.phone?.trim() || null, isPrimary: input.isPrimary ?? false, notes: input.notes?.trim() || null } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.company_contact.created", entityType: "PlacementCompanyContact", entityId: contact.id, metadata: { companyId } });
  return contact;
}

export async function listPlacementOpenings(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  return prisma.placementOpening.findMany({ where: { institutionId }, include: { company: { select: { id: true, name: true } }, drives: { select: { id: true, title: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
}
export async function createPlacementOpening(institutionId: string, actor: AuthenticatedUser, input: {
  companyId: string; role: string; description?: string; employmentType?: string; location?: string;
  totalCtc?: number; fixedCtc?: number; variableCtc?: number; bonus?: number; stipend?: number; currency?: string; packagePeriod?: string;
  requiredSkills?: string[]; eligibility?: Record<string, unknown>; hiringBatchIds?: string[]; deadline?: string; applicationProcess?: string;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  if (!(await prisma.placementCompany.findFirst({ where: { id: input.companyId, institutionId }, select: { id: true } }))) throw new AppError("Company not found in this institution.", 404);
  const opening = await prisma.placementOpening.create({ data: {
    institutionId, companyId: input.companyId, role: input.role.trim(), description: input.description?.trim() || null, employmentType: input.employmentType?.trim() || null,
    location: input.location?.trim() || null, totalCtc: input.totalCtc, fixedCtc: input.fixedCtc, variableCtc: input.variableCtc, bonus: input.bonus, stipend: input.stipend,
    currency: input.currency || "INR", packagePeriod: input.packagePeriod || null, requiredSkills: input.requiredSkills ?? undefined, eligibility: input.eligibility as Prisma.InputJsonValue | undefined,
    hiringBatchIds: input.hiringBatchIds ?? undefined, deadline: input.deadline ? new Date(input.deadline) : null, applicationProcess: input.applicationProcess?.trim() || null,
  }, include: { company: true }});
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.opening.created", entityType: "PlacementOpening", entityId: opening.id, metadata: { companyId: input.companyId, role: input.role }});
  return opening;
}

export async function createPlacementOffer(institutionId: string, actor: AuthenticatedUser, input: {
  applicationId: string; role: string; offerDate: string; joiningDate?: string; totalCtc?: number; fixedCtc?: number; variableCtc?: number; bonus?: number; currency?: string; offerDocumentUrl?: string;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const application = await prisma.application.findFirst({ where: { id: input.applicationId, institutionId }, include: { student: { select: { id: true } }, opportunity: { select: { organization: true } } } });
  if (!application) throw new AppError("Application not found.", 404);
  if (!["INTERVIEW","OFFERED","ACCEPTED"].includes(application.status)) throw new AppError("Application is not in an offerable state.", 409);
  const company = await prisma.placementCompany.findFirst({ where: { institutionId, name: application.opportunity.organization }, select: { id: true } });
  if (!company) throw new AppError("Create the canonical company record before issuing an offer.", 409);
  const offer = await prisma.placementOffer.create({ data: {
    institutionId, studentId: application.student.id, companyId: company.id, applicationId: application.id, role: input.role.trim(),
    offerDate: new Date(input.offerDate), joiningDate: input.joiningDate ? new Date(input.joiningDate) : null, totalCtc: input.totalCtc,
    fixedCtc: input.fixedCtc, variableCtc: input.variableCtc, bonus: input.bonus, currency: input.currency || "INR", offerDocumentUrl: input.offerDocumentUrl || null,
  }});
  await prisma.application.update({ where: { id: application.id }, data: { status: "OFFERED" } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.offer.created", entityType: "PlacementOffer", entityId: offer.id, metadata: { applicationId: application.id, studentId: application.student.id }});
  return offer;
}

export async function transitionPlacementOffer(institutionId: string, actor: AuthenticatedUser, offerId: string, status: string) {
  assertInstitution(actor, institutionId);
  const offer = await prisma.placementOffer.findFirst({ where: { id: offerId, institutionId } });
  if (!offer) throw new AppError("Placement offer not found.", 404);
  const next=status.toUpperCase();
  const allowed: Record<string,string[]>={OFFERED:["ACCEPTED","REJECTED"],ACCEPTED:["JOINING_PENDING","JOINED"],JOINING_PENDING:["JOINED"],REJECTED:[],JOINED:[]};
  if (actor.roles.includes("STUDENT")) {
    if (offer.studentId !== actor.id) throw new AppError("This offer is outside your scope.",403);
    if (!["ACCEPTED","REJECTED"].includes(next) || offer.status !== "OFFERED") throw new AppError("Invalid student offer transition.",409);
  } else {
    if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.",403);
    if (!allowed[offer.status]?.includes(next)) throw new AppError(`Invalid offer transition: ${offer.status} -> ${next}`,409);
  }
  const updated=await prisma.placementOffer.update({ where:{id:offerId}, data:{status:next, acceptanceAt:next==="ACCEPTED"?new Date():offer.acceptanceAt, joiningStatus:next==="JOINING_PENDING"?"PENDING":offer.joiningStatus} });
  await recordAuditLog({institutionId,userId:actor.id,action:"placements.offer.status_changed",entityType:"PlacementOffer",entityId:offerId,metadata:{from:offer.status,to:next}});
  return updated;
}
