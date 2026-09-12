# Setup — Phase 0

## Prerequisites
- Node.js >= 18
- A PostgreSQL database (local, Neon, or Supabase) — only required once
  you run Prisma commands; the health endpoint itself has no DB dependency.

## Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DATABASE_URL if/when you want to run Prisma commands
npm run dev
```

Runs on **http://localhost:5000**.

Verify:
```bash
curl http://localhost:5000/api/v1/health
```
Expected:
```json
{
  "success": true,
  "service": "acadlyx-api",
  "status": "healthy",
  "timestamp": "..."
}
```

### Database (Phase 1+)
Set `DATABASE_URL` in `.env`, then also set `JWT_ACCESS_SECRET` and
`JWT_REFRESH_SECRET` (e.g. `openssl rand -hex 64` for each). Without
them the server runs with insecure dev defaults and prints a warning.

```bash
npm run prisma:generate     # generate the Prisma client
npm run prisma:migrate      # create/apply the Phase 1 migration
npm run prisma:seed         # create AIMT + demo users (see docs/PHASE-1.md)
```

## Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Runs on **http://localhost:3000**. The home page (`/`) calls the backend
health endpoint and shows "Backend connected" once both servers are
running.

### Student Portal (Phase 3+)
1. Make sure the backend has been migrated and seeded (see above).
2. Go to **http://localhost:3000/login**.
3. Sign in as `student@aimt.acadlyx.com` with your backend's
   `SEED_DEMO_PASSWORD`.
4. You're redirected to **http://localhost:3000/student** — the
   student dashboard.

## Notes
- Frontend and backend are fully independent — either can run without
  the other; `/` just shows a connection error state, and `/student`
  redirects to `/login` if there's no valid session.
- Auth tokens are stored in the browser's `localStorage` for this MVP
  (see `docs/PHASE-3.md` for the trade-off and when it'll be revisited).
