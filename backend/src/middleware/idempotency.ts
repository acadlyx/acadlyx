import { createHash } from "crypto";
import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";

const HEADER = "x-idempotency-key";
const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function requestScope(req: Request): string {
  return req.method + ":" + req.originalUrl + ":" +
    createHash("sha256").update(req.header("authorization") ?? "").digest("hex");
}

function fingerprint(req: Request): string {
  const authorization = req.header("authorization") ?? "";
  const body = JSON.stringify(req.body ?? {});
  return createHash("sha256")
    .update(req.method)
    .update("\n")
    .update(req.originalUrl)
    .update("\n")
    .update(authorization)
    .update("\n")
    .update(body)
    .digest("hex");
}

function responseBody(res: Response): { body: string; contentType: string } {
  const captured = (res.locals.idempotencyResponseBody ?? "") as string;
  return {
    body: captured,
    contentType: res.getHeader("content-type")?.toString() ?? "application/json; charset=utf-8",
  };
}

export async function idempotency(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!MUTATING.has(req.method)) {
    next();
    return;
  }

  const key = req.header(HEADER)?.trim();
  if (!key) {
    next();
    return;
  }

  if (!KEY_PATTERN.test(key)) {
    throw new AppError("Invalid X-Idempotency-Key.", 400);
  }

  const scope = requestScope(req);
  const requestFingerprint = fingerprint(req);
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);

  try {
    const existing = await prisma.$queryRaw<Array<{
      id: string;
      fingerprint: string;
      status_code: number | null;
      response_body: string | null;
      response_content_type: string | null;
      expires_at: Date;
    }>>(Prisma.sql`
      SELECT id, fingerprint, status_code, response_body, response_content_type, expires_at
      FROM idempotency_keys
      WHERE key = ${key}
        AND scope = ${scope}
        AND expires_at > NOW()
      LIMIT 1
    `);

    if (existing.length) {
      const record = existing[0];
      if (record.fingerprint !== requestFingerprint) {
        throw new AppError("This idempotency key was already used for a different request.", 409);
      }

      if (record.status_code !== null && record.response_body !== null) {
        res.status(record.status_code);
        res.setHeader("Content-Type", record.response_content_type ?? "application/json; charset=utf-8");
        res.setHeader("X-Idempotency-Replayed", "true");
        res.send(record.response_body);
        return;
      }

      res.status(409).json({
        success: false,
        error: {
          message: "An identical request is already being processed.",
          requestId: res.locals.requestId,
        },
      });
      return;
    }

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO idempotency_keys (id, key, scope, fingerprint, expires_at, created_at, updated_at)
      VALUES (gen_random_uuid(), ${key}, ${scope}, ${requestFingerprint}, ${expiresAt}, NOW(), NOW())
      ON CONFLICT (key, scope) DO UPDATE
      SET fingerprint = EXCLUDED.fingerprint,
          status_code = NULL,
          response_body = NULL,
          response_content_type = NULL,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
      WHERE idempotency_keys.expires_at <= NOW()
    `);

    const winner = await prisma.$queryRaw<Array<{
      id: string;
      fingerprint: string;
      status_code: number | null;
      response_body: string | null;
      response_content_type: string | null;
      expires_at: Date;
    }>>(Prisma.sql`
      SELECT id, fingerprint, status_code, response_body, response_content_type, expires_at
      FROM idempotency_keys
      WHERE key = ${key} AND scope = ${scope}
      LIMIT 1
    `);

    if (!winner.length || winner[0].fingerprint !== requestFingerprint) {
      throw new AppError("This idempotency key was already used for a different request.", 409);
    }

    if (winner[0].status_code !== null && winner[0].response_body !== null) {
      res.status(winner[0].status_code);
      res.setHeader("Content-Type", winner[0].response_content_type ?? "application/json; charset=utf-8");
      res.setHeader("X-Idempotency-Replayed", "true");
      res.send(winner[0].response_body);
      return;
    }

    let captured = "";
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);

    res.send = ((body?: unknown) => {
      if (typeof body === "string") captured = body;
      else if (Buffer.isBuffer(body)) captured = body.toString("utf8");
      else if (body !== undefined) captured = JSON.stringify(body);
      res.locals.idempotencyResponseBody = captured;
      return originalSend(body as never);
    }) as Response["send"];

    res.json = ((body: unknown) => {
      captured = JSON.stringify(body);
      res.locals.idempotencyResponseBody = captured;
      return originalJson(body);
    }) as Response["json"];

    res.end = ((chunk?: unknown, encoding?: BufferEncoding | (() => void), cb?: () => void) => {
      if (chunk !== undefined && typeof chunk !== "function") {
        captured = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        res.locals.idempotencyResponseBody = captured;
      }
      return originalEnd(chunk as never, encoding as never, cb);
    }) as Response["end"];

    res.once("finish", () => {
      const body = responseBody(res);
      void prisma.$executeRaw(Prisma.sql`
        UPDATE idempotency_keys
        SET status_code = ${res.statusCode},
            response_body = ${body.body},
            response_content_type = ${body.contentType},
            updated_at = NOW()
        WHERE key = ${key} AND scope = ${scope} AND fingerprint = ${requestFingerprint}
      `).catch(() => {
        // The business request has already completed. Never turn persistence
        // failure into a second response or an unhandled rejection.
      });
    });

    next();
  } catch (error) {
    if (error instanceof AppError) throw error;
    next(error);
  }
}
