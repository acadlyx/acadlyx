import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { assertCanViewStudent } from "../services/accessScope.service";
import { requireInstitution } from "../utils/requireInstitution";
import {
  deleteFile,
  getFileDelivery,
  storeFile,
  allowedMimeTypesForModule,
} from "../services/fileStorage.service";

const MODULE_PERMISSIONS: Record<string, string[]> = {
  "profile-photos": ["users.update"],

  site: ["site.manage"],
  students: ["students.create", "students.update"],
  faculty: ["users.update"],
  staff: ["users.update"],
  admissions: ["admissions.manage"],
  assignments: ["assignments.create", "assignments.update", "assignments.submit"],
  notices: ["notices.manage"],
  examinations: ["exams.manage", "exams.approve"],
  results: ["results.read", "marks.enter"],
  certificates: ["certificates.issue"],
  documents: ["documents.manage"],
  lms: ["lms.manage", "lms.grade"],
  library: ["library.manage"],
  operations: ["operations.manage"],
  expenses: ["expenses.read", "expenses.manage", "expenses.approve"],
};

const BLOCKED_MIME_TYPES = new Set([
  "application/x-msdownload",
  "application/x-sh",
  "application/x-httpd-php",
  "text/html",
  "text/javascript",
  "application/javascript",
  "image/svg+xml",
]);

function assertModuleAccess(req: Request, module: string, requiredPermission?: string): void {
  if (!req.user) throw new AppError("Authentication required", 401);
  if (req.user.roles.includes("SUPER_ADMIN")) return;

  const permissions = requiredPermission ? [requiredPermission] : MODULE_PERMISSIONS[module];
  if (!permissions) {
    throw new AppError("Unsupported storage module", 400);
  }

  if (!permissions.some((permission) => req.user!.permissions.includes(permission))) {
    throw new AppError("You are not allowed to upload files for this module", 403);
  }
}

function resourceTypeFor(mimeType: string): "image" | "video" | "raw" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "video";
  return "raw";
}

export const upload = async (req: Request, res: Response): Promise<void> => {
  const institutionId = requireInstitution(req);
  const module = typeof req.body?.module === "string" ? req.body.module.trim().toLowerCase() : "";
  assertModuleAccess(req, module, module === "expenses" ? "expenses.manage" : undefined);

  if (!req.file) throw new AppError("File is required", 400);
  if (BLOCKED_MIME_TYPES.has(req.file.mimetype)) {
    throw new AppError("This file type is not allowed", 415);
  }

  const allowed = allowedMimeTypesForModule(module);
  if (!allowed.length) throw new AppError("Unsupported storage module", 400);

  const visibility = req.body?.visibility === "public" ? "public" : "private";
  if (visibility === "public" && !["site"].includes(module)) {
    throw new AppError("Only public website media may use public delivery", 403);
  }

  const stored = await storeFile({
    institutionId,
    module,
    buffer: req.file.buffer,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    ownerId: req.user!.id,
    referenceId: typeof req.body?.referenceId === "string" ? req.body.referenceId : undefined,
    visibility,
    resourceType: resourceTypeFor(req.file.mimetype),
  });

  res.status(201).json({
    success: true,
    data: stored,
  });
};

export const get = async (req: Request, res: Response): Promise<void> => {
  const institutionId = requireInstitution(req);
  const result = await getFileDelivery(req.params.id, institutionId, req.query.download === "true");

  if (!req.user?.roles.includes("SUPER_ADMIN")) {
    const actor = req.user!;
    const modulePermissions = MODULE_PERMISSIONS[result.file.module] ?? ["documents.read"];
    const canRead = modulePermissions.some((permission) => actor.permissions.includes(permission));
    const isOwner = result.file.ownerId === actor.id;
    const publicSiteAsset = result.file.module === "site" && result.file.visibility === "public";
    let canReadReferencedStudentDocument = false;

    // Generic documents.read must not expose another campus/department's
    // private student asset by guessing a FileAsset UUID. Resolve the referenced
    // student and apply the same backend record-scope guard used by the portals.
    if (result.file.module === "documents" && result.file.referenceId) {
      const referencedStudent = await prisma.user.findFirst({
        where: {
          id: result.file.referenceId,
          institutionId,
          userRoles: { some: { role: { name: "STUDENT" } } },
        },
        select: { id: true },
      });
      if (referencedStudent) {
        await assertCanViewStudent(institutionId, actor, referencedStudent.id);
        canReadReferencedStudentDocument = actor.permissions.includes("documents.read");
      }
    }

    if (!publicSiteAsset && !canRead && !isOwner && !canReadReferencedStudentDocument) {
      throw new AppError("You are not allowed to access this file", 403);
    }
  }

  res.json({
    success: true,
    data: {
      id: result.file.id,
      url: result.url,
      module: result.file.module,
      mimeType: result.file.mimeType,
      size: result.file.size,
      originalName: result.file.originalName,
    },
  });
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const institutionId = requireInstitution(req);
  const result = await getFileDelivery(req.params.id, institutionId);
  assertModuleAccess(req, result.file.module, result.file.module === "expenses" ? "expenses.manage" : undefined);
  await deleteFile(req.params.id, institutionId);
  res.json({ success: true, data: { id: req.params.id, deleted: true } });
};
