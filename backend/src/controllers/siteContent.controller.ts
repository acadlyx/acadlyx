import { Request, Response } from "express";
import { storePlatformFile } from "../services/fileStorage.service";
import * as site from "../services/siteContent.service";
import { asyncHandler } from "../utils/asyncHandler";
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

  const isPlatformCmsUser =
    req.user.institutionId === null &&
    req.user.roles.some((role) => role === "SUPER_ADMIN" || role === "CMS");

  const hasSiteManagePermission =
    req.user.permissions.includes("site.manage");

  if (!isPlatformCmsUser || !hasSiteManagePermission) {
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

    // Legacy institutionId/slug query parameters are ignored. Public website
    // content is a platform singleton and no longer depends on a tenant.
    const content = await site.getPublicSiteContent();

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

    const content = await site.getSiteContent(req.user!);

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

    const content = req.body?.content ?? req.body;
    const updated = await site.updateSiteContent(req.user!, content);

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
  async (req: Request, res: Response) => {
    assertCanManageSiteContent(req);
    if (!req.file) {
      throw new AppError("Image file is required", 400);
    }

    assertSafeImageUpload(req.file);

    const stored = await storePlatformFile({
      module: "site",
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      ownerId: req.user!.id,
      visibility: "public",
      resourceType: "image",
    });

    res.status(201).json({
      success: true,
      data: {
        id: stored.id,
        url: stored.secureUrl,
        publicId: stored.publicId,
        provider: stored.provider,
      },
    });
  }
);
