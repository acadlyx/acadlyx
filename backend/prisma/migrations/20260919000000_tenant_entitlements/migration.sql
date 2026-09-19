CREATE TABLE "tenant_subscriptions" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'STANDARD',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "trialEndsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "renewsAt" TIMESTAMP(3),
  "studentLimit" INTEGER,
  "userLimit" INTEGER,
  "facultyLimit" INTEGER,
  "storageLimitMb" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_subscriptions_institutionId_key" ON "tenant_subscriptions"("institutionId");
CREATE INDEX "tenant_subscriptions_status_idx" ON "tenant_subscriptions"("status");
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tenant_feature_entitlements" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "limitValue" INTEGER,
  "override" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_feature_entitlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_feature_entitlements_institutionId_featureKey_key" ON "tenant_feature_entitlements"("institutionId", "featureKey");
CREATE INDEX "tenant_feature_entitlements_subscriptionId_idx" ON "tenant_feature_entitlements"("subscriptionId");
ALTER TABLE "tenant_feature_entitlements" ADD CONSTRAINT "tenant_feature_entitlements_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_feature_entitlements" ADD CONSTRAINT "tenant_feature_entitlements_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "tenant_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "tenant_subscriptions" ("id", "institutionId", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), "id", CURRENT_TIMESTAMP
FROM "institutions"
ON CONFLICT ("institutionId") DO NOTHING;
