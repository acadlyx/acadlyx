export interface RefreshSessionState {
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

/**
 * Access tokens are bound to the refresh-token record that issued them.
 * A signed JWT alone is not sufficient after logout, rotation, revocation,
 * expiry, or account/session replacement.
 */
export function isActiveRefreshSession(
  session: RefreshSessionState | null | undefined,
  userId: string,
  now: Date = new Date(),
): boolean {
  return Boolean(
    session &&
    session.userId === userId &&
    session.revokedAt === null &&
    session.expiresAt.getTime() > now.getTime()
  );
}
