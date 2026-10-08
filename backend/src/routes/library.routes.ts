import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize, authorizeWorkflow } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/library.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk } from "../utils/http";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { z } from "zod";
import { idParams, pageQuery } from "../validators/common";
import {
  bookListQuery,
  circulationListQuery,
  createBookSchema,
  issueBookSchema,
  reserveBookSchema,
  returnBookSchema,
  updateBookSchema,
  fineWaiverRequestSchema,
  fineWaiverApprovalSchema,
} from "../validators/library.validators";

const router = Router();

router.use(authenticate, requireFeature("library"));

router.get(
  "/summary",
  authorize("library.read"),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.getLibrarySummary(requireInstitution(req)))
  )
);

router.get(
  "/books",
  authorize("library.read"),
  validateQuery(bookListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total, categories } = await service.listBooks(
      requireInstitution(req),
      pagination,
      {
        search: searchTerm(req.query.search),
        category:
          typeof req.query.category === "string" ? req.query.category : undefined,
        availableOnly: req.query.availableOnly === "true",
      }
    );
    res.status(200).json({
      success: true,
      data: items,
      categories,
      meta: buildPaginationMeta(total, pagination),
    });
  })
);

router.get(
  "/books/:id",
  authorize("library.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.getBook(requireInstitution(req), req.params.id))
  )
);

router.post(
  "/books",
  authorizeWorkflow("library.manage"),
  validateBody(createBookSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createBook(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.patch(
  "/books/:id",
  authorizeWorkflow("library.manage"),
  validateParams(idParams),
  validateBody(updateBookSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateBook(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.get(
  "/loans/mine",
  authorizeWorkflow("library.borrow"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listMyLoans(
        requireInstitution(req),
        requireAuthenticatedUser(req)
      )
    )
  )
);

router.get(
  "/loans",
  authorizeWorkflow("library.manage"),
  validateQuery(circulationListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total, outstandingFines } = await service.listCirculation(
      requireInstitution(req),
      pagination,
      {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        borrowerId:
          typeof req.query.borrowerId === "string" ? req.query.borrowerId : undefined,
        bookId: typeof req.query.bookId === "string" ? req.query.bookId : undefined,
      }
    );
    res.status(200).json({
      success: true,
      data: items,
      outstandingFines,
      meta: buildPaginationMeta(total, pagination),
    });
  })
);

router.post(
  "/loans",
  authorizeWorkflow("library.manage"),
  validateBody(issueBookSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.issueBook(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.post(
  "/loans/:id/impose-late-fine",
  authorizeWorkflow("library.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    sendOk(
      res,
      await service.imposeLateReturnFine(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    );
  })
);

router.post(
  "/loans/:id/return",
  authorizeWorkflow("library.manage"),
  validateParams(idParams),
  validateBody(returnBookSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.returnBook(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/reservations",
  authorizeWorkflow("library.borrow"),
  validateBody(reserveBookSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.reserveBook(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body.bookId,
        req.body.borrowerId,
        auditMeta(req)
      ),
      201
    )
  )
);

router.post(
  "/reservations/:id/cancel",
  authorizeWorkflow("library.borrow"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.cancelReservation(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

router.get(
  "/fines",
  authorize("library.read"),
  validateQuery(z.object(pageQuery)),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const result = await service.listFines(requireInstitution(req), requireAuthenticatedUser(req), pagination);
    res.status(200).json({ success: true, data: result.items, meta: buildPaginationMeta(result.total, pagination) });
  })
);

router.post(
  "/fines/:id/waiver-request",
  authorizeWorkflow("library.fines.waive.request"),
  validateParams(idParams),
  validateBody(fineWaiverRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await service.requestFineWaiver(
      requireInstitution(req), requireAuthenticatedUser(req), req.params.id,
      req.body.reason, req.body.amount, auditMeta(req)
    );
    sendOk(res, result);
  })
);

router.post(
  "/fines/:id/waiver-approve",
  authorizeWorkflow("library.fines.waive.approve"),
  validateParams(idParams),
  validateBody(fineWaiverApprovalSchema),
  asyncHandler(async (req, res) => {
    const result = await service.approveFineWaiver(
      requireInstitution(req), requireAuthenticatedUser(req), req.params.id,
      Number(req.body.amount), req.body.reason, auditMeta(req)
    );
    sendOk(res, result);
  })
);

export default router;
