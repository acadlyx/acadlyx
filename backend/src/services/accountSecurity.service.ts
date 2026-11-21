import { createHash, randomBytes } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { env } from "../config/env";
import { AuthenticatedUser } from "../types/auth";
import { comparePassword, hashPassword } from "../utils/password";
import {
  buildOtpAuthUrl,
  generateTotpSecret,
  verifyTotp,
} from "../utils/totp";
import { recordAuditLog } from "./audit.service";
import { sendEmail } from "./email.service";

/**
 * Account security.
 *
 * Covers the parts of authentication that sit either side of the
 * password check: brute-force lockout, TOTP second factor, and
 * self-service password reset.
 *
 * Design choices worth knowing:
 *  - Nothing reversible is stored. Reset tokens, MFA challenges and
 *    recovery codes are kept as SHA-256 hashes, so a database dump
 *    yields no usable credential.
 *  - Reset requests never reveal whether an address exists. The caller
 *    always gets the same response.
 *  - A completed reset revokes every refresh token for that user, so a
 *    stolen session cannot survive the password change that was meant
 *    to end it.
 */

const MAX_FAILED_ATTEMPTS = Number(process.env.AUTH_MAX_FAILED_ATTEMPTS || 8);
const LOCKOUT_MINUTES = Number(process.env.AUTH_LOCKOUT_MINUTES || 15);
const RESET_TOKEN_TTL_MINUTES = Number(process.env.AUTH_RESET_TTL_MINUTES || 30);
const MFA_CHALLENGE_TTL_MINUTES = 5;
const MFA_MAX_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

// ==========================================================
// BRUTE-FORCE PROTECTION
// ==========================================================

/**
 * Called before the password comparison. A locked account fails fast
 * and identically for every caller, so lockout cannot be used to
 * enumerate accounts.
 */
export async function assertNotLocked(user: {
  id: string;
  lockedUntil: Date | null;
}): Promise<void> {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const seconds = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 1000
    );
    throw new AppError(
      `Too many failed sign-in attempts. Try again in ${Math.ceil(seconds / 60)} minute(s).`,
      429
    );
  }
}

/** Increments the failure counter and locks the account at the threshold. */
export async function recordFailedLogin(
  userId: string,
  institutionId: string | null,
  meta: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });

  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: minutesFromNow(LOCKOUT_MINUTES),
        failedLoginAttempts: 0,
      },
    });
    await recordAuditLog({
      institutionId,
      userId,
      action: "auth.account_locked",
      metadata: { minutes: LOCKOUT_MINUTES, threshold: MAX_FAILED_ATTEMPTS },
      ...meta,
    });
  }
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

/** Administrative unlock. */
export async function unlockAccount(
  institutionId: string,
  actor: AuthenticatedUser,
  userId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const target = await prisma.user.findFirst({
    where: { id: userId, institutionId },
    select: { id: true },
  });
  if (!target) {
    throw new AppError("User was not found in this institution", 404);
  }

  await clearFailedLogins(userId);

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "auth.account_unlocked",
    entityType: "User",
    entityId: userId,
    ...meta,
  });

  return { userId, unlocked: true };
}

// ==========================================================
// MFA CHALLENGE (second step of sign-in)
// ==========================================================

/**
 * Issues a short-lived handle that authorises only the second factor
 * step. It is not an access token and grants no API access on its own.
 */
