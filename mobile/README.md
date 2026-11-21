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
- Generic read-only API collection/detail views for the wider catalog.
- Dedicated assignment lifecycle surfaces: create draft, publish/unpublish, student submission, reviewer grading and explicit reopen.
- Dedicated notices create/edit/delete and timetable create/edit/delete screens using existing server validators and scope/conflict enforcement.
- Notification list, individual read and mark-all-as-read actions.
- Account role/permission summary and password-change flow.
- Exact original ACADLYX logo used on the sign-in screen; native app icon and splash assets are still pending.

This is not full feature parity. Module-specific writes, approval transitions, context switching, push notifications, deep links, file workflows, imports/exports and conflict-safe offline support remain incomplete. See docs/mobile/MOBILE_FEATURE_PARITY.md and docs/mobile/MOBILE_KNOWN_LIMITATIONS.md.

The exact original ACADLYX logo has been copied from `frontend/public/branding/acadlyx-logo.png` to `mobile/assets/acadlyx-logo.png` and is displayed on the sign-in screen. Dedicated icon/splash crops and store artwork remain pending.

## Build

- npm run android or npm run ios for local native development builds.
- eas build --profile development --platform android or ios.
- eas build --profile preview --platform android or ios.
- eas build --profile production --platform android or ios.

EAS project association, signing credentials, Apple Developer provisioning, Play Console release setup, native app assets and privacy/store metadata must be completed by the release owner. No build or store submission is claimed.