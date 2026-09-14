import cors from "cors";
import express, { Application } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env, isProduction } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { requestContext } from "./middleware/requestContext";

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
import erpRoutes from "./routes/erp.routes";
import importRoutes from "./routes/import.routes";
import siteContentRoutes from "./routes/siteContent.routes";

import institutionRoutes from "./routes/institution.routes";
import userRoutes from "./routes/user.routes";

export function createApp(): Application {
  const app: Application = express();

  app.use(helmet());
  app.use(requestContext);

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  if (!isProduction) {
    app.use(morgan("dev"));
  }

  app.get("/", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "ACADLYX API is running",
      version: env.apiVersion,
      environment: env.nodeEnv,
    });
  });

  const apiPrefix = `/api/${env.apiVersion}`;

  app.use(`${apiPrefix}/health`, healthRoutes);

  app.use(`${apiPrefix}/auth`, authRoutes);

  /*
   * PLATFORM ADMINISTRATION
   */
  app.use(`${apiPrefix}/institutions`, institutionRoutes);
  app.use(`${apiPrefix}/users`, userRoutes);

  /*
   * ACADEMIC STRUCTURE
   */
  app.use(`${apiPrefix}/departments`, departmentRoutes);
  app.use(`${apiPrefix}/programs`, programRoutes);
  app.use(`${apiPrefix}/academic-years`, academicYearRoutes);
  app.use(`${apiPrefix}/semesters`, semesterRoutes);
  app.use(`${apiPrefix}/sections`, sectionRoutes);
  app.use(`${apiPrefix}/courses`, courseRoutes);
  app.use(`${apiPrefix}/course-offerings`, courseOfferingRoutes);

  /*
   * PEOPLE / STUDENT SELF SERVICE
   */
  app.use(`${apiPrefix}/students`, studentRoutes);
  app.use(`${apiPrefix}/faculty`, facultyRoutes);

  /*
   * ACADEMIC OPERATIONS
   */
  app.use(
    `${apiPrefix}/attendance-sessions`,
    attendanceSessionRoutes
  );

  app.use(`${apiPrefix}/assignments`, assignmentRoutes);

  app.use(`${apiPrefix}/internal-marks`, internalMarkRoutes);

  /*
   * INTELLIGENCE
   */
  app.use(`${apiPrefix}/intelligence`, intelligenceRoutes);

  app.use(`${apiPrefix}/ask-acadlyx`, askRoutes);
  app.use(`${apiPrefix}/erp`, erpRoutes);
  app.use(`${apiPrefix}/imports`, importRoutes);
  app.use(`${apiPrefix}/site-content`, siteContentRoutes);

  app.use(notFound);

  app.use(errorHandler);

  return app;
}
