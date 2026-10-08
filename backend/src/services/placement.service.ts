import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { assertCanViewStudent, getStudentWhereScope, getAuthorizedDepartmentIds, hasAnyRole } from "./accessScope.service";
import { recordAuditLog } from "./audit.service";

const APPLICATION_TRANSITIONS: Record<string, string[]> = {
  APPLICATION_SUBMITTED: ["SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["TEST", "INTERVIEW", "REJECTED", "WITHDRAWN"],
  TEST: ["INTERVIEW", "SELECTED", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["SELECTED", "REJECTED", "WITHDRAWN"],
  SELECTED: ["OFFERED", "REJECTED"],
  OFFERED: ["ACCEPTED", "REJECTED"],
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

async function assertPlacementEntitlement(institutionId: string): Promise<void> {
  const entitlement = await prisma.tenantFeatureEntitlement.findFirst({
    where: { institutionId, featureKey: "placements" },
    select: { isEnabled: true },
  });
  if (entitlement && !entitlement.isEnabled) {
    throw new AppError("Placement is not enabled for this institution.", 403);
  }
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
  await assertPlacementEntitlement(institutionId);
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
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement application access is not permitted.", 403);
  const studentId = actor.roles.includes("STUDENT") ? actor.id : options.studentId;
  if (studentId) await assertCanViewStudent(institutionId, actor, studentId);
  const scopedStudentWhere = studentId ? { id: studentId } : (await getStudentWhereScope(institutionId, actor));

  return prisma.application.findMany({
    where: {
      institutionId,
      ...(options.opportunityId ? { opportunityId: options.opportunityId } : {}),
      student: scopedStudentWhere,
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
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) {
    throw new AppError("Placement intelligence access is not permitted.", 403);
  }

  const institutionWide = hasAnyRole(actor, ["SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","MANAGEMENT","REGISTRAR","PLACEMENT"]);
  const studentWhere: Prisma.UserWhereInput = institutionWide ? {} : await getStudentWhereScope(institutionId, actor);
  const studentBaseWhere: Prisma.UserWhereInput = {
    ...studentWhere,
    userRoles: { some: { role: { name: "STUDENT" } } },
    studentEnrollments: { some: { institutionId, status: "ACTIVE" } },
  };
  const applicationWhere: Prisma.ApplicationWhereInput = { institutionId, student: studentWhere };
  const offerWhere: Prisma.PlacementOfferWhereInput = { institutionId, student: studentWhere };

  const [
    drives,
    openDrives,
    applications,
    statusRows,
    offers,
    acceptedOffers,
    joinedOffers,
    packageStats,
    companies,
    eligibleStudents,
  ] = await Promise.all([
    prisma.placementDrive.count({ where: { institutionId } }),
    prisma.placementDrive.count({ where: { institutionId, status: { in: ["PUBLISHED","APPLICATION_OPEN","SHORTLISTING","TEST","INTERVIEW"] } } }),
    prisma.application.count({ where: applicationWhere }),
    prisma.application.groupBy({ by: ["status"], where: applicationWhere, _count: { _all: true } }),
    prisma.placementOffer.count({ where: offerWhere }),
    prisma.placementOffer.count({ where: { ...offerWhere, status: "ACCEPTED" } }),
    prisma.placementOffer.count({ where: { ...offerWhere, status: "JOINED" } }),
    prisma.placementOffer.aggregate({ where: offerWhere, _avg: { totalCtc: true }, _max: { totalCtc: true }, _min: { totalCtc: true } }),
    prisma.placementCompany.count({ where: { institutionId } }),
    prisma.user.count({ where: { institutionId, ...studentBaseWhere } }),
  ]);

  const status = Object.fromEntries(statusRows.map((row) => [row.status, row._count._all]));
  const placedStudents = joinedOffers;
  return {
    drives, openDrives, companies, applications, offers, acceptedOffers, joinedOffers, placedStudents,
    eligibleStudents,
    unplacedStudents: Math.max(eligibleStudents - placedStudents, 0),
    status,
    placementRate: eligibleStudents ? Math.round((placedStudents / eligibleStudents) * 1000) / 10 : 0,
    applicationSuccessRate: applications ? Math.round(((status.SELECTED ?? 0) + (status.OFFERED ?? 0) + (status.ACCEPTED ?? 0) + (status.JOINED ?? 0)) / applications * 1000) / 10 : 0,
    offerAcceptanceRate: offers ? Math.round((acceptedOffers / offers) * 1000) / 10 : 0,
    joiningRate: acceptedOffers ? Math.round((joinedOffers / acceptedOffers) * 1000) / 10 : 0,
    averagePackage: packageStats._avg.totalCtc ? Number(packageStats._avg.totalCtc) : 0,
    highestPackage: packageStats._max.totalCtc ? Number(packageStats._max.totalCtc) : 0,
    lowestPackage: packageStats._min.totalCtc ? Number(packageStats._min.totalCtc) : 0,
  };
}

export async function listPlacementCompanies(institutionId: string, actor: AuthenticatedUser, search?: string) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const where = { institutionId, ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}) };
  if (isPlacementManager(actor)) {
    return prisma.placementCompany.findMany({
      where,
      include: { contacts: true, history: true },
      orderBy: { name: "asc" },
      take: 100,
    });
  }
  return prisma.placementCompany.findMany({
    where,
    select: {
      id: true,
      name: true,
      logoUrl: true,
      industry: true,
      companyType: true,
      website: true,
      description: true,
      headquarters: true,
      relationshipStatus: true,
    },
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

export async function listPlacementDrives(institutionId: string, actor: AuthenticatedUser, options: { status?: string; search?: string; page?: number; pageSize?: number } = {}) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const scopedDepartmentIds = hasAnyRole(actor, ["DEAN","HOD","FACULTY","DIRECTOR"]) ? await getAuthorizedDepartmentIds(institutionId, actor) : null;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
  const rows = await prisma.placementDrive.findMany({
    where: {
      institutionId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.search ? { OR: [{ title: { contains: options.search, mode: "insensitive" } }, { company: { name: { contains: options.search, mode: "insensitive" } } }] } : {}),
      ...(roles.includes("STUDENT") ? { status: { in: ["PUBLISHED","APPLICATION_OPEN","APPLICATION_CLOSED","SHORTLISTING","TEST","INTERVIEW","OFFERED"] } } : {}),
    },
    include: { company: { select: { id: true, name: true, logoUrl: true } }, opening: true },
    orderBy: [{ driveDate: "asc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  if (!scopedDepartmentIds) return rows;
  if (!scopedDepartmentIds.length) return [];
  const allowed = new Set(scopedDepartmentIds);
  return rows.filter((row) => {
    const ids = Array.isArray(row.eligibleDepartments)
      ? row.eligibleDepartments.filter((id): id is string => typeof id === "string")
      : [];
    return ids.length === 0 || ids.some((id) => allowed.has(id));
  });
}
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
  await prisma.placementCompanyHistory.upsert({
    where: { institutionId_companyId: { institutionId, companyId: drive.companyId } },
    create: { institutionId, companyId: drive.companyId, driveCount: 1, lastInteractionAt: new Date() },
    update: { driveCount: { increment: 1 }, lastInteractionAt: new Date() },
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
  const [drive, enrollment, academic] = await Promise.all([
    prisma.placementDrive.findFirst({ where: { id: driveId, institutionId }, select: { id: true, status: true, applicationDeadline: true, cgpaRequirement: true, maxBacklogs: true, eligiblePrograms: true, eligibleDepartments: true, eligibleBatches: true, eligibleSemesters: true, requiredSkills: true, academicRequirements: true } }),
    prisma.studentEnrollment.findFirst({ where: { institutionId, userId: target, status: "ACTIVE" }, orderBy: { enrolledAt: "desc" }, select: { programId: true, batchId: true, semesterId: true, program: { select: { departmentId: true } } } }),
    prisma.placementAcademicSnapshot.findFirst({ where: { institutionId, studentId: target } }),
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
  if (drive.cgpaRequirement != null) {
    if (academic?.cgpa == null) reasons.push("Authoritative CGPA is not available for this student.");
    else if (academic.cgpa < drive.cgpaRequirement) reasons.push("CGPA does not meet the drive requirement.");
  }
  if (drive.maxBacklogs != null) {
    if (academic?.backlogCount == null) reasons.push("Authoritative backlog count is not available for this student.");
    else if (academic.backlogCount > drive.maxBacklogs) reasons.push("Backlog count exceeds the drive limit.");
  }
  const academicRules = drive.academicRequirements && typeof drive.academicRequirements === "object" && !Array.isArray(drive.academicRequirements)
    ? drive.academicRequirements as Record<string, unknown>
    : {};
  if (typeof academicRules.academicStatus === "string" && academic?.academicStatus !== academicRules.academicStatus) reasons.push("Academic status is not eligible.");
  if (academicRules.graduationEligible === true && academic?.graduationEligible !== true) reasons.push("Graduation eligibility is not confirmed.");


  const requiredSkillIds = list(drive.requiredSkills);
  if (requiredSkillIds.length) {
    const skillRows = await prisma.studentSkill.findMany({
      where: { institutionId, studentId: target, skillId: { in: requiredSkillIds } },
      select: { skillId: true },
    });
    const owned = new Set(skillRows.map((row) => row.skillId));
    const missingSkills = requiredSkillIds.filter((skillId) => !owned.has(skillId));
    if (missingSkills.length) reasons.push("Required placement skills are missing from the student profile.");
  }

  return { eligible: reasons.length === 0, reasons, studentId: target };
}

export async function applyToDrive(institutionId: string, actor: AuthenticatedUser, driveId: string) {
  assertInstitution(actor, institutionId);
  if (!actor.roles.includes("STUDENT") || !actor.permissions.includes("placements.apply")) {
    throw new AppError("Student placement application authority is required.", 403);
  }

  const eligibility = await checkDriveEligibility(institutionId, actor, driveId);
  if (!eligibility.eligible) throw new AppError(eligibility.reasons.join(" "), 409);

  const drive = await prisma.placementDrive.findFirst({
    where: { id: driveId, institutionId },
    select: { id: true, openingId: true, companyId: true, applicationDeadline: true },
  });
  if (!drive) throw new AppError("Placement drive not found.", 404);

  const existing = await prisma.application.findFirst({
    where: { institutionId, studentId: actor.id, placementDriveId: drive.id },
    select: { id: true },
  });
  if (existing) throw new AppError("You have already applied to this placement drive.", 409);

  let opportunityId: string;
  const legacyOpportunity = await prisma.opportunity.findFirst({
    where: { institutionId, title: "Drive:" + drive.id },
    select: { id: true },
  });

  if (legacyOpportunity) {
    opportunityId = legacyOpportunity.id;
  } else {
    const company = await prisma.placementCompany.findFirst({
      where: { id: drive.companyId, institutionId },
      select: { name: true },
    });
    const driveRecord = await prisma.placementDrive.findUnique({
      where: { id: drive.id },
      select: { title: true },
    });
    if (!company || !driveRecord) throw new AppError("Placement drive not found.", 404);

    const opportunity = await prisma.opportunity.create({
      data: {
        institutionId,
        title: "Drive:" + drive.id,
        organization: company.name,
        description: driveRecord.title,
        deadline: drive.applicationDeadline,
      },
      select: { id: true },
    });
    opportunityId = opportunity.id;
  }

  try {
    const application = await prisma.application.create({
    
      data: {
        institutionId,
        studentId: actor.id,
        opportunityId,
        placementDriveId: drive.id,
        placementOpeningId: drive.openingId,
        status: "APPLICATION_SUBMITTED",
      },
      include: {
        opportunity: { select: { id: true, title: true, organization: true, deadline: true } },
      },
    });
    await recordAuditLog({
      institutionId,
      userId: actor.id,
      action: "placements.application.created",
      entityType: "Application",
      entityId: application.id,
      metadata: { driveId: drive.id, openingId: drive.openingId },
    });
    return application;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("You have already applied to this placement drive.", 409);
    }
    throw error;
  }
}

export async function placementProfile(institutionId: string, actor: AuthenticatedUser, studentId?: string) {
  assertInstitution(actor, institutionId);
  let target = actor.roles.includes("STUDENT") ? actor.id : studentId;
  if (actor.roles.includes("PARENT") && !target) {
    const link = await prisma.parentStudentLink.findFirst({
      where: { institutionId, parentId: actor.id },
      select: { studentId: true },
    });
    target = link?.studentId;
  }
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

export async function listPlacementOffers(institutionId: string, actor: AuthenticatedUser, studentId?: string) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const target = actor.roles.includes("STUDENT") ? actor.id : studentId;
  if (target) await assertCanViewStudent(institutionId, actor, target);
  const studentWhere = target ? { id: target } : await getStudentWhereScope(institutionId, actor);
  return prisma.placementOffer.findMany({
    where: { institutionId, student: studentWhere },
    include: { company: { select: { id: true, name: true, logoUrl: true } } },
    orderBy: { offerDate: "desc" },
    take: 100,
  });
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
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  return prisma.placementOpening.findMany({
    where: {
      institutionId,
      ...(actor.roles.includes("STUDENT")
        ? { drives: { some: { status: { in: ["PUBLISHED", "APPLICATION_OPEN", "APPLICATION_CLOSED", "SHORTLISTING", "TEST", "INTERVIEW", "OFFERED"] } } } }
        : {}),
    },
    include: { company: { select: { id: true, name: true } }, drives: { select: { id: true, title: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
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

export async function verifyPlacementJoining(institutionId: string, actor: AuthenticatedUser, offerId: string, input: { actualJoiningDate?: string; status: "VERIFIED"|"REJECTED"; proofUrl?: string; notes?: string }) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const offer=await prisma.placementOffer.findFirst({where:{id:offerId,institutionId},select:{id:true,studentId:true,joiningDate:true}});
  if(!offer) throw new AppError("Placement offer not found.",404);
  const existingVerification = await prisma.placementJoiningVerification.findUnique({ where: { offerId }, select: { status: true } });
  const verification=await prisma.placementJoiningVerification.upsert({
    where:{offerId},
    create:{institutionId,offerId,studentId:offer.studentId,expectedJoiningDate:offer.joiningDate,actualJoiningDate:input.actualJoiningDate?new Date(input.actualJoiningDate):null,status:input.status,proofUrl:input.proofUrl||null,verifiedById:actor.id,verifiedAt:new Date(),notes:input.notes||null},
    update:{actualJoiningDate:input.actualJoiningDate?new Date(input.actualJoiningDate):undefined,status:input.status,proofUrl:input.proofUrl,verifiedById:actor.id,verifiedAt:new Date(),notes:input.notes},
  });
  if(input.status==="VERIFIED") {
    await prisma.placementOffer.update({where:{id:offerId},data:{status:"JOINED",joiningStatus:"VERIFIED",joiningVerifiedAt:new Date(),joiningVerifiedById:actor.id}});
    const joinedOffer = await prisma.placementOffer.findUnique({ where: { id: offerId }, select: { companyId: true, totalCtc: true } });
    if (joinedOffer && existingVerification?.status !== "VERIFIED") {
      const aggregate = await prisma.placementOffer.aggregate({ where: { institutionId, companyId: joinedOffer.companyId, status: "JOINED" }, _avg: { totalCtc: true }, _max: { totalCtc: true } });
      await prisma.placementCompanyHistory.upsert({
        where: { institutionId_companyId: { institutionId, companyId: joinedOffer.companyId } },
        create: { institutionId, companyId: joinedOffer.companyId, hiredCount: 1, averagePackage: aggregate._avg.totalCtc, highestPackage: aggregate._max.totalCtc, lastInteractionAt: new Date() },
        update: { hiredCount: { increment: 1 }, averagePackage: aggregate._avg.totalCtc, highestPackage: aggregate._max.totalCtc, lastInteractionAt: new Date() },
      });
    }
  }
  await recordAuditLog({institutionId,userId:actor.id,action:"placements.joining.verified",entityType:"PlacementJoiningVerification",entityId:verification.id,metadata:{offerId,status:input.status}});
  return verification;
}


export async function listPlacementInterviews(
  institutionId: string,
  actor: AuthenticatedUser,
  options: { studentId?: string; driveId?: string } = {},
) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const studentWhere = await getStudentWhereScope(institutionId, actor);
  return prisma.placementInterview.findMany({
    where: {
      institutionId,
      ...(options.driveId ? { driveId: options.driveId } : {}),
      ...(actor.roles.includes("STUDENT") ? { participants: { some: { studentId: actor.id } } } : {}),
      ...(options.studentId ? { participants: { some: { studentId: options.studentId } } } : {}),
      ...(!hasAnyRole(actor, ["SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","MANAGEMENT","DIRECTOR","REGISTRAR","DEAN","PLACEMENT","STUDENT"])
        ? { participants: { some: { student: studentWhere } } }
        : {}),
    },
    include: {
      drive: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
      participants: {
        include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
}

export async function createPlacementInterview(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { driveId: string; roundNumber: number; roundType: string; startsAt: string; endsAt?: string; venue?: string; onlineLink?: string; interviewer?: string },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const drive = await prisma.placementDrive.findFirst({ where: { id: input.driveId, institutionId }, select: { id: true } });
  if (!drive) throw new AppError("Placement drive not found.", 404);
  const interview = await prisma.placementInterview.create({
    data: {
      institutionId,
      driveId: input.driveId,
      roundNumber: input.roundNumber,
      roundType: input.roundType.trim(),
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      venue: input.venue?.trim() || null,
      onlineLink: input.onlineLink?.trim() || null,
      interviewer: input.interviewer?.trim() || null,
    },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.interview.created", entityType: "PlacementInterview", entityId: interview.id, metadata: { driveId: input.driveId, roundNumber: input.roundNumber } });
  return interview;
}

export async function addPlacementInterviewParticipant(
  institutionId: string,
  actor: AuthenticatedUser,
  interviewId: string,
  studentId: string,
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  await assertCanViewStudent(institutionId, actor, studentId);
  const interview = await prisma.placementInterview.findFirst({ where: { id: interviewId, institutionId }, select: { id: true } });
  if (!interview) throw new AppError("Placement interview not found.", 404);
  const participant = await prisma.placementInterviewParticipant.create({ data: { interviewId, studentId } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.interview.participant_added", entityType: "PlacementInterviewParticipant", entityId: interviewId + ":" + studentId, metadata: { interviewId, studentId } });
  return participant;
}

export async function updatePlacementInterviewParticipant(
  institutionId: string,
  actor: AuthenticatedUser,
  interviewId: string,
  studentId: string,
  input: { attendanceStatus?: string; resultStatus?: string; feedback?: string | null },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const participant = await prisma.placementInterviewParticipant.findFirst({ where: { interviewId, studentId, interview: { institutionId } } });
  if (!participant) throw new AppError("Interview participant not found.", 404);
  const updated = await prisma.placementInterviewParticipant.update({
    where: { interviewId_studentId: { interviewId, studentId } },
    data: input,
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.interview.participant_updated", entityType: "PlacementInterviewParticipant", entityId: interviewId + ":" + studentId, metadata: input });
  return updated;
}

export async function listPlacementVisits(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  return prisma.placementVisit.findMany({
    where: { institutionId },
    include: { company: { select: { id: true, name: true, logoUrl: true } }, drive: { select: { id: true, title: true, status: true } } },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
}

export async function createPlacementVisit(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { companyId: string; driveId?: string; type: string; startsAt: string; endsAt?: string; venue?: string; purpose?: string; representatives?: unknown; participatingStudentIds?: string[]; notes?: string; followUp?: string },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const company = await prisma.placementCompany.findFirst({ where: { id: input.companyId, institutionId }, select: { id: true } });
  if (!company) throw new AppError("Company not found in this institution.", 404);
  if (input.driveId && !(await prisma.placementDrive.findFirst({ where: { id: input.driveId, institutionId, companyId: input.companyId }, select: { id: true } }))) {
    throw new AppError("Drive does not belong to the selected company.", 422);
  }
  const visit = await prisma.placementVisit.create({
    data: {
      institutionId,
      companyId: input.companyId,
      driveId: input.driveId || null,
      type: input.type.trim(),
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      venue: input.venue?.trim() || null,
      purpose: input.purpose?.trim() || null,
      representatives: input.representatives as Prisma.InputJsonValue | undefined,
      participatingStudentIds: input.participatingStudentIds ?? undefined,
      notes: input.notes?.trim() || null,
      followUp: input.followUp?.trim() || null,
    },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.visit.created", entityType: "PlacementVisit", entityId: visit.id, metadata: { companyId: input.companyId, type: input.type } });
  return visit;
}


export async function listPlacementStudents(institutionId: string, actor: AuthenticatedUser, options: { search?: string; page?: number; pageSize?: number } = {}) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const studentWhere = await getStudentWhereScope(institutionId, actor);
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
  const where: Prisma.UserWhereInput = {
    institutionId,
    ...studentWhere,
    userRoles: { some: { role: { name: "STUDENT" } } },
    ...(options.search ? { OR: [
      { firstName: { contains: options.search, mode: "insensitive" } },
      { lastName: { contains: options.search, mode: "insensitive" } },
      { email: { contains: options.search, mode: "insensitive" } },
      { idNumber: { contains: options.search, mode: "insensitive" } },
    ] } : {}),
  };
  return prisma.user.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, email: true, avatarUrl: true,
      studentEnrollments: {
        where: { institutionId, status: "ACTIVE" },
        orderBy: { enrolledAt: "desc" },
        take: 1,
        select: {
          program: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
          batch: { select: { id: true, name: true } },
          semester: { select: { id: true, name: true } },
        },
      },
      placementProfile: { select: { placementStatus: true, portfolioUrl: true, githubUrl: true, linkedInUrl: true } },
      _count: { select: { placementApplicationsOwned: true, placementOffers: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

async function assertPlacementStudentOwner(institutionId: string, actor: AuthenticatedUser, studentId: string) {
  assertInstitution(actor, institutionId);
  if (!actor.roles.includes("STUDENT") || actor.id !== studentId) {
    throw new AppError("Only the owning student may edit this placement profile data.", 403);
  }
}

export async function upsertPlacementSkill(institutionId: string, actor: AuthenticatedUser, skillId: string, input: { proficiency: number; evidence?: string | null }) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  if (!Number.isInteger(input.proficiency) || input.proficiency < 0 || input.proficiency > 100) throw new AppError("Skill proficiency must be between 0 and 100.", 400);
  const skill = await prisma.skill.findFirst({ where: { id: skillId, institutionId, isActive: true }, select: { id: true } });
  if (!skill) throw new AppError("Skill is not available for this institution.", 404);
  const row = await prisma.studentSkill.upsert({
    where: { studentId_skillId: { studentId: actor.id, skillId } },
    create: { institutionId, studentId: actor.id, skillId, proficiency: input.proficiency, evidence: input.evidence?.trim() || null },
    update: { proficiency: input.proficiency, evidence: input.evidence?.trim() || null },
    include: { skill: true },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.skill.updated", entityType: "StudentSkill", entityId: actor.id + ":" + skillId, metadata: { proficiency: input.proficiency } });
  return row;
}

export async function deletePlacementSkill(institutionId: string, actor: AuthenticatedUser, skillId: string) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  await prisma.studentSkill.deleteMany({ where: { institutionId, studentId: actor.id, skillId } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.skill.deleted", entityType: "StudentSkill", entityId: actor.id + ":" + skillId, metadata: {} });
}

export async function createPlacementCertification(institutionId: string, actor: AuthenticatedUser, input: { name: string; issuer?: string; issuedAt?: string; credentialUrl?: string }) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.placementCertification.create({ data: { institutionId, studentId: actor.id, name: input.name.trim(), issuer: input.issuer?.trim() || null, issuedAt: input.issuedAt ? new Date(input.issuedAt) : null, credentialUrl: input.credentialUrl?.trim() || null } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.certification.created", entityType: "PlacementCertification", entityId: row.id, metadata: {} });
  return row;
}

export async function deletePlacementCertification(institutionId: string, actor: AuthenticatedUser, id: string) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.placementCertification.findFirst({ where: { id, institutionId, studentId: actor.id }, select: { id: true } });
  if (!row) throw new AppError("Certification not found.", 404);
  await prisma.placementCertification.delete({ where: { id } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.certification.deleted", entityType: "PlacementCertification", entityId: id, metadata: {} });
}

export async function createPlacementProject(institutionId: string, actor: AuthenticatedUser, input: { title: string; description?: string; technologies?: string[]; projectUrl?: string }) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.placementProject.create({ data: { institutionId, studentId: actor.id, title: input.title.trim(), description: input.description?.trim() || null, technologies: input.technologies ?? [], projectUrl: input.projectUrl?.trim() || null } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.project.created", entityType: "PlacementProject", entityId: row.id, metadata: {} });
  return row;
}

export async function deletePlacementProject(institutionId: string, actor: AuthenticatedUser, id: string) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.placementProject.findFirst({ where: { id, institutionId, studentId: actor.id }, select: { id: true } });
  if (!row) throw new AppError("Project not found.", 404);
  await prisma.placementProject.delete({ where: { id } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.project.deleted", entityType: "PlacementProject", entityId: id, metadata: {} });
}

export async function createPlacementResume(institutionId: string, actor: AuthenticatedUser, input: { url: string; fileName?: string }) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.$transaction(async (tx) => {
    await tx.placementResume.updateMany({ where: { institutionId, studentId: actor.id }, data: { isCurrent: false } });
    return tx.placementResume.create({ data: { institutionId, studentId: actor.id, url: input.url, fileName: input.fileName?.trim() || null, isCurrent: true } });
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.resume.created", entityType: "PlacementResume", entityId: row.id, metadata: {} });
  return row;
}

export async function listPlacementTests(institutionId: string, actor: AuthenticatedUser, options: { studentId?: string; driveId?: string } = {}) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const target = actor.roles.includes("STUDENT") ? actor.id : options.studentId;
  if (target) await assertCanViewStudent(institutionId, actor, target);
  const studentWhere = target ? { id: target } : await getStudentWhereScope(institutionId, actor);
  return prisma.placementTest.findMany({
    where: {
      institutionId,
      ...(options.driveId ? { driveId: options.driveId } : {}),
      ...(actor.roles.includes("STUDENT") ? { participants: { some: { studentId: actor.id } } } : {}),
      ...(!hasAnyRole(actor, ["SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","MANAGEMENT","REGISTRAR","PLACEMENT"]) ? { participants: { some: { student: studentWhere } } } : {}),
    },
    include: {
      drive: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
      participants: { where: target ? { studentId: target } : undefined, select: { studentId: true, attendanceStatus: true, resultStatus: true, score: true, feedback: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });
}

export async function createPlacementTest(institutionId: string, actor: AuthenticatedUser, input: { driveId: string; title: string; mode?: string; scheduledAt: string; durationMinutes?: number; maxScore?: number; testLink?: string; instructions?: string }) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const drive = await prisma.placementDrive.findFirst({ where: { id: input.driveId, institutionId }, select: { id: true } });
  if (!drive) throw new AppError("Placement drive not found.", 404);
  const row = await prisma.placementTest.create({ data: { institutionId, driveId: input.driveId, title: input.title.trim(), mode: input.mode?.trim() || "ONLINE", scheduledAt: new Date(input.scheduledAt), durationMinutes: input.durationMinutes, maxScore: input.maxScore, testLink: input.testLink?.trim() || null, instructions: input.instructions?.trim() || null } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.test.created", entityType: "PlacementTest", entityId: row.id, metadata: { driveId: input.driveId } });
  return row;
}

export async function addPlacementTestParticipant(institutionId: string, actor: AuthenticatedUser, testId: string, studentId: string) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  await assertCanViewStudent(institutionId, actor, studentId);
  const test = await prisma.placementTest.findFirst({ where: { id: testId, institutionId }, select: { id: true } });
  if (!test) throw new AppError("Placement test not found.", 404);
  return prisma.placementTestParticipant.upsert({
    where: { testId_studentId: { testId, studentId } },
    create: { testId, studentId },
    update: {},
  });
}

export async function updatePlacementTestParticipant(institutionId: string, actor: AuthenticatedUser, testId: string, studentId: string, input: { attendanceStatus?: string; resultStatus?: string; score?: number | null; feedback?: string | null }) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const row = await prisma.placementTestParticipant.findFirst({ where: { testId, studentId, test: { institutionId } } });
  if (!row) throw new AppError("Test participant not found.", 404);
  if (input.score != null && input.score < 0) throw new AppError("Score cannot be negative.", 400);
  const updated = await prisma.placementTestParticipant.update({ where: { testId_studentId: { testId, studentId } }, data: input });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.test.participant_updated", entityType: "PlacementTestParticipant", entityId: testId + ":" + studentId, metadata: input });
  return updated;
}
