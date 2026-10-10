# ACADLYX Final Independent Production-Readiness Audit — Milestones 8–9

Audit updated: 2026-10-10  
Repository: acadlyx/acadlyx  
Application-source snapshot reviewed: ab4dfdec3aec12e086b0b9738d28a1056e670128  
Working branch: stabilization-platform-2026-10-09  
Baseline: production-upgrade-2026-09-20 at 6ddcc30697071b6e55505caaf68337f704bdc7cd  
Decision: **NO-GO for production release pending verification and remediation.**  
No deployment was performed or authorized.

## 1. Executive decision

ACADLYX is a substantial ERP codebase with frontend and backend packages, Prisma/PostgreSQL models, domain services, authorization middleware, background jobs, event/outbox code and unit/contract tests. Source inspection alone cannot establish that the audited branch builds, that migrations safely upgrade representative existing data, that tenant boundaries hold under adversarial requests, or that critical financial/academic workflows reconcile in a running deployment.

**Recommendation: NO-GO for production release at this time.** This is an evidence-based release gate, not a claim that an unauthorized access or data-corruption incident has been reproduced. The decisive blockers are:

1. The initial workflow-trigger blocker was confirmed and corrected on the stabilization branch. Exact-SHA hosted GitHub Actions runs for candidate `c10ec08489756ba770467fff7b81e7f992b2d0f0` completed successfully for the standard frontend/backend verification and clean PostgreSQL migration workflow. The live production smoke job was skipped on the stabilization ref.
2. Hosted CI ran clean lockfile installs, typechecks, lint, builds, the backend test suite (114 passed, 0 failed, 0 skipped) and all migrations against a disposable empty PostgreSQL 16 database. This is not local execution evidence and does not verify representative existing-data upgrades, adversarial HTTP isolation, finance/provider reconciliation, generated admit-card artifacts, live storage, browser behavior or disaster recovery.
3. render.yaml explicitly selects production-upgrade-2026-09-20 for both web and worker services. It does not identify the stabilization candidate as its deployment source. Release operators must explicitly review the intended source and release procedure before any deployment.
4. The reviewed application source tree is the same as `ab4dfdec3aec12e086b0b9738d28a1056e670128`; that SHA is an ancestor of the tested candidate. The current branch is 56 commits ahead of baseline after three Milestone 8 documentation commits and four Milestone 9 CI workflow commits. The candidate now has exact-SHA standard CI evidence, but that evidence does not close security, financial, existing-data migration or recovery gates.

No critical security exploit or financial corruption was reproduced. However, critical security and financial controls are not verified against this candidate. Under the supplied decision rules, missing release-critical evidence is insufficient for GO or CONDITIONAL GO; NO-GO is appropriate until gates are demonstrated.

## 2. Exact release candidate and repository evidence

