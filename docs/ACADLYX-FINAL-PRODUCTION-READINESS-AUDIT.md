# ACADLYX Final Independent Production-Readiness Audit — Milestone 8

Audit date: 2026-10-09  
Repository: acadlyx/acadlyx  
Application-source snapshot reviewed: ab4dfdec3aec12e086b0b9738d28a1056e670128  
Working branch: stabilization-platform-2026-10-09  
Baseline: production-upgrade-2026-09-20 at 6ddcc30697071b6e55505caaf68337f704bdc7cd  
Decision: **NO-GO for production release pending verification and remediation.**  
No deployment was performed or authorized.

## 1. Executive decision

ACADLYX is a substantial ERP codebase with frontend and backend packages, Prisma/PostgreSQL models, domain services, authorization middleware, background jobs, event/outbox code and unit/contract tests. Source inspection alone cannot establish that the audited branch builds, that migrations safely upgrade representative existing data, that tenant boundaries hold under adversarial requests, or that critical financial/academic workflows reconcile in a running deployment.

**Recommendation: NO-GO for production release at this time.** This is an evidence-based release gate, not a claim that an unauthorized access or data-corruption incident has been reproduced. The decisive blockers are:

1. No GitHub Actions run exists for stabilization-platform-2026-10-09 at the time queried. All inspected workflow triggers target the baseline production branch, so this candidate has no observed passing build/test/migration evidence.
2. No local checkout/command execution, authenticated running app, isolated database, payment sandbox, file-storage verification, or browser test environment was available. Build, tests, migration compatibility, adversarial isolation, finance reconciliation and generated admit-card integrity remain unverified.
3. render.yaml explicitly selects production-upgrade-2026-09-20 for both web and worker services. It does not identify the stabilization candidate as its deployment source. Release operators must explicitly review the intended source and release procedure before any deployment.
4. The candidate is 49 commits ahead of baseline and includes application changes to authentication/session validation, fee authorization/structure logic, frontend API caching, finance UI/navigation and examination fee eligibility. This is a meaningful release diff and cannot be accepted based only on documentation or a baseline-branch green run.

No critical security exploit or financial corruption was reproduced. However, critical security and financial controls are not verified against this candidate. Under the supplied decision rules, missing release-critical evidence is insufficient for GO or CONDITIONAL GO; NO-GO is appropriate until gates are demonstrated.

## 2. Exact release candidate and repository evidence

- GitHub branch endpoint reported stabilization-platform-2026-10-09 at ab4dfdec3aec12e086b0b9738d28a1056e670128 before this report-only commit.
- Baseline endpoint reported production-upgrade-2026-09-20 at 6ddcc30697071b6e55505caaf68337f704bdc7cd.
- GitHub compare: 49 commits ahead, 0 behind; merge base equals baseline SHA.
- GitHub combined status for the audited candidate returned no status checks.
- GitHub Actions query for branch=stabilization-platform-2026-10-09 returned total_count=0.
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
- Schema validation, generation, build, tests and migrations were not run against this candidate.

### CI workflows
Inspected .github/workflows/erp-verification.yml, frontend-build.yml, production-gate.yml and production-quality.yml.

- All inspected push/pull-request triggers target production-upgrade-2026-09-20; production-quality also supports manual dispatch.
- The production-quality workflow defines backend validation/build/lint/tests, a PostgreSQL 16 migration job, and frontend typecheck/lint/build.
- No workflow run was found for the stabilization branch. No passing results are attributed to this candidate.
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
- No login/refresh/logout/expiry tests were executed on this candidate.
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
- Migration presence does not prove safe upgrade of an existing database. No migration command or existing-data rehearsal ran on this candidate.
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

**NO-GO.** The codebase is not declared unbuildable; buildability is UNVERIFIED. The reason is that the exact stabilization candidate lacks an observed passing CI run and critical security, financial, workflow, migration, deployment and recovery gates have not been executed. Do not promote the candidate until those gates have evidence.

No production branch change, merge, deployment, production database operation or infrastructure mutation occurred during this audit.
