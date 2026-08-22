# Attendance-Hub — Paranoid Audit Findings (Phase 1)

**Date:** 2026-08-22 · **Branch:** `main` @ `593bca9` · **Mode:** read-only audit; no source files touched.
**Method:** full reads of auth flows, server actions, all 20 migrations, Dexie layer, sync engine, backup/restore actions, validation, stores, key pages (attendance/students/activity-logs/backup/export/login/register/change-password), configs and `.env.local` (names only). Findings below are verified against current code with file:line evidence.

**Severity:** Critical (exploitable security / data loss) · High (broken core behavior / serious risk) · Medium (correctness or robustness gaps) · Low (polish, hygiene).
**Confidence:** High = traced end-to-end; Medium = mechanism clear but runtime behavior not executed.

---

## CRITICAL

### F-001 — wipeUniversityData server action has no permission check at all
- **Location:** `src/app/(dashboard)/backup/actions.ts:5-62`
- **Evidence:** Takes `universityId` + `currentUserId` as plain arguments from the client and deletes every table for that university via `createAdminClient()` (service role, bypasses RLS). No session lookup, no role check — unlike `adminBulkUpsert`, which at least attempts one.
- **Impact:** Any caller who can reach this server action can destroy any university's entire dataset.
- **Confidence:** High
- **Fix direction:** Derive identity server-side from the calling session (`supabase.auth.getUser()` on a non-service client or verified cookie); verify caller is that university's super_admin before any delete.

### F-002 — adminBulkUpsert / restoreUniversityData authorize using a client-supplied user ID
- **Location:** `src/app/(dashboard)/backup/actions.ts:138-167, 169-385`
- **Evidence:** "Verify permissions" checks `users.role === 'super_admin' && university_id === universityId` where `currentUserId` comes from the request payload (`sync.ts:60` even passes queue `ownerId`). UIDs are not secrets (they appear in activity logs, backup JSON, local Dexie).
- **Impact:** Knowing/guessing a super_admin UID grants service-role upsert of arbitrary payloads into an arbitrary `collection` table name — full RLS bypass.
- **Confidence:** High
- **Fix direction:** Same as F-001; additionally whitelist allowed collections instead of accepting any table string.

### F-003 — Privileged user-management server actions have zero authorization
- **Location:** `src/app/(dashboard)/actions.ts:16-97`; also `src/app/(auth)/login/actions.ts:17-66`
- **Evidence:** `createManagedAuthUser` creates auth users with attacker-chosen passwords; `createManagedUserProfile` upserts profile rows with ANY role (incl. `super_admin`) for ANY existing auth uid; `deactivateManagedAuthUser` bans any uid. `completeOrphanedProfile` inserts a super_admin profile row for any userId whose orphaned university has `super_admin_id = userId`. None verify the caller's session.
- **Impact:** Unauthenticated/full privilege escalation into any university; account lockout of arbitrary users.
- **Confidence:** High
- **Fix direction:** Require an authenticated super_admin/admin session bound to the target university inside each action; drop or re-scope `completeOrphanedProfile`.

### F-004 — RLS lets primary_teacher/admin self-promote to super_admin via users UPDATE
- **Location:** `supabase/migrations/008_policy_perf_and_fk_indexes.sql:121-130` (policy still live; never dropped later)
- **Evidence:** `update_university_users` USING clause allows any `primary_teacher`/`admin` to update **any** user row in their university, including their own `role`. No `WITH CHECK`, no column restriction → `UPDATE users SET role='super_admin' WHERE id=auth.uid()` passes.
- **Impact:** Plain privilege escalation with a single Supabase call from any teacher account.
- **Confidence:** High
- **Fix direction:** New append-only migration replacing this policy: separate self-update policy restricted to non-privileged columns (e.g. `full_name`), plus admin/super_admin policies that cannot grant `super_admin` role (check both old and new row).

