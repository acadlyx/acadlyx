# ACADLYX Mobile Feature Matrix

The detailed route-by-route inventory, status definitions and remaining functionality live in docs/mobile/MOBILE_FEATURE_PARITY.md.

The implementation state and executed verification evidence are maintained in
docs/mobile/MOBILE_IMPLEMENTATION_TRACKER.md.

Companion documents:
- docs/mobile/MOBILE_ARCHITECTURE.md
- docs/mobile/MOBILE_ROLE_PERMISSION_MATRIX.md
- docs/mobile/MOBILE_API_INTEGRATION.md
- docs/mobile/MOBILE_TEST_REPORT.md
- docs/mobile/MOBILE_BUILD_AND_RELEASE.md
- docs/mobile/MOBILE_KNOWN_LIMITATIONS.md

Current native surfaces are authentication/MFA, secure token handling, My Work, permission-filtered module discovery, generic read-only API lists/detail rendering, dedicated assignment lifecycle, notices CRUD, timetable CRUD, library catalogue/circulation/fines, Calendar event CRUD, Attendance session/roster marking and submission, notification read actions, profile information and password change.

Foundation/partial means exactly that: these screens do not stand in for full CRUD, approvals, exports, imports or total workflow parity. The protected server-side authorization and scope model remain authoritative. No test or build is described as passed without execution evidence.
