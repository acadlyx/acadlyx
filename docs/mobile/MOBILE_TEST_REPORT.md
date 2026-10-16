# ACADLYX Mobile Test Report

## Execution record for this increment

The native source files, workspace configuration and test source were saved to branch native-mobile-parity-2026-10-17. No runtime build or test pass is claimed.

| Check | Result | Evidence / limitation |
|---|---|---|
| Repository route/role discovery | SOURCE REVIEWED | Read backend/src/app.ts, backend/src/config/rbac.ts, auth, portal, student, assignment, finance and related route files from base commit 2dc568ec4416a295028cf64eaa7ee659b9258d89. |
| Native app source written | SOURCE ADDED | Expo shell, API/auth, navigator, home, module directory/detail, notifications, profile, catalog and configuration files are on the feature branch. |
| Structural contract test source | ADDED, NOT RUN | mobile/scripts/mobile-contract.test.mjs |
| npm dependency install / lockfile | NOT RUN / NOT CREATED | This environment could access the connected GitHub API but could not clone the repo into a local checkout for build tooling. |
| TypeScript typecheck | NOT RUN | No local dependency installation or checkout. |
| Expo Doctor | NOT RUN | Requires dependency installation. |
| Android build/device install | NOT RUN | Android SDK, JDK, emulator/device build not available through this repository interface. |
| iOS build/device launch | NOT RUN | A local iOS build requires macOS/Xcode; EAS credentials and project binding are not configured. |
| Live API smoke test | NOT RUN | No authenticated test account or isolated test institution supplied; production records were not touched. |
| Push delivery / deep-link tests | NOT RUN | Native push registration and event contract are not implemented. |
| Authorization/cross-tenant tests | NOT RUN | Dedicated integration tests are still required against an isolated database. |
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