- At Milestone 9 verification, GitHub reported stabilization-platform-2026-10-09 at `c10ec08489756ba770467fff7b81e7f992b2d0f0`. The earlier application-review SHA `ab4dfdec3aec12e086b0b9738d28a1056e670128` is an ancestor; the app source tree did not change in the later documentation/CI commits.
- Baseline endpoint reported production-upgrade-2026-09-20 at 6ddcc30697071b6e55505caaf68337f704bdc7cd.
- Current compare: 56 commits ahead, 0 behind; merge base equals baseline SHA `6ddcc30697071b6e55505caaf68337f704bdc7cd`.
- Exact-SHA hosted workflow runs are recorded in the Milestone 9 evidence addendum below. Initial empty status results predate the workflow trigger fix.
- The initial branch query returned zero runs before the trigger fix. Four workflows were then observed for tested SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`; all completed successfully.
- Recent baseline runs observed for SHA 6ddcc30697071b6e55505caaf68337f704bdc7cd: “Frontend build” and “ACADLYX Production Gate” concluded success. These runs verify baseline only, not this 49-commit candidate.
- GitHub does not expose the user's local working tree or uncommitted changes. Local tree cleanliness is UNVERIFIED; preserve local work and verify locally before checkout/merge.
- All seven required prior milestone reports exist on the stabilization branch. Governance and platform inventory reports also exist.
- Root-level package.json and root-level vercel.json returned 404. Frontend deployment config exists at frontend/vercel.json; this is a path distinction, not evidence that frontend config is missing.
- No production branch write, merge, deploy, production database query or infrastructure mutation was performed.

## 3. Stack and actual build/deployment configuration

### Frontend
Source: frontend/package.json, frontend/package-lock.json, frontend/vercel.json.

- Next.js 15.5.25; React and React DOM ^18.3.1; TypeScript ^5.6.0; Tailwind ^3.4.10.
- Declared Node engine: 24.x.
- Scripts: npm run validate:source && next build, next lint, and tsc -p tsconfig.json --noEmit.
- Lockfile exists. Clean install and actual build were not run.

### Backend
Source: backend/package.json, backend/package-lock.json, backend/prisma/schema.prisma.

- Express ^4.21.0; Prisma client/CLI ^5.20.0; TypeScript ^5.6.0; JWT, Zod, Helmet, rate limiter, Cloudinary, Multer and XLSX dependencies are declared.
- Declared Node engine: 20.x.
- Scripts include Prisma generation, TypeScript build/typecheck, ESLint, tsx --test src/__tests__/*.test.ts, migration deployment, API start and background worker start.
- Prisma datasource is PostgreSQL using DATABASE_URL.
- Frontend and backend declare different Node major versions; CI/deployment must use the matching version per package.
- Prisma validation/generation, backend typecheck/build/lint and tests passed in hosted CI; all migrations applied successfully to an empty disposable PostgreSQL 16 database. Existing-data migration safety remains unverified.

### CI workflows
Inspected .github/workflows/erp-verification.yml, frontend-build.yml, production-gate.yml and production-quality.yml.

- Milestone 9 added the stabilization branch to push and pull-request filters in all four inspected workflows. Each now has least-privilege `contents: read` permissions. The production-quality live smoke job is explicitly restricted to the production branch.
- The production-quality workflow defines backend validation/build/lint/tests, a PostgreSQL 16 migration job, and frontend typecheck/lint/build.
- Four hosted workflow runs passed on exact tested SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`. The production-quality run skipped its live production smoke job on the stabilization ref.
- Release condition: execute existing checks against the exact candidate SHA and make failures visible as a release gate. Do not modify production triggers or merge this branch merely to obtain a run.

### Deployment blueprint
Source: render.yaml.

- Web and worker services both select production-upgrade-2026-09-20 as their source branch.
- Web pre-deploy runs prisma migrate deploy and RBAC sync; service start runs npm start, whose package script also runs prisma migrate deploy and may bootstrap a super-admin when credentials are configured.
- Worker runs npm run worker with database and job settings supplied as environment variables.
- Config names environment variables, but hosted values and validity were not inspected. No secrets were retrieved or printed.
- Repeated migration invocation at pre-deploy and application start should be confirmed intentional and safe for the actual platform lifecycle; it is not asserted to be a failure.
- Health path is configured as /api/v1/health; deployed health/readiness semantics were not probed.
- A declared service plan is not capacity evidence. No throughput or concurrent-user capacity is claimed.

## 4. Summary of previous stabilization evidence

All reports below were independently re-opened on the working branch. They are source audits, not runtime verification.

