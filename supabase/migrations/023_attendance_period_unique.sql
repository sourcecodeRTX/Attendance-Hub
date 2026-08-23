-- Migration 023: enforce one attendance session per (subject, date, period)
--
-- Audit finding F-016: nothing in the database prevented two rows for the
-- same subject/date/period_number. The client used to converge concurrent
-- creations onto one deterministic composite primary key and silently
-- last-write-win over each other's records. Session ids are now UUIDs, so a
-- genuine same-period race produces two distinct rows — this constraint makes
-- the second insert fail loudly (23505) instead of duplicating data. The
-- sync engine dead-letters the losing item for explicit user resolution.
--
-- Precondition: no existing duplicates. Deterministic composite ids were
-- globally unique before this migration, so duplicates cannot exist unless
-- data was written out-of-band; if this migration fails with a unique
-- violation, deduplicate attendance_sessions manually first.

ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_subject_date_period_unique
  UNIQUE (subject_id, date, period_number);
