import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AccessTokenPayload } from "../types/auth";

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

/**
 * Refresh tokens are opaque random strings, NOT JWTs.
 * Only their SHA-256 hash is ever stored, so a database leak does
 * not hand out usable tokens.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiryDate(): Date {
  const days = env.jwtRefreshExpiresInDays;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