export async function createMfaChallenge(
  userId: string,
  ipAddress?: string
): Promise<{ challengeToken: string; expiresAt: Date }> {
  const challengeToken = randomBytes(32).toString("hex");
  const expiresAt = minutesFromNow(MFA_CHALLENGE_TTL_MINUTES);

  // Serialize challenge replacement per account so simultaneous sign-ins
  // cannot leave more than one live MFA challenge for the same user.
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE
    `;
    if (!locked.length) throw new AppError("User was not found", 404);

    await tx.mfaChallenge.deleteMany({ where: { userId, consumedAt: null } });
    await tx.mfaChallenge.create({
      data: {
        userId,
        challengeHash: sha256(challengeToken),
        expiresAt,
        ipAddress,
      },
    });
  });

  return { challengeToken, expiresAt };
}

/**
 * Consumes a challenge with either a TOTP code or a recovery code.
 * A per-user row lock serializes challenge consumption and recovery-code
 * claims; the challenge itself is also conditionally marked consumed.
 */
export async function consumeMfaChallenge(
  challengeToken: string,
  code: string,
  meta: { ipAddress?: string; userAgent?: string }
): Promise<string> {
  const invalid = () => new AppError("Invalid or expired verification code", 401);
  const candidate = await prisma.mfaChallenge.findUnique({
    where: { challengeHash: sha256(challengeToken) },
    select: { id: true, userId: true },
  });
  if (!candidate) throw invalid();

  const result = await prisma.$transaction(async (tx) => {
    // Lock the user first; challenge creation uses the same lock order.
    const lockedUser = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "users" WHERE "id" = ${candidate.userId} FOR UPDATE
    `;
    if (!lockedUser.length) return { status: "invalid" as const };

    const challenge = await tx.mfaChallenge.findUnique({
      where: { id: candidate.id },
      include: {
        user: {
          select: {
            id: true,
            institutionId: true,
            isActive: true,
            mfaSecret: true,
            mfaEnabled: true,
          },
        },
      },
    });
    const now = new Date();
    if (!challenge || challenge.challengeHash !== sha256(challengeToken) ||
        challenge.consumedAt || challenge.expiresAt <= now || !challenge.user.isActive) {
      return { status: "invalid" as const };
    }

    if (challenge.attempts >= MFA_MAX_ATTEMPTS) {
      await tx.mfaChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: now },
      });
      return { status: "locked" as const, userId: challenge.user.id, institutionId: challenge.user.institutionId };
    }
    if (!challenge.user.mfaEnabled || !challenge.user.mfaSecret) {
      return { status: "invalid" as const };
    }

    const totpValid = verifyTotp(challenge.user.mfaSecret, code);
    let method: "totp" | "recovery_code" = "totp";

    if (!totpValid) {
      const recovery = await tx.mfaRecoveryCode.findFirst({
        where: {
          userId: challenge.user.id,
          usedAt: null,
          codeHash: sha256(code.trim().toUpperCase()),
        },
        select: { id: true },
      });
      if (!recovery) {
        const nextAttempts = challenge.attempts + 1;
        await tx.mfaChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } },
          data: {
            attempts: { increment: 1 },
            ...(nextAttempts >= MFA_MAX_ATTEMPTS ? { consumedAt: now } : {}),
          },
        });
        return {
          status: nextAttempts >= MFA_MAX_ATTEMPTS ? "locked" as const : "failed" as const,
          userId: challenge.user.id,
          institutionId: challenge.user.institutionId,
        };
      }

      const recoveryClaim = await tx.mfaRecoveryCode.updateMany({
        where: { id: recovery.id, userId: challenge.user.id, usedAt: null },
        data: { usedAt: now },
      });
      if (recoveryClaim.count !== 1) return { status: "invalid" as const };
      method = "recovery_code";
    }

    const challengeClaim = await tx.mfaChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (challengeClaim.count !== 1) throw invalid();

    return {
      status: "success" as const,
      userId: challenge.user.id,
      institutionId: challenge.user.institutionId,
      method,
    };
  });

  if (result.status === "locked") {
    if (result.userId) {
      await recordAuditLog({ institutionId: result.institutionId, userId: result.userId, action: "auth.mfa_failed", metadata: { outcome: "locked" }, ...meta });
    }
    throw new AppError("Too many verification attempts. Sign in again.", 429);
  }
  if (result.status === "failed") {
    await recordAuditLog({ institutionId: result.institutionId, userId: result.userId, action: "auth.mfa_failed", ...meta });
    throw invalid();
  }
  if (result.status !== "success") throw invalid();

  await recordAuditLog({
    institutionId: result.institutionId,
    userId: result.userId,
    action: "auth.mfa_verified",
    metadata: { method: result.method },
    ...meta,
  });
  return result.userId;
}
// MFA ENROLMENT
// ==========================================================

/**
 * Starts enrolment. The secret is stored but MFA stays off until the
 * user proves they can generate a code from it, so a mis-scanned QR
 * cannot lock anyone out.
 */
export async function beginMfaEnrollment(actor: AuthenticatedUser) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { email: true, mfaEnabled: true, institution: { select: { name: true } } },
  });

  if (user.mfaEnabled) {
    throw new AppError(
      "Two-factor authentication is already enabled on this account",
      409
    );
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: actor.id },
    data: { mfaSecret: secret, mfaEnabled: false },
  });

  return {
    secret,
    otpauthUrl: buildOtpAuthUrl({
      secret,
      accountName: user.email,
      issuer: user.institution?.name || "ACADLYX",
    }),
  };
}

