# ACADLYX Financial and Library Integrity Audit

**Review date:** 2026-10-10  
**Candidate at start of remediation:** `eed8d92b2236bea94404d588d9c9d932f79a5fa8`  
**Working branch:** `stabilization-platform-2026-10-09`  
**Status:** PARTIALLY VERIFIED — release gate remains NO-GO

## Scope and evidence limits

This is a source-level audit plus hosted CI evidence. A writable local checkout and disposable PostgreSQL integration fixture were not available in the execution environment. No database-backed concurrency test, provider sandbox transaction, backup/restore drill, or live payment operation was run. Do not interpret source review as a successful race-condition test.

## Existing architecture reviewed

- Canonical fee billing implementation: `backend/src/services/feeBilling.service.ts`
- Finance workspace implementation: `backend/src/services/finance.service.ts`
- Finance HTTP routes/controller: `backend/src/routes/finance.routes.ts`, `backend/src/controllers/finance.controller.ts`
- Canonical records: `FeeInvoice`, `FeePayment`, `FeeReceipt`, `FeeRefund`, `FeeTransaction`, `LibraryFine`
- `FeePayment` has a tenant/idempotency-key unique constraint and a provider/payment-ID unique constraint.
- The fee-billing settlement implementation uses a row lock on the invoice and checks for an existing provider payment within its transaction. The fee-billing refund request/processing flow also uses payment row locks.
- The separate Finance workspace service has a different implementation path. Its payment and refund methods must not be assumed to inherit the fee-billing service's locking guarantees.

## Remediation performed

### Director financial scope

**FIXED IN SOURCE; CI PENDING/NOT YET CERTIFIED.** The Finance workspace now calls `getDirectorCampusIds(institutionId, actor.id)`, which reads explicit, active, same-institution `CampusAccess` grants. The scope branch was reordered before the broad permission fallback, and HOD/Dean department scope also precedes that fallback. A regression contract test guards the canonical helper and ordering.

This change has not yet been verified with seeded PostgreSQL records or HTTP requests. It does not establish that every exported/reporting/mutation route is correctly scoped.

## Payment and refund concurrency matrix

| Scenario | Source evidence | Execution status | Required proof |
|---|---|---|---|
| Two payments against one invoice | Fee-billing path locks invoice; separate Finance workspace path requires equivalent locking review | UNVERIFIED | Concurrent PostgreSQL transactions against each exposed API path |
| Duplicate idempotency key | Schema has unique `(institutionId, idempotencyKey)`; duplicate handling is implemented in fee-billing path | PARTIALLY VERIFIED | Replay same key and key collision with different invoice/amount through API |
| Duplicate provider callback | Fee-billing service checks provider payment ID under invoice transaction; provider configured as manual in checked-in deployment config | PARTIALLY VERIFIED | Provider sandbox callback replay and out-of-order callback test; currently BLOCKED without sandbox |
| Two simultaneous refund requests | Fee-billing refund path locks payment; separate Finance workspace refund request aggregates and creates outside one transaction | HIGH RISK / UNVERIFIED | Concurrent PostgreSQL requests proving reservation and refundable balance cannot race |
| Duplicate refund processing | Fee-billing path locks payment while applying refund; Finance workspace `processRefund` needs atomic claim/row locking | HIGH RISK / UNVERIFIED | Two concurrent process calls; exactly one financial posting |
| Interrupted operation and retry | Transaction boundaries exist in parts of both implementations | UNVERIFIED | Fault injection after each write and safe retry test |
| Pending/failed payment balance | Fee-billing settlement records successful payments; payment-state behavior across all adapters is not verified | UNVERIFIED | Assert invoice balance changes only after verified successful settlement |
| Fine/replacement charge posting | Library and finance models exist; end-to-end idempotent posting is not certified | UNVERIFIED | Concurrent return/lost/damaged/waiver scenarios against PostgreSQL |

## Reconciliation invariants to verify

Use existing canonical records; do not introduce a second ledger.

