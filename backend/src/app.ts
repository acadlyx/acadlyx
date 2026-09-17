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

import academicYearRoutes from "./routes/academicYear.routes";
import assignmentRoutes from "./routes/assignment.routes";
import attendanceSessionRoutes from "./routes/attendanceSession.routes";
import authRoutes from "./routes/auth.routes";
import campusRoutes from "./routes/campus.routes";
import courseRoutes from "./routes/course.routes";
import courseOfferingRoutes from "./routes/courseOffering.routes";
import departmentRoutes from "./routes/department.routes";
import facultyRoutes from "./routes/faculty.routes";
import healthRoutes from "./routes/health.routes";
import internalMarkRoutes from "./routes/internalMark.routes";
import programRoutes from "./routes/program.routes";
import sectionRoutes from "./routes/section.routes";
import semesterRoutes from "./routes/semester.routes";
import studentRoutes from "./routes/student.routes";
import intelligenceRoutes from "./routes/intelligence.routes";
import askRoutes from "./routes/ask.routes";
import erpRoutes from "./routes/erp.routes";
import importRoutes from "./routes/import.routes";
import siteContentRoutes from "./routes/siteContent.routes";
import institutionRoutes from "./routes/institution.routes";
import userRoutes from "./routes/user.routes";

export function createApp(): Application {
  const app: Application = express();

  /*
   * Render runs behind a reverse proxy.
   *
   * The existing EnvConfig does not expose a security.trustProxy
   * property, so use the production environment directly here.
   */
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

  app.use(
    cors({
      origin(origin, callback) {
        /*
         * Requests without an Origin header include server-to-server
         * requests and health checks. These are allowed.
         */
        if (!origin) {
          callback(null, true);
          return;
        }

        /*
         * Normalize trailing slashes so:
         *
         * https://acadlyx-orcin.vercel.app
         *
         * and
         *
         * https://acadlyx-orcin.vercel.app/
         *
         * are treated as the same origin.
         */
        const normalizedOrigin = origin.replace(
          /\/+$/,
          ""
        );

        if (
          env.corsOrigins.includes(
            normalizedOrigin
          )
        ) {
          callback(null, true);
          return;
        }

        callback(
          new Error(
            `CORS origin not allowed: ${origin}`
          )
        );
      },

      credentials: true,

      methods: [
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],

      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
      ],

      exposedHeaders: [
        "X-Request-ID",
      ],
    })
  );

  app.use(
    express.json({
      limit: "2mb",
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: "2mb",
    })
  );

  if (!isProduction) {
    app.use(
      morgan("dev")
    );
  }

  /*
   * API root.
   */
  app.get(
    "/",
    (_req, res) => {
      res.status(200).json({
        success: true,
        name: "ACADLYX",
        message:
          "ACADLYX API is running",
        version:
          env.apiVersion,
        environment:
          env.nodeEnv,
      });
    }
  );

  const apiPrefix =
    `/api/${env.apiVersion}`;

  /*
   * HEALTH
   */
  app.use(
    `${apiPrefix}/health`,
    healthRoutes
  );

  /*
   * AUTHENTICATION
   */
  app.use(
    `${apiPrefix}/auth`,
    authRoutes
  );

  /*
   * PLATFORM / INSTITUTION ADMINISTRATION
   */
  app.use(
    `${apiPrefix}/institutions`,
    institutionRoutes
  );

  app.use(
    `${apiPrefix}/users`,
    userRoutes
  );

  /*
   * ACADEMIC STRUCTURE
   */
  app.use(
    `${apiPrefix}/campuses`,
    campusRoutes
  );

  app.use(
    `${apiPrefix}/departments`,
    departmentRoutes
  );

  app.use(
    `${apiPrefix}/programs`,
    programRoutes
  );

  app.use(
    `${apiPrefix}/academic-years`,
    academicYearRoutes
  );

  app.use(
    `${apiPrefix}/semesters`,
    semesterRoutes
  );

  app.use(
    `${apiPrefix}/sections`,
    sectionRoutes
  );

  app.use(
    `${apiPrefix}/courses`,
    courseRoutes
  );

  app.use(
    `${apiPrefix}/course-offerings`,
    courseOfferingRoutes
  );

  /*
   * PEOPLE
   */
  app.use(
    `${apiPrefix}/students`,
    studentRoutes
  );

  app.use(
    `${apiPrefix}/faculty`,
    facultyRoutes
  );

  /*
   * ACADEMIC OPERATIONS
   */
  app.use(
    `${apiPrefix}/attendance-sessions`,
    attendanceSessionRoutes
  );

  app.use(
    `${apiPrefix}/assignments`,
    assignmentRoutes
  );

  app.use(
    `${apiPrefix}/internal-marks`,
    internalMarkRoutes
  );

  /*
   * INTELLIGENCE
   */
  app.use(
    `${apiPrefix}/intelligence`,
    intelligenceRoutes
  );

  app.use(
    `${apiPrefix}/ask-acadlyx`,
    askRoutes
  );

  /*
   * LEGACY / AGGREGATED ERP
   *
   * Kept for compatibility while individual ERP domains
   * are progressively implemented.
   */
  app.use(
    `${apiPrefix}/erp`,
    erpRoutes
  );

  /*
   * DATA IMPORTS
   */
  app.use(
    `${apiPrefix}/imports`,
    importRoutes
  );

  /*
   * PUBLIC / SITE CMS
   */
  app.use(
    `${apiPrefix}/site-content`,
    siteContentRoutes
  );

  /*
   * 404 HANDLER
   */
  app.use(notFound);

  /*
   * CENTRAL ERROR HANDLER
   */
  app.use(errorHandler);

  return app;
}
