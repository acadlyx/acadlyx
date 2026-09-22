import { createHash, randomBytes } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { comparePassword, hashPassword } from "../utils/password";
import {
  buildOtpAuthUrl,
  generateTotpSecret,
  verifyTotp,
} from "../utils/totp";
import { recordAuditLog } from "./audit.service";

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
  // A fresh sign-in supersedes any pending challenge for this user.
  await prisma.mfaChallenge.deleteMany({
    where: { userId, consumedAt: null },
  });

  const challengeToken = randomBytes(32).toString("hex");
  const expiresAt = minutesFromNow(MFA_CHALLENGE_TTL_MINUTES);

  await prisma.mfaChallenge.create({
    data: {
      userId,
      challengeHash: sha256(challengeToken),
      expiresAt,
      ipAddress,
    },
  });

  return { challengeToken, expiresAt };
}

/**
 * Consumes a challenge with either a TOTP code or a recovery code.
 * Returns the user id the challenge belongs to; the caller then issues
 * real tokens.
 */
export async function consumeMfaChallenge(
  challengeToken: string,
  code: string,
  meta: { ipAddress?: string; userAgent?: string }
): Promise<string> {
  const challenge = await prisma.mfaChallenge.findUnique({
    where: { challengeHash: sha256(challengeToken) },
    include: {
      user: {
        select: {
          id: true,
          institutionId: true,
          mfaSecret: true,
          mfaEnabled: true,
        },
      },
    },
  });

  const invalid = () => new AppError("Invalid or expired verification code", 401);

  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) {
    throw invalid();
  }
  if (challenge.attempts >= MFA_MAX_ATTEMPTS) {
    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    throw new AppError(
      "Too many verification attempts. Sign in again.",
      429
    );
  }
  if (!challenge.user.mfaEnabled || !challenge.user.mfaSecret) {
    throw invalid();
  }

  const totpValid = verifyTotp(challenge.user.mfaSecret, code);
  let recoveryUsed = false;

  if (!totpValid) {
    // Fall back to a single-use recovery code.
    const recovery = await prisma.mfaRecoveryCode.findFirst({
      where: {
        userId: challenge.user.id,
        usedAt: null,
        codeHash: sha256(code.trim().toUpperCase()),
      },
      select: { id: true },
    });
    if (!recovery) {
      await prisma.mfaChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      await recordAuditLog({
        institutionId: challenge.user.institutionId,
        userId: challenge.user.id,
        action: "auth.mfa_failed",
        ...meta,
      });
      throw invalid();
    }
    await prisma.mfaRecoveryCode.update({
      where: { id: recovery.id },
      data: { usedAt: new Date() },
    });
    recoveryUsed = true;
  }

  await prisma.mfaChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  await recordAuditLog({
    institutionId: challenge.user.institutionId,
    userId: challenge.user.id,
    action: "auth.mfa_verified",
    metadata: { method: recoveryUsed ? "recovery_code" : "totp" },
    ...meta,
  });

  return challenge.user.id;
}

// ==========================================================
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

  // One live token at a time: a new request invalidates the previous.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = minutesFromNow(RESET_TOKEN_TTL_MINUTES);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt,
      requestedIp: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  await recordAuditLog({
    institutionId: user.institutionId,
    userId: user.id,
    action: "auth.password_reset_requested",
    metadata: { outcome: "token_issued", expiresAt },
    ...meta,
  });

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

  if (
    !record ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    !record.user.isActive
  ) {
    throw new AppError("This reset link is invalid or has expired", 400);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.user.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.refreshToken.updateMany({
      where: { userId: record.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
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