| Evidence | Previous conclusion | Independent release interpretation |
|---|---|---|
| Milestone 1 platform stabilization | Source-level hardening and remaining gaps documented | Useful inventory, not a passing release gate |
| Milestone 2 baseline verification | Partially verified / runtime checks blocked | No candidate build/test proof |
| Milestone 3 security/RBAC | Partially verified; authored tests not executed | Authorization source exists; adversarial isolation tests required |
| Milestone 4 API/data reliability | Partially verified; cache race source fix | Cache invalidation needs regression tests and auth-isolation proof |
| Milestone 5 design/responsive | Partially verified; browser checks blocked | Focus trap, return-focus, role navigation and responsive behavior need browser verification |
| Milestone 6 performance/scalability | Partially verified; no benchmark/DB-plan/load evidence | Capacity and p95 latency remain unknown |
| Milestone 7 cross-module workflows | Partially verified; exam outstanding query corrected for refunds | Financial reconciliation and full E2E flows remain untested |

These reports are useful findings and scope maps, but their status labels do not substitute for tests on the current SHA.

## 5. Independent security and authorization gate

### Positive source evidence
- backend/src/middleware/authenticate.ts reloads roles, permissions, account status and effective institution context from the database rather than treating JWT claims as the full authorization source.
- Institution-context logic rejects conflicting role-institution bindings and rejects a platform super-admin that is also institution-scoped.
- backend/src/utils/refreshSession.ts checks session subject, revocation and expiry; refresh-session tests exist.
- Fee action permissions are centralized in backend/src/services/feeAuthorization.ts; fee structure service uses permission checks and route middleware is documented as the security boundary.
- Helmet and rate-limiter dependencies are declared.

### Release gaps
- The backend test suite ran on the tested SHA and passed 114 tests, including refresh-session and permission-catalogue checks. End-to-end login/refresh/logout/expiry behavior and adversarial HTTP access remain unverified.
- No adversarial HTTP requests tested student-to-student, parent-to-unlinked-student, Faculty-to-unassigned-class, HOD-to-other-department, Director-to-other-campus or cross-institution access.
- File upload/download access, background-job scope propagation, entitlement enforcement, sensitive audit writes and approval self-review rules were not verified end-to-end.
- No security scanner or complete unsafe-cast/disabled-check scan was executed.
- Source inspection does not prove every route invokes the appropriate middleware or every identifier query is tenant scoped.

**Status: UNVERIFIED for release-critical adversarial isolation; gate remains closed.** This is missing required proof, not a confirmed bypass.

## 6. Institutional workflow, finance, library and examination gates

| Area | Source evidence | Release status |
|---|---|---|
| Student/enrollment/registration/attendance | Dedicated services, scope helpers and existing workflow tests | PARTIALLY VERIFIED; no full lifecycle run |
| Finance structures/invoices/payments/receipts/refunds | Fee authorization, invoice/payment/refund schema and contract tests | PARTIALLY VERIFIED; no sandbox or DB reconciliation |
| Library inventory/circulation/fines | Catalog/copy/loan models, policy snapshots and charge integration | PARTIALLY VERIFIED; no duplicate-charge/concurrency/rollback test |
| Examination eligibility/admit cards/marks/results | Eligibility, generation jobs, templates/PDF services and lifecycle code | PARTIALLY VERIFIED; no actual artifact/count/publication check |
| Placement | Company/drive/application/offer services and role tests | PARTIALLY VERIFIED; no full drive-to-offer test |
| Approvals/governance | Workflow authority/state helpers and domain-specific approval code | PARTIALLY VERIFIED; self-approval/revocation/rejection paths need tests |
| Parent access and role dashboards | Parent portal and role-specific service paths | UNVERIFIED at browser/API integration level |
| Events/jobs/notifications | Durable job and event/outbox code and tests | PARTIALLY VERIFIED; delivery/retry/notification-failure behavior not executed |

Milestone 7 corrected exam fee eligibility to subtract refunds, include late fees and floor each invoice contribution at zero. The new examination-finance-integrity.test.ts is a source-contract regression guard; it was not run and does not prove database-backed reconciliation.

## 7. Database, migration and recovery

