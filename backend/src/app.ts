import cors from "cors";
import express, { Application } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env, isProduction } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";

import academicYearRoutes from "./routes/academicYear.routes";
import assignmentRoutes from "./routes/assignment.routes";
import attendanceSessionRoutes from "./routes/attendanceSession.routes";
import authRoutes from "./routes/auth.routes";
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

/*
 * Administrative/platform routes will be added in the next batch:
 *
 * /institutions
 * /users
 * /roles
 * /permissions
 * /audit
 *
 * Keeping route registration here centralized makes the API versioned
 * and prevents frontend pages from depending on internal controllers.
 */

export function createApp(): Application {
  const app: Application = express();

  // ----------------------------------------------------------
  // SECURITY
  // ----------------------------------------------------------

  app.use(helmet());

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );

  // ----------------------------------------------------------
  // REQUEST PARSING
  // ----------------------------------------------------------

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // ----------------------------------------------------------
  // DEVELOPMENT REQUEST LOGGING
  // ----------------------------------------------------------

  if (!isProduction) {
    app.use(morgan("dev"));
  }

  // ----------------------------------------------------------
  // ROOT / DEPLOYMENT CHECK
  // ----------------------------------------------------------

  app.get("/", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "ACADLYX API is running",
      version: env.apiVersion,
      environment: env.nodeEnv,
    });
  });

  // ----------------------------------------------------------
  // VERSIONED API
  // ----------------------------------------------------------

  const apiPrefix = `/api/${env.apiVersion}`;

  // System
  app.use(`${apiPrefix}/health`, healthRoutes);

  // Authentication
  app.use(`${apiPrefix}/auth`, authRoutes);

  // Academic structure
  app.use(`${apiPrefix}/departments`, departmentRoutes);
  app.use(`${apiPrefix}/programs`, programRoutes);
  app.use(`${apiPrefix}/academic-years`, academicYearRoutes);
  app.use(`${apiPrefix}/semesters`, semesterRoutes);
  app.use(`${apiPrefix}/sections`, sectionRoutes);
  app.use(`${apiPrefix}/courses`, courseRoutes);
  app.use(`${apiPrefix}/course-offerings`, courseOfferingRoutes);

  // People / student self-service
  app.use(`${apiPrefix}/students`, studentRoutes);
  app.use(`${apiPrefix}/faculty`, facultyRoutes);

  // Academic operations
  app.use(`${apiPrefix}/attendance-sessions`, attendanceSessionRoutes);
  app.use(`${apiPrefix}/assignments`, assignmentRoutes);
  app.use(`${apiPrefix}/internal-marks`, internalMarkRoutes);

  // Intelligence
  app.use(`${apiPrefix}/intelligence`, intelligenceRoutes);
  app.use(`${apiPrefix}/ask-acadlyx`, askRoutes);

  // ----------------------------------------------------------
  // 404
  // ----------------------------------------------------------

  app.use(notFound);

  // ----------------------------------------------------------
  // CENTRAL ERROR HANDLER
  // ----------------------------------------------------------

  app.use(errorHandler);

  return app;
}
