# ACADLYX Baseline Verification — Milestone 2

Date: 2026-10-09
Repository: `acadlyx/acadlyx`
Working branch: `stabilization-platform-2026-10-09`
Base branch: `production-upgrade-2026-09-20`
Scope: source/toolchain baseline inspection. No deployment, production write, database mutation, or environment-secret access was performed.

## Executive status

**Overall: UNVERIFIED / BLOCKED for executable checks.** Repository manifests and configuration were inspected through the GitHub repository connector. This environment has Node.js/npm installed but does not contain a checkout of ACADLYX; the available GitHub connector provides remote source reads and commits but no command runner against the checkout. Consequently TypeScript, lint, test, build, Prisma CLI and runtime checks could not be executed. No test or build is claimed to pass based on source inspection alone.

## Starting revision and working-tree state

- Working branch's last confirmed commit at audit start: `7a696d70c71c8954328105369c0400d24aa76b27` — “Use Express NextFunction type in Finance middleware tests”.
- Commit URL: https://github.com/acadlyx/acadlyx/commit/7a696d70c71c8954328105369c0400d24aa76b27
- Branch comparison reported `ahead_by=30`, `behind_by=0`; reported base/merge-base SHA: `6ddcc30697071b6e55505caaf68337f704bdc7cd`. No changes were written to the base branch by this milestone.
- GitHub commit status query for the recorded working revision returned no status entries. This means no status evidence was returned; it does **not** establish a passing CI run.
- Local `git status` / working-tree state: **BLOCKED** — there is no repository checkout in the execution container. The remote working branch changes from the prior milestone are committed. No local uncommitted changes could be inspected or preserved by this interface.
- Execution container versions: Node.js `v22.16.0`, npm `10.9.2`. These are tool-container versions, not proof of the deployed or CI toolchain.

## Repository structure and package manager

The root README documents separate `frontend/` and `backend/` packages. Root `package.json` was not found. Both packages have `package-lock.json` files with lockfileVersion 3, so npm is the evidenced package manager for each independent package; no npm workspace is declared in either inspected manifest.

| Package | Node engine in manifest and lock | Relevant scripts |
|---|---|---|
| `frontend/` | `24.x` | `npm run validate:source`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run dev`, `npm start` |
| `backend/` | `20.x` | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run prisma:generate`, `npx prisma validate`, `npx prisma migrate status`, `npm run dev` |

Frontend is Next.js `15.5.25`, React `^18.3.1`, TypeScript `^5.6.0`. Its TypeScript configuration enables strict mode and uses Next.js path alias `@/*`. Its ESLint flat config extends `next/core-web-vitals` and `next/typescript`; `@typescript-eslint/no-explicit-any` is a warning, not a build gate.

