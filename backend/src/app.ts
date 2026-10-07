import cors from "cors";
import express, {
  Application,
} from "express";
import helmet from "helmet";
import morgan from "morgan";

import {
  env,
  isProduction,
} from "./config/env";

import {
  errorHandler,
} from "./middleware/errorHandler";

import {
  notFound,
} from "./middleware/notFound";

import {
  requestContext,
} from "./middleware/requestContext";

import { mutationAudit } from "./middleware/mutationAudit";
import { idempotency } from "./middleware/idempotency";

import academicYearRoutes from "./routes/academicYear.routes";
import admissionRoutes from "./routes/admission.routes";
import assignmentRoutes from "./routes/assignment.routes";
import attendanceSessionRoutes from "./routes/attendanceSession.routes";
import authRoutes from "./routes/auth.routes";
import calendarRoutes from "./routes/calendar.routes";
import batchRoutes from "./routes/batch.routes";
import campusRoutes from "./routes/campus.routes";
import certificateRoutes from "./routes/certificate.routes";
import courseRoutes from "./routes/course.routes";
import courseOfferingRoutes from "./routes/courseOffering.routes";
import departmentRoutes from "./routes/department.routes";
import facultyRoutes from "./routes/faculty.routes";
import gradingRoutes from "./routes/grading.routes";
import healthRoutes from "./routes/health.routes";
import hrRoutes from "./routes/hr.routes";
import internalMarkRoutes from "./routes/internalMark.routes";
import leaveRoutes from "./routes/leave.routes";
import libraryRoutes from "./routes/library.routes";
import movementRoutes from "./routes/movement.routes";
import portalRoutes from "./routes/portal.routes";
import programRoutes from "./routes/program.routes";
import registrationRoutes from "./routes/registration.routes";
import enrollmentRequestRoutes from "./routes/enrollmentRequest.routes";
import sectionRoutes from "./routes/section.routes";
import semesterRoutes from "./routes/semester.routes";
import studentRoutes from "./routes/student.routes";
import intelligenceRoutes from "./routes/intelligence.routes";
import askRoutes from "./routes/ask.routes";
import erpRoutes from "./routes/erp.routes";
import exportRoutes from "./routes/export.routes";
import importRoutes from "./routes/import.routes";
import peopleImportRoutes from "./routes/peopleImport.routes";
import siteContentRoutes from "./routes/siteContent.routes";
import eventsRoutes from "./routes/events.routes";
import institutionalCmsRoutes from "./routes/institutionalCms.routes";
import institutionRoutes from "./routes/institution.routes";
import userRoutes from "./routes/user.routes";
import examinationRoutes from "./routes/examination.routes";
import attendanceGovernanceRoutes from "./routes/attendanceGovernance.routes";
import lmsRoutes from "./routes/lms.routes";
import lmsProductionRoutes from "./routes/lmsProduction.routes";
import feeBillingRoutes from "./routes/feeBilling.routes";
import financeRoutes from "./routes/finance.routes";
import parentPortalRoutes from "./routes/parentPortal.routes";
import operationsRoutes from "./routes/operations.routes";
import securityRoutes from "./routes/security.routes";
import subscriptionPlanRoutes from "./routes/subscriptionPlan.routes";
import directoryRoutes from "./routes/directory.routes";
import obeRoutes from "./routes/obe.routes";
import fileStorageRoutes from "./routes/fileStorage.routes";
import paymentWebhookRoutes from "./routes/paymentWebhook.routes";
import workspaceContextRoutes from "./routes/workspaceContext.routes";
import myWorkRoutes from "./routes/myWork.routes";
import globalSearchRoutes from "./routes/globalSearch.routes";
import workflowRoutes from "./routes/workflow.routes";
import placementRoutes from "./routes/placement.routes";

