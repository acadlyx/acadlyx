import { Prisma } from "@prisma/client";
import {
  Request,
  Response,
} from "express";

import * as campusService from "../services/campus.service";
import {
  recordAuditLog,
} from "../services/audit.service";

import {
  asyncHandler,
} from "../utils/asyncHandler";

import {
  buildPaginationMeta,
  parsePagination,
} from "../utils/pagination";

import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";

import {
  CreateCampusInput,
  UpdateCampusInput,
} from "../validators/campus.validators";

function auditRequestMetadata(
  req: Request
) {
  return {
    ipAddress: req.ip,

    userAgent:
      req.get("user-agent") ||
      undefined,
  };
}

export const list =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(req);

      const pagination =
        parsePagination(req);

      const search =
        (
          req.query.search as
            | string
            | undefined
        ) || undefined;

      const isActive =
        req.query.isActive ===
        undefined
          ? undefined
          : req.query.isActive ===
            "true";

      const {
        items,
        total,
      } =
        await campusService.listCampuses(
          institutionId,
          {
            ...pagination,
            search,
            isActive,
          }
        );

      res.status(200).json({
        success: true,
        data: items,
        meta: buildPaginationMeta(
          total,
          pagination
        ),
      });
    }
  );

export const getById =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(req);

      const campus =
        await campusService.getCampusById(
          institutionId,
          req.params.id
        );

      res.status(200).json({
        success: true,
        data: campus,
      });
    }
  );

export const create =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(req);

      const user =
        requireAuthenticatedUser(req);

      const campus =
        await campusService.createCampus(
          institutionId,
          req.body as CreateCampusInput
        );

      await recordAuditLog({
        institutionId,
        userId: user.id,
        action: "campus.create",
        entityType: "Campus",
        entityId: campus.id,

        metadata: {
          after: campus,
        } as unknown as Prisma.InputJsonValue,

        ...auditRequestMetadata(req),
      });

      res.status(201).json({
        success: true,
        data: campus,
      });
    }
  );

export const update =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(req);

      const user =
        requireAuthenticatedUser(req);

      const before =
        await campusService.getCampusById(
          institutionId,
          req.params.id
        );

      const campus =
        await campusService.updateCampus(
          institutionId,
          req.params.id,
          req.body as UpdateCampusInput
        );

      await recordAuditLog({
        institutionId,
        userId: user.id,
        action: "campus.update",
        entityType: "Campus",
        entityId: campus.id,

        metadata: {
          before,
          after: campus,
        } as unknown as Prisma.InputJsonValue,

        ...auditRequestMetadata(req),
      });

      res.status(200).json({
        success: true,
        data: campus,
      });
    }
  );

export const deactivate =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(req);

      const user =
        requireAuthenticatedUser(req);

      const before =
        await campusService.getCampusById(
          institutionId,
          req.params.id
        );

      const campus =
        await campusService.deactivateCampus(
          institutionId,
          req.params.id
        );

      await recordAuditLog({
        institutionId,
        userId: user.id,
        action: "campus.deactivate",
        entityType: "Campus",
        entityId: campus.id,

        metadata: {
          before,
          after: campus,
        } as unknown as Prisma.InputJsonValue,

        ...auditRequestMetadata(req),
      });

      res.status(200).json({
        success: true,
        data: campus,
      });
    }
  );
