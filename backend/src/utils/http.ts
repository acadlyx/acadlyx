import { Request, Response } from "express";
import {
  buildPaginationMeta,
  PaginationParams,
} from "./pagination";

/** Request metadata attached to audit entries. */
export function auditMeta(req: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || undefined,
  };
}

export function sendOk<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function sendPage<T>(
  res: Response,
  items: T[],
  total: number,
  pagination: PaginationParams
): void {
  res.status(200).json({
    success: true,
    data: items,
    meta: buildPaginationMeta(total, pagination),
  });
}

/** Escapes LIKE wildcards so user search text is always literal. */
export function searchTerm(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, 100);
  return trimmed.length ? trimmed : undefined;
}

/** Inclusive number of calendar days between two dates. */
export function inclusiveDays(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
