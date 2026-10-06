import { apiFetch } from "./api";
import { authedFetch } from "./auth";
import { Envelope } from "./httpShared";

/** Account security: password, MFA, recovery, sessions and login activity. */

export interface SecuritySession {
  id: string;
  current: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ipAddress: string | null;
  browser: string;
  os: string;
  device: string;
}

export interface LoginActivityEntry {
  id: string;
  action: string;
  createdAt: string;
  ipAddress: string | null;
  browser: string;
  os: string;
  device: string;
}

export async function getSecuritySessions(): Promise<SecuritySession[]> {
  const res = await authedFetch<Envelope<SecuritySession[]>>("/security/sessions");
  return res.data;
}

export async function revokeSecuritySession(id: string) {
  const res = await authedFetch<Envelope<{ revoked: boolean; current: boolean }>>(
    "/security/sessions/" + encodeURIComponent(id),
    { method: "DELETE" }
  );
  return res.data;
}

export async function revokeOtherSecuritySessions() {
  const res = await authedFetch<Envelope<{ revoked: number }>>(
    "/security/sessions/revoke-other",
    { method: "POST" }
  );
  return res.data;
}

export async function getLoginActivity(): Promise<LoginActivityEntry[]> {
  const res = await authedFetch<Envelope<LoginActivityEntry[]>>("/security/login-activity");
  return res.data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await authedFetch<Envelope<{ message: string }>>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return res.data;
}



export interface MfaStatus {
  mfaEnabled: boolean;
  mfaEnrolledAt: string | null;
  recoveryCodesRemaining: number;
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const res =
    await authedFetch<
      Envelope<MfaStatus>
    >("/security/mfa");

  return res.data;
}

export async function beginMfaEnrollment(): Promise<{
  secret: string;
  otpauthUrl: string;
}> {
  const res =
    await authedFetch<
      Envelope<{
        secret: string;
        otpauthUrl: string;
      }>
    >(
      "/security/mfa/enroll",
      {
        method: "POST",
      },
    );

  return res.data;
}

export async function confirmMfaEnrollment(
  code: string,
): Promise<{
  enabled: boolean;
  recoveryCodes: string[];
}> {
  const res =
    await authedFetch<
      Envelope<{
        enabled: boolean;
        recoveryCodes: string[];
      }>
    >(
      "/security/mfa/confirm",
      {
        method: "POST",
        body: JSON.stringify({
          code,
        }),
      },
    );

  return res.data;
}

export async function disableMfa(
  password: string,
) {
  const res =
    await authedFetch<
      Envelope<{
        enabled: boolean;
      }>
    >(
      "/security/mfa/disable",
      {
        method: "POST",
        body: JSON.stringify({
          password,
        }),
      },
    );

  return res.data;
}

export async function revokeAllSessions() {
  const res =
    await authedFetch<
      Envelope<{
        revoked: number;
      }>
    >(
      "/security/sessions/revoke-all",
      {
        method: "POST",
      },
    );

  return res.data;
}

/**
 * Unauthenticated endpoints deliberately use the public API wrapper.
 * They do not bypass timeout/error normalization.
 */
async function publicPost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  return apiFetch<T>(
    path,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function requestPasswordReset(
  email: string,
) {
  const res =
    await publicPost<
      Envelope<{
        message: string;
        expiresInMinutes: number;
        resetToken?: string;
      }>
    >(
      "/security/forgot-password",
      {
        email,
      },
    );

  return res.data;
}

export async function resetPassword(
  token: string,
  newPassword: string,
) {
  const res =
    await publicPost<
      Envelope<{
        reset: boolean;
      }>
    >(
      "/security/reset-password",
      {
        token,
        newPassword,
      },
    );

  return res.data;
}

export async function verifyMfaChallenge(
  challengeToken: string,
  code: string,
) {
  return publicPost<
    Envelope<{
      mfaRequired: false;
      user: Record<
        string,
        unknown
      >;
      tokens: {
        accessToken: string;
        refreshToken: string;
      };
    }>
  >(
    "/auth/mfa/verify",
    {
      challengeToken,
      code,
    },
  );
}
