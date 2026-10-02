import { apiFetch } from "./api";
import { authedFetch } from "./auth";
import { Envelope } from "./httpShared";

/** Account security: MFA, password reset and session control. */

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
