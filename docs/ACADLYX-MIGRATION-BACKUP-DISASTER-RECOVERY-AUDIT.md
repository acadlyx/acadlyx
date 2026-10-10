# ACADLYX Migration, Backup and Disaster-Recovery Audit

**Review date:** 2026-10-10  
**Status:** PARTIALLY VERIFIED — release gate remains NO-GO

## Evidence boundary

The hosted workflow `ACADLYX Production Quality` has applied the Prisma migration history to a fresh, disposable PostgreSQL 16 database on prior candidate commits. That is **empty-database migration evidence only**. This audit did not execute a prior-schema upgrade rehearsal, backup, restore, or production database operation. No local checkout or disposable database connection was available to the current operator.

## Migration rehearsal

| Check | Status | Evidence / next action |
|---|---|---|
| Prisma schema validation and client generation | VERIFIED in hosted CI on previously reported tested SHA | Re-run on exact final candidate SHA |
| All migrations apply to empty PostgreSQL 16 | VERIFIED in hosted CI on previously reported tested SHA | Keep as a separate empty-database check |
| Upgrade from representative previous schema | BLOCKED | Create isolated PostgreSQL fixture at a pinned earlier migration, load synthetic legacy records, apply remaining migrations |
| Legacy data preservation and relationship checks | UNVERIFIED | Compare counts, keys, and representative joined queries before/after upgrade |
| Uniqueness / null / enum / foreign-key edge cases | UNVERIFIED | Include synthetic duplicate and legacy-value fixtures; assert expected failure and recovery |
| Failed migration does not appear successful | UNVERIFIED | Inject a failing migration in a disposable DB; verify CI/job fails and `_prisma_migrations` reports failure correctly |
| Migration duration | NOT MEASURED | Record wall-clock duration on a representative synthetic dataset |
| Application rollback compatibility | UNVERIFIED | Confirm expand/contract sequencing and compatibility of the prior application build with post-migration schema |

## Required safe rehearsal procedure

1. Pin the source SHA and exact migration directory being tested.
2. Start a disposable PostgreSQL instance; never use shared or production credentials.
3. Apply migrations only up to the chosen prior schema version.
4. Insert synthetic institutions, campuses, departments, students, enrollments, fee invoices/payments/refunds, library issues/fines, exam registrations and placement records as supported by that schema.
5. Capture baseline counts and referential-integrity queries.
6. Apply pending migrations in production order with `npx prisma migrate deploy`; record start/end timestamps and full command exit status.
7. Re-run invariant queries and representative read paths; compare expected transformations and preserved identities.
8. Run a deliberately failing migration only in a separate disposable database and confirm a nonzero process exit.
9. Destroy the test instance only after saving logs and results.

Do not mark the rehearsal complete until commands and actual outcomes are captured.

## Backup and restore

| Check | Status | Required evidence |
|---|---|---|
| Automated backup policy and retention | UNVERIFIED | Confirm provider configuration, schedule, retention, encryption and access control |
| Synthetic backup creation | NOT RUN | Record exact `pg_dump` command and exit code |
| Restore to a separate disposable database | NOT RUN | Record exact `createdb` / `pg_restore` (or `psql`) commands and exit code |
| Record counts and relationship validation after restore | NOT RUN | Compare pre-backup and restored counts, key relationships and representative queries |
| Restore duration (RTO evidence) | NOT MEASURED | Measure from restore start until validated service-ready state |
| Simulated data-loss window (RPO evidence) | NOT MEASURED | Write timestamped synthetic transactions before backup and measure which survive the selected recovery point |
| Restore drill repeatability | UNVERIFIED | Repeat from a fresh target database and preserve logs |

Example commands for a synthetic database only (replace placeholders with isolated test values; never point them at production):

```sh
pg_dump --format=custom --no-owner --no-privileges \
  --dbname="$SYNTHETIC_SOURCE_URL" --file=acadlyx-synthetic.dump

createdb "$SYNTHETIC_RESTORE_DB"
pg_restore --exit-on-error --no-owner --no-privileges \
  --dbname="$SYNTHETIC_RESTORE_URL" acadlyx-synthetic.dump
```

Record `date -Is` immediately before and after each operation, command exit status, dump size, restored table counts, and validation-query results. These are proposed commands, not claims that a backup or restore has occurred.

## RPO / RTO

**UNVERIFIED.** No measured recovery point objective (RPO) or recovery time objective (RTO) is available from this rehearsal because it has not run. Business/institution leadership must approve target RPO and RTO values before the operator can judge the measured drill against them. Do not invent those targets.

## Release decision

