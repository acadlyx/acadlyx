import { Request, Response } from "express";

import * as studentService from "../services/studentAdmin.service";
import { asyncHandler } from "../utils/asyncHandler";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import {
  buildPaginationMeta,
  parsePagination,
} from "../utils/pagination";
import {
  CreateStudentInput,
  EnrollStudentInput,
  UpdateStudentInput,
} from "../validators/studentAdmin.validators";

function requireUser(req: Request) {
  return requireAuthenticatedUser(req);
}

/**
 * GET /api/v1/students
 * Institution-admin/student-read view of all student master records.
 */
export const list = asyncHandler(
  async (req: Request, res: Response) => {
    const institutionId = requireInstitution(req);
    const actor = requireUser(req);
    const pagination = parsePagination(req);

    const result =
      await studentService.listStudents(
        institutionId,
        actor,
        {
          page: pagination.page,
          pageSize: pagination.pageSize,
          search:
            typeof req.query.search === "string"
              ? req.query.search
              : undefined,
          status:
            typeof req.query.status === "string"
              ? req.query.status
              : undefined,
          academicYearId:
            typeof req.query.academicYearId === "string"
              ? req.query.academicYearId
              : undefined,
          programId:
            typeof req.query.programId === "string"
              ? req.query.programId
              : undefined,
          semesterId:
            typeof req.query.semesterId === "string"
              ? req.query.semesterId
              : undefined,
          sectionId:
            typeof req.query.sectionId === "string"
              ? req.query.sectionId
              : undefined,
        }
      );

    res.status(200).json({
      success: true,
      data: result.items,
      meta: buildPaginationMeta(
        result.total,
        pagination
      ),
    });
  }
);

/**
 * GET /api/v1/students/:id
 */
export const getById = asyncHandler(
  async (req: Request, res: Response) => {
    const institutionId = requireInstitution(req);
    const actor = requireUser(req);

    const student =
      await studentService.getStudent(
        institutionId,
        req.params.id,
        actor
      );

    res.status(200).json({
      success: true,
      data: student,
    });
  }
);

/**
 * POST /api/v1/students
 *
 * Creates the login account, STUDENT role binding,
 * student master profile and first enrollment atomically.
 */
export const create = asyncHandler(
  async (req: Request, res: Response) => {
    const institutionId = requireInstitution(req);
    const actor = requireUser(req);

    const student =
      await studentService.createStudent(
        institutionId,
        req.body as CreateStudentInput,
        actor
      );

    res.status(201).json({
      success: true,
      data: student,
    });
  }
);

/**
 * PATCH /api/v1/students/:id
 */
export const update = asyncHandler(
  async (req: Request, res: Response) => {
    const institutionId = requireInstitution(req);
    const actor = requireUser(req);

    const student =
      await studentService.updateStudent(
        institutionId,
        req.params.id,
        req.body as UpdateStudentInput,
        actor
      );

    res.status(200).json({
      success: true,
      data: student,
    });
  }
);

/**
 * POST /api/v1/students/:id/enrollments
 *
 * Adds a new academic-year enrollment, or updates the
 * existing enrollment for that student/year. Historical
 * years remain intact because uniqueness is per user/year.
 */
export const enroll = asyncHandler(
  async (req: Request, res: Response) => {
    const institutionId = requireInstitution(req);
    const actor = requireUser(req);

    const enrollment =
      await studentService.enrollStudent(
        institutionId,
        req.params.id,
        req.body as EnrollStudentInput,
        actor
      );

    res.status(201).json({
      success: true,
      data: enrollment,
    });
  }
);

/**
 * GET /api/v1/students/:id/enrollments
 */
export const enrollments = asyncHandler(
  async (req: Request, res: Response) => {
    const institutionId = requireInstitution(req);
    const actor = requireUser(req);

    const items =
      await studentService.listStudentEnrollments(
        institutionId,
        req.params.id,
        actor
      );

    res.status(200).json({
      success: true,
      data: items,
    });
  }
);
