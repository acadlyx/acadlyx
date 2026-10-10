# ACADLYX Deployment and Rollback Checklist — Milestones 8–9

Status: **NOT APPROVED FOR DEPLOYMENT**  
Updated: 2026-10-10  
Application source snapshot reviewed: ab4dfdec3aec12e086b0b9738d28a1056e670128; exact-SHA CI tested: c10ec08489756ba770467fff7b81e7f992b2d0f0 on stabilization-platform-2026-10-09  
Baseline: production-upgrade-2026-09-20 / 6ddcc30697071b6e55505caaf68337f704bdc7cd

This is a checklist, not a deployment instruction. Do not deploy or merge unless separately authorized after NO-GO blockers are cleared. No production action was performed during preparation.

## A. Release authorization and source identity

- [ ] Authorized release owner changes decision from NO-GO based on evidence.
- [ ] Confirm exact source branch and full commit SHA.
- [ ] Verify local working-tree status; preserve uncommitted user changes.
- [ ] Compare candidate with production-upgrade-2026-09-20; review all application, migration, configuration and dependency changes.
- [ ] Confirm build artifact identity corresponds to approved commit.
- [ ] Close all Critical and High risks or document owner acceptance where policy permits.
- [ ] Confirm change window, operator, reviewer, incident contact and stop conditions.
- [ ] Do not merge or deploy as part of this audit.

## B. Exact-SHA CI and package validation

### Frontend — Node 24.x, working directory frontend

- [x] `npm ci` succeeds from `frontend/package-lock.json` in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npm run validate:source` succeeds in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npm run typecheck` succeeds in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npm run lint` succeeds in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npm run build` succeeds after clean `npm ci` in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [ ] Save logs, exit codes, commit SHA, Node/npm versions and artifact identity.
- [ ] Smoke-test authentication, route protection, finance screens, student/parent views, examination/placement/library flows and mobile layouts against candidate API.

### Backend — Node 20.x, working directory backend

