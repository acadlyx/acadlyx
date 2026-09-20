# ACADLYX deployment checklist

## Staging

- [ ] Supabase PostgreSQL project created
- [ ] Render API deployed from `backend/`
- [ ] `DATABASE_URL` set on Render
- [ ] `CORS_ORIGIN` set to Vercel origin
- [ ] Render health endpoint returns HTTP 200
- [ ] Vercel frontend deployed from `frontend/`
- [ ] `NEXT_PUBLIC_API_URL` points to Render API origin
- [ ] Admin login verified
- [ ] Student master profile creation verified
- [ ] Enrollment/section workflow verified
- [ ] Attendance workflow verified
- [ ] Marks/results workflow verified
- [ ] Tenant isolation verified

## Before production

- [ ] Clean `npm ci` + build verified on Node 20
- [ ] Full automated test suite passes
- [ ] Password-reset email provider configured
- [ ] Authentication token storage security review completed
- [ ] Backup/restore procedure tested
- [ ] Real institutional workflows signed off
- [ ] Existing migration history verified against the target database
