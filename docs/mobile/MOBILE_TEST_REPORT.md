# ACADLYX Mobile Test Report

## Execution record for this increment

The latest Priority 1 scope-isolation changes are committed on branch native-mobile-parity-2026-10-17. The previous Native Mobile CI run passed source typecheck, structural tests, Expo Doctor, and Android/iOS JavaScript bundle exports; the new workspace isolation/API test changes must be confirmed by the current workflow before they are treated as verified. CI evidence is linked from the PR Checks tab.

| Check | Result | Evidence / limitation |
|---|---|---|
| Repository route/role discovery | SOURCE REVIEWED | Read backend/src/app.ts, backend/src/config/rbac.ts, auth, portal, student, assignment, finance and related route files from base commit 2dc568ec4416a295028cf64eaa7ee659b9258d89. |
| Native app source written | SOURCE ADDED | Expo shell, API/auth, original logo, My Work, module directory/detail, notifications/profile, dedicated assignments/notices/timetable screens, catalog and configuration are on the feature branch. |
| Structural contract tests | PASSED on prior head; rerun queued for Priority 1 changes | `mobile/scripts/mobile-contract.test.mjs` covers catalog keys, auth/token storage, context filtering across the seven dimensions, query reset before scope activation, query refetch, inactive-cache clearing, role permissions, and implemented workflows. Check the latest Native Mobile CI before treating the new cases as passed. |
| npm dependency install / lockfile | CI VERIFIED on prior head | `mobile/package-lock.json` is committed; the latest workflow reruns dependency installation and Expo-managed compatibility checks. |
| TypeScript typecheck | PASSED on prior head; rerun queued for Priority 1 changes | Native Mobile CI runs `npm run typecheck`; the Production Quality workflow separately runs backend typecheck/tests. |
| Expo Doctor | PASSED on prior head; rerun queued for Priority 1 changes | Native Mobile CI runs `npx expo-doctor`. |
| Android build/device install | NOT RUN | Android SDK, JDK, emulator/device build not available through this repository interface. |
| iOS build/device launch | NOT RUN | A local iOS build requires macOS/Xcode; EAS credentials and project binding are not configured. |
| Isolated PostgreSQL/API isolation suite | ADDED; current CI result pending | `backend/src/__tests__/workspace-context-isolation.integration.test.ts` starts the real Express app, seeds two disposable institutions and role/access/enrollment fixtures, issues test session JWTs, calls actual API endpoints, and cleans temporary records in `finally`. The Production Quality workflow enables `RUN_POSTGRES_INTEGRATION=1` against its disposable PostgreSQL. Read the current run result before calling this passed. |
| Push delivery / deep-link tests | NOT RUN | Native push registration and event contract are not implemented. |
| Role/context/tenant/student isolation | ADDED; current CI result pending | Covers all 20 roles (the 19 tenant roles plus platform Super Admin), multi-role priority cases, CampusAccess/DepartmentAccess revocation, deleted and cross-tenant selectors, active-enrollment-locked Student context, direct unauthorized course/program/year/semester/section/offering/batch/student requests, and cross-tenant/student record isolation. |
| Web/mobile consistency | NOT RUN | No test mutations were made. |

## Run in a connected development checkout

From the mobile directory:

~~~
npm install
npx expo install --fix
npm run typecheck
npm test
npm run doctor
npm start
npx expo run:android
npx expo run:ios
~~~

If SDK package auto-fix changes package versions, commit the generated package-lock.json. Use Node version and native toolchains supported by the selected Expo SDK.

## Required release test gates

- Login/MFA, refresh token rotation, logout, expired/revoked sessions, password-change and deactivated-user behavior.
- Each of the 20 canonical roles and actual multi-role combinations from RBAC.
- Direct API authorization on every endpoint, not only UI visibility.
- Institution, campus, department, programme, batch, semester, section and student isolation.
- Every workflow lifecycle after dedicated native mutations are implemented: validations, approvals, rejections, publication, corrections, refunds and idempotent retries.
- Pagination, sorting, filters and large datasets using representative non-production fixtures.
- Web-to-mobile and mobile-to-web changes against an isolated test institution.
- Android/iOS keyboard, safe areas, back handling, tablets, accessibility, offline/online transitions and request cancellation.
- Imports/exports, binary preview, upload/download interruption, audit and push/deep links after those capabilities are added.

Structural source tests do not prove API integration, build success, role isolation or end-to-end workflow behavior. Promote a feature to COMPLETE only after the relevant test actually runs and its evidence is recorded here.

## Pull-request CI configuration

`.github/workflows/mobile-ci.yml` was added. It is configured to install dependencies, check Expo versions, run TypeScript and structural tests, run Expo Doctor, and export Android/iOS JavaScript bundles for pull requests to the protected baseline. The previous Native Mobile CI run passed; the latest Priority 1 run must also pass before merge. These exports are not signed native builds or device tests.
