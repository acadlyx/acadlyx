/**
 * Minimal logger wrapper.
 * Kept intentionally simple in Phase 0 — swap the implementation
 * (e.g. pino/winston) later without touching call sites.
 */
export const logger = {
  info: (message: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.log(`[INFO] ${message}`, meta ?? "");
  },
  error: (message: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`, meta ?? "");
  },
  warn: (message: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${message}`, meta ?? "");
  },
};
