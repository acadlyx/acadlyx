import { Request, Response } from "express";

import { AppError } from "../middleware/errorHandler";
import * as portalService from "../services/portal.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";

function actor(req: Request) {
  if (!req.user) {
    throw new AppError(
      "Authentication required",
      401
    );
  }

  return req.user;
}

export const parentChildren =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.getParentChildren(
          requireInstitution(req),
          actor(req)
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );

export const parentDashboard =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.getParentDashboard(
          requireInstitution(req),
          actor(req)
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );

export const studentPortal =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.getStudentPortal(
          requireInstitution(req),
          actor(req),
          req.params.studentId
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );

export const notifications =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const page = Number(
        req.query.page ?? 1
      );

      const limit = Number(
        req.query.limit ?? 25
      );

      const unreadOnly =
        req.query.unreadOnly === "true";

      const data =
        await portalService.listMyNotifications(
          requireInstitution(req),
          actor(req),
          page,
          limit,
          unreadOnly
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );

export const markNotification =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const read =
        req.body?.read !== false;

      const data =
        await portalService.markNotificationRead(
          requireInstitution(req),
          actor(req),
          req.params.id,
          read
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );

export const markAllNotificationsRead =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.markAllNotificationsRead(
          requireInstitution(req),
          actor(req)
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );

export const createNotification =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.createNotification(
          requireInstitution(req),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const createBulkNotifications =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.createBulkNotifications(
          requireInstitution(req),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const myDocuments =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.listMyDocuments(
          requireInstitution(req),
          actor(req)
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );

export const studentDocuments =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.listStudentDocuments(
          requireInstitution(req),
          actor(req),
          req.params.studentId
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );

export const createDocument =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.createDocument(
          requireInstitution(req),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const deleteDocument =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const data =
        await portalService.deleteDocument(
          requireInstitution(req),
          actor(req),
          req.params.id
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );
