import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../lib/prisma";
import * as site from "../services/siteContent.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";

export const publicContent = asyncHandler(async (req: Request, res) => {
  const institutionId = typeof req.query.institutionId === "string" ? req.query.institutionId : undefined;
  const institutionSlug = typeof req.query.slug === "string" ? req.query.slug : undefined;
  const institution = institutionId ? { id: institutionId } : institutionSlug ? await prisma.institution.findUnique({ where: { slug: institutionSlug }, select: { id: true } }) : null;
  if (!institution) throw new AppError("institutionId or slug is required", 400);
  res.json({ success: true, data: await site.getPublicSiteContent(institution.id) });
});
export const get = asyncHandler(async (req, res) => { res.json({ success: true, data: await site.getSiteContent(requireInstitution(req)) }); });
export const update = asyncHandler(async (req, res) => { res.json({ success: true, data: await site.updateSiteContent(requireInstitution(req), req.user!, req.body) }); });
export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.roles.some((r) => ["SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT", "CMS"].includes(r))) throw new AppError("You are not allowed to upload website media", 403);
  if (!req.file) throw new AppError("Image file is required", 400);
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) throw new AppError("Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.", 503);
  cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret });
  const result = await new Promise<any>((resolve, reject) => { const stream = cloudinary.uploader.upload_stream({ folder: "acadlyx/site" }, (error, value) => error ? reject(error) : resolve(value)); stream.end(req.file!.buffer); });
  res.status(201).json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
});
