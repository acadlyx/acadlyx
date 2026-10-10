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