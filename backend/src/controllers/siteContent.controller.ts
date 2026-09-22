import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../lib/prisma";
import * as site from "../services/siteContent.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";
import { assertSafeImageUpload } from "../utils/imageUpload";

/**
 * Verify that the current authenticated user has the dedicated
 * website CMS capability.
 *
 * SUPER_ADMIN always has access.
 *
 * Other roles must explicitly have `site.manage`.
 */
function assertCanManageSiteContent(
  req: Request
): void {
  if (!req.user) {
    throw new AppError(
      "Authentication is required",
      401
    );
  }

  const isSuperAdmin =
    req.user.roles.includes("SUPER_ADMIN");

  const hasSiteManagePermission =
    req.user.permissions.includes("site.manage");

  if (
    !isSuperAdmin &&
    !hasSiteManagePermission
  ) {
    throw new AppError(
      "You are not allowed to manage website content",
      403
    );
  }
}

/**
 * Public website content endpoint.
 *
 * This endpoint does not require authentication.
 *
 * It accepts either:
 *
 * ?institutionId=<id>
 *
 * or:
 *
 * ?slug=<institution-slug>
 *
 * Only the institution identifier and published website content
 * are returned.
 */
export const publicContent = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const institutionId =
      typeof req.query.institutionId === "string"
        ? req.query.institutionId
        : undefined;

    const institutionSlug =
      typeof req.query.slug === "string"
        ? req.query.slug
        : undefined;

    if (
      !institutionId &&
      !institutionSlug
    ) {
      throw new AppError(
        "institutionId or slug is required",
        400
      );
    }

    const institution =
      institutionId
        ? await prisma.institution.findUnique({
            where: {
              id: institutionId,
            },
            select: {
              id: true,
            },
          })
        : await prisma.institution.findUnique({
            where: {
              slug: institutionSlug!,
            },
            select: {
              id: true,
            },
          });

    if (!institution) {
      throw new AppError(
        "Institution not found",
        404
      );
    }

    const content =
      await site.getPublicSiteContent(
        institution.id
      );

    res.json({
      success: true,
      data: content,
    });
  }
);

/**
 * Authenticated CMS read endpoint.
 */
export const get = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    assertCanManageSiteContent(req);

    const institutionId =
      requireInstitution(req);

    const content =
      await site.getSiteContent(
        institutionId,
        req.user!
      );

    res.json({
      success: true,
      data: content,
    });
  }
);

/**
 * Authenticated CMS update/publish endpoint.
 */
export const update = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    assertCanManageSiteContent(req);

    const institutionId =
      requireInstitution(req);

    const content =
      req.body?.content ??
      req.body;

    const updated =
      await site.updateSiteContent(
        institutionId,
        req.user!,
        content
      );

    res.json({
      success: true,
      data: updated,
    });
  }
);

/**
 * Upload a CMS image to Cloudinary.
 *
 * Only users with the dedicated CMS capability may upload.
 */
export const upload = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    assertCanManageSiteContent(req);

    if (!req.file) {
      throw new AppError(
        "Image file is required",
        400
      );
    }

    assertSafeImageUpload(
      req.file
    );

    if (
      !env.cloudinaryCloudName ||
      !env.cloudinaryApiKey ||
      !env.cloudinaryApiSecret
    ) {
      throw new AppError(
        "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
        503
      );
    }

    cloudinary.config({
      cloud_name:
        env.cloudinaryCloudName,
      api_key:
        env.cloudinaryApiKey,
      api_secret:
        env.cloudinaryApiSecret,
    });

    const result =
      await new Promise<any>(
        (
          resolve,
          reject
        ) => {
          const stream =
            cloudinary.uploader.upload_stream(
              {
                folder:
                  "acadlyx/site",
              },
              (
                error,
                value
              ) => {
                if (error) {
                  reject(error);
                  return;
                }

                resolve(value);
              }
            );

          stream.end(
            req.file!.buffer
          );
        }
      );

    res.status(201).json({
      success: true,
      data: {
        url:
          result.secure_url,
        publicId:
          result.public_id,
      },
    });
  }
);
