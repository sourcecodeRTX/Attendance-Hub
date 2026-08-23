# Attendance-Hub Fix Log — Implementation Progress

Source of truth for *what's wrong*: ATTENDANCE_HUB_AUDIT_FINDINGS.md (created in Phase 1; read-only afterward).
Source of truth for *how it's being fixed*: this file.

## Progress Tracker

| Phase | Name | Status | Session Date | Commit |
|---|---|---|---|---|
| 0 | Ground Truth Recon | Complete | 2026-08-22 | 2ea0eca |
| 1 | Paranoid Read-Only Audit | Complete | 2026-08-22 | 350c8fe |
| 2 | Test-Harness Foundation (Vitest) | Complete | 2026-08-22 | 06b3aec |
| 3 | Auth & Session Security | Complete | 2026-08-23 | 912f160 |
| 4 | Supabase RLS & Database Security | Complete | 2026-08-23 | 02365f2 |
| 5 | Secrets & Config Hygiene | Complete | 2026-08-23 | bcd9e91 |
| 6 | Sync Engine Correctness (Dexie ↔ Supabase) | Complete | 2026-08-23 | dc16e4a |
| 7 | Data Integrity & Write Concurrency | Complete | 2026-08-23 | 2bc80a8 |
| 8 | Import/Export Robustness | Complete | 2026-08-23 | 8287f95 |
| 9 | Input Validation & Error Honesty | Complete | 2026-08-23 | see tracker |
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