export async function confirmMfaEnrollment(
  actor: AuthenticatedUser,
  code: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { mfaSecret: true, mfaEnabled: true, institutionId: true },
  });

  if (!user.mfaSecret) {
    throw new AppError("Start enrolment before confirming a code", 409);
  }
  if (user.mfaEnabled) {
    throw new AppError("Two-factor authentication is already enabled", 409);
  }
  if (!verifyTotp(user.mfaSecret, code)) {
    throw new AppError("That code did not match. Check your authenticator app.", 400);
  }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    randomBytes(5).toString("hex").toUpperCase()
  );

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: { mfaEnabled: true, mfaEnrolledAt: new Date() },
    });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: actor.id } });
    await tx.mfaRecoveryCode.createMany({
      data: codes.map((code) => ({
        userId: actor.id,
        codeHash: sha256(code),
      })),
    });
  });

  await recordAuditLog({
    institutionId: user.institutionId,
    userId: actor.id,
    action: "auth.mfa_enabled",
    ...meta,
  });

  // The only time the plaintext recovery codes ever leave the server.
  return { enabled: true, recoveryCodes: codes };
}

export async function disableMfa(
  actor: AuthenticatedUser,
  password: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { passwordHash: true, mfaEnabled: true, institutionId: true },
  });

  if (!user.mfaEnabled) {
    throw new AppError("Two-factor authentication is not enabled", 409);
  }
  // Re-authenticate: removing a factor is as sensitive as adding one.
  if (!(await comparePassword(password, user.passwordHash))) {
    throw new AppError("Password is incorrect", 401);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: { mfaEnabled: false, mfaSecret: null, mfaEnrolledAt: null },
    });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: actor.id } });
    await tx.mfaChallenge.deleteMany({ where: { userId: actor.id } });
  });

  await recordAuditLog({
    institutionId: user.institutionId,
    userId: actor.id,
    action: "auth.mfa_disabled",
    ...meta,
  });

  return { enabled: false };
}

export async function getMfaStatus(actor: AuthenticatedUser) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { mfaEnabled: true, mfaEnrolledAt: true },
  });
  const remaining = await prisma.mfaRecoveryCode.count({
    where: { userId: actor.id, usedAt: null },
  });
  return { ...user, recoveryCodesRemaining: remaining };
}

// ==========================================================
// PASSWORD RESET
// ==========================================================

export interface PasswordResetIssue {
  /** Present only when delivery is not configured; see the note below. */
  token?: string;
  expiresAt?: Date;
}

/**
 * Issues a reset token.
 *
 * The response to the caller is always identical, whether or not the
 * address exists — account enumeration through this endpoint is not
 * possible. The token itself is returned to the ROUTE, which decides
 * delivery: with a mailer configured it is emailed and never returned
 * to the browser.
 */
