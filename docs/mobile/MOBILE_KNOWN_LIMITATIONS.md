# ACADLYX Mobile Known Limitations

This is an initial implementation increment, not a production-ready full-parity app.

## Functional gaps

- Most modules are generic read-only list/detail adapters. Dedicated assignment create/publish/submit/review/reopen, notice create/edit/delete and timetable create/edit/delete flows are now wired to inspected existing APIs. Other modules still need their own create/edit/delete, archive/restore, bulk, approval/rejection, publish/lock and state-transition workflows.
- The generic adapter does not yet provide fully typed API contracts, schema-validated inputs, reliable per-module pagination, sorting or server-side filters.
- Workspace/context switching is not implemented. This is a release blocker for roles with multiple campus/department/workspace scopes.
- Global search through /search?q= is not wired; search on the module directory is local.
- Login, MFA, token refresh, logout and password change are present. The inspected auth router did not expose a password recovery/reset endpoint, so the app does not pretend recovery is available.
- Profile editing, photo upload, account deactivation/deletion lifecycle and biometric unlock are not implemented.
- Notification preferences, push-token registration/delivery, notification taps and role/scope-safe deep links are not implemented.
- Camera/gallery, document picker, multipart uploads, download streaming, file previews, native PDF handling, import preview/commit and export formats are not implemented.
- Offline cache policy, conflict handling, queued mutations and background synchronization are not implemented. No offline write is silently reported as successful.
- Dedicated dashboards/workflows are incomplete for Chairman, Management, Director, Registrar, Dean, HOD, Faculty, Accounts, Examination, Librarian, HR, Admissions, Placement, IT, CMS, Parent, Club President, Institution Admin and Super Admin.
- Student self-service endpoint cards are mapped but have not been tested against authenticated live/test data.
- The exact original logo is included and displayed on sign-in. Dedicated native app icon/adaptive icon, splash and store artwork still need brand-approved cropping/configuration.
- Package versions need Expo-managed alignment, lockfile generation and verification.

## Verification gaps

- TypeScript compiler, npm test, Expo Doctor, Android/iOS builds and device tests have not run.
- No live/test API smoke tests, role-by-role access tests or cross-tenant/campus/department/student isolation tests have run.
- No push, export/import, binary file, offline/online or web/mobile consistency tests have run.
- Production readiness and 100% parity are not established.

## Safe next implementation order

1. Materialize this feature branch in a connected local checkout; align dependencies, create a lockfile and repair typecheck/build defects.
2. Verify the catalog against each actual controller, validator, response envelope and permission gate; replace generic views with dedicated typed screens and use the assignment, notice and timetable flows as the next validation targets.
3. Implement context selection and cache/query invalidation on any role/workspace/scope change.
4. Implement dedicated role dashboards and module workflows incrementally with schema validation, idempotency, audits and API authorization tests.
5. Add imports/exports, uploads/downloads, native notifications/deep links and explicit offline read/write policy.
6. Add automated integration/device tests against an isolated institution and verify web/mobile consistency.
7. Add the exact logo/icon/splash assets and signed release configuration.
8. Keep the protected production branch and live data unchanged until a separately authorized review/merge/release.