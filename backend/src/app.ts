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

/**
 * Builds and configures the Express application.
 * Route modules are mounted under a versioned prefix (/api/v1/...)
 * so future breaking changes can live under /api/v2 without disruption.
 */
export function createApp(): Application {
  const app: Application = express();

  // Security & parsing middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (!isProduction) {
    app.use(morgan("dev"));
  }

  // Lightweight deployment/liveness response. Detailed service health remains
  // available at GET /api/v1/health.
  app.get("/", (_req, res) => {
    res.status(200).json({ success: true, message: "ACADLYX API is running" });
  });

  // Versioned API routes
  const apiPrefix = `/api/${env.apiVersion}`;
  app.use(`${apiPrefix}/health`, healthRoutes);
  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/departments`, departmentRoutes);
  app.use(`${apiPrefix}/programs`, programRoutes);
  app.use(`${apiPrefix}/academic-years`, academicYearRoutes);
  app.use(`${apiPrefix}/semesters`, semesterRoutes);
  app.use(`${apiPrefix}/sections`, sectionRoutes);
  app.use(`${apiPrefix}/courses`, courseRoutes);
  app.use(`${apiPrefix}/course-offerings`, courseOfferingRoutes);
  app.use(`${apiPrefix}/students`, studentRoutes);
  app.use(`${apiPrefix}/faculty`, facultyRoutes);
  app.use(`${apiPrefix}/attendance-sessions`, attendanceSessionRoutes);
  app.use(`${apiPrefix}/assignments`, assignmentRoutes);
  app.use(`${apiPrefix}/internal-marks`, internalMarkRoutes);
  app.use(`${apiPrefix}/intelligence`, intelligenceRoutes);
  app.use(`${apiPrefix}/ask-acadlyx`, askRoutes);

  // Future route mounts (Phase 6+):
  // app.use(`${apiPrefix}/users`, userRoutes);

  // 404 + centralized error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
