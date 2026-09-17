import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  apiVersion: string;
  corsOrigin: string;
  corsOrigins: string[];
  databaseUrl: string | undefined;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresInDays: number;
  bcryptSaltRounds: number;
  cloudinaryCloudName: string | undefined;
  cloudinaryApiKey: string | undefined;
  cloudinaryApiSecret: string | undefined;
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function parseCorsOrigins(value: string | undefined): string[] {
  const raw = value || "http://localhost:3000";

  const origins = raw
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  return origins.length > 0
    ? origins
    : ["http://localhost:3000"];
}

const corsOrigins = parseCorsOrigins(
  process.env.CORS_ORIGIN
);

/**
 * Centralized, typed application environment.
 *
 * Keep these properties flat because the existing ACADLYX
 * services already consume these names directly.
 */
export const env: EnvConfig = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT) || 5001,

  apiVersion:
    process.env.API_VERSION || "v1",

  corsOrigin: corsOrigins[0],

  corsOrigins,

  databaseUrl:
    process.env.DATABASE_URL,

  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET ||
    "insecure-dev-access-secret",

  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    "insecure-dev-refresh-secret",

  jwtAccessExpiresIn:
    process.env.JWT_ACCESS_EXPIRES_IN ||
    "15m",

  jwtRefreshExpiresInDays:
    Number(
      process.env.JWT_REFRESH_EXPIRES_IN_DAYS
    ) || 30,

  bcryptSaltRounds:
    Number(
      process.env.BCRYPT_SALT_ROUNDS
    ) || 10,

  cloudinaryCloudName:
    process.env.CLOUDINARY_CLOUD_NAME,

  cloudinaryApiKey:
    process.env.CLOUDINARY_API_KEY,

  cloudinaryApiSecret:
    process.env.CLOUDINARY_API_SECRET,
};

export const isProduction =
  env.nodeEnv === "production";

/**
 * Production must never silently start with the
 * development fallback JWT secrets.
 */
export function assertAuthEnv(): void {
  const usingDefaults =
    !process.env.JWT_ACCESS_SECRET ||
    !process.env.JWT_REFRESH_SECRET;

  if (isProduction && usingDefaults) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production."
    );
  }

  if (isProduction) {
    if (
      env.jwtAccessSecret.length < 32 ||
      env.jwtRefreshSecret.length < 32
    ) {
      throw new Error(
        "JWT access and refresh secrets must each be at least 32 characters in production."
      );
    }
  }

  if (!isProduction && usingDefaults) {
    // eslint-disable-next-line no-console
    console.warn(
      "[WARN] JWT_ACCESS_SECRET/JWT_REFRESH_SECRET not set — using insecure defaults for local development only."
    );
  }
}