### F-005 — pullFromCloud fetches whole tables unpaginated; Supabase silently caps at 1000 rows
- **Location:** `src/lib/db/sync.ts:216-270`
- **Evidence:** `.select('*').eq('university_id', …)` per table with no `.range()` pagination. supabase-js/PostgREST default max-rows is 1000. Also `bulkPut`-only merge means rows deleted remotely are never removed locally.
- **Impact:** Large universities get silently incomplete offline caches (missing students in marking UI, wrong analytics) and permanently stale/deleted records locally.
- **Confidence:** High
- **Fix direction:** Paged fetch loop until short page; reconcile deletions (compare IDs or use soft-delete markers).

## HIGH

### F-006 — SUPABASE_SERVICE_ROLE_KEY missing from environment while all privileged flows require it
- **Location:** `src/lib/supabase/admin.ts:8` (`process.env.SUPABASE_SERVICE_ROLE_KEY!`)
- **Evidence:** `.env.local` contains only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Phase 0 recon). Registration, login-completion, wipe, restore and sync bulk paths all call `createAdminClient()`.
- **Impact:** Those flows crash at runtime with an undefined key in this deployment shape; if the key *was* added ad hoc elsewhere, that's untracked config drift.
- **Confidence:** High (fact of mismatch); Medium (runtime failure claim depends on deploy env)
- **Fix direction:** Document/require the var explicitly, fail fast at startup with a clear message; consider moving privileged flows behind properly authorized non-service clients (F-001..F-003 fixes shrink its surface).

### F-007 — restoreAuthUsers resets every restored account to hardcoded password 'Password123!'
- **Location:** `src/app/(dashboard)/backup/actions.ts:115-120`
- **Evidence:** `createUser({ email, password: 'Password123!', email_confirm: true })` for every restored user.
- **Impact:** All restored accounts share a repo-visible password; `must_change_password` comes from the backup row and may be `false`.
- **Confidence:** High
- **Fix direction:** Generate random one-time passwords + force `must_change_password=true`, or invite-flow emails.

### F-008 — Cross-university account hijack during restore
- **Location:** `src/app/(dashboard)/backup/actions.ts:69-110`
- **Evidence:** Matches backup users by email against **all** auth users project-wide (paginated `listUsers`). A match belonging to another university gets `u.id = existing.id`, then `restoreUniversityData` upserts that person's profile row with THIS university_id.
- **Impact:** Steals/corrupts accounts across tenants; duplicate-email collision silently remaps identities.
- **Confidence:** High
- **Fix direction:** Scope matching to profiles already in the restoring university only; treat foreign-email matches as new-user creation.

### F-009 — Sync engine: multi-tab races, poison pills, teacher bulk-uploads never sync
- **Location:** `src/lib/db/sync.ts:22-134` (+ `backup/actions.ts:143-146`)
- **Evidence:** Every tab runs `processSyncQueue` on the same items with no claim/lock (duplicate concurrent pushes). Failed items retry forever every 15 s — `retryCount >= 5` only logs a warning (line 130), never dead-letters. The `bulk_create` path calls `adminBulkUpsert`, which requires `role==='super_admin'` — so a `primary_teacher`'s bulk student upload fails remotely forever while the UI already showed "students uploaded".
- **Impact:** Duplicate/racing writes, infinite retry churn, silent permanent data divergence for teachers.
- **Confidence:** High
- **Fix direction:** Queue claiming (lease flag), backoff + dead-letter state surfaced in UI, replace super_admin-only bulk action with RLS-respecting chunked upserts from the client.

### F-010 — Attendance conflict resolution trusts unsynchronized client clocks
- **Location:** `src/lib/db/sync.ts:146-193`
- **Evidence:** LWW compares `Date.parse(markedAt)` strings produced on different devices; ties (`localMarkedAt <= remoteMarkedAt`) silently favor remote and overwrite local edits.
- **Impact:** Clock-skewed devices lose attendance edits silently.
- **Confidence:** Medium
- **Fix direction:** Server-side timestamps or monotonic revision counters for conflict resolution.