- Prisma schema uses PostgreSQL. Migration history covers tenant/academic entities, finance, examination, library, placement, jobs and domain events.
- `prisma migrate deploy` succeeded against an empty disposable PostgreSQL 16 database in hosted CI. Migration behavior against representative existing data, backups and recovery remains unverified.
- The checked-in CI migration job uses PostgreSQL 16 and prisma migrate deploy. This is useful clean-database evidence only when run successfully on the candidate; it does not replace testing representative existing data or restoring a backup.
- No schema-vs-migration drift check, production-safe backup verification, point-in-time restore test, foreign-key/unique-constraint concurrency test or query-plan inspection was executed.
- Live connection pool behavior and hosted database capacity were not established.
- Before release, confirm backup freshness, restore point, migration duration/locking, rollback compatibility and an approved migration window.

**Status: UNVERIFIED for existing-data migration safety and disaster recovery.**

## 8. Type safety, tests and code quality

- Package scripts are recorded above. The candidate has no observed branch CI runs and no commands were executed by this audit environment.
- Existing tests and CI scripts cover typecheck, lint, tests, Prisma validation and migration deploy.
- No claim is made that the new test passes or frontend/backend builds pass.
- No comprehensive scan was executed for any, unsafe casts, @ts-ignore, @ts-nocheck, disabled checks, skipped tests, unhandled promises or stale API contracts.
- A source change may still fail because of generated Prisma types, lockfile state, runtime configuration or interactions elsewhere.

**Status: BLOCKED pending exact-SHA CI and reproducible test output.**

## 9. Deployment, operations and performance

- Required variable names are visible in render.yaml; actual hosted values for database, storage and worker credentials are unknown and were not requested.
- No hosted environment, CORS preflight, cookie/token transport, TLS connection, storage upload/download, mail/payment integration, shutdown/restart, readiness check, alert or rollback was exercised.
- No runtime trace was reviewed to prove structured logging/correlation coverage.
- No representative API p50/p95, dashboard request count, query latency, CPU/memory, queue delay, worker throughput or load test was available.
- The previous bounded-cache change has no measured performance result.
- Deployment source branch mismatch between stabilization candidate and render.yaml must be explicitly resolved by release operators in an approved release-preparation change. This audit does not switch deployment source.

**Status: BLOCKED / UNVERIFIED depending on control; no capacity claim is made.**

## 10. Accessibility and role experience

Prior source audit added semantic dialog attributes, Escape close, body-scroll locking, focus-ring tokens and reduced-motion behavior. It explicitly left focus trap/return-focus gaps and did not execute browser tests. Role-specific routes, loading/error states, UUID selector audit, mobile layout, keyboard behavior and parity between UI visibility and backend permissions were not browser-verified.

**Status: PARTIALLY VERIFIED at source level; browser release checks blocked.**

## 11. Risk register and exact steps to clear NO-GO

See docs/ACADLYX-PRODUCTION-RELEASE-RISK-REGISTER.md for severity, impact, owner/workstream, status and verification test. Primary blockers are candidate CI absence, unverified security/data isolation, unverified finance/exam/library integrity, migration/restore uncertainty and deployment-source alignment.

1. Preserve and verify local working-tree changes; checkout/fetch the exact stabilization SHA in a clean local or CI workspace.
2. Frontend: run npm ci, npm run validate:source, npm run typecheck, npm run lint and npm run build using Node 24.
3. Backend: run npm ci, npx prisma validate, npx prisma generate, npm run typecheck, npm run build, npm run lint and npm test using Node 20.
4. Run migrations against disposable PostgreSQL 16, then rehearse upgrade from representative sanitized existing schema/data. Never reset or migrate production as a test.
5. Run adversarial tenant/campus/department/student/parent/file/entitlement tests and verify access after session/permission revocation.
6. Execute E2E financial reconciliation with sandbox payments/refunds, library charge idempotency, admit-card artifact/count validation, result publication and parent visibility.
7. Test retries, concurrent updates, worker failure/recovery, notification failure after commit, graceful shutdown and backup restore.
8. Resolve/approve deployment source and validate target environment variables by name without printing secrets; smoke-test health/readiness, TLS/CORS, storage and provider integrations.
9. Capture exact-SHA evidence, remediate all Critical/High risks, obtain owner acceptance for any residual noncritical risks, then repeat diff/branch review.
10. Only a separate authorized release decision may approve deployment. This audit does not authorize deployment or merge.

