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

Runs on **http://localhost:5001** by default.

Verify:
```bash
curl http://localhost:5001/api/v1/health
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
INITIAL_ADMIN_EMAIL=admin@example.edu INITIAL_ADMIN_PASSWORD='use-a-strong-secret' npm run prisma:seed
```

`prisma:seed` is the safe production bootstrap: it repairs the RBAC catalog
and creates or repairs the configured institution administrator without
overwriting existing user passwords. Development-only sample data is opt-in:
`SEED_DEMO_PASSWORD='local-only-secret' npm run prisma:seed:demo`.

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

### Student Portal
Create a student user and enrollment through the institution admin workflow,
then sign in at **http://localhost:3000/login**. The application redirects the
user to the dashboard permitted by their assigned role.

## Notes
- Frontend and backend are fully independent — either can run without
  the other; `/` just shows a connection error state, and `/student`
  redirects to `/login` if there's no valid session.
- Auth tokens are stored in the browser's `localStorage` for this MVP
  (see `docs/PHASE-3.md` for the trade-off and when it'll be revisited).
