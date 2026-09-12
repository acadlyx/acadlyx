# ACADLYX

Education ERP & Institutional Intelligence Platform.

Pilot institution: **Accurate Institute of Management & Technology (AIMT)**.
ACADLYX is architected as a multi-tenant SaaS platform from day one — AIMT
is the first institution, not a hard-coded assumption.

## Status
Phase 5 — core academic operations (attendance completed, assignments,
internal marks). See [`docs/PHASE-0.md`](./docs/PHASE-0.md),
[`docs/PHASE-1.md`](./docs/PHASE-1.md), [`docs/PHASE-2.md`](./docs/PHASE-2.md),
[`docs/PHASE-3.md`](./docs/PHASE-3.md), [`docs/PHASE-4.md`](./docs/PHASE-4.md),
and [`docs/PHASE-5.md`](./docs/PHASE-5.md) for what each phase includes
and the decisions that shape later phases.

## Structure

```
ACADLYX/
├── frontend/   Next.js + TypeScript + Tailwind CSS
├── backend/    Node.js + Express + TypeScript + Prisma
├── docs/       Phase notes and architecture documentation
└── README.md
```

## Stack
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript, REST API
- **Database:** PostgreSQL via Prisma ORM
- **Auth (Phase 1+):** JWT + refresh tokens, RBAC

## Quick start
See [`docs/SETUP.md`](./docs/SETUP.md) for full install/run instructions.

```bash
# Backend
cd backend && npm install && cp .env.example .env && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

- Frontend: http://localhost:3000
- Backend health check: http://localhost:5000/api/v1/health
