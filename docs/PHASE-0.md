# Phase 0 — Foundation

## Scope
Established the ACADLYX project skeleton: independently runnable Next.js
frontend and Express/TypeScript backend, Prisma wired to PostgreSQL (no
models yet), a single health endpoint, and shared conventions the rest of
the phases build on.

## What exists after Phase 0
- `frontend/` — Next.js 14 (App Router) + TypeScript + Tailwind, one page
  that verifies connectivity to the backend health endpoint.
- `backend/` — Express + TypeScript, layered as
  `routes -> controllers -> (services/repositories in later phases)`,
  with centralized error handling and env config.
- `backend/prisma/schema.prisma` — datasource/generator only. Domain
  models (Institution, User, etc.) start in Phase 1.
- `GET /api/v1/health` — the only functional endpoint.

## Explicitly NOT in Phase 0
Authentication, RBAC, institutions, students, faculty, attendance,
assignments, fees, placement, AI/intelligence, dashboards.

## Decisions that affect future phases
- API is versioned under `/api/v1/...`; all future routes mount under
  the same `apiPrefix` built in `backend/src/app.ts`.
- All backend env access goes through `backend/src/config/env.ts` —
  no direct `process.env` reads elsewhere.
- Errors should be thrown as `AppError` (`backend/src/middleware/errorHandler.ts`)
  so status codes and response shape stay consistent as auth/RBAC/validation
  errors are added.
- Frontend API calls go through `frontend/src/lib/api.ts` (`apiFetch`/`apiUrl`).
  Auth headers and token refresh will be added inside this file in Phase 1
  without changing call sites.
- Institution branding will be applied via CSS variables
  (`--acadlyx-primary`, `--acadlyx-secondary` in `globals.css`) and
  `tailwind.config.ts` already maps `acadlyx-primary`/`acadlyx-secondary`
  to them — this is what makes white-labeling possible later without a
  Tailwind config rewrite.
- Logo assets for ACADLYX and AIMT are stored at
  `frontend/public/branding/` but are not yet referenced in any component.
- No database models exist yet, so `prisma migrate dev` has nothing to
  migrate in this phase — Phase 1 introduces the first migration
  (Institution, User, RBAC tables).
