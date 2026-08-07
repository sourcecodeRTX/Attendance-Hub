-- Database hardening and performance follow-up
-- 1) Domain-level uniqueness constraints
-- 2) Missing FK/helper indexes flagged by advisors
-- 3) Function search_path hardening

-- ---------------------------------------------------------------------
-- Unique constraints (idempotent)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_university_staff_unique'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_university_staff_unique
      UNIQUE (university_id, staff_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_section_roll_unique'
      AND conrelid = 'public.students'::regclass
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_section_roll_unique
      UNIQUE (section_id, roll_number);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Indexes (idempotent)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_department_id
  ON public.attendance_sessions (department_id);

CREATE INDEX IF NOT EXISTS idx_branches_university_id
  ON public.branches (university_id);

CREATE INDEX IF NOT EXISTS idx_branches_created_by
  ON public.branches (created_by);

CREATE INDEX IF NOT EXISTS idx_departments_admin_id
  ON public.departments (admin_id);

CREATE INDEX IF NOT EXISTS idx_departments_created_by
  ON public.departments (created_by);

CREATE INDEX IF NOT EXISTS idx_sections_branch_id
  ON public.sections (branch_id);

CREATE INDEX IF NOT EXISTS idx_sections_created_by
  ON public.sections (created_by);

CREATE INDEX IF NOT EXISTS idx_sections_primary_teacher_id
  ON public.sections (primary_teacher_id);

CREATE INDEX IF NOT EXISTS idx_sections_specialisation_id
  ON public.sections (specialisation_id);

CREATE INDEX IF NOT EXISTS idx_sections_university_id
  ON public.sections (university_id);

CREATE INDEX IF NOT EXISTS idx_specialisations_department_id
  ON public.specialisations (department_id);

CREATE INDEX IF NOT EXISTS idx_specialisations_university_id
  ON public.specialisations (university_id);

CREATE INDEX IF NOT EXISTS idx_specialisations_created_by
  ON public.specialisations (created_by);

CREATE INDEX IF NOT EXISTS idx_students_branch_id
  ON public.students (branch_id);

CREATE INDEX IF NOT EXISTS idx_students_department_id
  ON public.students (department_id);

CREATE INDEX IF NOT EXISTS idx_students_specialisation_id
  ON public.students (specialisation_id);

CREATE INDEX IF NOT EXISTS idx_users_department_id
  ON public.users (department_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);

-- ---------------------------------------------------------------------
-- Function search_path hardening
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_period_number(
  p_subject_id uuid,
  p_date date
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(MAX(period_number), 0) + 1
  FROM public.attendance_sessions
  WHERE subject_id = p_subject_id AND date = p_date
$$;

CREATE OR REPLACE FUNCTION public.auth_user_university_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT university_id FROM public.users WHERE id = auth.uid()
$$;
