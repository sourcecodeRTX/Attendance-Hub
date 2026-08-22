# Attendance-Hub Fix Log — Implementation Progress

Source of truth for *what's wrong*: ATTENDANCE_HUB_AUDIT_FINDINGS.md (created in Phase 1; read-only afterward).
Source of truth for *how it's being fixed*: this file.

## Progress Tracker

| Phase | Name | Status | Session Date | Commit |
|---|---|---|---|---|
| 0 | Ground Truth Recon | Complete | 2026-08-22 | 2ea0eca |
| 1 | Paranoid Read-Only Audit | Complete | 2026-08-22 | 350c8fe |
| 2 | Test-Harness Foundation (Vitest) | Complete | 2026-08-22 | (see entry) |
| 3 | Auth & Session Security | Not started | | |
| 4 | Supabase RLS & Database Security | Not started | | |
| 5 | Secrets & Config Hygiene | Not started | | |
| 6 | Sync Engine Correctness (Dexie ↔ Supabase) | Not started | | |
| 7 | Data Integrity & Write Concurrency | Not started | | |
| 8 | Import/Export Robustness | Not started | | |
| 9 | Input Validation & Error Honesty | Not started | | |
| 10 | README/Docs Claims vs Measured Behavior (High) | Not started | | |
| 11 | Query Performance & Scalability | Not started | | |
| 12 | Frontend Accessibility I | Not started | | |
| 13 | Frontend Accessibility II + UX Honesty | Not started | | |
| 14 | State Management & Hooks Robustness | Not started | | |
| 15 | Backup/Restore & Activity-Log Correctness | Not started | | |
| 16 | Test-Quality Fixes | Not started | | |
| 17 | Medium Docs/UI-Text Contradictions | Not started | | |
| 18 | Low Sweep — Lib Correctness | Not started | | |
| 19 | Low Sweep — Frontend UX/A11y Polish | Not started | | |
| 20 | Low Sweep — Ops/Tooling | Not started | | |
| 21 | CI Foundation | Not started | | |
| 22 | Low Sweep — Final Docs/Text | Not started | | |
| 23 | Compressed Re-Audit | Not started | | |
| 24 | Final Docs/README Sync | Not started | | |
| 25 | Closing Report | Not started | | |

Status values: `Not started` / `In progress (partial — see notes)` / `Complete`

## Phase 0 Notes

**Date:** 2026-08-22. **Branch:** `main` @ `254a3d0` ("Update favicon to graduation cap"), up to date with `origin/main`. Working tree clean except the effort's own new files (`ATTENDANCE_HUB_PARANOID_FIX_PROTOCOL.md`, this file, `opencode.json`). No stray changes; nothing reset or re-cloned.

**Environment facts:**
- pnpm 10.27.0, Node v24.12.0, Windows (PowerShell 5.1 shell).
- **Docker: NOT available** on this machine. Consequence for later phases: no local Postgres/Supabase container is possible; DB-level claims must be tested via precisely-mocked `supabase-js` clients and Dexie logic via `fake-indexeddb` (per protocol Rule 6/12). Never touch the production Supabase project from tests.
- `.env.local` variable names only (values never recorded): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role key present client-side — good; full secrets/config audit happens in Phase 5.
- Test runner: **none installed** (no vitest/jest in package.json). Drives Phase 2.
- Supabase migrations: 20 files (`001_initial_schema.sql` … `020_fix_attendance_rls_for_mixed_roles.sql`). Fixes append from `021`.