**NO-GO.** Empty-database migration CI alone does not prove safe upgrade of existing institutional data, recoverability, or rollback compatibility.

## PR #29 evidence update — 2026-10-10

**Evidence snapshot candidate:** `c7dc0b31a2355364b5342636307578aac4109ab9`.

- **Migration CI:** [run 38040500919](https://github.com/acadlyx/acadlyx/actions/runs/38040500919) reports the Prisma migration-validation job completed successfully on SHA `275280390500b214dce754e12740e2599c545f32`. This demonstrates that workflow's migration path for its configured database fixture; it does not establish compatibility with a representative previous-version production dataset.
- **Latest candidate:** run [38040759171](https://github.com/acadlyx/acadlyx/actions/runs/38040759171) was still in progress at capture time.
- **Not verified:** realistic legacy/null/duplicate/orphaned data migration, high-volume table behavior, forward-deploy recovery, a non-production backup artifact, integrity verification, isolated restore, application-level restored-data checks, or measured RTO/RPO against approved targets.
- **Safety:** No production database, production credentials, or production data were used for this audit action. No restore rehearsal was executed through the available repository interface.
- **Release gate:** OPEN / NO-GO. Record the prior schema/migration version, backup method, database version, integrity output, restored counts and measured recovery duration before release.


---

## Production-readiness continuation — 2026-10-10

This addendum supersedes earlier baseline references in this document where they conflict with the following verified repository state:

- Production branch: `production-upgrade-2026-09-20`
- Production HEAD at start of this continuation: `b48cd1dd3ead99b7008095b532dff7e4639b2267`
- Remediation branch: `production-readiness-completion-2026-10-10`, created directly from that production HEAD.
- Production baseline CI: [run 38041145591](https://github.com/acadlyx/acadlyx/actions/runs/38041145591) passed backend typecheck/build/lint/tests, frontend typecheck/lint/build, clean PostgreSQL 16 migration validation, and the configured production smoke job on the production SHA. These results do not establish unrun concurrency, authorization, populated-data migration, restore, browser or capacity gates.
- A draft PR is open at [PR #33](https://github.com/acadlyx/acadlyx/pull/33). It is not merged and is not authorization to deploy.
- The remediation branch adds a PostgreSQL 16 service to the backend quality job and applies the candidate's Prisma migrations before backend tests. This corrects the previously missing database service for any DB-backed tests, but no new genuine concurrent payment/refund integration test has yet been demonstrated by this change alone.
- Four missing reports were added: full repository audit, module readiness matrix, UI/CSS design-system audit, and performance/scalability audit. The UI audit enumerates all 233 discovered frontend page/layout source files; all are marked NOT VISUALLY VERIFIED pending browser evidence.
- Candidate CI was triggered for predecessor SHA `8e953114f0708882fcbaf1c838f99fa7a9c1b4fb` when the draft PR was opened. This addendum commit changes the candidate SHA, so only CI runs attached to the final branch HEAD may be treated as final-candidate evidence.
- No production application source, production data, provider settings, deployment configuration, migrations or repository security settings were changed in this continuation. No real PostgreSQL concurrency, authenticated HTTP isolation, populated-data migration, backup/restore, end-to-end browser workflow or 10,000+ student load test was run here.

**Current release decision remains NO-GO.** Required gates must be closed with exact-SHA evidence; a clean build or a source-contract test cannot substitute for persisted-state integration evidence.


## Implementation continuation — 2026-10-10

### Migration compatibility implementation update

Added migration 20261010100000_finance_legacy_column_compat to backfill refund payment references in both directions, allow the legacy mirror column to be nullable, and retain a foreign-key/index for the legacy reference. The current application writes both paymentId and feePaymentId. A separate CI job now constructs a populated legacy refund row before applying this compatibility migration, then verifies the backfill.

The clean PostgreSQL migration path passed in the evidence below. The populated legacy migration job is newly added and must pass on the final candidate SHA before it can be marked verified.

Verified on exact implementation commit fecdb003f3742957e4c7e0c0f2d7a27b5b04ad12: [ACADLYX Production Quality run 38075258304](https://github.com/acadlyx/acadlyx/actions/runs/38075258304) completed successfully. Backend suite: 144 tests passed, 0 failed, 0 skipped. PostgreSQL migrations, backend typecheck/build/lint, and frontend typecheck/lint/production build passed. This is isolated CI evidence, not staging or production evidence. New performance, populated migration, and browser gates were added after this evidence and must pass on the exact final SHA.

No production database was accessed or migrated. Backup creation/restoration, encryption/retention verification, and measured RTO/RPO remain open; no recovery capability is claimed without a restore rehearsal.
