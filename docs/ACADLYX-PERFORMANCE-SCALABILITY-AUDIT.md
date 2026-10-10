# ACADLYX Performance, Database Optimization, Caching & Scalability Audit — Milestone 6

Date: 2026-10-09  
Repository: `acadlyx/acadlyx`  
Working branch: `stabilization-platform-2026-10-09`  
Protected baseline: `production-upgrade-2026-09-20`  
Source-fix commit: `ee9f87477a708dc633233d050478d407151c08e5`  
Previous shared base / merge base: `6ddcc30697071b6e55505caaf68337f704bdc7cd`

## Executive status

**Overall: PARTIALLY VERIFIED; runtime, database, and workload verification are BLOCKED.**

One source-confirmed frontend cache risk was addressed in `frontend/src/lib/api.ts`:
- credentialed or potentially credentialed GET requests no longer enter the shared response/in-flight cache;
- callers must explicitly set `credentials: "omit"` and provide no Authorization/Cookie header to opt into caching;
- expired entries are purged when inserting, and the map is capped at 200 entries using oldest-insertion eviction.

This is a correctness and bounded-memory improvement, not a measured latency improvement. The source was read back and the commit diff inspected; TypeScript/build/regression tests were not run. The explicit credential opt-in intentionally trades some cache hits for safety. Existing callers that do not explicitly opt out of credentials bypass response caching.

No database schema or migration was changed. No infrastructure was added. No deployment, protected-branch write, production database access, migration execution, or stress test occurred.

## Branch, commit and prior milestone evidence

- Confirmed the requested stabilization branch exists.
- Before creating this report, branch comparison against `production-upgrade-2026-09-20` showed **42 commits ahead, 0 behind** with merge base `6ddcc30697071b6e55505caaf68337f704bdc7cd`.
- The cache change is commit `ee9f87477a708dc633233d050478d407151c08e5`; its file diff was fetched and reviewed.
- Milestone 2 baseline report: `docs/ACADLYX-BASELINE-VERIFICATION.md`, overall UNVERIFIED/BLOCKED for executable checks.
- Milestone 3 security/RBAC report: `docs/ACADLYX-SECURITY-RBAC-AUDIT.md`, PARTIALLY VERIFIED; authored tests were not executed.
- Milestone 4 API/data reliability report: `docs/ACADLYX-API-DATA-RELIABILITY-AUDIT.md`, PARTIALLY VERIFIED; one cache race fix was source-inspected, runtime tests were blocked.
- Milestone 5 design-system report: `docs/ACADLYX-DESIGN-SYSTEM-RESPONSIVE-AUDIT.md`, PARTIALLY VERIFIED; browser and executable checks were blocked.

This environment has remote source-read/commit access but no working project checkout, database credentials, production-like test database, running backend, browser performance runner, or load-test environment. No local working-tree status or uncommitted local changes can be observed through the available remote connector; remote file writes used the returned blob SHA for the exact file revision.

## Verified toolchain and architecture observations

### Package manifests

- Frontend manifest declares Next.js `15.5.25`, React and React DOM `^18.3.1`, TypeScript `^5.6.0`, Tailwind CSS `^3.4.10`, and Node engine `24.x`.
- Frontend scripts: `npm run validate:source && next build`, `next lint`, and `tsc -p tsconfig.json --noEmit`.
- Backend manifest declares Express `^4.21.0`, Prisma client/CLI `^5.20.0`, TypeScript `^5.6.0`, and Node engine `20.x`.
- Backend scripts include `prisma generate && tsc -p tsconfig.json`, `tsx --test src/__tests__/*.test.ts`, and a separate `node dist/worker.js` worker entry point.
- The lockfiles exist and use lockfile version 3. Exact installed runtime versions and dependency resolution at execution time were not measured.

### Backend and data architecture

