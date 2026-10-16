# ACADLYX Native Mobile

Native Android and iOS workspace built with Expo, React Native and TypeScript. It uses the existing ACADLYX REST API and authoritative database; it does not connect to PostgreSQL or Supabase directly.

## Setup

1. Install a Node.js version supported by the selected Expo SDK.
2. Copy .env.example to .env and set EXPO_PUBLIC_API_URL to the backend origin only. Do not append /api/v1.
3. Run npm install, then npx expo install --fix to align Expo-managed package versions.
4. Run npm run typecheck, npm test and npm run doctor.
5. Run npm start for Metro. Native builds require the relevant platform toolchains.
6. For local development: Android emulator uses http://10.0.2.2:5001; iOS simulator uses http://localhost:5001. Physical devices require a reachable LAN or HTTPS endpoint.

## Implemented in this increment

- Existing login and MFA API contracts, secure token storage, refresh-on-401 and sign-out.
- Live /my-work home screen and permission-filtered module directory.
- Generic read-only API collection/detail views for the current catalog.
- Notification list and backend mark-all-as-read action.
- Account role/permission summary and password-change flow.

This is not full feature parity. Module-specific writes, approval transitions, context switching, push notifications, deep links, file workflows, imports/exports and conflict-safe offline support remain incomplete. See docs/mobile/MOBILE_FEATURE_PARITY.md and docs/mobile/MOBILE_KNOWN_LIMITATIONS.md.

The original image assets are not embedded in this source increment. The A monogram is typographic styling, not an alternative ACADLYX logo. Replace it with the exact repository brand asset before release.

## Build

- npm run android or npm run ios for local native development builds.
- eas build --profile development --platform android or ios.
- eas build --profile preview --platform android or ios.
- eas build --profile production --platform android or ios.

EAS project association, signing credentials, Apple Developer provisioning, Play Console release setup, native app assets and privacy/store metadata must be completed by the release owner. No build or store submission is claimed.