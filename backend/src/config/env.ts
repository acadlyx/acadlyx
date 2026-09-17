import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();

  return value || fallback;
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name]?.trim();

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Environment variable ${name} must be a valid number.`
    );
  }

  return parsed;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }

  if (value === "false" || value === "0" || value === "no") {
    return false;
  }

  throw new Error(
    `Environment variable ${name} must be true/false.`
  );
}

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

const nodeEnv = optional("NODE_ENV", "development");

const isProduction = nodeEnv === "production";

const databaseUrl = required("DATABASE_URL");

const jwtAccessSecret = required("JWT_ACCESS_SECRET");
const jwtRefreshSecret = required("JWT_REFRESH_SECRET");

if (isProduction) {
  if (jwtAccessSecret.length < 32) {
    throw new Error(
      "JWT_ACCESS_SECRET must contain at least 32 characters in production."
    );
  }

  if (jwtRefreshSecret.length < 32) {
    throw new Error(
      "JWT_REFRESH_SECRET must contain at least 32 characters in production."
    );
  }
}

const corsOriginRaw = optional(
  "CORS_ORIGIN",
  "http://localhost:3000"
);

const corsOrigins = corsOriginRaw
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

if (corsOrigins.length === 0) {
  throw new Error("At least one CORS origin must be configured.");
}

export const env = {
  nodeEnv,

  isProduction,

  port: numberEnv("PORT", 5001),

  apiVersion: optional("API_VERSION", "v1"),

  databaseUrl,

  corsOrigin: corsOrigins[0],

  corsOrigins,

  jwt: {
    accessSecret: jwtAccessSecret,
    refreshSecret: jwtRefreshSecret,

    accessExpiresIn: optional(
      "JWT_ACCESS_EXPIRES_IN",
      "15m"
    ),

    refreshExpiresIn: optional(
      "JWT_REFRESH_EXPIRES_IN",
      "30d"
    ),
  },

  cloudinary: {
    cloudName: optional("CLOUDINARY_CLOUD_NAME", ""),
    apiKey: optional("CLOUDINARY_API_KEY", ""),
    apiSecret: optional("CLOUDINARY_API_SECRET", ""),
  },

  upload: {
    maxFileSizeMb: numberEnv("MAX_FILE_SIZE_MB", 10),
  },

  security: {
    trustProxy: booleanEnv("TRUST_PROXY", isProduction),

    loginRateLimitWindowMs: numberEnv(
      "LOGIN_RATE_LIMIT_WINDOW_MS",
      15 * 60 * 1000
    ),

    loginRateLimitMax: numberEnv(
      "LOGIN_RATE_LIMIT_MAX",
      10
    ),
  },

  app: {
    name: optional("APP_NAME", "ACADLYX"),
    frontendUrl: normalizeOrigin(
      optional(
        "FRONTEND_URL",
        "http://localhost:3000"
      )
    ),
  },
};

export { isProduction };
