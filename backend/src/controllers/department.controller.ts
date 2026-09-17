import {
  Prisma,
} from "@prisma/client";

import {
  Request,
  Response,
} from "express";

import * as departmentService from "../services/department.service";

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
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "../validators/department.validators";

function auditRequestMetadata(
  req: Request
) {
  return {
    ipAddress:
      req.ip,

    userAgent:
      req.get(
        "user-agent"
      ) || undefined,
  };
}

export const list =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const institutionId =
        requireInstitution(
          req
        );

      const pagination =
        parsePagination(
          req
        );

      const search =
        (
          req.query
            .search as
            | string
            | undefined
        ) ||
        undefined;

      const isActive =
        req.query.isActive ===
        undefined
          ? undefined
          : req.query
                .isActive ===
              "true";

      const {
        items,
        total,
      } =
        await departmentService.listDepartments(
          institutionId,
          {
            ...pagination,
            search,
            isActive,
          }
        );

      res
        .status(200)
        .json({
          success: true,

          data:
            items,

          meta:
            buildPaginationMeta(
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
        requireInstitution(
          req
        );

      const department =
        await departmentService.getDepartmentById(
          institutionId,
          req.params.id
        );

      res
        .status(200)
        .json({
          success: true,
          data:
            department,
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
        requireInstitution(
          req
        );

      const user =
        requireAuthenticatedUser(
          req
        );

      const department =
        await departmentService.createDepartment(
          institutionId,
          req.body as CreateDepartmentInput
        );

      await recordAuditLog(
        {
          institutionId,

          userId:
            user.id,

          action:
            "department.create",

          entityType:
            "Department",

          entityId:
            department.id,

          metadata: {
            after:
              department,
          } as unknown as Prisma.InputJsonValue,

          ...auditRequestMetadata(
            req
          ),
        }
      );

      res
        .status(201)
        .json({
          success: true,
          data:
            department,
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
        requireInstitution(
          req
        );

      const user =
        requireAuthenticatedUser(
          req
        );

      const before =
        await departmentService.getDepartmentById(
          institutionId,
          req.params.id
        );

      const department =
        await departmentService.updateDepartment(
          institutionId,
          req.params.id,
          req.body as UpdateDepartmentInput
        );

      await recordAuditLog(
        {
          institutionId,

          userId:
            user.id,

          action:
            "department.update",

          entityType:
            "Department",

          entityId:
            department.id,

          metadata: {
            before,
            after:
              department,
          } as unknown as Prisma.InputJsonValue,

          ...auditRequestMetadata(
            req
          ),
        }
      );

      res
        .status(200)
        .json({
          success: true,
          data:
            department,
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
        requireInstitution(
          req
        );

      const user =
        requireAuthenticatedUser(
          req
        );

      const before =
        await departmentService.getDepartmentById(
          institutionId,
          req.params.id
        );

      const department =
        await departmentService.deactivateDepartment(
          institutionId,
          req.params.id
        );

      await recordAuditLog(
        {
          institutionId,

          userId:
            user.id,

          action:
            "department.deactivate",

          entityType:
            "Department",

          entityId:
            department.id,

          metadata: {
            before,
            after:
              department,
          } as unknown as Prisma.InputJsonValue,

          ...auditRequestMetadata(
            req
          ),
        }
      );

      res
        .status(200)
        .json({
          success: true,
          data:
            department,
        });
    }
  );