## 12. Final verdict

**NO-GO.** Standard exact-SHA hosted CI and clean-database migration checks passed, but release-critical adversarial authorization, finance/provider reconciliation, representative existing-data migration, admit-card artifacts, live integration and restore/recovery remain unverified. The codebase is not declared unbuildable. Do not promote the candidate until remaining critical gates have evidence.

No production branch change, merge, deployment, production database operation or infrastructure mutation occurred during this audit.


## 13. Milestone 9 — Exact-SHA hosted verification (2026-10-10)

Tested commit: `c10ec08489756ba770467fff7b81e7f992b2d0f0` on `stabilization-platform-2026-10-09`. The tested application source tree matches the reviewed application tree at `ab4dfdec3aec12e086b0b9738d28a1056e670128`; subsequent commits in this cycle changed workflow YAML only. Evidence is from hosted GitHub Actions, not local execution.

| Run | Exact-SHA result | Evidence |
|---|---|---|
| ACADLYX Production Quality | **SUCCESS**; backend clean install, Prisma validate/generate, typecheck, production build, lint and tests passed; frontend clean install, typecheck, lint and production build passed; PostgreSQL 16 empty-database migration job passed. Backend test output: 114 tests, 114 passed, 0 failed, 0 skipped. Live production smoke job was skipped on stabilization branch. | https://github.com/acadlyx/acadlyx/actions/runs/38031718249 |
| ACADLYX Production Gate | **SUCCESS**; backend and frontend verification jobs passed. | https://github.com/acadlyx/acadlyx/actions/runs/38031718250 |
| ACADLYX ERP verification | **SUCCESS**; backend and frontend jobs passed. | https://github.com/acadlyx/acadlyx/actions/runs/38031718247 |
| Frontend build | **SUCCESS**; source validation, TypeScript check and production build passed. | https://github.com/acadlyx/acadlyx/actions/runs/38031718309 |

### Milestone 9 CI trigger correction

The four workflows `.github/workflows/production-quality.yml`, `production-gate.yml`, `erp-verification.yml` and `frontend-build.yml` now include the stabilization branch in push and pull-request filters. Each declares `permissions: contents: read`. The production-quality workflow's live smoke job only runs when `github.ref == 'refs/heads/production-upgrade-2026-09-20'` and the event is not a pull request. Hosted evidence confirms the smoke job was skipped for the stabilization candidate. No deployment job was added.

### Scope limits / remaining release gates

- Clean migrations on an empty disposable PostgreSQL 16 database do not establish upgrade safety against representative existing data.
- Backend unit/contract tests passed, but the suite does not substitute for adversarial HTTP tests across all tenant/campus/department/student/parent/faculty/file/entitlement boundaries.
- Payment/refund provider behavior, canonical financial reconciliation, library exactly-once charges, admit-card persisted counts and nonempty PDF artifacts, marks/result publication, placement transitions, browser accessibility, load/capacity and backup restore were not exercised by these runs.
- The frontend manifest has no unit/integration test script; the frontend's source validation, typecheck, lint and production build are verified, but frontend runtime/unit tests are not.
- Existing-data migration and disaster-recovery gates remain BLOCKED/UNVERIFIED. Keep the overall release decision NO-GO.

The GitHub branch currently advances beyond the tested SHA when these evidence documents are updated. No application code is changed by this report update; CI results above apply exactly to the stated tested SHA, not by implication to any future code change.
