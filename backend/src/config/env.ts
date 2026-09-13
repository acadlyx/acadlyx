import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  apiVersion: string;
  corsOrigin: string;
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

/**
 * Centralized, typed access to environment variables.
 * Every future module should read config from here instead of
 * calling process.env directly, so env handling stays in one place.
 */
export const env: EnvConfig = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5001,
  apiVersion: process.env.API_VERSION || "v1",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "insecure-dev-access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "insecure-dev-refresh-secret",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresInDays: Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS) || 30,
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
};

export const isProduction = env.nodeEnv === "production";

/**
 * Fail fast on missing auth secrets outside of local dev, rather than
 * silently signing tokens with an empty-string secret.
 */
export function assertAuthEnv(): void {
  const usingDefaults = !process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET;

  if (isProduction && usingDefaults) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production."
    );
  }
  if (!isProduction && usingDefaults) {
    // eslint-disable-next-line no-console
    console.warn(
      "[WARN] JWT_ACCESS_SECRET/JWT_REFRESH_SECRET not set — using insecure defaults for local dev only."
    );
  }
}