1. Each successful payment has exactly one receipt (`FeeReceipt.paymentId` is unique).
2. Each payment and refund has no more than one corresponding financial effect for its canonical idempotency/reference key.
3. For each invoice, payment and refund totals reconcile with `paidAmount`, `refundedAmount`, invoice status, and the related `FeeTransaction` rows according to one documented accounting convention.
4. Refunds in REQUESTED/APPROVED/PROCESSED states reserve the remaining refundable amount consistently.
5. Library fine/charge records reconcile with the linked canonical invoice/transaction; repeated requests must not duplicate the posting.
6. Every override, waiver, refund approval and adjustment has an actor and audit event.
7. Reconciliation reports must flag orphaned receipts, payments without expected transaction records, duplicated references, negative balances, and invoice/payment institution mismatches.

## Required tests before release

- PostgreSQL integration tests for the Finance workspace endpoints and canonical fee-billing endpoints.
- Simultaneous payment attempts with same and different idempotency keys.
- Duplicate/replayed provider callback tests when a real provider is configured.
- Concurrent partial and full refund requests and processing attempts.
- Transaction rollback/fault-injection tests.
- Library fine/return/loss/damage/waiver retries and cross-module reconciliation.
- Persisted invoice, payment, receipt, refund and transaction assertions after each scenario.

## Release decision

**NO-GO.** Source-level controls and green build/test workflows are not a substitute for PostgreSQL concurrency evidence. Real provider verification is BLOCKED until a provider sandbox and credentials are made available.

## Additional payment replay correction — 2026-10-10

**FIXED AT SOURCE; CI PENDING.** The settlement path previously rejected a fully settled invoice before checking whether the incoming provider payment ID had already been recorded. This meant a repeated callback for a payment that completed the invoice could fail instead of returning the existing settlement. The provider-payment idempotency lookup now runs before the outstanding-balance guard. A source-contract regression test checks that ordering.

This does not replace PostgreSQL concurrency tests. The unique provider-payment constraint remains the final duplicate-record guard, and concurrent callbacks, mismatched invoice/amount replays, and provider out-of-order behavior still require execution against a disposable database and real provider sandbox where available.


## PR #29 evidence update — 2026-10-10

**Evidence snapshot candidate:** `c7dc0b31a2355364b5342636307578aac4109ab9`.

- **Payment code change:** payment writes in `backend/src/services/finance.service.ts` lock the invoice row before re-reading outstanding balance. The latest candidate also validates a non-empty idempotency key, checks key/payload compatibility, and rechecks a concurrent replay after acquiring the invoice lock. This was a code inspection; no PostgreSQL concurrency run has yet established persisted invariants.
- **Refund code change:** refund requests lock invoice/payment rows before calculating reserved amounts; processing conditionally claims an APPROVED refund and posts payment/invoice/transaction updates in a transaction. The schema's `FeeRefund` model does not currently expose a dedicated refund-request idempotency key, so duplicate client retries can still create separate reservation records when capacity permits.
- **Library link:** `LibraryFine` has a unique `[issueId, type]` constraint and `FeeInvoice` has a unique `[institutionId, sourceEventKey]` constraint; `library.service.ts` uses a deterministic `LIBRARY_FINANCIAL_CHARGE:<issueId>:<fineType>` event key. This is schema/source evidence, not an executed exactly-once test.
- **CI:** [run 38040759171](https://github.com/acadlyx/acadlyx/actions/runs/38040759171) was in progress when this section was written. Prior run 38040500919 passed its checks on earlier SHA `275280390500b214dce754e12740e2599c545f32`; production smoke checks were skipped.
- **Not verified:** overlapping PostgreSQL payment/refund requests, persisted receipt/ledger totals, retries, deadlock/retry behavior, library waiver/reversal consistency, and full library-to-finance HTTP workflows.
- **Release gate:** OPEN / NO-GO until real disposable-PostgreSQL concurrency and library/finance integration tests run repeatedly and assert persisted rows and balances.


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