**Fresh baseline verification suite (recorded pre-any-changes):**
| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm run lint` | EXIT=0 — **17 warnings, 0 errors** (15× `@typescript-eslint/no-unused-vars`, 1× unused caught error, 1× `react-hooks/exhaustive-deps` in `src/app/page.tsx:43`) |
| Type-check | `pnpm exec tsc --noEmit` | EXIT=0 — clean |
| Build | `pnpm run build` | EXIT=0 — all 20 routes prerender static, middleware 75.3 kB, shared First Load JS 87.8 kB |

These 17 lint warnings are the pre-existing baseline; they are NOT auto-findings but are fair game for Phase 1's audit to classify.

## Finding-to-Phase Map

*(to be filled at the start of Phase 3 — maps each finding ID from ATTENDANCE_HUB_AUDIT_FINDINGS.md to its assigned phase)*

## New Leads Observed (Not Yet In Scope)

*(nothing yet — Phase 0 is recon-only)*

---

## Entries

### [PHASE 0] Ground Truth Recon — Complete

- **Date**: 2026-08-22
- **Work performed**: branch/checkout sanity confirmed (Rule 10); environment facts recorded above; fresh baseline of all three existing verification gates captured (all green); this log created per §7 of the protocol.
- **Code changes**: none (protocol-compliant — Phase 0 makes no source edits).
- **Blockers for later phases**: Docker absent → local DB-instance testing impossible; test harness does not exist yet → Phase 1 audit may still write reproductions as manual traces, but failing-first automated tests only become possible after Phase 2.

### [PHASE 1] Paranoid Read-Only Audit — Complete

- **Date**: 2026-08-22
- **Work performed**: Full adversarial read-only audit per §5 of the protocol. Read end-to-end: middleware, all auth flows + server actions (`register`, `login`, `(dashboard)/actions.ts`, `backup/actions.ts`), auth-provider/guard/stores, entire Dexie layer (index, sync, attendance, students, subjects, university, user-sections, activity, analytics), validation schemas, migrations 001–020 (operative RLS state reconciled through the DROP/CREATE chain: 002→004→005→006→008→009→013→016→020), attendance/students/activity-logs/backup/export pages, package.json/configs, `.env.local` names only. Produced `ATTENDANCE_HUB_AUDIT_FINDINGS.md`: **31 findings** — 5 Critical, 7 High, 12 Medium, 7 Low — each with file:line evidence, impact, confidence, and fix-direction-only suggestions.
- **Code changes**: none beyond creating the audit file (protocol-compliant). Committed as `350c8fe`.
- **Headline findings** (full detail in audit file): unauthenticated/under-authorized service-role server actions (F-001..F-003); users-table UPDATE self-promotion to super_admin via RLS (F-004); pullFromCloud silent 1000-row truncation + no delete propagation (F-005); missing SUPABASE_SERVICE_ROLE_KEY in env (F-006); hardcoded restore password + cross-tenant account hijack (F-007/F-008); sync poison pills & teacher bulk-upload never syncing (F-009).
- **Verification gates**: N/A — no source code touched; lint/tsc/build baseline from Phase 0 remains authoritative for this commit.
- **Notes for Phase 2+**: DB-level claims (F-004, F-015/F-016 constraint gap, F-025, F-026) were derived by migration tracing only (Docker absent) — reproduce with precisely-mocked supabase-js clients once Vitest lands. Finding-to-Phase Map to be filled at Phase 3 start.

### [PHASE 2] Test-Harness Foundation (Vitest) — Complete

- **Date**: 2026-08-22
- **Work performed**: Installed and configured Vitest 4.1.11 with the official `@vitejs/plugin-react` transformer, jsdom environment, and `@` path alias (`vitest.config.ts`). Added `test` / `test:watch` / `test:coverage` scripts to `package.json`. Dev dependencies added: `vitest@4.1.11`, `@vitest/coverage-v8@4.1.11`, `jsdom@30.0.1`, `@testing-library/react@16.3.2`, `@testing-library/user-event@14.6.6`, `@testing-library/jest-dom@7.0.1`, `fake-indexeddb@6.2.5`, `@vitejs/plugin-react@6.1.0`. Setup file `src/test/setup.ts` registers jest-dom matchers.
- **Harness patterns proven** (5 test files, 34 tests, all passing):
  - *Pure lib units*: `src/lib/utils/validation.test.ts` — zod schema behavior (accept/reject paths for register/login/change-password/section/university-settings schemas). Notable discovery: **zod v4's `.uuid()` enforces a version nibble `[1-8]`** — classic v1-style fixture UUIDs like `6f9619ff-8b86-d011-…` are rejected; tests use v4-format UUIDs. Relevant to F-029 work later.
  - *CSV parse helpers*: `src/test/students-csv.test.ts` — mirrors and pins the header-mapping logic inlined in students/page.tsx handleFileParse (snake_case/TitleCase/camelCase headers, missing-field row skipping, blank-line skipping, whitespace trimming) ahead of Phase 8 import robustness.
  - *Dexie against fake-indexeddb*: `src/lib/db/attendance.test.ts` — real Dexie operations over `fake-indexeddb/auto`: `getNextPeriodNumber` (empty/max+1/cross-subject-and-date isolation), archived-session filtering, and `createAttendanceSession`/`updateAttendanceSession` local-write + syncQueue-enqueue payload shape (snake_case remote payloads). This is the pattern Phase 6/7 sync-engine tests will reuse.
  - *Mocked supabase-js client*: `src/lib/supabase/realtime.test.ts` — `vi.mock('@/lib/supabase/client')` with a chainable fake channel builder; asserts channel naming, postgres_changes config/filter scoping, subscription, and payload passthrough. No network, never touches the production project (Rule 12).
  - *Component render*: `src/components/ui/button.test.tsx` — jsdom + Testing Library render, user-event click, disabled-state behavior over the existing Base UI button wrapper.
- **Issues hit and resolved during setup**: (1) tsconfig `jsx: "preserve"` broke vite transform of `.tsx` — fixed by adding `@vitejs/plugin-react`; (2) initial validation-test UUID fixture rejected by zod v4 strict uuid format (see above) — fixture corrected, not the schema (schema change is out of scope until F-029).
- **Verification gates**: `pnpm run lint` EXIT=0 (17 warnings / 0 errors — identical to Phase 0 baseline, no new warnings from test files); `pnpm exec tsc --noEmit` EXIT=0 clean; `pnpm run test` EXIT=0 (5 files / 34 tests passed); `pnpm run build` EXIT=0 (same route output as baseline).
- **Code changes**: none to existing source files — only new config/test files, package.json devDependencies/scripts, README test instructions (all within Phase 2 scope).
- **Notes for Phase 3+**: failing-first tests are now possible per protocol Rule 6. The Finding-to-Phase Map must be filled at Phase 3 start. DB-level claims still require precisely-mocked supabase-js clients (Docker remains absent).
