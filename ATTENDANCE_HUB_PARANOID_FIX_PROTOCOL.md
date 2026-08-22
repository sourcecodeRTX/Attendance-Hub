# ATTENDANCE-HUB PARANOID AUDIT & FIX PROTOCOL

**READ THIS ENTIRE FILE, START TO FINISH, BEFORE DOING OR WRITING ANYTHING.**
Do not skim. Do not jump to the phase list. Do not begin work after reading only the phase table. This file defines rules that apply to *every* phase, and violating them invalidates the effort. If you have already read it once earlier in this session, re-read it anyway — you cannot rely on a memory summary of your own instructions.

---

## 0. WHAT THIS IS

This is a multi-session, multi-phase, adversarial **audit-then-fix** effort against the **Attendance-Hub** codebase — a Next.js 14 (App Router) + React 18 + TypeScript attendance tracker backed by **Supabase** (Postgres with RLS, Auth), with an offline-first layer (**Dexie/IndexedDB** + a custom sync engine), Zustand state management, and CSV/XLSX/PDF import-export (`papaparse`, `xlsx`, `jszip`, `@react-pdf/renderer`).

Unlike a project that starts from a completed audit, this effort begins with **no audit findings file**. Therefore:

- **Phase 1 produces `ATTENDANCE_HUB_AUDIT_FINDINGS.md`** — a complete, adversarial, read-only audit of the codebase (every finding numbered, with severity, evidence, impact, confidence, and a terse suggested fix direction). That phase touches nothing in `src/` or `supabase/`.
- Every phase after that is a **fix-implementation phase** driven by that file.

Each phase happens in a **separate chat with a fresh context window**, against the **same working checkout, installed once at the very start of the whole effort** — see Rule 10. This file is the only thing that persists your instructions across sessions. Two more files persist *state*:

- `ATTENDANCE_HUB_AUDIT_FINDINGS.md` — created in Phase 1; permanently **read-only** afterward; the source of truth for *what is wrong*.
- `ATTENDANCE_HUB_FIX_LOG.md` — the source of truth for *implementation progress and decisions*. **If it isn't written into the fix log, it did not happen.** A future session (a future you) will trust that file completely and will not re-read the entire codebase to rediscover what you already fixed, why, and how you proved it.

Together, these three files are the entire state of this effort. Nothing else survives between sessions.

**A finding's "Suggested fix direction" (written during Phase 1) is a starting hint, not an instruction to follow blindly.** Your job in each fix phase is to independently re-derive the best actual fix — considering every edge case, every concurrent-access pattern, every malformed-input path, every interaction with other findings already fixed — and implement *that*, even if it differs from or goes further than the hint. If the hint is wrong or incomplete, say so in the fix log and do the right thing instead.

---

## 1. ABSOLUTE, NON-NEGOTIABLE RULES

1. **You edit the source tree only inside the scope of the finding(s) you are actively fixing in this phase.** No drive-by refactors, no unrelated cleanup, no "while I'm here" changes to files outside the current phase's target, even if you notice something else wrong. If you notice something else wrong that isn't already in `ATTENDANCE_HUB_AUDIT_FINDINGS.md`, note it in `ATTENDANCE_HUB_FIX_LOG.md` under "New leads observed (not yet in scope)" and move on.
2. **No feature additions.** You are here to make what already exists correct, robust, secure, and honest about what it does — never to add new capabilities beyond what a finding's fix genuinely requires (e.g., adding a Postgres unique constraint or RLS policy to fix an integrity/security hole is in scope; adding a new dashboard page is not).
3. **The only files you write to, outside the specific finding's target files, are:**
   - `ATTENDANCE_HUB_AUDIT_FINDINGS.md` — **only during Phase 1**, when it is created. Never touched again.
   - `ATTENDANCE_HUB_FIX_LOG.md` (append audit/fix entries, update the progress tracker) — repo root.
   - New test files / test additions, which are a **required deliverable of every fix phase**, not optional scratch work.
   - Scratch/throwaway files **outside the repo tree** (`C:\Users\mrrat\AppData\Local\Temp\opencode\...`) for probe scripts used to verify a hypothesis before committing to a fix. Delete these when done; never let them leak into a commit.
