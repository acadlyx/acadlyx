import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../middleware/errorHandler";
import * as institutionService from "../services/institution.service";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  CreateInstitutionInput,
  UpdateInstitutionInput,
} from "../validators/institution.validators";
import * as entitlementService from "../services/entitlement.service";
import { env } from "../config/env";

function requireSuperAdmin(req: Request): void {
  if (!req.user?.roles.includes("SUPER_ADMIN")) {
    throw new AppError("SUPER_ADMIN access required", 403);
  }
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const pagination = parsePagination(req);

  const search =
    typeof req.query.search === "string"
      ? req.query.search
      : undefined;

  const isActive =
    req.query.isActive === undefined
      ? undefined
      : req.query.isActive === "true";

  const result = await institutionService.listInstitutions({
    ...pagination,
    search,
    isActive,
  });

  res.status(200).json({
    success: true,
    data: result.items,
    meta: buildPaginationMeta(result.total, pagination),
  });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const institution = await institutionService.getInstitutionById(
    req.params.id
  );

  res.status(200).json({
    success: true,
    data: institution,
  });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const institution = await institutionService.createInstitution(
    req.body as CreateInstitutionInput
  );

  res.status(201).json({
    success: true,
    data: institution,
  });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const institution = await institutionService.updateInstitution(
    req.params.id,
    req.body as UpdateInstitutionInput
  );

  res.status(200).json({
    success: true,
    data: institution,
  });
});

export const setActive = asyncHandler(
  async (req: Request, res: Response) => {
    requireSuperAdmin(req);

    const isActive = req.body.isActive === true;

    const institution = await institutionService.setInstitutionActive(
      req.params.id,
      isActive
    );

    res.status(200).json({
      success: true,
      data: institution,
    });
  }
);

export const stats = asyncHandler(
  async (req: Request, res: Response) => {
    requireSuperAdmin(req);

    const data = await institutionService.getPlatformStats();

    res.status(200).json({
      success: true,
      data,
    });
  }
);

export const entitlements = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);
  res.json({ success: true, data: await entitlementService.getTenantEntitlements(req.params.id) });
});

export const updateEntitlements = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  requireSuperAdmin(req);
  const { reason, ...changes } = req.body;
  res.json({ success: true, data: await entitlementService.updateTenantEntitlements({ institutionId: req.params.id, actorId: req.user.id, reason, ...changes }) });
});

/** Upload and immediately bind a tenant logo. Passing logoUrl: "" to the
 * existing PATCH endpoint removes the binding without deleting shared media. */
export const uploadLogo = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);
  if (!req.file) throw new AppError("Logo image is required", 400);
  if (!req.file.mimetype.startsWith("image/")) throw new AppError("Logo must be an image", 400);
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new AppError("Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.", 503);
  }
  cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret });
  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "acadlyx/tenant-logos", resource_type: "image" }, (error, value) => error ? reject(error) : resolve(value));
    stream.end(req.file!.buffer);
  });
  const institution = await institutionService.updateInstitution(req.params.id, { logoUrl: result.secure_url });
  res.status(201).json({ success: true, data: institution });
});