- [x] `npm ci` succeeds from `backend/package-lock.json` in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npx prisma validate` succeeds in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npx prisma generate` succeeds in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npm run typecheck` succeeds in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npm run build` succeeds in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npm run lint` succeeds in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [x] `npm test` succeeds in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`: 114 passed, 0 failed, 0 skipped.
- [x] `npm test` includes the configured backend test suite on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`; all 114 tests passed. This does not imply end-to-end finance/library/exam/provider tests were performed.
- [ ] Verify no critical check was disabled or bypassed.

Milestone 9 hosted CI execution evidence is recorded above and below. No local command execution was performed in this environment; all checkmarks explicitly identify hosted CI evidence and the tested SHA.

## C. Security and authorization

- [ ] Verify login, invalid credentials, lockout/rate limits, access-token expiry, refresh rotation/reuse, logout/revocation, disabled user and permission changes.
- [ ] Attempt cross-institution reads/writes by substituting IDs on sensitive API families.
- [ ] Attempt cross-campus and cross-department access, including HOD/program and Director/campus mismatch.
- [ ] Verify Faculty assignment restrictions, student self-only records, parent-to-linked-student-only access and no cross-child leakage.
- [ ] Test module entitlement denial directly at frontend route and backend API.
- [ ] Test fee/payment/refund/waiver approval permissions by direct API calls.
- [ ] Test file upload/download authorization, storage URL expiry and ownership.
- [ ] Test background jobs preserve tenant scope and cannot be triggered by unauthorized callers.
- [ ] Verify actor, scope, reason, before/after state and rejection audit for sensitive operations.
- [ ] No Critical/High unauthorized-access finding remains unresolved.

## D. Data, migrations and finance

- [ ] Verify current backup and restore point before any production migration.
- [x] `npx prisma migrate deploy` applied all migrations to an empty disposable PostgreSQL 16 database in hosted CI on SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- [ ] Rehearse upgrade from sanitized representative prior schema/data, including legacy/null/duplicate data edge cases.
- [ ] Inspect migration locks, runtime, backfill volume, uniqueness conflicts, foreign keys and rollback/forward-fix plan.
- [ ] Confirm intended DB connection/TLS without logging connection strings or secrets.
- [ ] Confirm migration compatibility with app version during rollout and rollback.
- [ ] Reconcile fixtures for invoice amount, successful payment, late fee, partial/full refund, concession/waiver, cancellation, library charge and overpayment.
- [ ] Verify retries/provider callbacks do not duplicate payments or receipts.
- [ ] Confirm refunds/reversals preserve audit history; never fabricate provider confirmation.
- [ ] Reconcile student/parent and Accounts balances against canonical records.
- [ ] Verify library return/loss/damage retries create one canonical obligation and inventory remains consistent.
- [ ] Never use production for destructive testing.

## E. Examination and generated artifacts

- [ ] Verify eligibility criteria, attendance source and missing-data behavior.
- [ ] Verify fee-clearance policy only when configured and reconciled to canonical invoices.
- [ ] Confirm every blocked student has a meaningful reason.
- [ ] Generate admit cards in nonproduction and compare requested, eligible, skipped, successful and failed counts with persisted records.
- [ ] Retry generation and verify duplicate-safe behavior.
- [ ] Open generated PDF/ZIP artifacts; confirm nonzero size, readability, correct student/exam data, storage policy and authorized download.
- [ ] Verify marks validation, approval and publication permissions.
- [ ] Confirm unpublished results remain inaccessible to student/parent routes.
- [ ] Verify parent/student views expose only permitted records.

## F. Deployment configuration and secrets

- [ ] Confirm approved deployment source matches reviewed commit. Current render.yaml pins web and worker to production-upgrade-2026-09-20; explicitly confirm promotion process.
- [ ] Review frontend deployment config at frontend/vercel.json and target project settings.
- [ ] Confirm Node versions: frontend 24.x, backend 20.x.
- [ ] Verify lockfile install and build commands match approved artifact.
- [ ] Validate required variable names and values in secret manager; do not paste secrets into logs, PRs or reports.
- [ ] Confirm frontend API base URL points to approved backend and not localhost/unintended environment.
- [ ] Confirm CORS origins, cookie/token transport, HTTPS, secure headers, JWT secrets, database TLS, storage credentials, upload limits and provider mode.
- [ ] Confirm payment mode/currency explicitly; use sandbox where available.
- [ ] Test storage upload/download, signed URL/access policy and orphan-file recovery.
- [ ] Confirm mail/notification integrations work or are explicitly disabled with clear degraded behavior.
- [ ] Confirm web/worker environment variables are consistent and least-privileged.

## G. Runtime observability and readiness

- [ ] Probe /api/v1/health and determine whether it checks liveness only or dependency readiness.
- [ ] Verify structured logs and request/job correlation IDs without sensitive payloads.
- [ ] Alert on API errors/latency, DB pool saturation, failed/stuck jobs, outbox backlog, payment reconciliation and storage/provider errors.
- [ ] Verify worker heartbeat, stale-job recovery, bounded retries, graceful shutdown and duplicate-safe replay.
- [ ] Record API p50/p95, DB query latency, queue delay, CPU/memory and error rate under representative nonproduction load.
- [ ] Do not claim capacity until measured against an agreed workload/SLO.
- [ ] Confirm on-call owner, alert destination, dashboards and incident playbook.

## H. Backup, rollback and disaster recovery

- [ ] Name backup owner and document frequency, retention, encryption and point-in-time recovery.
- [ ] Perform/time a restore into isolated target; record measured RPO/RTO and integrity checks.
- [ ] Document application artifact rollback and schema compatibility; schema changes may not be reversible by app rollback alone.
- [ ] Prefer backward-compatible expand/migrate/contract changes where appropriate.
- [ ] Record exact previous known-good artifact/commit and configuration version.
- [ ] Define stop triggers: failed health/readiness, auth/RBAC regression, financial mismatch, elevated 5xx, migration error, job backlog or artifact failure.
- [ ] Define decision owner/escalation; do not blindly retry non-idempotent payments or external effects.
- [ ] After rollback/forward-fix, reconcile business records and queued jobs before reopening consequential workflows.

## I. Controlled rollout and post-release verification — only after separate approval

- [ ] Confirm written GO decision and scope.
- [ ] Announce change window and support contacts.
- [ ] Deploy only approved artifact through authorized process.
- [ ] Monitor health, errors, DB load, job backlog, storage, payments and audit failures.
- [ ] Execute non-destructive smoke tests with approved accounts.
- [ ] Reconcile authorized workflow records without fabricating financial state.
- [ ] Confirm student/parent/role isolation and finance/examination/library paths.
- [ ] Keep rollback/forward-fix operator available during observation window.
- [ ] Record outcome, incidents, metrics and follow-up owner.

## J. Current disposition

**NOT APPROVED FOR DEPLOYMENT.** Exact-SHA hosted CI passed for standard builds/tests and migrations against an empty disposable PostgreSQL 16 database (tested SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`). Adversarial authorization, existing-data migration safety, financial reconciliation, generated examination artifacts, provider integrations, restore and operational recovery remain unverified. Complete the remaining NO-GO conditions before requesting a new release decision.


## K. Milestone 9 exact-SHA evidence

Tested SHA: `c10ec08489756ba770467fff7b81e7f992b2d0f0`; evidence source: hosted GitHub Actions. Application source tree matches the earlier reviewed tree at `ab4dfdec3aec12e086b0b9738d28a1056e670128`; the later commits before this test changed workflow configuration only.

- [x] [ACADLYX Production Quality](https://github.com/acadlyx/acadlyx/actions/runs/38031718249) — success: backend clean install, Prisma validate/generate, typecheck, build, lint, 114 tests passed; frontend clean install, typecheck, lint and production build passed; all migrations applied on empty disposable PostgreSQL 16. Live production smoke job was skipped for the stabilization branch.
- [x] [ACADLYX Production Gate](https://github.com/acadlyx/acadlyx/actions/runs/38031718250) — backend/frontend checks passed.
- [x] [ACADLYX ERP verification](https://github.com/acadlyx/acadlyx/actions/runs/38031718247) — backend/frontend checks passed.
- [x] [Frontend build](https://github.com/acadlyx/acadlyx/actions/runs/38031718309) — source validation, typecheck and production build passed.

The frontend package has no unit/integration test script, so frontend runtime/unit tests are not covered by these runs. No production deployment or production database operation occurred. The current branch advances with documentation updates after the tested SHA; do not describe the documentation-update SHA as a separately tested source revision.