4. **Never touch `ATTENDANCE_HUB_AUDIT_FINDINGS.md` after Phase 1.** It is the historical record of the original audit. Corrections (if a finding turns out to be a misread during re-verification) go in `ATTENDANCE_HUB_FIX_LOG.md` as a note, not as an edit to the audit file.
5. **Every fix must be independently re-verified before it is trusted**, per the Gauntlet Loop in §2. Do not implement Phase 1's suggested direction verbatim without first re-deriving why it's right and whether it's actually sufficient.
6. **Every fix must be proven, not asserted.** "Proven" means: a test that failed before the fix and passes after it, for every edge case you identified — plus the full existing verification gates still green. If something genuinely cannot be tested automatically (e.g., Supabase Studio-only behavior, browser-only OAuth redirects), say so explicitly in the fix log and explain the manual verification you performed instead.
7. **No regressions, ever.** Before a phase is allowed to end, the *entire* verification suite must pass:
   - `pnpm run lint`
   - `pnpm exec tsc --noEmit`
   - `pnpm run test` (once Phase 2 introduces Vitest)
   - `pnpm run build` (at minimum for phases touching build-affecting code)
   
   Not just the new tests written this phase. If a phase's fix breaks something else, that break must be resolved (or the fix redesigned) before the phase ends — it cannot be logged as a known issue and deferred. All commands use **pnpm**, always.
8. **One phase per session, fully, before stopping.** Do not do half a phase and call it done. Do not skip ahead to a later phase because it looks more interesting. Do not silently merge or split phases. If a phase turns out to be larger than expected once you're inside it, it is better to finish a *smaller, explicitly-scoped subset* of it correctly than to rush the whole thing shallowly — but you must then leave the tracker in `In progress (partial — see notes)` and record exactly what remains, rather than marking it Complete.
9. **Every phase ends in exactly one git commit** (after the full verification suite is green), with a message of the form:
   - Audit phase: `audit(phaseN): <short summary>`
   - Fix phases: `fix(phaseN): <short summary> — closes: <finding title fragment(s)>`
   
   **Git history is sacred: never amend, rebase, force-push, or rewrite any prior commit.** Do not push automatically — leave the commit for the user to review and push.
10. **The working checkout is fixed at the very start of this whole effort and is never reset, recloned, or reinstalled between phases.** The same checkout accumulates every phase's commits in place. Guard: at the start of Phase 0, confirm you're on the correct branch and the tree is clean. For every phase after, confirm `git log --oneline` shows every commit `ATTENDANCE_HUB_FIX_LOG.md`'s tracker claims is done. If anything is missing or looks wrong, STOP and flag it to the user immediately — do not proceed or silently re-do already-completed work.
11. **Trust nothing you have not personally re-verified**, including your own prior sessions' fix-log entries about *other* findings, if this phase's fix touches code near them. A fix-log entry says a fix was made and tested at the time — always confirm it's still true (a later phase could theoretically have altered nearby behavior), don't just cite it.
12. **Secrets discipline.** This project talks to a live Supabase project. Never print, commit, or copy secret keys (`service_role`, `SUPABASE_SERVICE_ROLE_KEY`, Gemini API keys) into logs, tests, fixtures, or the fix log. Tests must use mocked clients or local/disposable instances — never the production project. `.env.local` is gitignored; keep it that way.

---

## 2. THE GAUNTLET LOOP (mandatory methodology for every finding, every fix phase)

This is not a checklist to skim — it is the actual sequence of work for every finding you fix. Do not skip steps. Do not collapse steps 2–4 into "I already know the fix" just because the suggested direction seems obvious — obvious-looking fixes are exactly where a missed edge case does the most damage.