### F-011 — "Today" is UTC everywhere; dashboard date frozen at module load
- **Location:** `src/app/(dashboard)/attendance/page.tsx:82-83`; `src/app/(dashboard)/dashboard/page.tsx:32`
- **Evidence:** `new Date().toISOString().split('T')[0]` defines the attendance date; dashboard computes it once at module scope.
- **Impact:** For UTC+n universities, sessions between midnight and the offset land on the wrong date; long-lived tabs mark tomorrow/yesterday incorrectly.
- **Confidence:** High
- **Fix direction:** Local-timezone date helper used consistently; recompute per render/day rollover.

### F-012 — Activity logs forgeable by any member
- **Location:** `supabase/migrations/002_rls_policies.sql:286-287`; `src/lib/db/activity.ts:22-41`
- **Evidence:** INSERT policy checks only university membership; `performed_by_name/id/role` come from the client payload verbatim. Super_admin deletion has no tamper-evidence trail.
- **Impact:** Any CR/teacher can fabricate audit entries attributed to anyone.
- **Confidence:** High
- **Fix direction:** Set `performed_by_*` columns server-side from `auth.uid()` (trigger or default), keep client fields display-only.

## MEDIUM

### F-013 — Stale `subjects.sectionId` after junction migration breaks section-delete cascade & section analytics
- **Location:** `src/lib/db/university.ts:303-313`; `src/lib/db/analytics.ts:59`; `src/lib/db/sync.ts:290`; `src/lib/db/index.ts:29`
- **Evidence:** Migration 013 dropped `subjects.section_id`, but `deleteSection` still queries `subjects.where({universityId, sectionId})` (always empty now), `getSectionAnalytics` filters subjects by `sectionId` (always empty → empty summaries), `mapRemoteToLocal` hardcodes `sectionId:''`.
- **Impact:** Orphaned subject/attendance rows left locally on section delete; per-section analytics silently return nothing.
- **Confidence:** High
- **Fix direction:** Route both through `subjectSections` junction lookups; clean up Dexie index declarations.

### F-014 — invalidateAnalyticsCache ignores its parameter; fragile key-prefix delete
- **Location:** `src/lib/db/attendance.ts:105-109`
- **Evidence:** `universityId` arg unused; cache cleared by `id.startsWith('section_' + sectionId)` against the primary-key index — correctness hinges on an implicit key-format contract.
- **Impact:** Cache invalidation breaks silently if key format changes; misleading signature.
- **Confidence:** High
- **Fix direction:** Secondary index on sectionId for `cachedAnalytics` or explicit composite keys.

### F-015 — Local write + sync-queue enqueue not transactional in several writers
- **Location:** `src/lib/db/attendance.ts:29-82`; `src/lib/db/students.ts:19-97`; most creators in `src/lib/db/university.ts`
- **Evidence:** `put(...)` then `syncQueue.add(...)` without wrapping `db.transaction` (other writers like `createStudentsBulk` do wrap).
- **Impact:** Crash between the two leaves local rows that never sync (or vice versa) — silent divergence.
- **Confidence:** High
- **Fix direction:** Standardize on Dexie transactions covering both tables.

### F-016 — Concurrent/offline period creation collides on deterministic IDs; no DB constraint backs period numbers
- **Location:** `src/app/(dashboard)/attendance/page.tsx:524`; `src/lib/db/attendance.ts:20-27`; `supabase/migrations/001_initial_schema.sql:153-168`
- **Evidence:** Session ID = `${subjectId}_${date}_${periodNumber}`; `getNextPeriodNumber` computed from local Dexie only; no UNIQUE(subject_id,date,period_number) in Postgres.
- **Impact:** Two devices creating the same period converge to one ID and silently last-write-win overwrite each other's records.
- **Confidence:** High
- **Fix direction:** Append-only migration adding the unique constraint; UUID session ids + conflict handling in sync.