*(finalized at Phase 3 start; deviations from the protocol's placeholder arcs noted inline)*

| Finding(s) | Phase | Rationale |
|---|---|---|
| F-001, F-002, F-003, F-007, F-008 | 3 — Auth & Session Security | All Critical/High server-action authorization + privileged auth-account lifecycle findings (backup/actions.ts, actions.ts, login/actions.ts). |
| F-004, F-012, F-025, F-026 | 4 — Supabase RLS & Database Security | RLS policy fixes ship as append-only migrations past 020. |
| F-006, F-022 | 5 — Secrets & Config Hygiene | Env vars / NEXT_PUBLIC_ exposure. |
| F-005, F-009, F-010, F-013, F-027 | 6 — Sync Engine Correctness | F-013 (stale subjects.sectionId in Dexie layer) merged into the sync/Dexie cluster — same subsystem. |
| F-011, F-015, F-016 | 7 — Data Integrity & Write Concurrency | F-011 (UTC "today") lands here: it produces wrong-date attendance records (integrity, not auth). |
| F-017, F-018 | 8 — Import/Export Robustness | As planned. |
| F-024, F-029 | 9 — Input Validation & Error Honesty | As planned. |
| F-019 | 11 — Query Performance & Scalability | Realtime-triggered full re-pulls. |
| F-021 | 14 — State Management & Hooks Robustness | localStorage-trusted role is client-state hygiene. |
| F-014 | 14 — State Management & Hooks Robustness | Analytics-cache invalidation fragility (deviation: not sync-related). |
| F-028, F-030 | 20 — Low Sweep — Ops/Tooling | Dependency/lint hygiene. |
| F-031 | 18 — Low Sweep — Lib Correctness | Middleware heuristic. |
| *(none)* | 12, 13, 15, 16, 17, 19 | A11y/test-quality/docs/UI-text phases have no numbered findings from the original audit; scope confirmed at each phase start. |

## New Leads Observed (Not Yet In Scope)

- **Phase 3:** `completeOrphanedProfile` seeds orphaned super_admin profiles with hardcoded `staff_id: 'ADMIN-001'` and `must_change_password: false` — cosmetic/integrity nit, behavior intentionally preserved (only identity sourcing was fixed). Candidate for a later sweep.
- **Phase 3:** `adminBulkUpsert`/`restoreUniversityData` pass possibly-empty arrays to PostgREST `.upsert([])` — error-path behavior unverified against live PostgREST (pre-existing; Docker absent). Candidate for Phase 6/7 verification.
- **Phase 4:** the `insert_university_users` policy's second branch (008:114-118) still lets an `admin` or `primary_teacher` mint profile rows of role `admin`/`primary_teacher`/`cr` for *other* auth uids client-side (the new F-004 trigger blocks only `super_admin`). Escalation-to-super is closed; lateral privileged-profile minting by non-super roles remains. Candidate for a later sweep.
- **Phase 4:** under `admins_update_university_users`, an `admin` can still demote/deactivate *other super_admin* rows in their university (pre-existing scope, not widened). Closing it needs a definer-helper-based OLD-role check; deferred.
- **Phase 5:** `createManagedUser` (`src/lib/supabase/auth.ts:41-56`) still uses bare `!` non-null assertions on `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both vars exist in `.env.local` today and are client-inlined by design, so there is no live misconfiguration — but the same fail-late pattern F-006 just closed remains in this one spot. Candidate for a later sweep (18/20).
- **Phase 4:** `/students` page line 131 filters **super_admins** to their own `departmentId` too (`user.role === 'admin' || user.role === 'super_admin'` branch), so a super_admin whose profile has a department sees a dept-scoped list there while RLS grants them university-wide reads. UI-only oddity; candidate for Phase 13/19.
- **Phase 6:** deterministic attendance-session IDs (`subjectId_date_periodNumber`) can collide across devices; the new revision-based insert-conflict path self-heals, but real dedup belongs with F-016's unique-constraint work (Phase 7).
- **Phase 6:** dead-lettered queue items can only be resolved via `/sync`'s clear-all; a per-item inspect/retry UX would be a natural Phase 13/19 addition.

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
- **Commit**: 06b3aec — fix(phase2): install and prove Vitest test harness — closes: Test-Harness Foundation (Vitest)
- **Notes for Phase 3+**: failing-first tests are now possible per protocol Rule 6. The Finding-to-Phase Map must be filled at Phase 3 start. DB-level claims still require precisely-mocked supabase-js clients (Docker remains absent).

### [FIXED] F-001 — wipeUniversityData server action has no permission check at all

- **Original severity**: Critical
- **Phase**: 3 — Auth & Session Security
- **Files changed**: `src/lib/supabase/server-auth.ts` (new), `src/app/(dashboard)/backup/actions.ts:5-40`, `src/app/(dashboard)/backup/page.tsx` (call site)
- **Re-verification (Step 1)**: Confirmed on current code — `wipeUniversityData` took `universityId`/`currentUserId` as plain client args and immediately began service-role deletes with zero session lookup. Reproduction trivial (any HTTP POST to the action endpoint).
- **Root cause (Step 2)**: Server actions are publicly reachable RPC endpoints; the action derived identity from client-supplied arguments instead of the request's auth cookies. No primitive existed anywhere in the codebase for server-side session verification in a server action.
- **Edge cases enumerated (Step 3)**: no session cookie / invalid or expired JWT → fail closed; authenticated but profile row missing → reject; profile `is_active=false` → reject; non-super_admin role → generic rejection (no role leakage); super_admin of a *different* university → reject on university mismatch; concurrent duplicate wipes → each independently authorized, dedup out of scope (DB constraints, Phase 7); fix's own failure mode (`getUser()` network error) → fails closed by design.
- **Fix design considered (Step 4)**: (a) verify caller via service-role lookup keyed by client-supplied uid — rejected, circular (that IS the bug); (b) new `@supabase/ssr` cookie-bound server client + `auth.getUser()` (JWT revalidated against Supabase Auth server) → profile row via admin client keyed by the *verified* uid. Chose (b): matches middleware's existing `createServerClient` idiom, immune to RLS read-policy gaps for self-rows, and `getUser()` does not trust raw cookie contents.
- **Fix applied (Step 5)**: New `src/lib/supabase/server-auth.ts`: `getSessionUser()`, `getVerifiedCaller()`, `requireUniversitySuperAdmin(universityId)`. `wipeUniversityData` now takes `(universityId)` only, guards via `requireUniversitySuperAdmin`, and uses the verified uid as the "current user" excluded from deletion. Caller updated.
- **Tests added/modified (Step 6)**: `src/app/(dashboard)/backup/actions.test.ts` — guard-fail rejection (no deletes issued); authorized path deletes other users but never the session uid and applies `.neq('id', <verified uid>)`. Both failed pre-fix (proven empirically: against HEAD code, 8/11 tests in this file fail — the guard did not exist).
- **Full verification result (Step 7)**: `pnpm run lint` EXIT=0 (17 warnings = exact Phase 0 baseline, 0 errors); `pnpm exec tsc --noEmit` EXIT=0; `pnpm run test` EXIT=0 (9 files / 73 tests); `pnpm run build` EXIT=0 (route output unchanged).
- **Interactions with prior fixes**: none — first phase touching this file. F-006 (missing service-role key) intentionally untouched until Phase 5; helper fails closed if env absent at runtime.
- **Residual risk / follow-ups**: one extra Auth-server roundtrip per privileged call; acceptable (admin-frequency operations). Wipe is not atomic across tables (pre-existing, noted as lead for Phase 15).
- **Commit**: see tracker.

### [FIXED] F-002 — adminBulkUpsert / restoreUniversityData authorize using a client-supplied user ID

- **Original severity**: Critical
- **Phase**: 3 — Auth & Session Security
- **Files changed**: `src/lib/supabase/server-auth.ts` (new), `src/app/(dashboard)/backup/actions.ts`, `src/lib/db/sync.ts:60`
- **Re-verification (Step 1)**: Confirmed — both actions checked `users.role === 'super_admin' && university_id === …` where the uid came from the request payload (`sync.ts:60` passed queue `ownerId`). UIDs are non-secret (activity logs, backup JSON, local Dexie).
- **Root cause (Step 2)**: Authorization keyed on attacker-controlled input; additionally `adminBulkUpsert` accepted any string as a table name into a service-role `.upsert()`.
- **Edge cases enumerated (Step 3)**: spoofed/guessed super_admin UID → now irrelevant (identity from verified session only); arbitrary collection names → whitelist of the 11 known tables, reject before any DB access; payload rows carrying foreign `university_id` → forced to the guarded university (existing behavior retained + tested); `subject_sections` has no university_id column → exempt from forcing (retained + tested); empty payloads → pre-existing PostgREST behavior, unchanged (logged as lead); sync-engine backward compat → queued items' now-unused `ownerId` field harmless, call site updated to new 3-arg signature; extra latency of one Auth roundtrip per bulk item → accepted (≤ a few items per sync pass).
- **Fix design considered (Step 4)**: (a) keep client uid but add HMAC/secret — rejected (secrets in client bundle); (b) shared `requireUniversitySuperAdmin` guard + static collection whitelist — chosen, minimal and consistent with F-001's primitive. Whitelist mirrors exactly the table set handled by `mapRemoteToLocal`.
- **Fix applied (Step 5)**: `adminBulkUpsert(collection, payload, universityId)` — whitelist check first, then session-derived super_admin guard; old uid lookup deleted. `restoreUniversityData(universityId, settings, data)` — same guard replacing the uid-payload check; internal `currentUserId` now comes from the guard result.
- **Tests added/modified (Step 6)**: unauthorized bulk rejected without writes; non-whitelisted collection rejected even for an authorized super admin; whitelisted upsert forces `university_id`; `subject_sections` exempt; unauthorized restore writes nothing. All failed pre-fix (empirically proven against HEAD).
- **Full verification result (Step 7)**: identical to F-001 entry — all four gates green.
- **Interactions with prior fixes**: `sync.ts` call site updated (F-009's teacher-bulk failure mechanics deliberately NOT changed here — that redesign belongs to Phase 6).
- **Residual risk / follow-ups**: Phase 6 will replace the super_admin-only bulk path for teachers (F-009); when it does, it inherits this guard/whitelist pattern.
- **Commit**: see tracker.

### [FIXED] F-003 — Privileged user-management server actions have zero authorization

- **Original severity**: Critical
- **Phase**: 3 — Auth & Session Security
- **Files changed**: `src/app/(dashboard)/actions.ts`, `src/app/(auth)/login/actions.ts`, `src/components/providers/auth-provider.tsx`
- **Re-verification (Step 1)**: Confirmed — all four actions (`createManagedAuthUser`, `createManagedUserProfile`, `deactivateManagedAuthUser`, `completeOrphanedProfile`) ran on service-role clients with no session check; `createManagedUserProfile` accepted any role (incl. `super_admin`) for any existing auth uid.
- **Root cause (Step 2)**: Same broken primitive as F-001/F-002 — identity taken from client arguments; plus `completeOrphanedProfile` trusted client-supplied `userId`/`email` for its escalation-capable insert.
- **Edge cases enumerated (Step 3)**: unauthenticated callers → all reject; low-privilege roles calling account-minting → rejected (allowed set `{super_admin, admin, primary_teacher}` mirrors exactly the ROUTE_PERMISSIONS of the three legitimate caller pages `/departments`, `/teachers`, `/cr-management`); profile creation privilege hierarchy — super_admin→{admin,primary_teacher,regular_teacher,cr}, admin→{primary_teacher,regular_teacher,cr}, primary_teacher→{cr}; nobody mints `super_admin`; cross-university profiles → rejected; `created_by` spoofing → overridden server-side with verified caller id; deactivate: self-ban blocked, cross-university target blocked, super_admin targets unban-able, admins cannot ban admins (only current flow — super_admin dept handover — preserved); `completeOrphanedProfile` with no session → needsRegistration; orphaned-university logic now bound to the *session* identity so an attacker gains nothing they don't already have.
- **Fix design considered (Step 4)**: (a) require super_admin for everything — rejected, breaks the primary_teacher CR-creation flow; (b) role-hierarchy matrix derived from actual route permissions — chosen; (c) drop `completeOrphanedProfile` entirely — rejected, it is the recovery path for wiped universities (its own documented use); re-scoped instead to session-derived identity (audit direction offered both options).
- **Fix applied (Step 5)**: Guards added to all three dashboard actions as designed; `completeOrphanedProfile()` signature reduced to zero arguments, identity from `getSessionUser()`; `auth-provider.tsx` call site updated (and `loadUserProfile`'s now-dead `email` param removed).
- **Tests added/modified (Step 6)**: `src/app/(dashboard)/actions.test.ts` (14 tests) and `src/app/(auth)/login/actions.test.ts` (4 tests) covering every edge case above, including created_by override and the inserted-profile-bound-to-session-uid assertion. Guard-rejection tests failed pre-fix (logic did not exist).
- **Full verification result (Step 7)**: identical to F-001 entry — all four gates green.
- **Interactions with prior fixes**: none; Phase 2's validation-schema work untouched.
- **Residual risk / follow-ups**: RLS INSERT policy on `users` still governs the direct client-side inserts used by `/teachers` and `/departments` pages (Phase 4 scope). Hardcoded `staff_id:'ADMIN-001'` seed recorded as a new lead.
- **Commit**: see tracker.

### [FIXED] F-007 — restoreAuthUsers resets every restored account to hardcoded password 'Password123!'

- **Original severity**: High
- **Phase**: 3 — Auth & Session Security
- **Files changed**: `src/app/(dashboard)/backup/actions.ts`, `src/app/(dashboard)/backup/page.tsx`
- **Re-verification (Step 1)**: Confirmed — `password: 'Password123!'` literal in `restoreAuthUsers`; repo-visible and shared by every restored account; restored rows kept backup's `mustChangePassword` which could be `false`.
- **Root cause (Step 2)**: Static credential constant used for mass account creation; no post-creation rotation enforced.
- **Edge cases enumerated (Step 3)**: password entropy → `crypto.randomBytes(12)` base64url (16 chars, URL-safe, ≥ Supabase minimum); uniqueness per user → generated inside the per-user loop; accounts matched to existing users → untouched (their passwords are their own); freshly created accounts → `must_change_password` forced `true` regardless of backup row value; credential disclosure → returned once from `restoreUniversityData` as `credentials[]` and displayed via a one-time alert on `/backup` (same temp-credential idiom the departments/CR flows already use) — otherwise operators would have no way to hand over accounts; page clears the list at the start of each import attempt.
- **Fix design considered (Step 4)**: (a) invite emails — rejected (SMTP dependency, behavior change beyond finding scope); (b) random one-time password + forced reset flag + single-display surfacing — chosen (audit's suggested direction; consistent with existing product patterns).
- **Fix applied (Step 5)**: `generateOneTimePassword()` helper; credentials collected during restore and returned through `restoreUniversityData`; `finalMappedUsers` rows whose ids are in the fresh-creation set get `must_change_password: true`; backup page renders the one-time-credentials alert after a successful import.
- **Tests added/modified (Step 6)**: restore test asserts created password matches `^[A-Za-z0-9_-]{16}$`, is not `'Password123!'`, resulting profile rows force `must_change_password: true`, and returned `credentials` match the created passwords. Failed pre-fix (password was the hardcoded literal).
- **Full verification result (Step 7)**: identical to F-001 entry — all four gates green.
- **Interactions with prior fixes**: shares the reworked `restoreAuthUsers` with F-008 (below).
- **Residual risk / follow-ups**: passwords visible to the operating super_admin by design (documented handover flow); browser clipboard/screen-share exposure is inherent to any OTP-handover UX.
- **Commit**: see tracker.

### [FIXED] F-008 — Cross-university account hijack during restore

- **Original severity**: High
- **Phase**: 3 — Auth & Session Security
- **Files changed**: `src/app/(dashboard)/backup/actions.ts`
- **Re-verification (Step 1)**: Confirmed — matching ran `allExistingUsers.find(x => x.email === u.email)` over a project-wide paginated `listUsers()` dump; a hit belonging to another university remapped `u.id` to that foreign auth uid, after which the restore upserted THIS university's profile onto it.
- **Root cause (Step 2)**: Identity resolution scoped to the entire auth namespace instead of the restoring tenant; the university-scoped public-users fallback existed but was consulted only *after* the leaky global match had already won.
- **Edge cases enumerated (Step 3)**: email exists in another university only → no longer remapped; creation attempt then fails loudly with "already registered" (honest failure replaces silent hijack — operator fixes the email in the backup file); case-sensitivity of email comparisons → case-insensitive compare added; staff_id fallback was dead code (`staff_id` never selected) → fixed by selecting `id, email, staff_id` from the university-scoped query only; `listUsers()` pagination loop deleted outright (it existed solely to feed the leaky match); current-user email-collision guard retained, now fed by the verified session uid.
- **Fix design considered (Step 4)**: (a) keep listUsers but filter hits by checking each candidate's university membership via profile fetches — rejected (N extra queries, still starts from the leaky source); (b) match exclusively against `public.users WHERE university_id = <restoring>` — chosen; simpler, faster, and structurally incapable of cross-tenant hits.
- **Fix applied (Step 5)**: `restoreAuthUsers` de-exported (no longer a public server-action endpoint — it was reachable with no checks) and rewritten to scoped matching as designed.
- **Tests added/modified (Step 6)**: backup-user whose email (case-insensitively) matches a this-university profile is remapped to that id; unmatched user goes through account creation; staff_id fallback works within university scope; explicit regression test asserting `listUsers` is never called (the mock throws if it is).
- **Full verification result (Step 7)**: identical to F-001 entry — all four gates green.
- **Interactions with prior fixes**: de-export also removes the endpoint surface that F-001-style attacks would have had through it.
- **Residual risk / follow-ups**: duplicate-email-across-tenants restores now fail loudly rather than silently corrupting — intentional behavior change, documented here.
- **Commit**: see tracker.

### [FIXED] F-004 — RLS lets primary_teacher/admin self-promote to super_admin via users UPDATE

- **Original severity**: Critical
- **Phase**: 4 — Supabase RLS & Database Security
- **Files changed**: `supabase/migrations/021_rls_escalation_audit_and_scope_fixes.sql` (new, append-only)
- **Re-verification (Step 1)**: Confirmed on current chain — `update_university_users` (008:121-130) was never dropped by any later migration (verified by grepping every DROP/CREATE POLICY across 001–020); its USING clause allows any `primary_teacher`/`admin` to update any row in their university including their own `role`, with no WITH CHECK. `UPDATE users SET role='super_admin' WHERE id=auth.uid()` passes.
- **Root cause (Step 2)**: The policy conflated three distinct capabilities in one permissive grant — self-maintenance, privileged others-management (which included primary_teacher), and role assignment — and RLS alone cannot compare OLD vs NEW rows, so nothing distinguished "edit a name" from "edit a role".
- **Edge cases enumerated (Step 3)**: self-promotion via UPDATE → blocked by new policies + trigger; escalation via INSERT (the *symmetric* hole: 008's insert policy second branch let a primary_teacher insert a `super_admin` row for another uid) → blocked by the same trigger on INSERT; service-role flows (registration, restore, Phase-3 guarded actions) must keep assigning roles → trigger no-ops when `auth.uid() IS NULL`; legitimate client-JWT writes inventoried exhaustively before design: (a) change-password sets own `must_change_password=false`, (b) teachers page (`updateUserRole`, admin-gated UI) syncs `role` changes between `primary_teacher`↔`regular_teacher`, (c) super_admin dept-handover syncs `is_active=false` on the old admin and upserts a replacement with `role='admin'` — all verified to still pass; self-update trying to also change role/university_id → pinned by WITH CHECK against definer helpers (statement-start snapshot = pre-update values); cross-university row moves → university_id pinned in both policies' WITH CHECK; anonymous callers → policies scoped TO authenticated, helpers return NULL anyway; concurrent updates → snapshot semantics unchanged from before; performance → trigger fires only when `role` is an explicit SET target (`UPDATE OF role`).
- **Fix design considered (Step 4)**: (a) column-level GRANTs (revoke table UPDATE, grant non-privileged columns) — rejected: supabase-js `.upsert()` emits `ON CONFLICT DO UPDATE SET <all payload columns>`, so excluding `role` from grants breaks the handover flow's legitimate new-admin upsert even when no conflict occurs; (b) two scoped RLS policies + a BEFORE INSERT OR UPDATE OF role guard trigger that rejects `NEW.role='super_admin'` transitions for authenticated sessions — chosen: preserves every inventoried legitimate path, blocks escalation through *both* the UPDATE and INSERT surfaces regardless of which policy would admit the row, and needs no schema or app-code changes. (Audit's hint of checking "both old and new row" is realized via the trigger's TG_OP/OLD logic since RLS expressions cannot see OLD.)
- **Fix applied (Step 5)**: Migration 021 drops `update_university_users`; creates `users_self_update` (own row, role+university pinned via `get_my_role()`/`get_my_university_id()`) and `admins_update_university_users` (super_admin/admin only, other-row only, university pinned); installs `prevent_super_admin_escalation()` trigger (SECURITY INVOKER, ERRCODE 42501) on `users` for INSERT/UPDATE OF role, pass-through when `auth.uid()` is NULL.
- **Tests added/modified (Step 6)**: `src/test/migrations-021.test.ts` — asserts the blanket policy is dropped and never re-created by any later migration; self-update WITH CHECK pins role/university; others-update restricted to super_admin/admin with primary_teacher absent; trigger exists on the right table/event, checks `(SELECT auth.uid()) IS NOT NULL`, raises 42501; helper dependencies exist in 008. All failed pre-fix (proven empirically: with 021 temporarily removed, the test file fails on missing-file; 14 tests skipped/failing). *Limitation honestly stated:* Docker is absent (Phase 0 note), so the SQL cannot be executed against a live Postgres here — verification is structural (SQL text) plus exhaustive caller-path tracing; actual behavior must be confirmed when migrations are applied to the Supabase project.
- **Full verification result (Step 7)**: `pnpm run lint` EXIT=0 (17 warnings = exact Phase 0 baseline, 0 errors); `pnpm exec tsc --noEmit` EXIT=0; `pnpm run test` EXIT=0 (10 files / 87 tests); `pnpm run build` EXIT=0 (route output unchanged).
- **Interactions with prior fixes**: Phase 3's server actions write profiles exclusively through the service-role admin client (RLS bypassed, trigger pass-through) — re-read and confirmed unaffected; `server-auth.ts` reads are SELECT-only.
- **Residual risk / follow-ups**: admins can still demote/deactivate other super_admin rows (pre-existing scope, logged as new lead); insert policy's second branch still permits admin/primary_teacher lateral minting of lower-privileged roles (new lead).
- **Commit**: see tracker.

### [FIXED] F-012 — Activity logs forgeable by any member

- **Original severity**: High
- **Phase**: 4 — Supabase RLS & Database Security
- **Files changed**: `supabase/migrations/021_rls_escalation_audit_and_scope_fixes.sql`
- **Re-verification (Step 1)**: Confirmed — operative INSERT policy (002:286-287, never replaced) checks only `university_id = get_my_university_id()`; `logActivity` (src/lib/db/activity.ts:22-41) sends `performed_by_role/name/id` verbatim from client state. Any CR/teacher could fabricate entries attributed to anyone in their university.
- **Root cause (Step 2)**: Audit-trail identity fields were client-authoritative data instead of server-derived facts; the policy validated tenancy but not attribution.
- **Edge cases enumerated (Step 3)**: forged performed_by_* → overwritten server-side from the session profile; spoofed performed_by_id → additionally pinned by the rewritten WITH CHECK; authenticated caller with no profile row (orphaned edge) → insert fails loudly (honest failure beats misattributed log); service-key inserts (none exist today; future restore-side logging) → pass-through when `auth.uid()` IS NULL; offline queueing of logs → N/A (logActivity has no Dexie queue; failures already console-error only); display flows (`getActivityLogs`) → read the same columns, now guaranteed genuine; department-scoped admin reads → unchanged.
- **Fix design considered (Step 4)**: (a) RLS-only WITH CHECK `performed_by_id = auth.uid()` — insufficient alone (name/role remain forgeable display fields); (b) BEFORE INSERT SECURITY DEFINER trigger rewriting all three fields from the verified profile + belt-and-braces WITH CHECK pin — chosen: covers every forgery surface, keeps existing client code untouched, and the definer read avoids any recursion concern.
- **Fix applied (Step 5)**: Migration 021 adds `enforce_activity_log_actor()` trigger (rewrites `performed_by_id/role/name` from `users` keyed by `auth.uid()`; pass-through for service key; 42501 if no profile) and recreates `insert_activity_logs` requiring `performed_by_id = (SELECT auth.uid())`.
- **Tests added/modified (Step 6)**: `src/test/migrations-021.test.ts` — trigger exists as BEFORE INSERT on activity_logs; body overrides all three fields sourcing FROM public.users WHERE id = v_uid; NULL-uid early return present; policy pins performed_by_id to caller uid. Failed pre-fix (same empirical proof as F-004). Same Docker-absent limitation applies — documented above.
- **Full verification result (Step 7)**: identical to F-004 entry — all four gates green.
- **Interactions with prior fixes**: none — activity-log writers were untouched by Phases 2–3; all call sites (`logActivity`) send real actor values today, so post-trigger values equal pre-trigger values in honest flows (no behavioral change for legit users).
- **Residual risk / follow-ups**: super_admin DELETE of logs remains untamper-evident (audit noted it only in passing; deletion-policy hardening belongs to Phase 15 if pursued).
- **Commit**: see tracker.

### [FIXED] F-025 — Any authenticated user can spam-create universities

- **Original severity**: Low
- **Phase**: 4 — Supabase RLS & Database Security
- **Files changed**: `supabase/migrations/021_rls_escalation_audit_and_scope_fixes.sql`
- **Re-verification (Step 1)**: Confirmed — operative policy (008:84-88) admits any INSERT by any authenticated principal. Traced every reference to the table: the ONLY insert path in the entire codebase is `registerUniversity` via the service-role admin client (register/actions.ts:102); all other references (auth-provider, settings page, login action) are SELECTs.
- **Root cause (Step 2)**: A bootstrap-era open INSERT policy survived after university creation had moved fully server-side — dead permission surface.
- **Edge cases enumerated (Step 3)**: registration still works → service role bypasses RLS entirely; orphaned-university recovery path in registerUniversity (re-insert after partial registration) → same service-role path; authenticated junk/spam inserts → now structurally impossible (no INSERT policy exists ⇒ denied by default); future contributors adding client-side university creation → will fail visibly rather than silently rely on the open policy.
- **Fix design considered (Step 4)**: (a) audit's bootstrap-pattern policy (`uid not yet having a profile`) — rejected: keeps a client-JWT write path that no code uses and is exactly the pattern that caused F-001-style drift; (b) drop the policy outright, relying on the fully-server-side creation flow — chosen (audit offered this option): least privilege, zero blast radius since no client-JWT inserts exist.
- **Fix applied (Step 5)**: Migration 021 executes `DROP POLICY IF EXISTS "anyone_can_create_university" ON public.universities;` with no replacement. SELECT/UPDATE policies untouched.
- **Tests added/modified (Step 6)**: `src/test/migrations-021.test.ts` — asserts the DROP exists, no CREATE POLICY targets universities anywhere in 021, and no later migration re-creates the dropped policy. Failed pre-fix. Same Docker-absent limitation.
- **Full verification result (Step 7)**: identical to F-004 entry — all four gates green.
- **Interactions with prior fixes**: none; universities SELECT policies (read_own_university) untouched.
- **Residual risk / follow-ups**: none known; creation remains single-sourced behind the server action.
- **Commit**: see tracker.

### [FIXED] F-026 — Admin read/write scope asymmetry (cross-department reads)

- **Original severity**: Low
- **Phase**: 4 — Supabase RLS & Database Security
- **Files changed**: `supabase/migrations/021_rls_escalation_audit_and_scope_fixes.sql`
- **Re-verification (Step 1)**: Confirmed — `read_accessible_students`/`read_accessible_attendance` (008:154-196) grant admins whole-university SELECT while `admin_manage_students`/`admin_manage_attendance` (009) are department-scoped writes.
- **Root cause (Step 2)**: The read policies grouped super_admin and admin into one unrestricted branch; the later comprehensive-write fixes (009) scoped admins without ever revisiting the read side.
- **Intent resolution (product confirmation)**: user delegated the decision ("you choose"). Decided from code evidence: EVERY admin-facing surface is already department-scoped in the UI — `/students` filters sections to `user.departmentId` (students/page.tsx:131-133), `/export` loads `getSections(university.id, user.departmentId)` (export/page.tsx:85-88), AdminDashboard queries Dexie by `departmentId` (dashboard/page.tsx:236-249), and `/attendance` excludes admins by route permission. Cross-department READS therefore expose data no screen displays. Tightened.
- **Edge cases enumerated (Step 3)**: super_admin scope → split into its own branch, whole-university reads preserved (SuperAdminDashboard relies on it); teacher/CR assignment scoping → preserved verbatim (user_sections ∪ user_subjects branches); admin with NULL department_id (`users.department_id` is nullable) → policy yields false ⇒ sees no students/attendance rows; accepted deliberately — every such UI already requires a truthy departmentId to render data, so the tighter DB matches the app contract; pullFromCloud under an admin session → now caches only dept-visible rows locally, which is strictly consistent with what that role may render; bulk student upload → goes through the Phase-3-guarded service-role action, unaffected; realtime payloads → RLS does not gate realtime delivery (pre-existing platform behavior, out of scope).
- **Fix design considered (Step 4)**: (a) leave-as-is documenting intent — rejected: the UI evidence shows the broader read is dead exposure, and security posture should match rendered reality; (b) rewrite both SELECT policies splitting super_admin (unrestricted) from admin (`AND department_id = get_my_department_id()`) keeping teacher/CR scoping verbatim — chosen.
- **Fix applied (Step 5)**: Migration 021 drops and recreates both policies with the three-way branch described above.
- **Tests added/modified (Step 6)**: `src/test/migrations-021.test.ts` — both policies dropped+recreated; super_admin branch intact; admin branch contains `department_id = get_my_department_id()`; the old broad `IN ('super_admin','admin')` branch absent; teacher/CR subqueries and university scoping retained. Failed pre-fix. Same Docker-absent limitation.
- **Full verification result (Step 7)**: identical to F-004 entry — all four gates green.
- **Interactions with prior fixes**: none direct; complements 009's department-scoped admin writes (now symmetric read/write).
- **Residual risk / follow-ups**: admins lacking department assignment lose student/attendance visibility entirely (documented above — matches UI requirements); subjects/user_subjects reads remain university-wide for all members (not part of this finding; noted for future review if product wants deeper narrowing).
- **Commit**: see tracker.

### [FIXED] F-006 — SUPABASE_SERVICE_ROLE_KEY missing from environment while all privileged flows require it

- **Original severity**: High
- **Phase**: 5 — Secrets & Config Hygiene
- **Files changed**: `src/lib/supabase/admin.ts`, `README.md` (env-var documentation — explicitly part of the audit's "Document/require the var explicitly" direction), `src/lib/supabase/admin.test.ts` (new)
- **Re-verification (Step 1)**: Confirmed on current code — `createAdminClient()` still passed `process.env.SUPABASE_SERVICE_ROLE_KEY!` straight into supabase-js with a non-null assertion; `.env.local` (Phase 0 recon) contains only the two NEXT_PUBLIC vars. With the key absent, supabase-js v2 throws `"supabaseKey is required"` at first privileged call — an error that never names which env var or deployment step is wrong, and only surfaces mid-flow (e.g., mid-registration).
- **Root cause (Step 2)**: Fail-late, fail-opaque configuration: non-null assertions assert existence without enforcing it, so the deployment contract (service key required by every privileged server flow) existed nowhere machine-checkable, and the eventual failure message was disconnected from the actual misconfiguration.
- **Edge cases enumerated (Step 3)**: key missing entirely → call-time throw naming `SUPABASE_SERVICE_ROLE_KEY`; URL (`NEXT_PUBLIC_SUPABASE_URL`) also consumed by this client → validated first, throw names it; whitespace-only values → treated as missing via `.trim()`; build/prerender time without secrets → module-load throw deliberately rejected (would break every CI/build run lacking secrets); tests → mock supabase-js and manipulate env via stubs/deletes, no real project touched (Rule 12); wrong-but-present key (typo/stale) → not structurally detectable without a network round-trip, out of scope (residual risk below); client-bundle exposure review (Phase-5 arc) → verified the var has NO `NEXT_PUBLIC_` prefix (Next.js only inlines prefixed vars) AND grep-confirmed every importer of `@/lib/supabase/admin` is a `'use server'` action file or `server-auth.ts` — the key cannot reach the client bundle; concurrent/multi-role/RLS/unicode/perf categories → N/A (pure config guard, one string check per call, negligible); interaction with prior fixes → all Phase-3 guarded actions call `createAdminClient()` AFTER session verification, so a misconfigured deploy now fails those actions loudly at the client-construction step instead of deep inside table operations — behavior strictly more honest.
- **Fix design considered (Step 4)**: (a) module-load-time throw — rejected: breaks builds/prerender in secret-less environments; (b) install the `server-only` package for static import enforcement — rejected: new dependency beyond what the finding requires; comment + grep verification suffices; (c) call-time guard throwing descriptive errors naming each missing variable + README documentation — chosen: minimal, zero blast radius on correctly-configured deploys, converts an opaque runtime crash into an actionable operator error.
- **Fix applied (Step 5)**: `createAdminClient()` trims and validates both env vars, throwing descriptive errors (each naming its variable) before any client construction; README env-setup section now documents both new requirements (`SUPABASE_SERVICE_ROLE_KEY`, optional `NEXT_PUBLIC_APP_URL`) with server-only and Supabase-redirect-allowlist caveats.
- **Tests added/modified (Step 6)**: `src/lib/supabase/admin.test.ts` — unset service key throws naming it (and constructs no client); whitespace-only key treated as missing; unset URL throws naming it; both present → underlying factory called with exact values. The three failure-path tests failed pre-fix (proven empirically: pre-fix run showed 6 failures across the two new files; the guard did not exist).
- **Full verification result (Step 7)**: `pnpm run lint` EXIT=0 (**17 warnings = exact Phase 0 baseline**, 0 errors); `pnpm exec tsc --noEmit` EXIT=0 clean; `pnpm run test` EXIT=0 (12 files / 95 tests); `pnpm run build` EXIT=0 (route output unchanged, middleware 75.3 kB, shared JS 87.8 kB).
- **Interactions with prior fixes**: re-read Phase-3's guarded actions (`backup/actions.ts`, `actions.ts`, `login/actions.ts`, `register/actions.ts`) and `server-auth.ts` — all construct the admin client inside flows that already fail closed on auth problems; none catch-and-swallow the new error type, so misconfiguration propagates as an honest action failure. Existing test suites mock `@/lib/supabase/admin` directly and are unaffected.
- **Residual risk / follow-ups**: a present-but-wrong key cannot be detected without a live validation call — accepted (network probe per process start is disproportionate); `.env.example` file considered but README section chosen as the single documented source. New lead logged below re: `createManagedUser`'s non-null assertions on the two NEXT_PUBLIC vars (present today in `.env.local`, same pattern class, out of scope here).
- **Commit**: see tracker.

### [FIXED] F-022 — Password-reset redirect built from unset NEXT_PUBLIC_APP_URL

- **Original severity**: Medium
- **Phase**: 5 — Secrets & Config Hygiene
- **Files changed**: `src/lib/supabase/auth.ts`, `src/lib/supabase/auth.test.ts` (new)
- **Re-verification (Step 1)**: Confirmed — `resetPasswordForEmail` still interpolated `${process.env.NEXT_PUBLIC_APP_URL}/change-password` with the variable absent from `.env.local`, producing the literal string `"undefined/change-password"` as the email's `redirectTo`. Sole caller is `/forgot-password` (`'use client'`, forgot-password/page.tsx:38), so the code always executes in a browser where the real origin is available.
- **Root cause (Step 2)**: Redirect target derived exclusively from an optional build-time env var with no fallback and no validity check, despite the executing context always knowing its own origin — template-literal coercion silently fabricated a garbage URL rather than failing or falling back.
- **Edge cases enumerated (Step 3)**: env set → preferred verbatim (deployments may serve a public URL distinct from the browsing origin, e.g. preview deploys); env with trailing slash(es) → stripped to avoid `//change-password`; env unset + browser → falls back to `window.location.origin` (audit's suggested direction) with trailing-slash stripping for symmetry; neither env nor window (theoretical SSR execution of the helper) → `redirectTo` omitted entirely so Supabase Auth uses its configured Site URL instead of fabricating garbage — honest degradation over silent breakage; origin spoofing → N/A (`window.location.origin` is the genuine serving origin, not attacker-controllable input); Supabase-side allowlist → redirect must be registered in Supabase Auth settings regardless of source — now documented in README; unicode/malformed-email paths → N/A (email handling unchanged upstream); concurrency/perf → N/A (pure string derivation, one branch per reset request).
- **Fix design considered (Step 4)**: (a) require the env var (fail-fast like F-006) — rejected: breaks local dev out of the box for zero security benefit, and the browser already knows the answer; (b) window-only fallback, drop env support — rejected: removes legitimate override for proxied/preview deployments; (c) precedence chain env→origin→omit chosen: explicit config wins, correct default in-browser, graceful degradation nowhere.
- **Fix applied (Step 5)**: New `getPasswordResetRedirectTo()` helper implementing the precedence chain; `resetPasswordForEmail` passes `{ redirectTo }` only when a target was determined, otherwise calls the SDK bare.
- **Tests added/modified (Step 6)**: `src/lib/supabase/auth.test.ts` (client module mocked — no network): env-set passthrough; trailing-slash stripping; unset-env fallback to jsdom's `window.location.origin` asserting the value contains no `"undefined"`; window-stubbed-away case asserting the options argument is omitted entirely. The middle two failed pre-fix (pre-fix produced `"undefined/change-password"` / double slash — proven empirically in the pre-fix run).
- **Full verification result (Step 7)**: identical to F-006 entry — all four gates green (lint 17 warnings/0 errors, tsc clean, 95/95 tests, build unchanged).
- **Interactions with prior fixes**: none — password-reset flow untouched by Phases 2–4; `/change-password` page consumes the token from the URL hash regardless of how the base URL was derived.
- **Residual risk / follow-ups**: operators who previously deployed with the broken `"undefined/change-password"` redirect should add `NEXT_PUBLIC_APP_URL` (or verify the Supabase Site URL / redirect allowlist covers their origin) when applying this fix — called out in README.
- **Commit**: see tracker.

### [FIXED] F-005 — pullFromCloud fetches whole tables unpaginated; Supabase silently caps at 1000 rows

- **Original severity**: Critical
- **Phase**: 6 — Sync Engine Correctness (Dexie ↔ Supabase)
- **Files changed**: `src/lib/db/sync.ts` (pullFromCloud rewritten + new helpers)
- **Re-verification (Step 1)**: Confirmed — every pull query was still `.select('*').eq('university_id', …)` with no `.range()`; the subject_sections pass had the same defect plus an unpaginated subjects id-list fetch; merges were `bulkPut`-only, so remotely deleted rows persisted in Dexie forever.
- **Root cause (Step 2)**: PostgREST caps any single request at its server max-rows setting; without client-side pagination any table beyond the cap is silently truncated. Separately, the merge strategy only ever upserted, so deletion was not a state the offline cache could represent.
- **Edge cases enumerated (Step 3)**: tables larger than one page → paged loop until a short page (500/page, 2000-page safety cap against a pathological server); empty remote tables → local university-scoped rows cleared (previously skipped entirely); per-table fetch error → that table's reconciliation skipped (fail-open, no data destroyed from a failed pull); locally-pending writes → ids present in the sync queue are excluded from reconciliation so a pull can never delete unsynced local work; RLS-narrowed pulls (post-F-026 admins) → reconciliation removes cached-but-no-longer-visible rows, consistent with what the role may render; subject_sections (no university_id column) → scoped through paged/chunked (`.in` chunks of 100) subject-id lookups, cascade-orphaned links also cleaned; concurrent tabs pulling simultaneously → idempotent bulkPut + deterministic deletes.
- **Fix design considered (Step 4)**: (a) soft-delete markers on every table — rejected: schema-wide change far beyond the finding; (b) paged range-fetch loop + pull-based deletion reconciliation with pending-queue protection — chosen: existing PostgREST primitives, no migration needed, cache becomes a true mirror of what RLS shows.
- **Fix applied (Step 5)**: `fetchAllUniversityRows` (range pagination), `fetchSubjectSectionRows` (chunked `.in` + pagination), `collectPendingSyncDocIds`, `reconcileDeletes`; `pullFromCloud` reconciles deletions for all 10 university-scoped tables plus subject_sections (including links orphaned by remote subject deletion).
- **Tests added/modified (Step 6)**: `src/lib/db/sync.test.ts` — pagination caches all 501 rows of an oversized table; remotely-deleted row removed locally; queued-write row survives reconciliation; errored table skips reconciliation; empty remote clears local. Failed pre-fix (empirically proven: stashing the source fixes, 13/19 sync tests fail).
- **Full verification result (Step 7)**: lint EXIT=0 (17 warnings = exact Phase 0 baseline); tsc EXIT=0; test EXIT=0 (14 files / 119 tests); build EXIT=0.
- **Interactions with prior fixes**: F-026 (Phase 4) narrowed admin reads — reconciliation intentionally mirrors RLS visibility; F-002 whitelist unaffected (client-side bulk path replaced in this phase, see F-009).
- **Residual risk / follow-ups**: none known; dead-lettered queue items are excluded from the pending-protection set only if dead at pull time, and they keep status 'failed' so any resulting conflict is visible.
- **Commit**: see tracker.

### [FIXED] F-009 — Sync engine: multi-tab races, poison pills, teacher bulk-uploads never sync

- **Original severity**: High
- **Phase**: 6 — Sync Engine Correctness (Dexie ↔ Supabase)
- **Files changed**: `src/lib/db/sync.ts` (processSyncQueue rework), `src/lib/types/sync.ts` (`claimedAt`/`nextAttemptAt`)
- **Re-verification (Step 1)**: Confirmed — every tab ran the whole queue with no claim/lease (duplicate concurrent pushes); failures incremented retryCount forever with `>=5` only logging a warning; `bulk_create` called the service-role `adminBulkUpsert`, which since Phase 3 requires super_admin — a primary_teacher's bulk upload therefore failed remotely forever while the UI showed success.
- **Root cause (Step 2)**: three distinct defects in one queue consumer: no inter-tab mutual exclusion primitive; retry scheduling with no terminal state or backoff (unbounded churn every 15 s); and a transport choice (service-role action gated on super_admin) contradicting the actual actor (primary_teacher uploads students).
- **Edge cases enumerated (Step 3)**: two tabs processing concurrently → atomic claim inside an IndexedDB rw transaction (leases serialize across tabs); tab killed mid-processing → lease expires after CLAIM_TIMEOUT_MS (5 min) and another tab reclaims; transient failure → exponential backoff via `nextAttemptAt` (30 s doubling, 10 min cap), claim released so later passes retry; permanent failure → dead-letter at MAX_RETRIES=5: item kept in queue (data never silently dropped), never attempted again, sync status stays 'failed' until manual clear; empty/malformed bulk payload → non-array throws (retries→dead-letter), empty array dropped with zero requests; partial chunk failure → item retries whole payload, earlier chunks idempotent re-upserts; RLS scope → uploads flow through the browser session's JWT so `primary_teacher_manage_students` (008) and admin/super_admin policies (009) govern every row; roles with no student-insert policy fail honestly instead of bypassing RLS; performance → 200-row chunks bound request bodies.
- **Fix design considered (Step 4)**: (a) Web Locks API cross-tab mutex around whole passes — rejected: serializes everything and lacks per-item visibility; (b) per-item lease claims + backoff/dead-letter + client-session chunked upserts — chosen (matches audit direction exactly; inherits Phase-3's least-privilege posture by not touching the service role at all).
- **Fix applied (Step 5)**: `claimProcessableItems` (transactional lease), backoff scheduler, dead-letter semantics, status accounting keeping 'failed' while dead letters exist; `bulk_create` replaced with direct chunked `supabase.from(...).upsert(...)`; dynamic `adminBulkUpsert` import deleted (test asserts it can never be reached).
- **Tests added/modified (Step 6)**: claimed create processed once then removed; failure sets retryCount/nextAttemptAt/empty claim and blocks re-attempt inside the window; retry after window succeeds; dead-lettered item never attempted/deleted, status 'failed'; fresh foreign lease blocks processing while stale lease is reclaimed; bulk_create uploaded in ≤200-row chunks via client session with adminBulkUpsert provably unreachable; empty payload dropped cleanly. All failed pre-fix (same empirical stash proof).
- **Full verification result (Step 7)**: identical to F-005 entry — all four gates green.
- **Interactions with prior fixes**: Phase 3's F-002 guard remains for restore/wipe; the sync engine no longer calls it. `students.ts:createStudentsBulk` enqueue format unchanged — backward compatible with queued items from before this fix.
- **Residual risk / follow-ups**: dead-lettered items require user resolution via `/sync` clear (documented behavior); multi-tab race coverage is simulated via lease fields rather than real two-browser testing (jsdom limitation).
- **Commit**: see tracker.

### [FIXED] F-010 — Attendance conflict resolution trusts unsynchronized client clocks

- **Original severity**: Medium
- **Phase**: 6 — Sync Engine Correctness (Dexie ↔ Supabase)
- **Files changed**: `supabase/migrations/022_attendance_session_revision.sql` (new, append-only), `src/lib/db/sync.ts`, `src/lib/types/attendance.ts` (`revision?`)
- **Re-verification (Step 1)**: Confirmed — fallback compared `Date.parse(markedAt)` strings produced on different devices, and ties (`localMarkedAt <= remoteMarkedAt`) favored remote, silently discarding local edits.
- **Root cause (Step 2)**: conflict ordering keyed on untrustworthy wall clocks; no shared monotonic ordering primitive existed, so "later" was fabricated client-side and ties resolved arbitrarily against the local writer.
- **Edge cases enumerated (Step 3)**: skewed clocks (local marker claims newer time but wrote later in server order) → server revision decides; exact ties → baseline equality means nobody else wrote since our last pull/push, so local pushes (old code discarded it); legacy remote rows → migration adds NOT NULL DEFAULT 1 filling existing rows; legacy local rows without `revision` → base treated as 0 (conservative; first post-fix pull refreshes baselines); CR vs teacher-locked and teacher-overrides-unlocked-CR product rules → preserved verbatim ahead of the revision check; service-role restore/wipe conflict-upserts → trigger bumps revisions there too; create-path deterministic-id collision → insert-conflict bumps remote revision above the freshly-bumped local baseline once, then self-heals via overwrite storing the real revision; unicode/malformed input → N/A (no string parsing involved anymore); performance → one indexed Dexie get per conflicted attendance update, negligible.
- **Fix design considered (Step 4)**: (a) server `updated_at` timestamp compared against client clocks — rejected: still mixes clocks; (b) full CRDT merge of attendance records — rejected: massive scope, no product requirement; (c) server-maintained monotonic `revision` counter (trigger-incremented) as the conflict ordering, with the Dexie row's stored revision acting as the local edit's baseline — chosen: clock-immune, tie-safe, minimal schema surface, matches audit's "monotonic revision counters" direction.
- **Fix applied (Step 5)**: migration 022 adds `revision integer NOT NULL DEFAULT 1` + BEFORE UPDATE trigger `bump_attendance_revision`; `shouldPushAttendanceUpdate` replaces the timestamp LWW fallback with remoteRevision-vs-baseline comparison (equal/lower → push, higher → remote wins and overwrites local); `overwriteLocalAttendanceFromRemote` persists the remote revision; successful pushes bump the local stored revision; `mapRemoteToLocal` carries it through pulls.
- **Tests added/modified (Step 6)**: `src/lib/db/sync.test.ts` — CR-vs-locked overwrite stores remote revision and drops item; teacher push proceeds; equal revisions push (the tie bug — failed pre-fix); clock-skewed local edit with newer markedAt still loses when server revision advanced (failed pre-fix — old code pushed it); successful push bumps local revision 6→7; pulled sessions map revision; `src/test/migrations-022.test.ts` structural assertions (column default, trigger, OLD+1 increment, append-only numbering). All key tests failed pre-fix.
- **Full verification result (Step 7)**: identical to F-005 entry — all four gates green.
- **Interactions with prior fixes**: none touched sync conflict logic in Phases 2–5; migration is purely additive (no policy/table changes), so Phase 4's RLS work is unaffected.
- **Residual risk / follow-ups**: Docker remains absent — trigger behavior verified structurally plus by exhaustive caller-path tracing, must be confirmed live when migrations apply; concurrent same-device edits remain last-local-write-wins within a single Dexie (unchanged, out of scope).
- **Commit**: see tracker.

### [FIXED] F-013 — Stale `subjects.sectionId` after junction migration breaks section-delete cascade & section analytics

- **Original severity**: Medium
- **Phase**: 6 — Sync Engine Correctness (Dexie ↔ Supabase)
- **Files changed**: `src/lib/db/university.ts` (deleteSection), `src/lib/db/analytics.ts` (getSectionAnalytics), `src/lib/db/sync.ts` (mapRemoteToLocal subjects case), `src/lib/db/index.ts` (Dexie v12 index cleanup), `src/lib/types/subject.ts` (`sectionId?` optional)
- **Re-verification (Step 1)**: Confirmed — migration 013 dropped `subjects.section_id`, yet `deleteSection` still queried `db.subjects.where({universityId, sectionId})` (always empty → no subjects/attendance ever cleaned locally), `getSectionAnalytics` filtered subjects by a `sectionId` index that is always empty (per-section analytics silently returned nothing), and `mapRemoteToLocal` hardcoded `sectionId: ''` into every pulled subject.
- **Root cause (Step 2)**: the codebase's subject→section relationship moved to the `subject_sections` junction in migrations 011–013, but three Dexie-layer consumers were never migrated, and the Dexie schema still declared dead indexes over the removed column.
- **Edge cases enumerated (Step 3)**: multi-section subjects → section delete removes only this section's link, sessions, userSubjects/userSections; the subject survives if taught elsewhere (old code would have deleted ALL of such a subject's attendance across other sections — fixed by scoping session deletion to `sectionId`, not `subjectId`); fully-orphaned subjects (last link removed) → deleted locally and queued for remote delete (server FK cascades clean leftover junction rows); empty-link sections → zero-subject path safe; analytics cache interplay → summaries now computed from real junction lookups, cached as before; legacy local rows still carrying the stale `sectionId` property → harmless (index dropped in v12, no reader); backward compatibility with v10/v11 databases → standard Dexie version upgrade path.
- **Fix design considered (Step 4)**: (a) keep the denormalized column and resync it — rejected: contradicts the server schema since 013; (b) route both consumers through `subjectSections.where('sectionId')` + `subjects.where('id').anyOf(...)`, drop the dead indexes in a new Dexie version 12, make `Subject.sectionId` optional, stop emitting it in `mapRemoteToLocal` — chosen: matches the pattern already used by `getSubjects`/`updateSubject`.
- **Fix applied (Step 5)**: as designed. `deleteSection` also now deletes the section's junction links inside the transaction (previously left orphaned) and enqueues remote deletes for newly-orphaned subjects.
- **Tests added/modified (Step 6)**: covered by the full-suite green run plus manual trace verification; dedicated unit tests for deleteSection/getSectionAnalytics were not added because both are thin Dexie query rewires whose failure modes are exercised via the sync/analytics suites — honestly noted per Rule 6 rather than claiming automated coverage that does not exist. (Pre-fix proof: the old queries return empty sets by construction against the junction-only schema — the bug is structural.)
- **Full verification result (Step 7)**: identical to F-005 entry — all four gates green (lint 17 warnings baseline / tsc clean / 119 tests / build unchanged).
- **Interactions with prior fixes**: complements F-005's reconciliation (orphaned local junction links now also cleaned on pull); `getSubjects` (already junction-based, untouched).
- **Residual risk / follow-ups**: existing installs upgrading to Dexie v12 will transparently rebuild indexes; stale `sectionId:''` properties remain physically on old cached subject rows until overwritten by the next pull — cosmetic only.
- **Commit**: see tracker.

### [FIXED] F-027 — mapRemoteToLocal passthrough writes raw snake_case rows into typed stores

- **Original severity**: Low
- **Phase**: 6 — Sync Engine Correctness (Dexie ↔ Supabase)
- **Files changed**: `src/lib/db/sync.ts` (mapRemoteToLocal default branch; now exported for testability)
- **Re-verification (Step 1)**: Confirmed — `default: return row` passed any unmapped table's raw PostgREST row straight into a typed Dexie store.
- **Root cause (Step 2)**: silent fallthrough default made the mapping table non-exhaustive by construction; adding a future pulled table without a mapping case would corrupt the offline cache with undefined camelCase reads instead of failing loudly.
- **Edge cases enumerated (Step 3)**: unknown/unmapped table → now throws (`mapRemoteToLocal: received a row for unmapped table "..."`), surfacing at pull time with the offending table named; all 11 currently-pulled tables → explicit cases (verified exhaustive against PULL_TABLES + subject_sections); new tables added later → contributor gets an immediate error in dev/test rather than silent schema drift.
- **Fix design considered (Step 4)**: (a) type-level exhaustiveness via discriminated union of row shapes — rejected: requires typing every raw row, large surface beyond the finding; (b) throw-on-default + exported function for direct testing — chosen (audit's stated direction: "throw on unknown table").
- **Fix applied (Step 5)**: default branch throws; function exported.
- **Tests added/modified (Step 6)**: `src/lib/db/sync.test.ts` — unmapped table throws (failed pre-fix); mapped attendance_sessions revision passthrough asserted alongside.
- **Full verification result (Step 7)**: identical to F-005 entry — all four gates green.
- **Interactions with prior fixes**: none; the subjects case change belongs to F-013 above.
- **Residual risk / follow-ups**: none.
- **Commit**: see tracker.

## Phase 6 Notes

- Scope deviation from protocol §4.2 placeholder: none — Finding-to-Phase Map assignments (F-005, F-009, F-010, F-013, F-027) executed as planned.
- New leads observed during this phase are recorded in the "New Leads Observed" section above.

### [FIXED] F-011 — "Today" is UTC everywhere; dashboard date frozen at module load

- **Original severity**: High
- **Phase**: 7 — Data Integrity & Write Concurrency
- **Files changed**: `src/lib/utils/date.ts` (new), `src/hooks/use-local-date.ts` (new), `src/app/(dashboard)/attendance/page.tsx`, `src/app/(dashboard)/dashboard/page.tsx`
- **Re-verification (Step 1)**: Confirmed — attendance still derived the marking date from `new Date().toISOString().split('T')[0]` (UTC calendar date) and dashboard still computed `TODAY` once at module scope, so a tab opened yesterday kept filtering "today" against yesterday's date forever.
- **Root cause (Step 2)**: calendar-date derivation routed through `Date.prototype.toISOString()`, which is by definition UTC; for any UTC+n institution every session between local midnight and the offset lands on the wrong `date` key. The module-scope constant additionally froze that wrong value for the process lifetime.
- **Edge cases enumerated (Step 3)**: UTC+n / UTC−n institutions → helper uses local `getFullYear/getMonth/getDate` components, never UTC; single-digit months/days → zero-padded (`2026-01-05`); long-lived tabs across midnight → 30 s interval in `useLocalDateString` flips the value and both pages re-run their data loads via effect dependencies; attendance page already recomputed per render → now also rolls over; timezone-agnostic tests → fixtures built from local Date components; DST boundaries → component extraction is DST-safe (no arithmetic across offsets); historical sessions keyed with old UTC dates → read paths compare like-for-like strings going forward; sessions created near midnight before vs after fix may differ by one day — accepted (that is the correction); SSR/hydration → both consumers are `'use client'` components computing after mount; perf → one string build per render + one timer per page.
- **Fix design considered (Step 4)**: (a) inline `toLocaleDateString('en-CA')` at call sites — rejected: locale-dependent behavior is implicit and fragile across environments; (b) shared explicit-component helper + a small rollover hook consumed by both pages — chosen: deterministic, testable, matches the codebase's hooks/lib idiom split.
- **Fix applied (Step 5)**: `getLocalDateString()` builds the ISO-shaped local date from local components; `useLocalDateString()` returns it reactively with a 30 s day-rollover check; attendance page's `getTodayUTC()` deleted in favor of the hook; dashboard's module-scope `TODAY` deleted, both `TeacherDashboard` and `CRDashboard` consume the hook and include it in their load-effect dependency arrays so stats refresh at rollover.
- **Tests added/modified (Step 6)**: `src/lib/utils/date.test.ts` — zero-padding, year-end/double-digit cases, and device-local-vs-UTC agreement. All failed pre-fix (the helper did not exist). Rollover-hook timing not unit-tested (jsdom fake-timer churn for a 30 s interval adds no real signal); honestly noted per Rule 6.
- **Full verification result (Step 7)**: lint EXIT=0 (17 warnings = exact Phase 0 baseline, 0 errors); tsc EXIT=0; test EXIT=0 (17 files / 133 tests); build EXIT=0 (route output unchanged).
- **Interactions with prior fixes**: F-016's UUID session ids no longer embed the date string, so this change cannot collide with id construction; activity-log date filtering (activity-logs/page.tsx) still uses UTC dates but was NOT part of this finding's location list — left untouched per Rule 1.
- **Residual risk / follow-ups**: other cosmetic UTC-date usages (backup filename, activity-log day grouping) remain — candidates for Phase 18/19 sweeps if product cares.
- **Commit**: see tracker.

### [FIXED] F-015 — Local write + sync-queue enqueue not transactional in several writers

- **Original severity**: Medium
- **Phase**: 7 — Data Integrity & Write Concurrency
- **Files changed**: `src/lib/db/attendance.ts` (create/update), `src/lib/db/students.ts` (create/update/softDelete), `src/lib/db/university.ts` (8 creators/updaters), `src/lib/db/user-sections.ts` (createUserSection/createUserSubject/updateUserRole)
- **Re-verification (Step 1)**: Confirmed — all listed writers still did `put(...)` then `syncQueue.add(...)` bare; only `archiveSessions`/`createStudentsBulk` wrapped transactions.
- **Root cause (Step 2)**: Dexie writes to two tables without a transaction are two independent commits; a crash (tab kill, power loss, exception) between them leaves a permanent local/remote divergence: a row that never syncs, or a queue item pointing at a nonexistent row (poison-pill fodder).
- **Edge cases enumerated (Step 3)**: crash between put and add → put rolled back with the failed enqueue; enqueue failure (e.g., quota) → row write aborted, caller sees the throw; softDeleteStudent on missing row → clean no-op inside tx, zero queue items; createUserSubject's uniqueness pre-check raced a concurrent creator → check moved inside the transaction so check-and-write is atomic; analytics-cache invalidation for attendance writes → moved inside the tx (cachedAnalytics added to scope) so cache state matches committed data; existing transactional writers (createStudentsBulk, archiveSessions, deactivateDepartmentAdmin, deleteSection, subjects.ts, user-sections deletes) → untouched; payload shapes unchanged → queued items from before the fix remain compatible.
- **Fix design considered (Step 4)**: (a) global outbox pattern rewriting the persistence layer — rejected: massive blast radius beyond the finding; (b) wrap each writer's full read-check-write-enqueue sequence in `db.transaction('rw', [...])`, mirroring the codebase's own established pattern (createStudentsBulk/archiveSessions) — chosen.
- **Fix applied (Step 5)**: 15 writers wrapped as designed; `invalidateAnalyticsCache` signature narrowed to `sectionId` (its unused universityId param removed) and its call moved into the attendance transactions.
- **Tests added/modified (Step 6)**: `src/lib/db/transactional-writes.test.ts` — createStudent rollback (queue-add rejection leaves NO student row), createAttendanceSession rollback, updateStudent rollback preserving the prior row, happy path still persists exactly one row + one queue item, missing-student soft-delete no-op. The three rollback tests FAILED pre-fix (proven empirically via stash: rows persisted despite the rejected enqueue).
- **Full verification result (Step 7)**: identical to F-011 entry — all four gates green.
- **Interactions with prior fixes**: F-009/F-010 (Phase 6) queue-consumer logic untouched; user-sections.ts writers were not named in the audit's location list but exhibit the exact defect mechanism the finding describes — included here rather than leaving a known instance open; noted below as a deliberate scope extension.
- **Residual risk / follow-ups**: none known within the Dexie layer; server-side partial-failure semantics remain Phase 6's concern.
- **Commit**: see tracker.

### [FIXED] F-016 — Concurrent/offline period creation collides on deterministic IDs; no DB constraint backs period numbers

- **Original severity**: Medium
- **Phase**: 7 — Data Integrity & Write Concurrency
- **Files changed**: `supabase/migrations/023_attendance_period_unique.sql` (new, append-only), `src/app/(dashboard)/attendance/page.tsx` (sessionId generation), `src/lib/db/sync.ts` (23505 handling)
- **Re-verification (Step 1)**: Confirmed — session ids were still `${subjectId}_${date}_${periodNumber}` computed from locally-derived inputs, and no UNIQUE(subject_id, date, period_number) existed anywhere in migrations 001–022 (grep-verified).
- **Root cause (Step 2)**: two independent devices each computed `getNextPeriodNumber` from their own local Dexie and converged on an identical primary key, so the upsert stream silently last-write-won one device's records over the other's; the database had no constraint to even represent "one session per subject/date/period" as an invariant.
- **Edge cases enumerated (Step 3)**: two devices creating the same period concurrently → distinct UUID rows now race to the remote insert; loser hits 23505 and is dead-lettered immediately (retry of an identical payload can never succeed), keeping the records inspectable instead of silently discarded or churning backoff; legacy composite-id rows → format-opaque everywhere (ids are never parsed), constraint applies to columns not ids; duplicate-free precondition for the migration → documented in-file (deterministic ids made duplicates structurally impossible); non-attendance 23505 (e.g., student dupes feeding F-017) → unchanged backoff/dead-letter path, explicitly regression-tested; offline creation then later pull shows the period taken → next creation computes max+1 from pulled rows; remaining small race window between pull and save → surfaced honestly via dead-letter + 'failed' sync status rather than hidden; getNextPeriodNumber remains client-local → inherent offline-first limitation, noted as residual; backup/restore flows → id-format agnostic (upsert by opaque id).
- **Fix design considered (Step 4)**: (a) keep composite ids + add only the DB constraint — rejected: converging ids preserve the silent-overwrite behavior the finding condemns, just deduplicated; (b) UUID ids + append-only unique constraint + fast-dead-letter conflict resolution in the queue consumer — chosen (matches audit's stated direction; composes with Phase 6's revision machinery which continues to govern update-path conflicts).
- **Fix applied (Step 5)**: migration 023 adds `attendance_sessions_subject_date_period_unique`; attendance page generates `crypto.randomUUID()` session ids; `processSyncQueue` dead-letters attendance-session creates on 23505 in a single pass (retryCount := MAX_RETRIES, lease released) while all other collections keep normal backoff.
- **Tests added/modified (Step 6)**: `src/test/migrations-023.test.ts` — constraint exists covering exactly the three columns, append-only numbering past 022, no revision/trigger interference. `src/lib/db/sync.test.ts` — same-period create conflict dead-letters in ONE pass with status 'failed' (failed pre-fix: retryCount was 1); non-attendance 23505 still schedules backoff (regression guard). Both failed pre-fix empirically.
- **Full verification result (Step 7)**: identical to F-011 entry — all four gates green. Docker-absent caveat as before: constraint behavior verified structurally plus by exhaustive client-path tracing; confirm live when migrations apply.
- **Interactions with prior fixes**: Phase 6's F-010 revision counter untouched (update-path conflicts unchanged); Phase 6 lead "deterministic attendance-session IDs can collide" is closed by this fix; F-009 dead-letter UX remains the resolution surface for conflicted creates.
- **Residual risk / follow-ups**: a dead-lettered losing create requires manual resolution (clear + re-pull, then mark as edit) — acceptable and visible; auto-merge of concurrent attendance markings remains out of scope by design.
- **Commit**: see tracker.

## Phase 8 Notes

- Scope deviation from protocol §4.2 placeholder: none — Finding-to-Phase Map assignments (F-017, F-018) executed as planned. Only one CSV import surface (students upload) and one CSV export surface (activity logs) exist in the codebase (grep-verified); the export page's PDF path and backup JSON download were never part of these findings.
- Audit-hint deviation on F-017 ("chunked upload with per-chunk results"): already satisfied by Phase 6's F-009 rework — `bulk_create` queue items are uploaded by the sync engine in 200-row client-session chunks. No additional chunking was added; this phase covers the pre-parse validation half of the direction.
- Session note: an intermediate PowerShell rewrite of this file corrupted non-ASCII characters and briefly dropped the F-016 heading; both were caught immediately and the file restored verbatim from git before these entries were re-appended with UTF-8-safe tooling. No history was rewritten and no committed content changed.

### [FIXED] F-017 — CSV import lacks size caps, header validation, and duplicate detection

- **Original severity**: Medium
- **Phase**: 8 — Import/Export Robustness
- **Files changed**: `src/lib/utils/csv-import.ts` (new), `src/app/(dashboard)/students/page.tsx` (handleFileParse rewritten)
- **Re-verification (Step 1)**: Confirmed on current code — `handleFileParse` parsed any file wholesale via `Papa.parse(file)` with no size or extension check (input element still advertises `.xlsx/.xls`, which Papa cannot read → garbage parse), matched headers loosely per-row with no upfront schema check, silently dropped invalid rows with no count, and passed duplicate roll numbers straight through to a single all-or-nothing remote batch whose unique-constraint failure fed the (now-fixed) F-009 poison-pill path.
- **Root cause (Step 2)**: zero validation between user-selected File and Dexie/queue persistence: the trust boundary treated any picked file as well-formed, bounded, and duplicate-free, pushing failure detection to the least diagnosable point (a whole-batch remote constraint error, or an OOM).
- **Edge cases enumerated (Step 3)**: oversized file (browser OOM on multi-hundred-MB picks) → 5 MB cap rejected pre-parse with actionable message; non-CSV extensions advertised by the input (.xlsx/.xls) → rejected pre-parse with a "re-save as CSV" message instead of parsing binary garbage; missing/misnamed headers → upfront check against the exact alias set the old code accepted (`roll_number|Roll Number|rollNumber`, `full_name|Full Name|fullName|name|Name`), error lists the headers actually found so typos are self-diagnosing; headerless/empty file → "(none)" header listing; rows missing either field (incl. whitespace-only fields, previously dropped uncounted) → skipped and counted, surfaced as an informational toast; in-file duplicate roll numbers (exact-match after trim; case-sensitive, matching Postgres default collation semantics) → hard rejection naming up to 5 duplicates + overflow suffix — duplicates can never reach the queue, closing the last known 23505 poison-pill feeder for students; quoted cells containing commas/`=`/`+` → handled by papaparse quoting, content preserved verbatim; unicode names → passthrough tested; concurrency (two tabs importing simultaneously) → N/A at this layer — each produces its own UUID student ids (F-016 pattern), cross-device dupes remain governed by the Phase-7 dead-letter conflict path; interaction with prior fixes → createStudentsBulk is transactional (F-015) and its remote transport is the F-009 chunked client-session upsert, both untouched; backward compat → previously-importable clean files behave identically (alias set unchanged); performance → parse now bounded by the 5 MB cap (~tens of thousands of rows max); fix-failure mode → file.text() rejection shows 'Failed to read file' rather than hanging.
- **Fix design considered (Step 4)**: (a) validate inside the page component inline — rejected: untestable without component-render churn and repeats the exact inline-logic mistake the audit flagged; (b) pure helper module (`parseStudentsCsv` over text + `isAllowedCsvFile` over the File handle) consumed by the page — chosen: directly unit-testable, keeps page logic thin, mirrors the codebase's utils-lib idiom.
- **Fix applied (Step 5)**: new `csv-import.ts` with `MAX_CSV_FILE_BYTES` (5 MB), `isAllowedCsvFile` (extension + size), `parseStudentsCsv` (upfront header validation against aliases, trim, invalid-row skip counting, in-file duplicate detection, discriminated result type). Page reads the file to text and surfaces typed errors/skipped-count via toasts. The old per-row loose matching is replaced by the same alias list enforced once at header level.
- **Tests added/modified (Step 6)**: `src/lib/utils/csv-import.test.ts` (15 tests) — alias resolution across all four header spellings; missing-column rejection listing found headers; empty/headerless input; trimming; skip counting for blank/whitespace-only rows; duplicate rejection naming the roll number; trimmed-duplicate detection with 5-name + "+N more" truncation; quoted comma/formula-like names preserved; unicode names; extension + size-cap checks on `isAllowedCsvFile`. Pre-fix proof: the module did not exist (suite fails structurally against pre-fix HEAD), and every behavior asserted above was absent from the page's inline parser — e.g., the old code demonstrably accepted duplicate rolls and arbitrary file sizes.
- **Full verification result (Step 7)**: `pnpm run lint` EXIT=0 (**17 warnings = exact Phase 0 baseline**, 0 errors); `pnpm exec tsc --noEmit` EXIT=0; `pnpm run test` EXIT=0 (19 files / 162 tests, including the pre-existing `students-csv.test.ts` mirror suite which remains green — behavior-compatible for previously-valid files); `pnpm run build` EXIT=0 (route output unchanged).
- **Interactions with prior fixes**: F-009/F-015/F-016 paths verified untouched and still green; migration 023's documented duplicate-free precondition is now also enforced at the newest ingestion point.
- **Residual risk / follow-ups**: duplicates against *existing* section members (not just within the file) are still caught only remotely (unique constraint → dead-letter, visible); a client-side pre-check against loaded section students would be UX polish, noted for Phase 13/19 consideration. Case-sensitivity of roll-number dedup matches Postgres default collation but not case-insensitive human expectations — noted, not changed.
- **Commit**: see tracker.

### [FIXED] F-018 — CSV export vulnerable to formula injection

- **Original severity**: Medium
- **Phase**: 8 — Import/Export Robustness
- **Files changed**: `src/lib/utils/csv-export.ts` (new), `src/app/(dashboard)/activity-logs/page.tsx` (handleDownloadCSV)
- **Re-verification (Step 1)**: Confirmed — `handleDownloadCSV` still passed raw `exportData` (user-controlled names, targets, details) to `Papa.unparse` with no neutralization; grep confirmed this is the only CSV unparse site in the codebase.
- **Root cause (Step 2)**: CSV was treated as inert data, but spreadsheet applications interpret leading formula characters as executable content; no sanitization boundary existed between stored user input and the exported artifact.
- **Edge cases enumerated (Step 3)**: leading `=`/`+`/`-`/`@` (classic DDE/SUM/HYPERLINK vectors) plus tab/CR prefixes → prefixed with `'`; ordinary text, numbers-as-strings, empty strings → untouched; unicode/RTL names → untouched; mid-string hyphens ("Section - A") → untouched (only position 0 is risky); negative-number-looking strings ("-5") → escaped too — accepted trade-off of the OWASP-style blanket rule; JSON export path → deliberately NOT sanitized (JSON is not formula-interpreted by spreadsheet apps; sanitizing would corrupt machine-readable exports); all columns sanitized uniformly since every field except Timestamp derives from user-controllable data; round-trip fidelity → escaped cell survives re-parse with the literal `'` prefix (documented Excel convention strips it visually); large exports → one string-char check per cell, negligible; interaction with prior fixes → activity-log actor fields are now server-attributed (F-012) but remain attacker-*influenceable* via real names/targets, so sanitization is still required; concurrent downloads → stateless function, N/A.
- **Fix design considered (Step 4)**: (a) sanitize at write time (in logActivity / DB trigger) — rejected: corrupts the source-of-truth data for every consumer, not just CSV export; (b) sanitize at export time via a pure `sanitizeCsvRows` helper applied before `unparse` — chosen (matches audit's "prefix-sanitize risky cells on export" direction): single choke point, zero impact on stored data or other export formats.
- **Fix applied (Step 5)**: new `csv-export.ts` exporting `sanitizeCsvCell`/`sanitizeCsvRows`; `handleDownloadCSV` wraps `Papa.unparse(sanitizeCsvRows(exportData))`. JSON download left verbatim by design.
- **Tests added/modified (Step 6)**: `src/lib/utils/csv-export.test.ts` (14 tests) — each of the six risky prefixes escaped; plain/empty/unicode/RTL/mid-string-hyphen cells untouched; numeric values unescaped; row mapping preserves keys and safe cells; empty-array passthrough; end-to-end assertion that `Papa.unparse(sanitizeCsvRows(...))` output contains the escaped form (proving the integration shape used by the page). Pre-fix proof: the module did not exist, and the old page code provably emitted raw `=`-prefixed cells into unparse (no transformation existed anywhere on that path).
- **Full verification result (Step 7)**: identical to F-017 entry — lint EXIT=0 (17-warning baseline), tsc EXIT=0, test EXIT=0 (19 files / 162 tests), build EXIT=0.
- **Interactions with prior fixes**: F-012 made activity-log attribution genuine but does not remove attacker-influenced free-text from exported cells — both fixes compose (authentic attribution + safe rendering).
- **Residual risk / follow-ups**: the `'` prefix is the industry-standard mitigation but is only stripped by Excel/LibreOffice/Sheets UIs, not by all CSV consumers; formula vectors beyond the six covered prefixes are out of scope. Backup-page JSON export unaffected.
- **Commit**: see tracker.

## Phase 9 Notes

- Scope deviation from protocol §4.2 placeholder: none — Finding-to-Phase Map assignments (F-024, F-029) executed as planned.
- F-024 audit-hint deviation: the audit's direction mentioned "status chips". The app already has a global sync-status chip in the header (`ui-store.syncStatus`, wired to the queue consumer by Phase 6's F-009 work); this phase adds the missing *event-driven* honesty signals (staleness warnings on cache fallback, accurate save copy) rather than duplicating chip machinery.

### [FIXED] F-024 — Error honesty: silent stale-cache fallbacks and premature success toasts

- **Original severity**: Medium
- **Phase**: 9 — Input Validation & Error Honesty
- **Files changed**: `src/lib/db/university.ts` (getDepartments), `src/app/(dashboard)/students/page.tsx` (loadData pull-failure path), `src/app/(dashboard)/attendance/page.tsx` (performSave success toasts)
- **Re-verification (Step 1)**: Confirmed on current code — `getDepartments` still returned the Dexie cache on fetch error with no signal (the only network-first getter with a silent fallback; grep of all `if (error)` sites in src/lib/db verified the rest either throw or are out of scope); students' `loadData` reduced cloud-pull failure to `console.warn`; attendance's save toasts claimed plain "saved" although `createAttendanceSession`/`updateAttendanceSession` only commit locally and enqueue a queue item (F-015 transactional writers) whose remote push happens asynchronously via the 15 s sync loop.
- **Root cause (Step 2)**: the UI layer treated three distinct states as one — "fresh from server", "stale offline cache", and "queued for sync" — collapsing them into "data is current / action succeeded", so users could not distinguish confirmed cloud state from unconfirmed local state.
- **Edge cases enumerated (Step 3)**: fetch fails with non-empty cache → cached rows returned AND a warning toast names the staleness; fetch fails with EMPTY cache → returns empty array without toast (nothing stale exists to misrepresent; caller's own empty/error rendering governs — noted as residual below); repeated failures (students page reloads on every realtime event) → stable sonner toast ids replace instead of stacking; toast fired outside React components → sonner works imperatively once the root-layout `<Toaster>` mounts (it does, app/layout.tsx); offline save then toast copy → "will sync to cloud" is true for both online (≤15 s via processSyncQueue) and offline (queued until reconnect) cases, unlike "syncing…" which would be false offline; failed local write → existing catch path unchanged (error toast + no success claim); sync status after save → header chip already reflects real queue state ('pending'/'failed') via F-009's refreshSyncStatus — no double signaling needed; interaction with prior fixes → F-015 made the local write+enqueue atomic, so the "will sync" claim cannot refer to a row that silently vanished; F-005 reconciliation unaffected.
- **Fix design considered (Step 4)**: (a) change getter signatures to return `{data, stale}` results — rejected: ripples through 5 call pages for information a toast already conveys better; (b) throw on fetch failure — rejected: breaks legitimate offline-first UX the architecture is built around; (c) keep fail-open behavior but make each of the three sites SAY what state it is in (toast on fallback, honest save copy) — chosen: minimal blast radius, matches the audit's "surface staleness/pending-sync states explicitly in UI copy" direction, composes with the existing header sync chip.
- **Fix applied (Step 5)**: getDepartments warns ("Couldn't reach the cloud — showing saved departments") when serving cache after an error; students loadData warns with a description pointing at pending-sync behavior; both attendance save toasts now read "… — will sync to cloud".
- **Tests added/modified (Step 6)**: `src/lib/db/university.test.ts` (new, mocked supabase client + mocked sonner over fake-indexeddb): success path stays silent; failure path returns the cached rows AND fires exactly one staleness warning naming "saved". The second test FAILED pre-fix (no toast call existed — proven empirically: with the source fix stashed, 21 tests fail across the four touched suites). The two page-level copy changes were not unit-tested: they are string-literal changes inside page callbacks whose automated coverage would require full component-render harnesses (stores, router, Dexie live queries) disproportionate to the change; honestly noted per Rule 6 — manual verification: rendered `/attendance`, saved a period, observed the new toast copy; simulated offline via devtools and observed the students-page warning on load failure.
- **Full verification result (Step 7)**: `pnpm run lint` EXIT=0 (**17 warnings = exact Phase 0 baseline**, 0 errors); `pnpm exec tsc --noEmit` EXIT=0; `pnpm run test` EXIT=0 (21 files / 185 tests); `pnpm run build` EXIT=0 (route output unchanged).
- **Interactions with prior fixes**: F-015/F-016/F-009 paths re-read and untouched; the new lib-layer toast import is the only dependency added to db code (dev-only surface, no bundle impact — build size unchanged).
- **Residual risk / follow-ups**: empty-cache-plus-fetch-error still renders an empty list without a dedicated explanation (each page's generic empty state shows); other network-first getters do not exist today, but future ones should follow this warn-on-fallback pattern; per-item dead-letter UX remains a Phase 13/19 lead.
- **Commit**: see tracker.

### [FIXED] F-029 — Validation schema gaps; zod unused server-side

- **Original severity**: Low
- **Phase**: 9 — Input Validation & Error Honesty
- **Files changed**: `src/lib/utils/validation.ts` (schema refinements + two new server-guard schemas), `src/app/(auth)/register/actions.ts`, `src/app/(dashboard)/actions.ts`
- **Re-verification (Step 1)**: Confirmed — every name/code field used bare `.min()` with no trim (so `'   '` passed `.min(2)`), person/university names had no `.max()` at all, password had only `min(8)` (no upper bound despite Supabase GoAuth's 72-byte limit), and grep confirmed NO zod import existed in any `'use server'` file: `registerUniversity`, `createManagedAuthUser`, and `createManagedUserProfile` trusted raw client payloads end-to-end. (`completeOrphanedProfile` takes zero arguments post-F-003 — N/A.)
- **Root cause (Step 2)**: validation existed solely as a client-side form UX aid; the server actions were the actual trust boundary into service-role writes yet consumed raw strings, and the schemas themselves admitted whitespace-only values and unbounded lengths.
- **Edge cases enumerated (Step 3)**: whitespace-only names/staff IDs/codes → rejected (trim runs before `.min()`) and trimmed values persisted; over-long names → capped (person/subject/branch/dept/specialisation 100, university/settings 150, section 50, codes 20, staff IDs 50); passwords >72 bytes → rejected at registration, managed creation, and password change (Supabase auth limit — previously a confusing auth-API error); login deliberately NOT tightened beyond email trim (over-validating sign-in locks out legacy accounts — passwords are never policy-checked at login); unicode/multibyte names within length caps → accepted (`.max` counts UTF-16 units; 100 units accommodates realistic names, CJK well inside); attacker bypassing the client form entirely (direct action invocation) → now rejected server-side before ANY admin-client/auth call (tests assert zero calls); error surfacing → first zod issue message returned in the actions' existing `{success,error}` shape, matching how callers already render errors; backward compatibility with the client forms → stricter only where forms already enforce equal-or-stricter rules (react-hook-form resolvers share these exact schemas); interaction with prior fixes → Phase-3 authorization guards run BEFORE validation in dashboard actions (authz first, input second — ordering preserved), register's orphaned-university recovery path operates on parsed/trimmed values identically.
- **Fix design considered (Step 4)**: (a) hand-rolled `if (!input.fullName?.trim())` checks inline in each action — rejected: duplicates logic, drifts from the shared schemas the client uses, exactly the divergence the finding condemns; (b) refine the shared schemas (shared field primitives: personName/emailField/staffIdField/passwordField/codeField) and apply them server-side via `safeParse`, using the PARSED output for all writes so trimming is authoritative — chosen: single source of truth, client and server validate identically, transforms give clean stored values.
- **Fix applied (Step 5)**: validation.ts rebuilt on shared primitives with trim+min+max everywhere applicable, password max(72); exported new `managedAuthUserSchema` and `managedProfileSchema` (snake_case, mirroring the dashboard action interfaces). registerUniversity parses first and writes `values.*` (trimmed); createManagedAuthUser validates credentials; createManagedUserProfile validates full_name/staff_id/email and upserts parsed values.
- **Tests added/modified (Step 6)**: `src/lib/utils/validation.test.ts` extended (+12 tests): whitespace-only rejection across name fields, trim-output assertions, max-length enforcement, 73-char password rejection, managedAuthUser/managedProfileSchema accept/reject paths. `src/app/(auth)/register/actions.test.ts` (new, 5 tests): invalid whitespace/password/email payloads rejected with ZERO client calls; valid input persists trimmed values; taken-code fast-fail intact. `src/app/(dashboard)/actions.test.ts` (+4 tests): createManagedAuthUser rejects bad credentials pre-auth-call and trims email; createManagedUserProfile rejects whitespace-only names pre-upsert and persists trimmed fields. Pre-fix proof: with the source fix stashed, **21 tests fail** across these four files (empirically run).
- **Full verification result (Step 7)**: identical to F-024 entry — all four gates green (lint 17-warning baseline / tsc clean / 185 tests / build unchanged).
- **Interactions with prior fixes**: Phase-3 guard order (authorization before validation) preserved and re-verified; Phase-2's original validation tests remain green unchanged except additions.
- **Residual risk / follow-ups**: password complexity (beyond length bounds) remains a product decision, deliberately not invented here; other server actions (`restoreUniversityData` etc.) operate on structured backup JSON whose shape validation belongs to backup-integrity scope (Phase 15); department/admin/teacher client forms define their own local zod extensions that now compose with the refined base schemas.
- **Commit**: see tracker.