**Step 1 — RE-VERIFY THE FINDING.**
Open `ATTENDANCE_HUB_AUDIT_FINDINGS.md`, locate the exact finding by its title fragment, read the full entry (Evidence, Impact, Confidence). Re-run whatever reproduction the audit describes against the *current* code (things may have already shifted since the audit). If you cannot reproduce it, do not assume the audit was wrong — dig until you understand why the reproduction path is different now, and only then decide whether the finding is stale, saying so explicitly in the fix log before proceeding differently than planned.

**Step 2 — ROOT-CAUSE ANALYSIS.**
Trace the actual mechanism end to end. Do not stop at the first plausible cause — ask "why does this happen" until you hit the true, lowest-level cause (e.g., not "the client can write anyone's attendance" but *why*: the RLS policy checks the wrong column / no policy exists for that table / the anon key is being used where an authenticated session is required / role comes from unverified client input — name the specific broken primitive).

**Step 3 — ENUMERATE EVERY EDGE CASE.** Before writing any fix code, write down the full set of conditions the fix must hold under:
- Concurrent/simultaneous access (two teachers marking the same student's attendance; sync engine racing a live edit)
- Empty / null / missing / wrong-type / oversized / malformed input (CSV cells, XLSX sheets, form fields, URL params)
- Unicode, RTL, non-English names, extreme lengths, boundary numeric values (0 students, negative counts, max roll numbers)
- Offline/online transitions: app killed mid-sync, retry after failure, clock skew between client and server
- Multi-role interaction: admin vs teacher vs CR vs viewer — does the fix change who can read/write what, intentionally or not?
- RLS interaction: does the fix still hold when the query comes from a different role, a different branch, or the service key?
- Interaction with **other findings already fixed** in earlier phases — check `ATTENDANCE_HUB_FIX_LOG.md` for anything touching the same subsystem
- Backward compatibility with existing rows already in Supabase / records already in IndexedDB from before the fix
- Performance impact at realistic scale (a branch with hundreds of students, months of attendance rows), not just toy data
- What happens if the fix itself fails or times out

If a category genuinely doesn't apply, write "N/A — <one-line reason>," don't silently omit it.

**Step 4 — DESIGN THE FIX.**
For anything non-trivial, consider at least two candidate approaches and briefly weigh them (correctness, security, performance, consistency with existing codebase idioms, blast radius) before picking one. Prefer the codebase's existing patterns (e.g., if other tables enforce integrity via migration-numbered unique constraints + RLS policies in `supabase/migrations/`, use those same primitives — as a *new, append-only* migration — unless there's a specific reason not to, and if so, say why). Migrations are **append-only**: never edit an already-applied migration file; always add `NNN_description.sql` continuing the numbering past `020`.

**Step 5 — IMPLEMENT.**
Minimal, scoped, idiomatic. Match the surrounding code's style. No unrelated changes (Rule 1).

