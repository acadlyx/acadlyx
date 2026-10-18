# ACADLYX staging deployment

This repository is prepared for the following staging topology:

- **Vercel** → `frontend/` (Next.js)
- **Render** → `backend/` (Express + Prisma)
- **Supabase** → PostgreSQL database

## 1. Supabase

Create a PostgreSQL project and copy its connection string.
Use the connection string as `DATABASE_URL` on Render. Keep the database credentials private.

The Render build runs Prisma migrations automatically through:

```text
npm ci && npm run render:build
```

Do not run `prisma migrate dev` against the staging/production database.

## 2. Render

The root `render.yaml` defines the API service.

Required manual environment variable:

```text
DATABASE_URL=<Supabase PostgreSQL connection string>
CORS_ORIGIN=https://<your-vercel-domain>
```

Render generates the two JWT secrets automatically from the Blueprint configuration.

After deployment, verify:

```text
https://<your-render-domain>/api/v1/health
```

Expected result is the API health response with HTTP 200.

## 3. Vercel

Create a Vercel project using `frontend/` as the project root.

Set:

```text
NEXT_PUBLIC_API_URL=https://<your-render-domain>
```

Do **not** add `/api/v1` to this variable. The frontend adds that path itself.

## 4. CORS

Once the Vercel production URL is known, set the same exact origin in Render's `CORS_ORIGIN` value, without a trailing slash.

For example:

```text
CORS_ORIGIN=https://acadlyx.example.com
```

Multiple browser origins can be supplied as a comma-separated value when needed.

## 5. First staging smoke test

Run these in order:

1. Render health endpoint returns 200.
2. Vercel application loads without API errors.
3. Admin login works.
4. Create institution data.
5. Create a student master profile.
6. Enroll the student into a program/section.
7. Assign faculty/course data.
8. Record attendance.
9. Record marks.
10. Verify the student's dashboard reflects the data.
11. Verify a user from one tenant cannot access another tenant's data.

## Important production notes

- Never commit `.env` files or real secrets.
- Keep Supabase credentials only in Render environment variables.
- `MAIL_ENABLED=false` means password-reset email delivery is not configured yet.
- The current frontend authentication implementation uses browser storage for tokens and should receive a dedicated security hardening pass before a broad institutional production rollout.
- The migration history contains a migration dated `20260921000000_core_erp_completion`. Verify the migration history against the target database before applying it to an existing database.

## Online payments, expense attachments and refund settlement

- Expense attachments use the existing private Cloudinary-backed `/api/v1/files` service. In Render, configure `STORAGE_PROVIDER=cloudinary` and `CLOUDINARY_URL` (or `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`). Supported documents are private and tenant-scoped; upload limit is 25 MB.
- Hosted student checkout is enabled only when `PAYMENT_PROVIDER=razorpay`, `PAYMENT_KEY_ID`, `PAYMENT_KEY_SECRET`, and `PAYMENT_WEBHOOK_SECRET` are configured in the backend service environment. Store these only in Render environment settings, never in Git.
- Configure Razorpay's webhook URL as `https://<your-api-host>/api/v1/payment-webhooks/razorpay` and subscribe to `payment.captured`. ACADLYX must not settle an invoice from an authorization-only event.
- Razorpay-collected refunds are initiated and polled against the provider API. ACADLYX reverses the financial ledger only after Razorpay reports the refund as `processed`. For offline payments, Accounts must confirm that funds have actually been returned and record the external bank/provider settlement reference before ACADLYX posts the reversal. No live charges or refunds are part of CI validation.