export function createApp(): Application {
  const app: Application = express();

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");

  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: "cross-origin",
      },
    })
  );

  app.use(requestContext);

  // Lightweight production timing telemetry. It adds no database work and
  // makes slow API endpoints visible immediately in browser/network traces.
  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      if (isProduction && elapsedMs >= 750) {
        console.warn(JSON.stringify({
          type: "slow_api",
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Math.round(elapsedMs),
        }));
      }
    });
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = origin.replace(/\/+$/, "");

        if (env.corsOrigins.includes(normalizedOrigin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-Idempotency-Key",
      ],
      exposedHeaders: [
        "X-Request-ID",
        "X-Idempotency-Replayed",
      ],
    })
  );

  app.use(
    express.json({
      limit: "8mb",
      verify: (req, _res, buffer) => {
        (req as typeof req & { rawBody?: string }).rawBody = buffer.toString("utf8");
      },
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: "8mb",
    })
  );

  if (!isProduction) {
    app.use(morgan("dev"));
  }

  app.use(idempotency);
  app.use(mutationAudit);

  app.get("/", (_req, res) => {
    res.status(200).json({
      success: true,
      name: "ACADLYX",
      message: "ACADLYX API is running",
      version: env.apiVersion,
    });
  });

  const apiPrefix = `/api/${env.apiVersion}`;

  app.use(`${apiPrefix}/health`, healthRoutes);
  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/workspace`, workspaceContextRoutes);
  app.use(`${apiPrefix}/my-work`, myWorkRoutes);
  app.use(`${apiPrefix}/search`, globalSearchRoutes);
  app.use(`${apiPrefix}/workflow`, workflowRoutes);
  app.use(`${apiPrefix}/placements`, placementRoutes);
  app.use(`${apiPrefix}/institutions`, institutionRoutes);
  app.use(`${apiPrefix}/users`, userRoutes);
  app.use(`${apiPrefix}/campuses`, campusRoutes);
  app.use(`${apiPrefix}/departments`, departmentRoutes);
  app.use(`${apiPrefix}/programs`, programRoutes);
  app.use(`${apiPrefix}/academic-years`, academicYearRoutes);
  app.use(`${apiPrefix}/batches`, batchRoutes);
  app.use(`${apiPrefix}/semesters`, semesterRoutes);
  app.use(`${apiPrefix}/sections`, sectionRoutes);
  app.use(`${apiPrefix}/courses`, courseRoutes);
  app.use(`${apiPrefix}/course-offerings`, courseOfferingRoutes);
  app.use(`${apiPrefix}/obe`, obeRoutes);
  app.use(`${apiPrefix}/students`, studentRoutes);
  app.use(`${apiPrefix}/faculty`, facultyRoutes);
  app.use(`${apiPrefix}/admissions`, admissionRoutes);
  app.use(`${apiPrefix}/hr`, hrRoutes);
  app.use(`${apiPrefix}/leave`, leaveRoutes);
  app.use(`${apiPrefix}/portal`, portalRoutes);
  app.use(`${apiPrefix}/library`, libraryRoutes);
  app.use(`${apiPrefix}/calendar`, calendarRoutes);
  app.use(`${apiPrefix}/registrations`, registrationRoutes);
  app.use(`${apiPrefix}/enrollment-requests`, enrollmentRequestRoutes);
  app.use(`${apiPrefix}/movements`, movementRoutes);
  app.use(`${apiPrefix}/certificates`, certificateRoutes);
  app.use(`${apiPrefix}/attendance-sessions`, attendanceSessionRoutes);
  app.use(`${apiPrefix}/assignments`, assignmentRoutes);
  app.use(`${apiPrefix}/internal-marks`, internalMarkRoutes);
  app.use(`${apiPrefix}/grades`, gradingRoutes);
  app.use(`${apiPrefix}/directory`, directoryRoutes);
  app.use(`${apiPrefix}/examinations`, examinationRoutes);
  app.use(`${apiPrefix}/attendance`, attendanceGovernanceRoutes);
  app.use(`${apiPrefix}/lms`, lmsRoutes);
  app.use(`${apiPrefix}/lms`, lmsProductionRoutes);
  app.use(`${apiPrefix}/billing`, feeBillingRoutes);
  app.use(`${apiPrefix}/finance`, financeRoutes);
  app.use(`${apiPrefix}/parent`, parentPortalRoutes);
  app.use(`${apiPrefix}/operations`, operationsRoutes);
  app.use(`${apiPrefix}/security`, securityRoutes);
  app.use(`${apiPrefix}/subscriptions`, subscriptionPlanRoutes);
  app.use(`${apiPrefix}/intelligence`, intelligenceRoutes);
  app.use(`${apiPrefix}/ask-acadlyx`, askRoutes);
  app.use(`${apiPrefix}/erp`, erpRoutes);
  app.use(`${apiPrefix}/imports`, importRoutes);
  app.use(`${apiPrefix}/people-imports`, peopleImportRoutes);
  app.use(`${apiPrefix}/exports`, exportRoutes);
  app.use(`${apiPrefix}/site-content`, siteContentRoutes);
  app.use(`${apiPrefix}/events`, eventsRoutes);
  app.use(`${apiPrefix}/institutional-cms`, institutionalCmsRoutes);
  app.use(`${apiPrefix}/files`, fileStorageRoutes);
  app.use(`${apiPrefix}/payment-webhooks`, paymentWebhookRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
