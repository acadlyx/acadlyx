import { NextFunction, Request, Response } from "express";
import { recordAuditLog } from "../services/audit.service";
import { publishDomainEvent } from "../services/domainEvent.service";

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
    const succeeded = res.statusCode < 400;
    const entityType = req.path
      .split("/")
      .filter(Boolean)
      .slice(2, 3)[0]
      ?.replace(/[-_]/g, " ")
      .replace(/^./, (value) => value.toUpperCase()) || "HTTP";

    const payload = {
      method: req.method,
      route: safeRoute(req),
      path: req.path,
      statusCode: res.statusCode,
      requestId: res.locals.requestId,
      entityId: req.params.id ?? null,
    };

    void recordAuditLog({
      institutionId,
      userId: user.id,
      action: `HTTP_${req.method}_${succeeded ? "SUCCEEDED" : "FAILED"}`,
      entityType,
      entityId: req.params.id,
      metadata: payload,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    });

    if (succeeded) {
      publishDomainEvent("erp.mutation.completed", {
        institutionId,
        actorId: user.id,
        payload,
      });
    }
  });

  next();
}