- A shared PrismaClient singleton is defined in `backend/src/lib/prisma.ts`; development hot reload reuses a global instance. No explicit application-level pool sizing was found in that file. Actual PostgreSQL pool configuration may be embedded in deployment connection URLs or provider defaults and could not be inspected without environment access.
- `backend/prisma/schema.prisma` declares PostgreSQL and contains existing composite indexes for background-job claiming/listing and domain-event outbox polling.
- Background jobs are stored in PostgreSQL, claimed with `FOR UPDATE SKIP LOCKED`, and processed by a separately runnable worker. Worker concurrency is bounded by configuration to a maximum of 8 per process, with a default of 2 in the inspected source. This is a code-level limit, not a measured capacity statement.
- `backend/src/index.ts` starts an outbox drain on a five-second interval, initially requesting up to 50 events. `drainDomainEventOutbox` clamps each requested batch to 1–100 and claims/handles events sequentially inside that drain invocation. Multiple interval invocations may overlap if one invocation runs longer than the interval; no timing evidence exists to establish whether that occurs under load.
- No Redis/BullMQ dependency was declared in the inspected backend package. The verified queue mechanism is PostgreSQL-backed; no separate broker is assumed.
- The deployment blueprint read from the working branch points at the protected production branch and declares a small `0.5c-512mb` service plan. This is configuration source, not proof of currently deployed resources or measured capacity. It was not changed.

## Baseline measurements

No runtime benchmark or instrumentation environment was available. These values are therefore explicitly unmeasured.

| Metric | Baseline result | Method / reason |
|---|---|---|
| Frontend production build duration | UNMEASURED | Build not executed |
| Route-level JS bundle sizes | UNMEASURED | Build artifacts/analyzer unavailable |
| API p50 / p95 latency | UNMEASURED | No running nonproduction API and traffic trace |
| PostgreSQL query latency/plans | UNMEASURED | No database access or sanitized query log |
| Dashboard request count/waterfall | UNMEASURED | No browser/network trace |
| Initial render / route transition | UNMEASURED | No browser runner |
| CPU and memory under load | UNMEASURED | No instrumented workload |
| Worker queue wait/throughput | UNMEASURED | No job fixture or worker metrics |
| Connection-pool utilization | UNMEASURED | No database telemetry |

No throughput, concurrency capacity, response-time improvement, cache hit ratio, or cost reduction is claimed.

## Findings and disposition

| ID | Finding | Status | Evidence / action |
|---|---|---|---|
| PERF-01 | The browser GET cache keyed entries only by method and URL and accepted all body-less GETs, regardless of Authorization headers or credential mode. | FIXED | Cache eligibility now requires explicit `credentials: "omit"` and no Authorization/Cookie header. This prevents requests with potentially user-specific credentials from sharing cached/in-flight responses. |
| PERF-02 | Expired cache entries were removed only when the same URL was requested again, so a long-lived tab visiting many distinct filtered URLs could retain expired keys indefinitely. | FIXED | Expired entries are swept on insertion and cache size is capped at 200 entries. No heap test was run. |
| PERF-03 | Five-second response TTL and cache invalidation exist in the shared API helper, including invalidation of in-flight entries after mutation. | PARTIALLY VERIFIED | Source inspected; the earlier milestone fixed an in-flight invalidation race. Caller inventory and runtime behavior remain incomplete. |
| PERF-04 | No measured frontend render, bundle, request-waterfall, API latency or resource-utilization baseline is available. | BLOCKED | No browser/benchmark/runtime environment. |
| DB-01 | Existing indexes cover the job claim query (`status, priority, availableAt`) and outbox pending-event query (`processedAt, createdAt`); related scope/list indexes also exist. | PARTIALLY VERIFIED | Prisma model definitions inspected. Actual index deployment state, selectivity, query plans and index use are unknown. No new index was added without query evidence. |
| DB-02 | PostgreSQL connection-pool sizing and saturation are not evidenced in the source files inspected. | UNVERIFIED | Connection URL/provider defaults and live connection telemetry unavailable. Do not add pool parameters speculatively. |
| API-01 | Bounded worker concurrency and SKIP LOCKED claiming exist. | PARTIALLY VERIFIED | Source inspected; no concurrent-worker correctness or throughput test executed. |
| API-02 | The API process invokes a batch outbox drain every five seconds; drains process events sequentially and interval invocations are not explicitly serialized. | PARTIALLY VERIFIED | Source observation. Whether overlapping invocations cause pressure requires duration/backlog telemetry; no change made without evidence. |
| DATA-01 | Canonical finance, library, examination, placement and student lifecycle flows have not been benchmarked end to end. | UNVERIFIED | Prior milestone reports do not establish load/performance correctness. No cross-module fixtures or live requests were available. |
| JOB-01 | Background-job states, retries, stale-job recovery, heartbeat, cancellation and progress are implemented in source. | PARTIALLY VERIFIED | Worker and job service inspected. Idempotency under retries, resource use, large payload behavior and shutdown under load remain untested. |
| LOAD-01 | No nonproduction load environment or representative dataset is available. | BLOCKED | No stress test executed and no concurrency claim is made. |

