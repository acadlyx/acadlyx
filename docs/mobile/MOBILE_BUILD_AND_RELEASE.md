# ACADLYX Mobile Build and Release

## Platform baseline

The workspace currently targets Expo SDK 57 / React Native 0.86 / React 19.2.3. Align package versions with the Expo SDK before building, then commit the resolved lockfile. SDK 57 documentation currently lists Node.js 22.13.x as the minimum and iOS 16.4+ / Xcode 26.4+ support requirements; verify the official SDK compatibility table before selecting a CI image.

## Local prerequisites

- Node.js version supported by the selected Expo SDK, npm and Git.
- Android Studio, Android SDK, compatible JDK and an emulator or test device for local Android builds.
- macOS, Xcode and required iOS build tooling for local iOS simulator/device builds.
- EAS CLI and an Expo account for cloud builds.
- Google Play Console, signing/release ownership and store metadata for Android distribution.
- Apple Developer account, provisioning, signing certificates and App Store Connect configuration for iOS distribution.

## Environment

Copy mobile/.env.example to mobile/.env and set EXPO_PUBLIC_API_URL to the backend origin only. Do not append /api/v1.

Current default origin: https://acadlyx-api.onrender.com.

For local development:
- Android emulator: http://10.0.2.2:5001
- iOS simulator: http://localhost:5001
- Physical device: use an IP/hostname reachable over the device's network, or an HTTPS development endpoint.

Never put PostgreSQL credentials, Supabase service-role keys, refresh service secrets, privileged backend tokens or database URLs in EXPO_PUBLIC variables. These variables are bundled into the mobile app.

## Automated pull-request gate

The repository now includes `.github/workflows/mobile-ci.yml`, triggered on pull requests targeting `production-upgrade-2026-09-20` and by manual dispatch. It installs mobile dependencies, checks Expo compatibility, runs TypeScript and structural tests, runs Expo Doctor and exports Android and iOS JavaScript bundles. These exports are not signed APK/AAB/IPA builds or device tests; check actual Actions results before treating the gate as passed.

## Install and validate

~~~
cd mobile
npm install
npx expo install --fix
npm run typecheck
npm test
npm run doctor
npm start
npx expo run:android
npx expo run:ios
~~~

The first source increment has no package lockfile yet. No command above is reported as already passing; run them in a connected checkout and record the real outputs.

## EAS build profiles

~~~
npm install --global eas-cli
eas login
eas build:configure
eas build --profile development --platform android
eas build --profile development --platform ios
eas build --profile preview --platform all
eas build --profile production --platform all
~~~

EAS project association, signing credentials, update channels, native push credentials, production environment, original ACADLYX icon/splash assets, and privacy/store metadata still require release-owner setup.

## Release gates

1. Resolve dependencies with Expo install tooling and commit a lockfile.
2. Pass Expo Doctor, TypeScript, structural tests and module-level test suites.
3. Build Android and iOS artifacts in a connected environment; install and smoke test them on actual supported devices.
4. Test each role/workspace and server-side scope isolation against an isolated test institution.
5. Verify uploads, downloads, exports, import validation, push delivery and deep links after those features exist.
6. Review permissions/privacy disclosures, deletion/account lifecycle, data retention, screenshots and store metadata.
7. Validate backend CORS/auth/rate limits without weakening RBAC.
8. Obtain explicit release authorization before publishing or changing production deployment configuration.

No APK, AAB, IPA, app-store submission or deployment has been produced or claimed in this increment.