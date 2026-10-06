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
import { assertDepartmentInScope, getAuthorizedDepartmentIds, isInstitutionWide } from "../services/accessScope.service";

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
      const actor = requireAuthenticatedUser(req);
      const allowedDepartmentIds = isInstitutionWide(actor) ? undefined : await getAuthorizedDepartmentIds(institutionId, actor);

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
            departmentIds: allowedDepartmentIds,
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
      const actor = requireAuthenticatedUser(req);
      await assertDepartmentInScope(institutionId, actor, req.params.id);

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

      if (!isInstitutionWide(user)) throw new Error("Only institution-wide administrators can manage departments");


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

      await assertDepartmentInScope(institutionId, user, req.params.id);


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

      await assertDepartmentInScope(institutionId, user, req.params.id);


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