### F-017 — CSV import lacks size caps, header validation, and duplicate detection
- **Location:** `src/app/(dashboard)/students/page.tsx:322-352, 361-403`
- **Evidence:** Any file size parsed wholesale; headers matched loosely with no upfront schema check; duplicate roll numbers within a file pass through and rely on the remote unique constraint failing the whole batch (feeding F-009 poison pills).
- **Impact:** Browser OOM on huge files; confusing all-or-nothing failures; partial local/remote divergence.
- **Confidence:** High
- **Fix direction:** Pre-parse validation (size limit, required headers, in-file dup detection), chunked upload with per-chunk results.

### F-018 — CSV export vulnerable to formula injection
- **Location:** `src/app/(dashboard)/activity-logs/page.tsx:304-320`
- **Evidence:** `Papa.unparse(exportData)` with no neutralization of leading `=`,`+`,`-`,`@` in user-controlled fields (names, targets, details).
- **Impact:** Crafted names execute formulas when exported CSV opens in Excel.
- **Confidence:** High
- **Fix direction:** Prefix-sanitize risky cells on export.

### F-019 — Realtime events trigger full-university re-pull
- **Location:** `src/app/(dashboard)/students/page.tsx:182-198`; `src/app/(dashboard)/attendance/page.tsx:345-356`
- **Evidence:** Each postgres change callback calls `pullFromCloud(university.id)` (all tables) plus full page reload.
- **Impact:** O(entire dataset) network/Dexie work per single-row event, multiplied per open subscriber.
- **Confidence:** High
- **Fix direction:** Apply the changed row from the realtime payload directly; debounce.

### F-020 — `/backup` route absent from AuthGuard route permissions
- **Location:** `src/components/providers/auth-guard.tsx:8-24`
- **Evidence:** `ROUTE_PERMISSIONS` covers every dashboard route except `/backup` → unknown routes fall through ungated.
- **Impact:** Any authenticated role reaches the backup/wipe UI by URL (real enforcement gap remains the server actions F-001..F-003, but this widens exposure).
- **Confidence:** High
- **Fix direction:** Add explicit entry (deny-by-default for unmapped routes would be safer still).

### F-021 — Client trusts localStorage-persisted user object (incl. role)
- **Location:** `src/lib/stores/auth-store.ts:32-42`; `src/components/providers/auth-guard.tsx`
- **Evidence:** Zustand persist stores `user`/`university`; guard gates on hydrated persisted state before fresh profile load completes.
- **Impact:** Editing localStorage spoofs role client-side; combined with F-001..F-003 it matters beyond cosmetics.
- **Confidence:** High
- **Fix direction:** Treat persisted user as display-cache only; gate on freshly verified profile.

### F-022 — Password-reset redirect built from unset NEXT_PUBLIC_APP_URL
- **Location:** `src/lib/supabase/auth.ts:34-39`
- **Evidence:** `redirectTo: \`${process.env.NEXT_PUBLIC_APP_URL}/change-password\`` — variable absent from `.env.local`.
- **Impact:** Reset emails redirect to `undefined/change-password` — broken recovery flow.
- **Confidence:** High
- **Fix direction:** Configure the variable or derive from `window.location.origin`.

### F-023 — registerUniversity: enumeration, no rate limiting, no server-side validation, non-atomic rollback
- **Location:** `src/app/(auth)/register/actions.ts:19-142`
- **Evidence:** Email-existence probing via `listUsers` fallback (49-54); no rate limiting/captcha; `registerSchema` zod only applied client-side; manual compensating deletes across three steps (100-140) leave partial states on crash.
- **Impact:** Account/code enumeration, abuse, inconsistent partial registrations.
- **Confidence:** High
- **Fix direction:** Uniform error messages, rate-limit/captcha, validate server-side with the shared schema.

### F-024 — Error honesty: silent stale-cache fallbacks and premature success toasts
- **Location:** `src/lib/db/university.ts:6-29`; `src/app/(dashboard)/students/page.tsx:117-121`; `src/app/(dashboard)/attendance/page.tsx:498-631`
- **Evidence:** Network-first getters silently fall back to possibly-stale Dexie caches; cloud-pull failures reduced to `console.warn`; "Attendance saved" toast fires though the cloud write may only be queued.
- **Impact:** Users believe data is saved/synced when it isn't; stale views presented as fresh.
- **Confidence:** High
- **Fix direction:** Surface staleness/pending-sync states explicitly in UI copy and status chips.

