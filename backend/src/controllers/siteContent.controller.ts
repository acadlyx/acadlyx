import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import { asyncHandler } from "../middleware/asyncHandler";
import { uploadBuffer } from "../utils/storage";
import {
  updateSiteContent,
} from "../services/siteContent.service";

function assertCanManageSiteMedia(
  req: Request
): void {
  if (!req.user) {
    throw new AppError(
      "Authentication required",
      401
    );
  }

  const isPlatformAdmin =
    req.user.roles.includes("SUPER_ADMIN");

  const hasCmsPermission =
    req.user.permissions.includes("site.manage");

  if (!isPlatformAdmin && !hasCmsPermission) {
    throw new AppError(
      "You are not allowed to upload website media",
      403
    );
  }
}

function getInstitutionId(
  req: Request
): string {
  const requestedInstitutionId =
    typeof req.body?.institutionId ===
    "string"
      ? req.body.institutionId.trim()
      : "";

  if (
    req.user?.roles.includes(
      "SUPER_ADMIN"
    ) &&
    requestedInstitutionId
  ) {
    return requestedInstitutionId;
  }

  if (req.user?.institutionId) {
    return req.user.institutionId;
  }

  throw new AppError(
    "Institution is required",
    400
  );
}

export const upload = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    assertCanManageSiteMedia(req);

    const file = req.file;

    if (!file) {
      throw new AppError(
        "No media file was uploaded",
        400
      );
    }

    const institutionId =
      getInstitutionId(req);

    if (
      !req.user?.roles.includes(
        "SUPER_ADMIN"
      ) &&
      req.user?.institutionId !==
        institutionId
    ) {
      throw new AppError(
        "You are not allowed to upload media for another institution",
        403
      );
    }

    const uploaded =
      await uploadBuffer({
        buffer: file.buffer,
        originalName:
          file.originalname,
        mimeType: file.mimetype,
      });

    res.status(201).json({
      success: true,
      data: {
        url: uploaded.url,
        key: uploaded.key,
        filename:
          file.originalname,
        mimeType:
          file.mimetype,
        size: file.size,
        institutionId,
      },
    });
  }
);

export const update = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    if (!req.user) {
      throw new AppError(
        "Authentication required",
        401
      );
    }

    const institutionId =
      getInstitutionId(req);

    const result =
      await updateSiteContent(
        institutionId,
        req.user,
        req.body?.content ??
          req.body
      );

    res.status(200).json({
      success: true,
      data: result,
    });
  }
);
