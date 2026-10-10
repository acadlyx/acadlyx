# ACADLYX Platform Functional Audit — 2026-10-11

## Scope and verification boundary

Audit branch: `platform-functional-audit-2026-10-11`  
Base: `production-upgrade-2026-09-20` at `1671a949a5104dfcbd6e9064428b81b582ff29c2`  
Policy: isolated changes only; no merge and no deployment.

Repository inventory at the audit snapshot: 827 tracked files, 238 frontend app page files, 57 backend route modules, and 30 backend test files. This inventory and targeted source tracing are not equivalent to running every role/workflow in a live browser. Runtime tenant data and live sessions are not available to this code-only inspection.

## Confirmed findings and changes

| Severity | Role / route | Root cause | Change | Regression coverage / status |
|---|---|---|---|---|
| High | Student, `/student/library`; `GET /library/loans/mine` | The route used `authorizeWorkflow("library.borrow")`. Its global workflow dependency requires `students.read`, which students correctly do not receive. The API therefore returned a 403 that the error handler rendered as “You do not have access to this feature.” | Changed student self-service loan, reservation, and reservation-cancel routes to require `library.borrow` directly. Existing service checks continue to bind loans to the authenticated borrower and prevent reserving/cancelling for another user unless the actor has librarian management authority. Tenant `library` entitlement and `library.read` catalogue authorization remain enforced. | Added backend source/permission regression assertions and updated frontend source contract. CI outcome pending. |
| High | Accounts / Chairman / Management, `/accounts/fee-structures` setup card | The form's single `Promise.all` requests academic years, programmes, semesters and fee heads. Accounts lacked `academic-years.read` and `semesters.read`, so setup lookup requests could be denied even while fee-structure read/manage permissions existed. Chairman and Management already inherit these read permissions through `LEADERSHIP_READ`. | Added only the missing academic-year and semester **read** permissions to Accounts. Regression tests assert that Accounts, Chairman and Management can read setup metadata without gaining academic-year or semester write authority. The setup lookup effect now runs only for users allowed to create, and its error state has an explicit retry. | Added role-matrix regression tests for required read permissions and prohibited write permissions. CI outcome pending. |
| Medium | Student, `/student/examinations/performance` (also reached by `/student/marks`) | The page loaded approved/published examination marks only. It did not query the existing `GET /students/me/marks` internal-assessment source, so internal marks could be present but invisible on this page. | Performance now loads exam marks and internal-assessment marks independently and displays them in separate sections. A failure of one source does not discard successful data from the other; two failed requests remain an error, not an empty success. | Added frontend source regression assertions. CI outcome pending. |
| Low | Accounts, `/accounts/fee-structures` and `/accounts/fee-heads` empty state | A generic “No financial records are available in this scope” message did not identify which collection was empty. | Replaced it with collection-specific “no fee structures created” / “no fee heads configured” messages. List API errors continue through the error state rather than being converted to an empty list. | Source change committed; CI outcome pending. |

## Confirmed authorization contracts

- Student library self-service permissions remain `library.read` and `library.borrow`; student roles still do not receive `library.manage` or fine-waiver authority.
- The Library router retains authentication and the tenant `library` feature entitlement check.
- The fee-structure API retains `requireFeature("fees")`, canonical `fees.structure.read/manage/approve` gates, institution-scoped database filters, and service-level authorization.
- Fee-structure reads are institution-wide by default; optional academic-year/programme/semester filters are applied only when explicitly supplied. The current frontend list request supplies no programme filter.
- Backend authentication reconstructs roles and effective permissions from the current authenticated user's database role bindings on each protected request; permissions embedded in an old JWT are not used as the authorization source.
- Tenant entitlement provisioning intentionally does not silently enable newly introduced features for existing tenants. A disabled entitlement must remain disabled and should surface as a feature-unavailable state, not be bypassed.

## Read-only connected-database checks

The connected ACADLYX database was queried read-only for counts and entitlement state (no data was changed):

- The Accurate Institute of Management & Technology tenant is active. The `library`, `fees`, `academics` and `students` entitlements are enabled. This rules out a disabled Library entitlement as the explanation for the observed generic 403 in this database.
- The institution has **0 fee structures**, **3 fee heads**, **1 active library title**, and **1 student library issue**. The fee-structure list's empty state is consistent with the data currently in this database; no sample rows were inserted.
- The database contains **3 internal-mark rows** for **1 student**, totaling **45/150 (30%)**. All 3 rows belong to a student with an active enrollment. It contains **0 canonical `exam_marks` rows** and **0 legacy `exam_results` rows**. The old Performance page queried only the latter examination sources, which explains why internal marks could be present yet invisible there. The new UI reads internal marks separately.
- The database's persisted `role_permissions` rows for ACCOUNTS do not include `academic-years.read` or `semesters.read`; Chairman and Management do. The backend derives effective request permissions from its canonical role matrix and runs RBAC reconciliation at startup, but this branch has not been deployed, so the live database has not yet been reconciled with the new ACCOUNTS grant.
- No authenticated student or Accounts browser/API session was available, so these are database-state checks, not proof that the deployed API is running this branch.

## Security finding requiring separate approval

The database inspection reports **RLS disabled on all 155 public tables**. Its schema-inspection advisory classified this as critical and claimed the tables were exposed to `anon`/`authenticated`. A separate read-only privilege check in the same project found no schema `USAGE` or table `SELECT/INSERT` privileges for those roles, so direct Data API exposure is **not confirmed** by the independent check. Nevertheless, all 155 tables currently have RLS disabled, and the mismatch between the advisory and privilege check must be reviewed before treating the database as safe.

No RLS changes were applied. Do not blindly run a blanket `ENABLE ROW LEVEL SECURITY` script without table-specific policies: it can break legitimate access paths, while enabling RLS without the correct policies does not implement tenant/row authorization. To generate a review list (this query only prints SQL; it does not change the database):

```sql
SELECT format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', schemaname, tablename)
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Policies must match the actual access architecture and tenant/owner scopes. Review the anon/authenticated grants, Data API exposure settings, and table-specific policies before any schema change.

## Verification still required

1. Run backend typecheck/build and all backend tests, including PostgreSQL integration tests where configured.
2. Run frontend source checks, typecheck, lint and production build.
3. In an authenticated tenant, inspect `/auth/me` (or the established current-user endpoint) for Student, Accounts, Institution Admin, Chairman and Management; compare effective permissions with the canonical matrix. Confirm the startup RBAC repair reconciles persisted role-permission rows.
4. Recheck tenant entitlements and persisted role-permission rows after the approved deployment; current read-only database results show the four relevant entitlements enabled, but this branch has not been deployed.
5. Exercise catalogue/own-loans/reserve/cancel with a student, and confirm attempts to use librarian operations or access another student's loans remain denied.
6. Exercise fee-structure list/create setup lookups for each intended role; verify API responses, database rows and refreshed UI after create. Do not seed fake production records to make an empty state disappear.
7. Inspect the student's actual enrollment and marks statuses. The dashboard intentionally has an enrollment-setup branch that returns zero-valued metrics when no active enrollment exists; the live student's enrollment state has not been verified here. Approved/published examination marks and internal assessment marks are separate data sources and now render separately on Performance.
8. Resolve the RLS-disabled-table security review before granting Data API access, and continue route/page inventory for remaining role workspaces, data contracts, CRUD/approval workflows, hierarchical scope, navigation and compact-list behavior. The current targeted fixes do not constitute a claim that all 238 page files have been browser-tested.

## Release status

**Not verified for release.** Changes are on the isolated branch only. Do not merge or deploy until CI passes and the tenant-backed access/data checks above are completed.