## LOW

### F-025 — Any authenticated user can spam-create universities
- **Location:** `supabase/migrations/008_policy_perf_and_fk_indexes.sql:84-88`
- **Evidence:** INSERT policy `WITH CHECK ((SELECT auth.uid()) IS NOT NULL)` — no linkage to registration flow.
- **Impact:** Orphan/junk university rows; minor integrity noise.
- **Confidence:** High
- **Fix direction:** Constrain insert to bootstrap pattern (uid not yet having a university/profile), or move creation fully server-side.

### F-026 — Admin read/write scope asymmetry (cross-department reads)
- **Location:** `supabase/migrations/008_policy_perf_and_fk_indexes.sql:154-196` vs `supabase/migrations/009_fix_rls_policies_comprehensive.sql:73-114`
- **Evidence:** Admins read ALL students/attendance in the university but write only their department's.
- **Impact:** Broader-than-needed cross-department visibility (may be intended — needs product confirmation).
- **Confidence:** High (behavior), Low (intent)
- **Fix direction:** Confirm intent; tighten SELECT to department scope if unintended.

### F-027 — mapRemoteToLocal passthrough writes raw snake_case rows into typed stores
- **Location:** `src/lib/db/sync.ts:299-301`
- **Evidence:** `default: return row` for unmapped tables.
- **Impact:** Schema-drift time bomb; camelCase code reading snake_case fields gets undefined.
- **Confidence:** High
- **Fix direction:** Explicit mapping for every pulled table; throw on unknown table.

### F-028 — Unused heavy dependencies
- **Location:** `package.json` (`xlsx@^0.18.5`, `@google/generative-ai@^0.24.1`)
- **Evidence:** Zero imports anywhere in `src/`.
- **Impact:** Supply-chain surface and install weight for nothing.
- **Confidence:** High
- **Fix direction:** Remove (xlsx also has known vuln history — good riddance).

### F-029 — Validation schema gaps; zod unused server-side
- **Location:** `src/lib/utils/validation.ts:3-68`
- **Evidence:** Whitespace-only names pass `.min(2)`; no max lengths on person/university names; password policy is length≥8 only; schemas never applied in server actions.
- **Impact:** Junk data accepted; server trusts raw input.
- **Confidence:** High
- **Fix direction:** Trim+min/max refinements; reuse schemas in actions.

### F-030 — Baseline lint warnings (17) include a real exhaustive-deps issue
- **Location:** `src/app/page.tsx:43` (per Phase 0 baseline); 15× unused-vars elsewhere
- **Evidence:** Phase 0 recorded 17 warnings, 0 errors.
- **Impact:** Minor; the deps warning can hide stale-closure bugs.
- **Confidence:** High
- **Fix direction:** Clean up during Low sweeps (Phases 19–20).

### F-031 — Middleware auth-cookie heuristic uses substring match
- **Location:** `src/middleware.ts:8-12`
- **Evidence:** `cookie.name.includes('-auth-token')` gates the public fast path.
- **Impact:** Fast-path misclassification only; session still verified downstream.
- **Confidence:** High
- **Fix direction:** Match exact known Supabase cookie names/prefix.

---

## Coverage Notes

- **Accessibility:** reviewed at surface level — forms correctly pair `<Label htmlFor>`, loading states expose `aria-live`/`aria-busy` (`src/app/loading.tsx:3`, dashboard `page.tsx:738`), Base UI primitives generally accessible. Deep adversarial a11y passes remain for Phases 12–13 as planned; no fabricated findings added here.
- **README claims vs behavior:** deliberately deferred to Phase 10 per protocol §4.2 ordering.
- **Not executable here:** Docker absent (Phase 0 note) — DB-level claims (F-004, F-016, F-025, F-026) were derived from migration text tracing; they must be reproduced against precisely-mocked clients in Phase 2+ tests.
