import { rateLimit } from "express-rate-limit";

const fifteenMinutes = 15 * 60 * 1000;

const common = {
  windowMs: fifteenMinutes,
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: "Too many requests. Please try again later.",
    },
  },
};

/** Limits password guessing while allowing normal authenticated use. */
export const loginRateLimit = rateLimit({
  ...common,
  max: 10,
  skipSuccessfulRequests: true,
});

/** Limits refresh-token probing and accidental retry loops. */
export const tokenRateLimit = rateLimit({
  ...common,
  max: 60,
});

/** Sensitive authenticated password changes are intentionally stricter than ordinary API traffic. */
export const passwordChangeRateLimit = rateLimit({
  ...common,
  max: 5,
  skipSuccessfulRequests: true,
});
