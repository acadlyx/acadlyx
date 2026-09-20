import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/certificate.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk } from "../utils/http";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  certificateListQuery,
  issueCertificateSchema,
  rejectCertificateSchema,
  requestCertificateSchema,
  verifyParams,
} from "../validators/certificate.validators";

const router = Router();

/**
 * Public verification endpoint — deliberately mounted before
 * `authenticate` so an employer or another institution can confirm a
 * certificate without an ACADLYX account. It returns only the facts
 * printed on the certificate itself.
 */
router.get(
  "/verify/:certificateNumber",
  validateParams(verifyParams),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.verifyCertificate(req.params.certificateNumber))
  )
);

router.use(authenticate, requireFeature("certificates"));

router.get(
  "/mine",
  authorize("certificates.request"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listMine(
        requireInstitution(req),
        requireAuthenticatedUser(req).id
      )
    )
  )
);

router.get(
  "/",
  authorize("certificates.read"),
  validateQuery(certificateListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total, summary } = await service.listCertificates(
      requireInstitution(req),
      pagination,
      {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        certificateType:
          typeof req.query.certificateType === "string"
            ? req.query.certificateType
            : undefined,
        studentId:
          typeof req.query.studentId === "string" ? req.query.studentId : undefined,
        search: searchTerm(req.query.search),
      }
    );
    res.status(200).json({
      success: true,
      data: items,
      summary,
      meta: buildPaginationMeta(total, pagination),
    });
  })
);

router.get(
  "/:id",
  authorize("certificates.request"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getCertificate(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.post(
  "/",
  authorize("certificates.request"),
  validateBody(requestCertificateSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.requestCertificate(
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
  "/:id/issue",
  authorize("certificates.issue"),
  validateParams(idParams),
  validateBody(issueCertificateSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.issueCertificate(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.remarks,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/:id/reject",
  authorize("certificates.issue"),
  validateParams(idParams),
  validateBody(rejectCertificateSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.rejectCertificate(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.remarks,
        auditMeta(req)
      )
    )
  )
);

export default router;