Backend uses Express `^4.21.0`, Prisma/`@prisma/client` `^5.20.0`, TypeScript `^5.6.0`, ESLint 9 with `typescript-eslint`, and strict TypeScript settings including `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, and `forceConsistentCasingInFileNames`. Its test script is `tsx --test src/__tests__/*.test.ts`.

The package manifests and each lockfile root entry were parsed and compared through source retrieval: dependency/devDependency/optionalDependency specs match in both packages. This is a static manifest-to-lock comparison, not an `npm ci` installation test.

## Verification ledger

Status definitions: PASS = executed successfully; FAIL = executed and failed; UNVERIFIED = not executed or insufficient evidence; BLOCKED = the required runtime/checkout/service is unavailable.

| Verification item | Exact command or evidence | Result |
|---|---|---|
| Working branch and base isolation | GitHub compare: `production-upgrade-2026-09-20` → `stabilization-platform-2026-10-09` | PASS for remote branch comparison; no production write/deploy performed |
| Local git status / uncommitted changes | `git status --short --branch` | BLOCKED — no checkout; no exit code because command could not be run in the repository |
| Toolchain version | `node --version`; `npm --version` in execution container | PASS — `v22.16.0`, `10.9.2`; does not satisfy both package engine declarations in one runtime |
| Frontend manifest/lock consistency | Parsed `frontend/package.json` and `frontend/package-lock.json` root dependency maps | PASS — no spec differences detected statically |
| Backend manifest/lock consistency | Parsed `backend/package.json` and `backend/package-lock.json` root dependency maps | PASS — no spec differences detected statically |
| Frontend dependency install | `cd frontend && npm ci` | BLOCKED — repository checkout unavailable; exit code N/A |
| Frontend TypeScript | `cd frontend && npm run typecheck` | BLOCKED — not executed; exit code N/A |
| Frontend ESLint | `cd frontend && npm run lint` | BLOCKED — not executed; exit code N/A |
| Frontend unit tests | No frontend test script was present in the inspected `frontend/package.json` | UNVERIFIED — test framework/config was not exhaustively enumerated |
| Frontend source validator | `cd frontend && npm run validate:source` | BLOCKED — not executed; exit code N/A |
| Frontend production build | `cd frontend && npm run build` | BLOCKED — not executed; exit code N/A |
| Backend dependency install | `cd backend && npm ci` | BLOCKED — repository checkout unavailable; exit code N/A |
| Backend TypeScript | `cd backend && npm run typecheck` | BLOCKED — not executed; exit code N/A |
| Backend ESLint | `cd backend && npm run lint` | BLOCKED — not executed; exit code N/A |
| Backend unit/integration/API tests | `cd backend && npm test` | BLOCKED — not executed; exit code N/A |
| Backend production compilation | `cd backend && npm run build` | BLOCKED — not executed; exit code N/A |
| Prisma client generation | `cd backend && npm run prisma:generate` | BLOCKED — not executed; exit code N/A |
| Prisma schema validation | `cd backend && npx prisma validate` | BLOCKED — not executed; exit code N/A |
| Migration status | `cd backend && npx prisma migrate status` against an explicitly configured test/staging database | BLOCKED — no database connection was configured or tested; command intentionally not run |
| Migration destructive-operation review | Inspect every file under `backend/prisma/migrations/` | UNVERIFIED — migration directory enumeration/review was not possible with the available file-reading calls; no migrations were applied |
| Runtime frontend startup / browser routes | `cd frontend && npm run dev` plus browser smoke tests | BLOCKED — no checkout and no browser test environment |
| Runtime API startup / health | `cd backend && npm run dev`; GET `/api/v1/health` (version prefix must match configuration) | BLOCKED — not executed; no API runtime or database configured |
| Authentication / database connectivity | Isolated test configuration and test account requests | BLOCKED — no credentials or test database were supplied; secrets were not requested or printed |
| CI status for recorded working commit | GitHub combined-status query for `7a696d70c71c8954328105369c0400d24aa76b27` | UNVERIFIED — returned an empty status list |
| Secrets scan / final local diff | `git diff --check`, `git diff --stat`, secret scanning | BLOCKED — no checkout; source reads did not reveal or expose secrets |

No command that was not executed is represented as PASS or FAIL. There are no measured command exit codes for blocked checks; they are explicitly marked N/A.

## Initial findings and risk inventory

### B1 — Executable verification unavailable

- **Classification:** ENVIRONMENT-BLOCKED.
- **Evidence:** Container root and `/mnt/data` do not contain an ACADLYX checkout; available Node/npm executables alone cannot run the project.
- **Impact:** Build/type/test defects cannot be confirmed or excluded; the previous milestone's added tests have not been executed.
- **Correction:** Run the commands in this ledger in a full checkout of the exact recorded branch commit, using the package-specific supported Node versions.
- **Regression evidence needed:** Complete command logs and exit codes from frontend and backend checks.

### B2 — Frontend/backend Node engine declarations differ

- **Classification:** CONFIRMED configuration fact; operational impact depends on how CI/deployment installs each package.
- **Evidence:** Frontend manifest and lock declare Node `24.x`; backend manifest and lock declare Node `20.x`.
- **Impact:** A single Node version does not satisfy both declared engines. Separate package build jobs/containers or an explicit engine policy are needed; changing either declaration without checking deployment compatibility would be unsafe.
- **Correction:** Inspect the actual CI/deployment build contexts and pin the corresponding package runtime. No engine field was changed in this milestone.
- **Regression evidence needed:** Clean install and build in each package's declared Node version.

### B3 — Frontend lint command has not been validated against the installed Next version

- **Classification:** SUSPECTED, not a confirmed defect.
- **Evidence:** Frontend script is `next lint` while Next is pinned to `15.5.25`. The lint command was not executed.
- **Impact:** The command may fail or report project/configuration problems; source inspection alone cannot establish that.
- **Correction:** Run `npm run lint`; if it fails, fix the configuration/script based on the actual error without disabling rules.
- **Regression evidence needed:** Successful ESLint execution over the intended source tree.

### B4 — No root package/workspace script

- **Classification:** CONFIRMED repository structure fact, not necessarily a defect.
- **Evidence:** Root `package.json` lookup returned NOT_FOUND; README describes independent frontend/backend folders, each with its own lockfile.
- **Impact:** Root-level `npm test` or `npm run build` is not the supported command path based on inspected manifests.
- **Correction:** Use package-specific commands or add a root orchestrator only if an explicit project requirement warrants it. No new root manifest was introduced.

### B5 — CI and migration-history evidence incomplete

- **Classification:** UNVERIFIED.
- **Evidence:** GitHub status query returned no statuses; workflow file discovery and complete migration enumeration could not be confirmed with the available connector. A repository audit document references GitHub Actions historically, but that is not evidence of a current passing run.
- **Impact:** No verified CI gate, migration safety result, or schema drift result can be claimed.
- **Correction:** Inspect `.github/workflows/` and all migration folders from a full checkout; review migrations before using a test/staging database.
- **Regression evidence needed:** Workflow job results and `prisma migrate status` against an explicitly approved non-production database.

## Backend initialization and runtime source inspection

Source inspection (not runtime verification) established:

- `backend/src/index.ts` calls `assertAuthEnv()` before creating/listening on the API server.
- The server mounts the health router under `/api/${env.apiVersion}/health` and starts periodic lifecycle cleanup/outbox processing; optional RBAC synchronization runs at boot when enabled and a database URL exists.
- `backend/src/app.ts` configures Helmet, CORS, JSON parsing, request context, auth routes, health routes and an error handler.
- `backend/src/config/env.ts` includes production checks for database URL and JWT secrets. No secret values were read into this report.
- These observations do not establish successful startup, database connectivity, readiness correctness, middleware order under live requests, or successful authentication.

## Fixes made in Milestone 2

**No application-code defect was changed in this milestone.** The required executable evidence is unavailable, and there is no confirmed failing command from which to derive a safe, targeted code fix. No checks were disabled, types weakened, environment variables fabricated, database commands run, or production changes made.

The baseline report itself is the deliverable; the previous Finance authorization changes and tests remain as they were on the working branch.

## Database safety

- Prisma schema source was inspected and declares PostgreSQL with `DATABASE_URL`.
- Migration lock declares provider `postgresql`.
- Prisma schema validation, client generation, migration status and drift detection were **not run**.
- No database URL was supplied to a command, no migration was applied, and no reset was attempted.
- Schema/migration safety is therefore **UNVERIFIED**, not PASS.

## Runtime verification

- Frontend startup: **BLOCKED**.
- Backend startup and health request: **BLOCKED**.
- Database connectivity: **BLOCKED**.
- Authentication and representative authorized API calls: **BLOCKED**.
- Browser hydration/network/console checks: **BLOCKED**.
- No runtime correctness claim is made.

## Recommended next milestone

1. Obtain/use a full checkout of `stabilization-platform-2026-10-09` at the recorded commit and record `git status --short --branch`.
2. Install frontend dependencies under Node 24 and backend dependencies under Node 20 using `npm ci`; do not regenerate lockfiles unless a reproducible inconsistency is demonstrated.
3. Run every package script in the verification ledger, capture stdout/stderr and exit codes, and fix only reproducible failures.
4. Review the actual CI workflow definitions and obtain CI run evidence.
5. Review all Prisma migrations, run schema validation/client generation, and query migration status only against an explicitly configured test/staging database.
6. Run isolated frontend/API startup and health/auth smoke tests using test data.
7. Update this report with actual results and a final diff/secrets review. Do not label the baseline clean while any required check is FAIL, UNVERIFIED or BLOCKED.

## Final status

**MILESTONE 2: UNVERIFIED / ENVIRONMENT-BLOCKED.** Package/lock metadata was statically compared and source configuration was inspected. The acceptance criteria requiring executed builds/tests, Prisma validation, runtime verification and exact command exit codes are not met in this environment. No production deployment or production-branch modification was performed.