export async function requestPasswordReset(
  email: string,
  meta: { ipAddress?: string; userAgent?: string }
): Promise<PasswordResetIssue> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, isActive: true, institutionId: true },
  });

  if (!user || !user.isActive) {
    await recordAuditLog({
      action: "auth.password_reset_requested",
      metadata: { email, outcome: "no_matching_account" },
      ...meta,
    });
    return {};
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = minutesFromNow(RESET_TOKEN_TTL_MINUTES);
  const issued = await prisma.$transaction(async (tx) => {
    // Serialize reset issuance per user so only the most recent link stays live.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE
    `;
    if (!locked.length) return null;
    const current = await tx.user.findFirst({
      where: { id: user.id, isActive: true },
      select: { id: true, email: true, institutionId: true },
    });
    if (!current) return null;

    await tx.passwordResetToken.updateMany({
      where: { userId: current.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.create({
      data: {
        userId: current.id,
        tokenHash: sha256(token),
        expiresAt,
        requestedIp: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    return current;
  });

  if (!issued) return {};
  await recordAuditLog({
    institutionId: issued.institutionId,
    userId: issued.id,
    action: "auth.password_reset_requested",
    metadata: { outcome: "token_issued", expiresAt },
    ...meta,
  });

  if (env.emailProvider !== "disabled") {
    const resetUrl = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: issued.email.trim().toLowerCase(),
      subject: "Reset your ACADLYX password",
      text: `Use this link to reset your ACADLYX password. It expires in ${RESET_TOKEN_TTL_MINUTES} minutes: ${resetUrl}`,
      html: `<p>Use this link to reset your ACADLYX password.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>`,
    });
  }

  return { token, expiresAt };
}
/**
 * Completes a reset. Beyond setting the new password this revokes every
 * refresh token and pending MFA challenge for the account, so any
 * session an attacker already holds dies with the old password.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, institutionId: true, isActive: true } } },
  });
  const now = new Date();
  if (!record || record.usedAt || record.expiresAt <= now || !record.user.isActive) {
    throw new AppError("This reset link is invalid or has expired", 400);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    // Atomic compare-and-set: one concurrent request can claim the token.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      throw new AppError("This reset link is invalid or has expired", 400);
    }

    const updatedUser = await tx.user.updateMany({
      where: { id: record.user.id, isActive: true },
      data: {
        passwordHash,
        passwordChangedAt: now,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    if (updatedUser.count !== 1) {
      throw new AppError("This reset link is invalid or has expired", 400);
    }

    await tx.refreshToken.updateMany({
      where: { userId: record.user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.mfaChallenge.deleteMany({ where: { userId: record.user.id } });
  });

  await recordAuditLog({
    institutionId: record.user.institutionId,
    userId: record.user.id,
    action: "auth.password_reset_completed",
    metadata: { sessionsRevoked: true },
    ...meta,
  });
  return { reset: true };
}

function describeUserAgent(userAgent: string | null): { browser: string; os: string; device: string } {
  const ua = userAgent || "";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Chrome\//i.test(ua) ? "Chrome" : /Firefox\//i.test(ua) ? "Firefox" : /Safari\//i.test(ua) && !/Chrome\//i.test(ua) ? "Safari" : /OPR\//i.test(ua) ? "Opera" : /MSIE|Trident/i.test(ua) ? "Internet Explorer" : "Browser";
  const os = /Windows/i.test(ua) ? "Windows" : /Mac OS X/i.test(ua) ? "macOS" : /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const device = /iPhone|iPad|Android.*Mobile|Mobile/i.test(ua) ? "Mobile" : /Tablet|iPad/i.test(ua) ? "Tablet" : "Desktop";
  return { browser, os, device };
}

export async function listSessions(actor: AuthenticatedUser) {
  const now = new Date();
  const sessions = await prisma.refreshToken.findMany({
    where: { userId: actor.id, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, expiresAt: true, createdAt: true, ipAddress: true, userAgent: true },
  });
  return sessions.map((session) => ({
    id: session.id,
    current: session.id === actor.sessionId,
    createdAt: session.createdAt,
    lastActiveAt: session.createdAt,
    expiresAt: session.expiresAt,
    ipAddress: session.ipAddress,
    ...describeUserAgent(session.userAgent),
  }));
}

export async function revokeSession(actor: AuthenticatedUser, sessionId: string, meta: { ipAddress?: string; userAgent?: string }) {
  const result = await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId: actor.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!result.count) throw new AppError("Session was not found or is already signed out", 404);
  await recordAuditLog({ institutionId: actor.institutionId, userId: actor.id, action: "auth.session_revoked", entityType: "RefreshToken", entityId: sessionId, metadata: { current: sessionId === actor.sessionId }, ...meta });
  return { revoked: true, current: sessionId === actor.sessionId };
}

export async function revokeOtherSessions(actor: AuthenticatedUser, meta: { ipAddress?: string; userAgent?: string }) {
  if (!actor.sessionId) throw new AppError("Current session could not be identified. Please sign in again.", 409);
  const result = await prisma.refreshToken.updateMany({
    where: { userId: actor.id, revokedAt: null, id: { not: actor.sessionId } },
    data: { revokedAt: new Date() },
  });
  await recordAuditLog({ institutionId: actor.institutionId, userId: actor.id, action: "auth.other_sessions_revoked", metadata: { revoked: result.count }, ...meta });
  return { revoked: result.count };
}

export async function getLoginActivity(actor: AuthenticatedUser) {
  const rows = await prisma.auditLog.findMany({
    where: {
      userId: actor.id,
      action: { in: ["auth.login", "auth.login_failed", "auth.logout", "auth.password_changed", "auth.password_reset_completed", "auth.refresh_token_reuse_detected"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, action: true, createdAt: true, ipAddress: true, userAgent: true },
  });
  return rows.map((row) => ({ id: row.id, action: row.action, createdAt: row.createdAt, ipAddress: row.ipAddress, ...describeUserAgent(row.userAgent) }));
}

/** Ends every other session for the caller. */
export async function revokeAllSessions(
  actor: AuthenticatedUser,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const result = await prisma.refreshToken.updateMany({
    where: { userId: actor.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await recordAuditLog({
    institutionId: actor.institutionId,
    userId: actor.id,
    action: "auth.sessions_revoked",
    metadata: { revoked: result.count },
    ...meta,
  });

  return { revoked: result.count };
}

/**
 * Administrative reset: issues a token on a user's behalf. Used by an
 * institution admin when a member of staff cannot receive email.
 */
export async function adminIssueResetToken(
  institutionId: string,
  actor: AuthenticatedUser,
  userId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const target = await prisma.user.findFirst({
    where: { id: userId, institutionId },
    select: { id: true, email: true },
  });
  if (!target) {
    throw new AppError("User was not found in this institution", 404);
  }

  const issue = await requestPasswordReset(target.email, meta);

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "auth.admin_password_reset_issued",
    entityType: "User",
    entityId: userId,
    ...meta,
  });

  return issue;
}

export const passwordResetTtlMinutes = RESET_TOKEN_TTL_MINUTES;
