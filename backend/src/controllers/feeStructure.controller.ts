import { Request } from "express";

import * as feeStructure from "../services/feeStructure.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";

function actor(req: Request) {
  if (!req.user) {
    throw new AppError(
      "Authentication required",
      401
    );
  }

  return req.user;
}

export const listFeeHeads =
  asyncHandler(async (req, res) => {
    const includeInactive =
      req.query.includeInactive === "true";

    const data =
      await feeStructure.listFeeHeads(
        requireInstitution(req),
        actor(req),
        includeInactive
      );

    res.json({
      success: true,
      data,
    });
  });

export const createFeeHead =
  asyncHandler(async (req, res) => {
    const data =
      await feeStructure.createFeeHead(
        requireInstitution(req),
        actor(req),
        req.body
      );

    res.status(201).json({
      success: true,
      data,
    });
  });

export const updateFeeHead =
  asyncHandler(async (req, res) => {
    const data =
      await feeStructure.updateFeeHead(
        requireInstitution(req),
        actor(req),
        req.params.id,
        req.body
      );

    res.json({
      success: true,
      data,
    });
  });

export const listFeeStructures =
  asyncHandler(async (req, res) => {
    const data =
      await feeStructure.listFeeStructures(
        requireInstitution(req),
        actor(req),
        {
          status:
            typeof req.query.status ===
            "string"
              ? req.query.status as
                  | "DRAFT"
                  | "ACTIVE"
                  | "ARCHIVED"
              : undefined,

          academicYearId:
            typeof req.query
              .academicYearId ===
            "string"
              ? req.query.academicYearId
              : undefined,

          programId:
            typeof req.query.programId ===
            "string"
              ? req.query.programId
              : undefined,

          semesterId:
            typeof req.query.semesterId ===
            "string"
              ? req.query.semesterId
              : undefined,
        }
      );

    res.json({
      success: true,
      data,
    });
  });

export const createFeeStructure =
  asyncHandler(async (req, res) => {
    const data =
      await feeStructure.createFeeStructure(
        requireInstitution(req),
        actor(req),
        req.body
      );

    res.status(201).json({
      success: true,
      data,
    });
  });

export const updateFeeStructure =
  asyncHandler(async (req, res) => {
    const data =
      await feeStructure.updateFeeStructure(
        requireInstitution(req),
        actor(req),
        req.params.id,
        req.body
      );

    res.json({
      success: true,
      data,
    });
  });
