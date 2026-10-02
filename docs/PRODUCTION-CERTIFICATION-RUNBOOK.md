# ACADLYX Production Certification Runbook

## 1. Application release gate

- GitHub Actions production-quality workflow must finish green on the exact release commit.
- Backend typecheck and tests must pass.
- Frontend typecheck, lint and production build must pass.
- Production smoke must reach the Render API health endpoint and Vercel application.

## 2. Required production secrets

### Core
- DATABASE_URL
- CORS_ORIGIN
- JWT_ACCESS_SECRET (32+ characters)
- JWT_REFRESH_SECRET (32+ characters)
- BCRYPT_SALT_ROUNDS=12

### Storage
- STORAGE_PROVIDER=cloudinary
- CLOUDINARY_URL or individual Cloudinary credentials

### Platform bootstrap
- SUPER_ADMIN_EMAIL
- SUPER_ADMIN_PASSWORD
- Optional SUPER_ADMIN_FIRST_NAME / SUPER_ADMIN_LAST_NAME

### Email
- EMAIL_PROVIDER=resend
- EMAIL_API_KEY
- EMAIL_FROM

Email must remain disabled rather than partially configured.

### Online payments
- PAYMENT_PROVIDER=razorpay
- PAYMENT_KEY_ID
- PAYMENT_KEY_SECRET
- PAYMENT_WEBHOOK_SECRET
- PAYMENT_CURRENCY=INR

If online payments are not contracted for an institution, use PAYMENT_PROVIDER=manual.

## 3. Tenant and role certification

Verify SUPER_ADMIN platform access, single-tenant institution users, disabled institution blocking, subscription blocking, direct URL authorization, navigation/action permission parity, and unauthorized API rejection.

Minimum role matrix: SUPER_ADMIN, INSTITUTION_ADMIN, MANAGEMENT, HOD, FACULTY, specialist operational roles, STUDENT, PARENT.

## 4. Responsive certification

Check authenticated routes at 320, 360, 375, 390, 414, 768, 1024, 1280, 1440 and 1920 pixels.

Verify no unintended horizontal overflow, mobile drawer behavior, ESC closing, focus trapping/restoration, responsive tables, forms, dialogs, filters and tabs.

## 5. Payments

For Razorpay: create a test order, complete test checkout, verify callback and webhook signatures, confirm exactly one internal payment, retry webhook for idempotency, verify invoice balance constraints, and verify failed/cancelled payments do not mark invoices paid.

Never enable live payment credentials until the complete test cycle passes.

## 6. Email

Using Resend: send a staging message, verify sender/domain authentication, verify delivery, verify provider failure handling, and confirm secrets never appear in logs.

## 7. Database backup and restoration

The application repository cannot perform an infrastructure restore itself. The production owner must confirm Supabase backup/PITR retention, create a restore point, restore into an isolated database, run Prisma migration status, start the backend against the restored database, run authentication/tenant/CRUD checks, compare critical row counts, and record the result.

A backup policy is not certified until an actual restoration succeeds.

## 8. Production data

- Run the production admin bootstrap only with dedicated production credentials.
- Do not run the demo seed in production.
- Create institutions, administrators, students and academic data through production workflows/imports.
- Remove test users and test payment records before go-live.

## 9. Go-live sign-off

Do not label the deployment 100% production-certified until CI is green on the exact release commit, responsive route QA and authorization matrix pass, enabled email/payment tests pass, backup restoration succeeds, and production data is verified clean.
