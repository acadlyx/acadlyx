import crypto from "crypto";
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

  cloudinaryUrl: string | undefined;
  cloudinaryCloudName: string | undefined;
  cloudinaryApiKey: string | undefined;
  cloudinaryApiSecret: string | undefined;
  storageProvider: string;
  storageSignedUrlTtlSeconds: number;

  emailProvider: string;
  emailApiKey: string | undefined;
  emailFrom: string | undefined;
  frontendUrl: string;

  paymentProvider: string;
  paymentKeyId: string | undefined;
  paymentKeySecret: string | undefined;
  paymentWebhookSecret: string | undefined;
  paymentCurrency: string;
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
    crypto.randomBytes(48).toString("hex"),

  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    crypto.randomBytes(48).toString("hex"),

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

  cloudinaryUrl:
    process.env.CLOUDINARY_URL,

  cloudinaryCloudName:
    process.env.CLOUDINARY_CLOUD_NAME,

  cloudinaryApiKey:
    process.env.CLOUDINARY_API_KEY,

  cloudinaryApiSecret:
    process.env.CLOUDINARY_API_SECRET,

  storageProvider:
    process.env.STORAGE_PROVIDER || "cloudinary",

  storageSignedUrlTtlSeconds:
    positiveInteger(process.env.STORAGE_SIGNED_URL_TTL_SECONDS, 900),

  emailProvider: (process.env.EMAIL_PROVIDER || "disabled").toLowerCase(),
  emailApiKey: process.env.EMAIL_API_KEY,
  emailFrom: process.env.EMAIL_FROM,
  frontendUrl: (process.env.FRONTEND_URL || corsOrigins[0] || "http://localhost:3000").replace(/\/+$/, ""),

  paymentProvider: (process.env.PAYMENT_PROVIDER || "manual").toLowerCase(),
  paymentKeyId: process.env.PAYMENT_KEY_ID,
  paymentKeySecret: process.env.PAYMENT_KEY_SECRET,
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
  paymentCurrency: process.env.PAYMENT_CURRENCY || "INR",
};

export const isProduction =
  env.nodeEnv === "production";

export function assertAuthEnv(): void {
  const missingDatabase =
    !process.env.DATABASE_URL;

  const missingCorsOrigin =
    !process.env.CORS_ORIGIN ||
    corsOrigins.length === 0;

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
    missingCorsOrigin
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

  if (!isProduction && (missingAccessSecret || missingRefreshSecret)) {
    console.warn(
      "[WARN] JWT secrets are not configured; ephemeral development secrets are being used for this process only. Restarting the local process invalidates local development tokens."
    );
  }

  if (isProduction && env.bcryptSaltRounds < 12) {
    throw new Error(
      "BCRYPT_SALT_ROUNDS must be at least 12 in production."
    );
  }

  if (isProduction && corsOrigins.some((origin) => origin === "*")) {
    throw new Error(
      "CORS_ORIGIN cannot contain * in production."
    );
  }

  if (isProduction && env.emailProvider !== "disabled" && (!env.emailApiKey || !env.emailFrom)) {
    throw new Error(
      "Configured email provider requires EMAIL_API_KEY and EMAIL_FROM in production."
    );
  }

  if (isProduction && env.paymentProvider !== "manual" && env.paymentProvider !== "razorpay") {
    throw new Error(
      `Unsupported production payment provider: ${env.paymentProvider}. Currently supported online provider: razorpay.`
    );
  }

  if (isProduction && env.paymentProvider === "razorpay" && (!env.paymentKeyId || !env.paymentKeySecret || !env.paymentWebhookSecret)) {
    throw new Error(
      "Razorpay production payments require PAYMENT_KEY_ID, PAYMENT_KEY_SECRET and PAYMENT_WEBHOOK_SECRET."
    );
  }

  if (isProduction && env.storageProvider === "cloudinary" && (
    !env.cloudinaryUrl &&
    (!env.cloudinaryCloudName ||
      !env.cloudinaryApiKey ||
      !env.cloudinaryApiSecret)
  )) {
    throw new Error(
      "Cloudinary storage requires CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in production."
    );
  }
}
