-- Migration 022: server-authoritative revision counter for attendance_sessions
--
-- Audit finding F-010: the offline sync engine resolved concurrent attendance
-- edits by comparing `marked_at` timestamps produced on different devices.
-- Devices with skewed clocks (or ties) silently lost edits. RLS cannot compare
-- rows and client clocks cannot be trusted, so the server now maintains a
-- monotonic per-row revision counter that the sync engine uses as the
-- conflict-resolution ordering instead of wall clocks.

ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.bump_attendance_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_session_revision ON public.attendance_sessions;

CREATE TRIGGER trg_attendance_session_revision
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_attendance_revision();

COMMENT ON COLUMN public.attendance_sessions.revision IS
  'Server-maintained monotonic counter incremented on every UPDATE; used by the offline sync engine for clock-skew-immune conflict resolution.';
