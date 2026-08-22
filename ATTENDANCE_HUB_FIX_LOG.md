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
| 4 | Supabase RLS & Database Security | Complete | 2026-08-23 | *(this commit)* |
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
- **Phase 4:** `/students` page line 131 filters **super_admins** to their own `departmentId` too (`user.role === 'admin' || user.role === 'super_admin'` branch), so a super_admin whose profile has a department sees a dept-scoped list there while RLS grants them university-wide reads. UI-only oddity; candidate for Phase 13/19.

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