## Cache inventory and security analysis

| Mechanism | Observed scope | Invalidation / risk |
|---|---|---|
| `frontend/src/lib/api.ts` GET response cache | Module-local browser JavaScript Map, 5-second TTL | Mutation invalidation exists; entries now capped at 200 and expired entries swept. Only explicit credential-free GETs can opt in. |
| `frontend/src/lib/api.ts` in-flight GET deduplication | Module-local Map keyed by method and URL | Same eligibility gate as response cache; mutation invalidation removes in-flight entries and finalizers check request identity. Runtime race tests not run. |
| Authenticated user cache in `frontend/src/lib/auth.ts` | Tab-local module memory, 30-second user cache TTL; a separate in-flight map keyed by auth scope | Token set/clear invalidates cached user and increments auth cache scope. Full audit of every feature module cache was not possible. |
| Backend process cache | No general-purpose distributed cache confirmed in inspected files | Do not assume shared cache across server instances. |
| PostgreSQL job and outbox storage | Persistent relational queue/outbox | Indexed polling is present; actual backlog, index usage and retention growth are unknown. |

No shared cache was introduced. Protected content is not intentionally preloaded across tenant, campus, department or user scopes. The cache fix narrows eligibility instead of attempting to make a shared response cache safe for authenticated requests.

## Pagination, query patterns and indexes

The Prisma schema has many existing indexes, including compound indexes on job and outbox status/time queries. Without database statistics or `EXPLAIN` output, schema index presence alone cannot prove the relevant query uses the index or that the index is selective.

No speculative index migration was created. Recommended evidence before schema optimization:
1. Sanitized `pg_stat_statements` top queries with call counts, mean/max execution time and rows.
2. Representative query plans using nonproduction data or safe non-ANALYZE explain plans first.
3. Actual indexes from database catalogs and migration status.
4. List endpoint query and payload sizes for students, attendance, fees, library, exams and placement.
5. Counts/aggregate paths and tenant/campus/department predicates.

Pagination coverage is not exhaustively verified across all listed modules. No claim is made that every list endpoint is bounded or that all client-side filters run after server-side filtering.

## Cross-module data integrity and background processing

Prior audit reports cover authorization, API reliability and selected financial/session correctness, but do not provide performance benchmarks. This milestone did not alter canonical financial calculations, admission/enrollment, library charges, examination eligibility, placement eligibility, idempotency middleware, transaction boundaries, or permissions.