**Step 6 — WRITE / EXTEND TESTS.**
Every edge case from Step 3 that is plausible to exercise automatically gets an automated test. At minimum:
- A test that would have **failed against the pre-fix code** (proves you're testing the real bug, not a strawman)
- Tests for each boundary/malformed-input/concurrency scenario identified (for DB-level claims, test against a real local Postgres/Supabase instance or precisely-mocked `supabase-js`; never against the production project — Rule 12)
- If a case genuinely can't be automated (browser-only flows, Supabase Studio config), perform and document a manual verification instead, and say explicitly why it isn't automated

**Step 7 — RUN THE FULL VERIFICATION SUITE.**
`pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run test`, and `pnpm run build`. Every one must be green, not just "mostly passing" — if a failure is genuinely pre-existing and unrelated, verify that it also fails on the pre-fix commit, and note it in the fix log rather than silently accepting it.

**Step 8 — ITERATE ON FAILURE.**
If step 6 or 7 turns up a problem, go back to Step 2 or 4 — do not patch around a test failure with a narrower test or a special-cased fix that doesn't address the root cause. There is no fixed iteration cap — keep going as long as each iteration produces new information and narrows the problem. If iteration stops converging, stop, write up exactly what you tried, why it didn't work, and what you believe the real blocker is, and leave the phase `In progress (partial — see notes)` rather than forcing a false "Complete."

**Step 9 — LOG AND COMMIT.**
Append the fix-log entry (format in §3), update the progress tracker, commit (Rule 9), then stop per Rule 8 — do not continue into the next phase in the same session.

---

## 3. FIX LOG ENTRY FORMAT (append to `ATTENDANCE_HUB_FIX_LOG.md`, one per finding)

```
### [FIXED] <finding title fragment, copied verbatim from ATTENDANCE_HUB_AUDIT_FINDINGS.md>

- **Original severity**: Critical / High / Medium / Low
- **Phase**: N — <phase name>
- **Files changed**: src/lib/db/sync.ts:120-145, supabase/migrations/021_xxx.sql
- **Re-verification (Step 1)**: how you confirmed the finding still reproduces on current code; if it didn't, what changed and why
- **Root cause (Step 2)**: the actual lowest-level mechanism, not the symptom
- **Edge cases enumerated (Step 3)**: the full list from your analysis, each with how it's addressed or why N/A
- **Fix design considered (Step 4)**: candidate approaches weighed, and why the chosen one won
- **Fix applied (Step 5)**: concrete description of what you actually did
- **Tests added/modified (Step 6)**: file:test_name — what each one proves, and confirmation that at least one failed pre-fix
- **Full verification result (Step 7)**: exact commands run and pass/fail counts for lint, tsc, test, build
- **Interactions with prior fixes**: anything in this subsystem touched by an earlier phase, and confirmation it's still correct
- **Residual risk / follow-ups**: anything not fully closed, deferred with justification, or a new lead spotted outside this phase's scope
- **Commit**: <short hash> — <message>
```

---

## 4. THE PHASE PLAN

### 4.0 Ordering principles

1. **Ground truth first, then audit, then infrastructure, then fixes.** You cannot fix reliably without a baseline (Phase 0), you have nothing to fix against until the audit exists (Phase 1), and you cannot prove fixes without a test harness (Phase 2).
2. **Severity order after that**: all Critical and High findings first (security/data-loss before polish), then Medium, then Low.
3. **Security before correctness before UX.** A leaky RLS policy outranks a race condition, which outranks a keyboard-navigation gap.
4. **Within Medium and Low**, findings are pre-clustered into phases by *subsystem*, 1–5 findings per phase depending on coupling and risk. These clusters are a **starting plan, not gospel** — at the start of each Medium/Low phase, read the full text of every finding assigned to it before finalizing scope; split or merge as reality dictates and note the deviation in the tracker.
5. **Docs-correction and README-sync work is deliberately scheduled last** — no point correcting documentation before the behavior it describes has stopped changing.
6. **Final phases** re-run a compressed version of the Phase-1 audit methodology against the *fixed* codebase, then do one last full docs/README sync, then close out.

Use this locator convention: to find a finding's full entry,
`Select-String -Path ATTENDANCE_HUB_AUDIT_FINDINGS.md -Pattern "<first 8–10 words of the title fragment>"`

---

### 4.1 Foundational phases (must run first, in order)

| Phase | Name | Scope |
|---|---|---|
| 0 | Ground Truth Recon | No code changes. Confirm correct branch, clean working tree, no stray changes. Record environment facts: pnpm version, Node version, whether a local Supabase instance/Docker is available, contents of `.env.local` variable *names only* (never values — Rule 12). Run the full existing verification suite fresh (`pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run build`) and record baseline results — there is currently **no test runner installed**, which is itself a recorded fact driving Phase 2. Create `ATTENDANCE_HUB_FIX_LOG.md` with the initial content in §6. |
| 1 | Paranoid Read-Only Audit | Produce `ATTENDANCE_HUB_AUDIT_FINDINGS.md` from scratch: a systematic adversarial audit of every subsystem listed in §5, using the severity scheme (Critical / High / Medium / Low) and per-finding format (title, location file:line, evidence, impact, confidence, suggested fix direction — direction only). Cover at minimum: Supabase auth flows & middleware route protection; RLS policies vs actual client queries (role escalation, cross-branch leakage); secrets/config hygiene; the Dexie→Supabase sync engine (conflict handling, retries, idempotency, partial-failure); CSV/XLSX import parsing (malformed input, formula injection on export); data-integrity constraints vs app assumptions; input validation coverage (zod schemas vs reality); frontend accessibility; performance (N+1 query patterns, virtualization, bundle size); error handling honesty (silent catches, fabricated UI states). Commit the audit file. This phase edits **nothing** else. |
| 2 | Test-Harness Foundation | Install and configure **Vitest** (+ `@testing-library/react`, `jsdom`, `@vitest/coverage-v8` as needed) with pnpm. Add `test` scripts to `package.json`. Wire the harness so Phase 3+ can write failing-first tests: unit tests for pure lib functions, component tests with a mocked `supabase-js` client, and a pattern for testing Dexie logic against `fake-indexeddb`. Prove the harness works with a handful of smoke tests over existing critical pure functions (attendance calculation, CSV parsing helpers). Update `README.md` dev instructions. |

### 4.2 Critical/High-severity phases (order set at the start of Phase 3 from the actual audit output)

The exact finding assignments below are **placeholders to be finalized immediately after Phase 1**, mapped onto whatever the audit actually found. The subsystem arcs are fixed; the finding fragments inside them come from the audit file:

| Phase | Arc | Notes |
|---|---|---|
| 3 | Auth & Session Security | Login/register/forgot-password/change-password flows, `(auth)` route protection, middleware, session refresh, role derivation. Whatever Critical/High auth findings exist land here. |
| 4 | Supabase RLS & Database Security | Reconcile `002_rls_policies.sql` through `020_*` against every actual query in `src/lib/supabase/` and page-level fetches: privilege escalation, cross-branch/cross-department data leakage, recursion-prone policies, missing policies, service-key misuse. Fixes ship as **new append-only migrations** continuing past `020`. |
| 5 | Secrets & Config Hygiene | `.env.local` variable usage, `NEXT_PUBLIC_` exposure review, Gemini API key handling, anything sensitive reachable from the client bundle. |
| 6 | Sync Engine Correctness (Dexie ↔ Supabase) | Conflict resolution, partial-failure mid-sync, retry/idempotency (does a retried sync double-write attendance?), clock skew, kill-mid-sync recovery, queue growth unboundedness. Real concurrency tests where feasible. |
| 7 | Data Integrity & Write Concurrency | Migration constraints vs app assumptions (unique student-per-section, assignment exclusivity, orphaned rows), double-submit/duplicate attendance races, optimistic-UI rollback correctness. |
| 8 | Import/Export Robustness | papaparse/xlsx parsing of malformed/hostile files, header mismatches, huge files, export correctness (jszip/PDF/XLSX), CSV/formula injection in exports. |
| 9 | Input Validation & Error Honesty | zod schema coverage vs actual API/DB writes, silent catch blocks, fabricated/hardcoded UI states presented as real data. |
| 10 | README/Docs Claims vs Measured Behavior | Only now that behavior is fixed: reconcile `README.md` and any docs against freshly verified behavior. Any remaining High doc-contradiction findings close here. |

### 4.3 Medium-severity phases (Phases 11–17, clusters finalized post-audit)

| Phase | Cluster arc |
|---|---|
| 11 | Query performance & scalability: N+1 Supabase fetch patterns, missing pagination, virtualization gaps, expensive recomputation on render |
| 12 | Frontend accessibility I: core navigation, tables, forms, dialogs — keyboard operability, ARIA, focus management |
| 13 | Frontend accessibility II + UX honesty: empty/loading/error states, destructive-action confirmations, prefers-reduced-motion |
| 14 | State management & hooks robustness: Zustand store invariants, stale-closure bugs, effect cleanup, Dexie live-query subscription leaks |
| 15 | Backup/restore & activity-log correctness: backup completeness, restore safety, activity-log truncation/tampering resistance |
| 16 | Test-quality fixes: tautological/vacuous assertions introduced since Phase 2, non-hermetic tests, tests codifying defective behavior as expected (run after the relevant behavior fixes landed) |
| 17 | Remaining Medium docs/UI-text contradictions |

### 4.4 Low-severity sweeps (Phases 18–22)

Low findings are batched more aggressively (narrow blast radius), but every single one still goes through the full Gauntlet Loop — "Low severity" describes impact, not the rigor owed to it.

| Phase | Sweep |
|---|---|
| 18 | Backend/lib low-severity correctness (whitespace-only names passing validation, NaN/Infinity propagation, inconsistent date/timezone handling, dead code paths) |
| 19 | Detection-free zone — frontend low-severity UX/a11y polish sweep |
| 20 | Ops/tooling sweep: eslint config strictness gaps, tsconfig strictness flags worth enabling, script hygiene, dependency pinning |
| 21 | CI foundation: add a GitHub Actions workflow running lint + tsc + test + build on PRs to main (this is the natural home once the suite exists), pinned actions, dependency-audit gate |
| 22 | Final low-severity docs/text sweep (all remaining doc-only findings) |

### 4.5 Final phases (Phases 23–25)

| Phase | Name | Scope |
|---|---|---|
| 23 | Compressed Re-Audit | Re-run a condensed version of the Phase-1 adversarial methodology against the now-fixed codebase — spot-check every fixed subsystem, hunt regressions, plus fresh adversarial input on the heaviest-changed areas (RLS, sync engine, import/export). May re-open a finding: if so, log it in `ATTENDANCE_HUB_FIX_LOG.md` as a new finding needing its own future phase — do **not** patch inline. |
| 24 | Final Docs/README Sync | One last full pass reconciling `README.md` and all docs against the fully-fixed, fully-re-audited codebase — verified fresh, not copied from phase notes. |
| 25 | Closing Report | Full verification suite one final time, all counts recorded, tracker marked fully Complete, closing summary written into the log: total findings closed, any deliberately left open with justification, overall confidence assessment. |

---

## 5. SUBSYSTEM MAP (what Phase 1's audit must cover — verify against reality, don't trust this map blindly)

- `src/app/(auth)/` — login, register, forgot-password, change-password; session/route protection
- `src/app/(dashboard)/` — dashboard, attendance, students, teachers, subjects, sections, departments, branches, specialisations, cr-management, activity-logs, backup, export, settings, sync
- `src/components/` — layout shell, providers, shared components, shadcn/Base UI primitives
- `src/hooks/`, `src/lib/stores/` (Zustand), `src/lib/utils/`
- `src/lib/db/` — Dexie schema, offline cache, sync engine
- `src/lib/supabase/` — client factories, typed queries
- `src/lib/types/`, `src/lib/constants/`
- `supabase/migrations/001…020` — schema, RLS policies, functions, hardening, indexes
- Import/export surface — papaparse, xlsx, jszip, @react-pdf/renderer
- `reset_database.sql`, `next.config.mjs`, eslint/tsconfig configs, `.env.local` (names only)

---

## 6. THE KICKOFF PROMPT (reusable template — paste into a new chat to start/continue any phase)

```
Before anything else: check whether C:\Users\mrrat\Videos\Attendance-Hub\ATTENDANCE_HUB_FIX_LOG.md exists yet.

- If it does NOT exist yet (this is the very first-ever run of this effort, i.e. Phase 0):
  confirm you're on the correct branch and the checkout is otherwise as expected (clean working
  tree, no stray uncommitted changes from something else). If anything looks wrong, STOP and tell
  me immediately. Otherwise, proceed straight to "read the files."
- If it DOES exist: confirm via `git log --oneline` that every commit ATTENDANCE_HUB_FIX_LOG.md's
  progress tracker claims as done is actually present in this checkout (same checkout, never reset
  since the effort began). If any commits are missing, STOP and tell me immediately — do not
  proceed or re-do work silently.

Once that check passes, read these files COMPLETELY, start to finish, not skimmed and not partial
— each one in full before moving to the next (skip any that don't exist yet):
1. C:\Users\mrrat\Videos\Attendance-Hub\ATTENDANCE_HUB_PARANOID_FIX_PROTOCOL.md — every rule applies
   to this phase, not just the ones that seem relevant at a glance.
2. C:\Users\mrrat\Videos\Attendance-Hub\ATTENDANCE_HUB_AUDIT_FINDINGS.md — the full file, not just
   the section for this phase's finding(s). Findings interact; you need the whole picture.
3. C:\Users\mrrat\Videos\Attendance-Hub\ATTENDANCE_HUB_FIX_LOG.md — the full history of what every
   prior phase already fixed, why, and how it was proven, plus the progress tracker showing which
   phase is next. (If it does not exist yet, this is Phase 0 — create it per §6 of the protocol.)

Execute the next incomplete phase now, following every rule in the protocol file exactly — the full
Gauntlet Loop (re-verify, root-cause, enumerate every edge case, design, implement, test, full
verification, iterate, log) for every finding in scope. No scope creep. No feature additions. No
history rewriting. Full verification suite (pnpm run lint, pnpm exec tsc --noEmit, pnpm run test,
pnpm run build) must be green before you're done, not just your new tests. Never touch the
production Supabase project from tests.

When the phase is fully done: update the progress tracker and append your entry/entries to
ATTENDANCE_HUB_FIX_LOG.md, commit (do not push), then output the next kickoff prompt for me to use,
then stop.
```

(For Phase 0 specifically, on the very first-ever run: after the branch/clean-tree check above passes, create `ATTENDANCE_HUB_FIX_LOG.md` with the initial content in §7 before starting Phase 0's actual work.)

---

## 7. INITIAL STATE OF `ATTENDANCE_HUB_FIX_LOG.md` (create with exactly this content if it does not yet exist)

```markdown
# Attendance-Hub Fix Log — Implementation Progress

Source of truth for *what's wrong*: ATTENDANCE_HUB_AUDIT_FINDINGS.md (created in Phase 1; read-only afterward).
Source of truth for *how it's being fixed*: this file.

## Progress Tracker

| Phase | Name | Status | Session Date | Commit |
|---|---|---|---|---|
| 0 | Ground Truth Recon | Not started | | |
| 1 | Paranoid Read-Only Audit | Not started | | |
| 2 | Test-Harness Foundation (Vitest) | Not started | | |
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
*(filled in during Phase 0 — fresh baseline lint/tsc/build results, environment confirmation, branch/checkout sanity confirmed)*

## Finding-to-Phase Map
*(filled in at the start of Phase 3 — maps each finding ID from ATTENDANCE_HUB_AUDIT_FINDINGS.md to its assigned phase, replacing the placeholder arcs)*

## New Leads Observed (Not Yet In Scope)
*(anything spotted during a phase that isn't already a finding in ATTENDANCE_HUB_AUDIT_FINDINGS.md — logged here, not acted on, until a future phase is explicitly planned for it)*

---

## Entries

*(audit notes and fix-log entries appended here per phase, using the exact format defined in ATTENDANCE_HUB_PARANOID_FIX_PROTOCOL.md Section 3)*
```

---

## 8. A NOTE ON DISCIPLINE

The single biggest failure mode for an effort like this is declaring victory early: patching the symptom the audit described, watching the one obvious reproduction case go green, and moving on without ever enumerating the edge cases that made the original bug possible in the first place. A sync conflict resolved for two racing clients but not three, an RLS policy tightened for teachers but left open for CRs, a CSV parser hardened against wrong headers but not against a 50MB file with a billion empty rows — these are not fixes, they are the same bug wearing a disguise that will resurface the next time someone runs an adversarial pass. The Gauntlet Loop in §2 exists specifically to make that shortcut structurally harder to take. Depth over speed, every phase, every finding — the 26-phase structure exists so that depth never has to compete with a shrinking context window.
