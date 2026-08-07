# Attendance Hub

Attendance Hub is a multi-tenant university attendance management system built with Next.js and Supabase.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Supabase (Auth + Postgres + Realtime)
- Dexie (offline-first IndexedDB)
- Zustand
- Tailwind CSS + shadcn/ui
- pnpm

## Requirements

- Node.js 18+
- pnpm
- Supabase project configured

## Setup

1. Install dependencies:

```bash
pnpm install
```

1. Configure environment in .env.local:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

1. Start development server:

```bash
pnpm dev
```

1. Build for production:

```bash
pnpm build
pnpm start
```

## Scripts

- pnpm dev: run development server
- pnpm build: production build
- pnpm start: run built app
- pnpm lint: lint project

## App Structure

- src/app/(auth): login/register/password flows
- src/app/(dashboard): role-based pages
- src/components: layout/ui/providers
- src/lib/db: local Dexie data layer + sync
- src/lib/supabase: client/admin/realtime helpers
- src/lib/stores: Zustand stores
- supabase/migrations: SQL schema and policy migrations

## Security and Data Model

- Multi-tenant data isolation by university_id
- RLS-based access boundaries in Supabase
- Role model: super_admin, admin, primary_teacher, regular_teacher, cr
- Offline-first queue sync with teacher-priority conflict handling for attendance

## Notes

- Package manager is pnpm.
- Production hardening and audit notes are documented in PRODUCTION_READINESS_AUDIT_2026-03-18.md.