The background worker source shows a PostgreSQL-backed job queue, per-process bounded concurrency, exponential retry backoff and stale-worker recovery. Remaining checks include:
- actual worker deployment count and connection budget across instances;
- queue age, oldest pending job, failure rate, retries and handler duration;
- idempotent side effects for every job handler;
- bounded payload/result size and large import/export memory behavior;
- graceful shutdown and heartbeat correctness under controlled failure;
- event-outbox drain duration, backlog, retry and retention/cleanup strategy.

## Commands and verification ledger

No local project commands were executed. Source reads and branch operations through the repository connector are not represented as build/test runs.

| Check | Result | Exit code |
|---|---|---|
| Verify requested branch exists | Completed through branch lookup | N/A |
| Compare stabilization branch to protected baseline before report | 42 ahead, 0 behind | N/A |
| Read manifests, lockfiles, Prisma schema, API helper, Prisma singleton, worker/job/outbox sources | Completed through remote source reads | N/A |
| Inspect cache change commit diff | Completed through remote commit read | N/A |
| Frontend `npm run validate:source` | NOT RUN — no checkout/runtime | N/A |
| Frontend `npm run typecheck` | NOT RUN — no checkout/runtime | N/A |
| Frontend `npm run lint` | NOT RUN — no checkout/runtime | N/A |
| Frontend `npm run build` | NOT RUN — no checkout/runtime | N/A |
| Backend `npm test` / `npm run test` | NOT RUN — no checkout/runtime | N/A |
| Backend `npm run build` / `npm run typecheck` | NOT RUN — no checkout/runtime | N/A |
| Prisma validate/generate/migration status | NOT RUN — no checkout/runtime/database | N/A |
| Query plans / pg_stat_statements | NOT RUN — no DB access | N/A |
| Browser performance / bundle analysis | NOT RUN — no browser/build artifacts | N/A |
| Controlled load test | NOT RUN — no nonproduction workload environment | N/A |

No exit code is assigned to a command that was not executed.

## Final re-audit and diff review

After the cache change, the updated `frontend/src/lib/api.ts` was fetched again and the following conditions were confirmed in source:
- `GET_CACHE_MAX_ENTRIES = 200`;
- cache eligibility requires `credentials: "omit"` and no Authorization/Cookie header;
- expired entries are swept during insertion;
- oldest-insertion entries are evicted while the cache is at its size cap.

The fetched commit diff contained only the cache eligibility and bounded-cache changes in `frontend/src/lib/api.ts`. Branch comparison remained 0 commits behind the protected baseline and all writes were directed to `stabilization-platform-2026-10-09`. No database schema, migration, infrastructure, authorization rule or deployment setting was changed.

This is a focused remote source diff review, not an executable test or complete working-tree review.

## Prioritized next steps

1. Run the actual frontend source validation, typecheck, lint and production build; run backend typecheck/build/test scripts on this exact commit.
2. Add deterministic unit tests for cache eligibility, credential isolation, expiration pruning, 200-entry eviction, mutation invalidation and in-flight deduplication.
3. Inventory current `apiFetch` call sites to identify safe public GETs that explicitly use `credentials: "omit"`; do not restore caching to protected requests to chase hit rate.
4. Obtain sanitized nonproduction query statistics and query plans before proposing any new indexes or pool-size changes.
5. Add request/query duration and queue-depth instrumentation with bounded-cardinality labels and no secrets or student data in logs.
6. Run representative dashboard, pagination, finance, library, examination and placement tests against a seeded nonproduction database.
7. Run load tests only in a controlled environment with a documented request mix, data size, concurrency ramp, duration and resource budget; report p50/p95, throughput, errors, pool wait and queue latency.
8. Recheck cache isolation and data-integrity invariants after any future performance optimization.

## Final milestone status

**PARTIALLY VERIFIED.** A source-confirmed unbounded-cache and credential-eligibility risk was addressed. No measured performance gain or scalability capacity is claimed. Build/test execution, query plans, connection-pool behavior, end-to-end module flows, background-worker throughput and controlled load tests remain UNVERIFIED or BLOCKED. No production environment was touched.
