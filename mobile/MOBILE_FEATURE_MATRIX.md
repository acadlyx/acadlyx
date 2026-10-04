# ACADLYX Mobile Feature Matrix

Branch: `mobile-app-foundation-2026-10-05`

This is the source-code audit inventory for the native client. The backend remains authoritative.

| Capability | Backend surface | Mobile surface | Status |
|---|---|---|---|
| Authentication | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` | Native login/session bootstrap | COMPLETE |
| MFA sign-in | `/auth/mfa/verify` | MFA verification | COMPLETE |
| Profile/account | `/auth/account` | Profile surface | PARTIAL |
| Role/permission workspace | `/my-work`, `/workspace`, auth payload | Permission-derived module registry | COMPLETE foundation |
| Users/people | `/users` | Live list + authorized actions | COMPLETE foundation |
| Students | `/students` | Live list + authorized actions | COMPLETE foundation |
| Faculty | `/faculty` | Live list | COMPLETE foundation |
| Departments | `/departments` | Live list + actions | COMPLETE foundation |
| Programs | `/programs` | Live list + actions | COMPLETE foundation |
| Academic years | `/academic-years` | Live list + actions | COMPLETE foundation |
| Semesters | `/semesters` | Live list + actions | COMPLETE foundation |
| Sections | `/sections` | Live list + actions | COMPLETE foundation |
| Courses | `/courses` | Live list + actions | COMPLETE foundation |
| Course offerings | `/course-offerings` | Live list + actions | COMPLETE foundation |
| Registration | `/registrations` | Live records + approve/reject actions | COMPLETE foundation |
| Attendance | `/attendance-sessions` | Live records | COMPLETE foundation |
| Assignments | `/assignments` | Live records | COMPLETE foundation |
| Grading/results | `/grades`, `/students/me/marks` | Live transcript/results | COMPLETE foundation |
| Examinations | `/examinations` | Live sessions | COMPLETE foundation |
| Fees/billing | `/billing`, `/finance`, `/erp` | Live financial records | COMPLETE foundation |
| Notifications | `/portal/notifications` | Live notification list | COMPLETE foundation |
| Documents | `/portal/documents` | Live document list | COMPLETE foundation |
| Library | `/library/books` | Live book list | COMPLETE foundation |
| HR | `/hr/employees` | Live employee list | COMPLETE foundation |
| Admissions | `/admissions` | API-backed module surface | COMPLETE foundation |
| OBE | `/obe` | API-backed module surface | COMPLETE foundation |
| Operations | `/operations` | Operations summary | COMPLETE foundation |
| Search | `/search?q=` | Module surface; query wiring pending | PARTIAL |
| Reports | `/erp` / export routes | API-backed module surface | PARTIAL |
| Audit | finance/security audit surfaces | Authorized audit surface | PARTIAL |
| Imports | `/imports/:type/preview`, `/imports/:type/commit` | Not yet native file picker wired | BLOCKED BY DEVICE LAYER |
| Exports | `/exports/:type` | Not yet native file handling wired | BLOCKED BY DEVICE LAYER |
| Push notifications | Existing notification records; push contract must be verified | Not registered in native client yet | BLOCKED BY DEVICE/BACKEND EVENT CONTRACT |
| Camera/document picker | Existing file endpoints | Expo device package not yet added | BLOCKED BY DEVICE LAYER |
| Binary PDF/ZIP preview | Existing web endpoints | Native binary/file viewer not yet added | BLOCKED BY DEVICE LAYER |
| Offline writes | Backend supports authenticated mutations | Client does not fake successful offline writes | PARTIAL |

## Safety verification

- Mobile changes target only `mobile-app-foundation-2026-10-05`.
- No Prisma migration was added.
- No Vercel or Render configuration was changed.
- No second backend was introduced.
- Authorization is still enforced server-side.
- Client-side permission filtering is usability only.
- Tenant/institution identity is never supplied as an authorization override by mobile.

## Next native layers

The remaining work is implementation, not a placeholder roadmap: native file/device integration, full per-module forms and workflow screens, push registration, deep links, offline read caching, and release/build verification.
