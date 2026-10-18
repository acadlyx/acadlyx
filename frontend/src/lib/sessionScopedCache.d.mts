export function sessionScopedCacheKey(
  sessionScope: number,
  params: Record<string, string | undefined>,
): string;

export function isSessionCurrent(
  requestedScope: number,
  currentScope: number,
): boolean;

export function canApplySessionResponse(
  requestedScope: number,
  currentScope: number,
  requestedGeneration: number,
  currentGeneration: number,
): boolean;
