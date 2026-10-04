import { NextFunction, Request, Response } from "express";
import { recordAuditLog } from "../services/audit.service";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function safeRoute(req: Request): string {
  const route = req.route?.path;
  return typeof route === "string" ? route : req.path;
}

export function mutationAudit(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method)) {
    next();
    return;
  }

  res.once("finish", () => {
    const user = req.user;
    if (!user) return;

    const institutionId = user.institutionId ?? null;
    const entityType = req.path
      .split("/")
      .filter(Boolean)
      .slice(2, 3)[0]
      ?.replace(/[-_]/g, " ")
      .replace(/^./, (value) => value.toUpperCase());

    void recordAuditLog({
      institutionId,
      userId: user.id,
      action: `HTTP_${req.method}_${res.statusCode < 400 ? "SUCCEEDED" : "FAILED"}`,
      entityType: entityType || "HTTP",
      entityId: req.params.id,
      metadata: {
        method: req.method,
        route: safeRoute(req),
        path: req.path,
        statusCode: res.statusCode,
        requestId: res.locals.requestId,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    });
  });

  next();
}
