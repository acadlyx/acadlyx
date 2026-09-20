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

function positiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const corsOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:3000"
)
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

export const env: EnvConfig = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: positiveInteger(
    process.env.PORT,
    5001
  ),

  apiVersion:
    process.env.API_VERSION || "v1",

  corsOrigin:
    corsOrigins[0] ||
    "http://localhost:3000",

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
    positiveInteger(
      process.env.JWT_REFRESH_EXPIRES_IN_DAYS,
      30
    ),

  bcryptSaltRounds:
    positiveInteger(
      process.env.BCRYPT_SALT_ROUNDS,
      10
    ),

  cloudinaryCloudName:
    process.env.CLOUDINARY_CLOUD_NAME,

  cloudinaryApiKey:
    process.env.CLOUDINARY_API_KEY,

  cloudinaryApiSecret:
    process.env.CLOUDINARY_API_SECRET,
};

export const isProduction =
  env.nodeEnv === "production";

export function assertAuthEnv(): void {
  const missingDatabase =
    !process.env.DATABASE_URL;

  const missingAccessSecret =
    !process.env.JWT_ACCESS_SECRET;

  const missingRefreshSecret =
    !process.env.JWT_REFRESH_SECRET;

  if (
    isProduction &&
    missingDatabase
  ) {
    throw new Error(
      "DATABASE_URL must be set in production."
    );
  }

  if (
    isProduction &&
    (!process.env.CORS_ORIGIN || corsOrigins.length === 0)
  ) {
    throw new Error(
      "CORS_ORIGIN must be set in production."
    );
  }

  if (
    isProduction &&
    (
      missingAccessSecret ||
      missingRefreshSecret
    )
  ) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production."
    );
  }

  if (
    isProduction &&
    (
      env.jwtAccessSecret.length < 32 ||
      env.jwtRefreshSecret.length < 32
    )
  ) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must each contain at least 32 characters in production."
    );
  }

  if (
    !isProduction &&
    (
      missingAccessSecret ||
      missingRefreshSecret
    )
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      "[WARN] JWT_ACCESS_SECRET/JWT_REFRESH_SECRET not set — using insecure defaults for local development only."
    );
  }
}
