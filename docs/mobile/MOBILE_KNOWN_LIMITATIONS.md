# ACADLYX Mobile Known Limitations

This is an initial implementation increment, not a production-ready full-parity app.

## Functional gaps

- Most modules are generic read-only list/detail adapters. Dedicated assignment create/publish/submit/review/reopen, notice create/edit/delete, timetable create/edit/delete and library catalogue/reservation/loan/return/renew/book-maintenance flows are now wired to inspected existing APIs. Other modules still need their own create/edit/delete, archive/restore, bulk, approval/rejection, publish/lock and state-transition workflows.
- The generic adapter does not yet provide fully typed API contracts, schema-validated inputs, reliable per-module pagination, sorting or server-side filters.
- Native workspace/context switching is implemented for campus, department, programme, academic year, batch, semester and section. It remains a release gate until the current CI run passes the isolated PostgreSQL/API suite and all role/scope cases are exercised against a live test tenant. Other module APIs still need module-by-module scope-filter review; only known compatible list contracts receive automatic client context filters.
- Global search is wired to the existing /search?q= endpoint; result taps currently open the corresponding module, not the exact record detail, and result/deep-link authorization still needs device/live-API verification.
- Login, MFA, token refresh, logout and password change are present. The inspected auth router did not expose a password recovery/reset endpoint, so the app does not pretend recovery is available.
- Profile editing, photo upload, account deactivation/deletion lifecycle and biometric unlock are not implemented.
- Notification preferences, push-token registration/delivery, notification taps and role/scope-safe deep links are not implemented.
- Camera/gallery, document picker, multipart uploads, download streaming, file previews, native PDF handling, import preview/commit and export formats are not implemented.
- Offline cache policy, conflict handling, queued mutations and background synchronization are not implemented. No offline write is silently reported as successful.
- Separate dashboard configurations exist for all 20 backend roles, but they remain IMPLEMENTED_UNVERIFIED: live metrics, multi-role precedence and every role's quick actions must be tested. Dashboard presence does not establish complete workflows.
- Student self-service endpoint cards are mapped but have not been tested against authenticated live/test data.
- The exact original logo is included and displayed on sign-in. Dedicated native app icon/adaptive icon, splash and store artwork still need brand-approved cropping/configuration.
- `mobile/package-lock.json` is committed and the Expo-managed dependency/typecheck/structural-test/Expo Doctor/Android+iOS JavaScript-bundle CI has previously passed. Verify the latest workflow for this increment. The recorded dependency audit still requires a reviewed compatibility-safe remediation.

## Verification gaps

- TypeScript, structural tests, Expo Doctor and Android/iOS JavaScript bundle exports have passed in earlier Native Mobile CI for this branch. The latest Priority 1 changes await the current CI result. Signed Android/iOS artifact builds and real-device tests have not been performed.
- A gated real Express API/PostgreSQL suite has been added at `backend/src/__tests__/workspace-context-isolation.integration.test.ts`; it seeds disposable tenant fixtures and tests all 20 roles, multi-role precedence, seven selectors, access revocation, deleted/foreign selections, and student/tenant isolation. Do not mark it passed until the current `ACADLYX Production Quality` run completes successfully.
- No push, export/import, binary file, offline/online or web/mobile consistency tests have run.
- Production readiness and 100% parity are not established.

## Safe next implementation order

1. Materialize this feature branch in a connected local checkout; align dependencies, create a lockfile and repair typecheck/build defects.
2. Verify the catalog against each actual controller, validator, response envelope and permission gate; replace generic views with dedicated typed screens and use the assignment, notice and timetable flows as the next validation targets.
3. Finish the Priority 1 context/scope release gate: pass the isolated API/PostgreSQL suite, check current CI results, and cover every module list endpoint with an explicit supported context filter or documented server-derived scope.
4. Implement dedicated role dashboards and module workflows incrementally with schema validation, idempotency, audits and API authorization tests.
5. Add imports/exports, uploads/downloads, native notifications/deep links and explicit offline read/write policy.
6. Add automated integration/device tests against an isolated institution and verify web/mobile consistency.
7. Add the exact logo/icon/splash assets and signed release configuration.
8. Keep the protected production branch and live data unchanged until a separately authorized review/merge/release.