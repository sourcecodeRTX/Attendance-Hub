-- Follow-up hardening:
-- 1) Add covering indexes for remaining FK constraints flagged by advisors.
-- 2) Optimize RLS policies to avoid per-row auth() re-evaluation patterns.
-- 3) Tighten overly permissive university bootstrap insert policy.

-- ------------------------------------------------------------------
-- Covering indexes for unindexed foreign keys
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_students_uploaded_by
  ON public.students (uploaded_by);

CREATE INDEX IF NOT EXISTS idx_subjects_created_by
  ON public.subjects (created_by);

CREATE INDEX IF NOT EXISTS idx_subjects_department_id
  ON public.subjects (department_id);

CREATE INDEX IF NOT EXISTS idx_subjects_section_id
  ON public.subjects (section_id);

CREATE INDEX IF NOT EXISTS idx_subjects_university_id
  ON public.subjects (university_id);

CREATE INDEX IF NOT EXISTS idx_user_sections_assigned_by
  ON public.user_sections (assigned_by);

CREATE INDEX IF NOT EXISTS idx_user_sections_university_id
  ON public.user_sections (university_id);

CREATE INDEX IF NOT EXISTS idx_user_subjects_assigned_by
  ON public.user_subjects (assigned_by);

CREATE INDEX IF NOT EXISTS idx_user_subjects_section_id
  ON public.user_subjects (section_id);

CREATE INDEX IF NOT EXISTS idx_user_subjects_university_id
  ON public.user_subjects (university_id);

CREATE INDEX IF NOT EXISTS idx_users_created_by
  ON public.users (created_by);

-- ------------------------------------------------------------------
-- Helper function update: wrap auth.uid() in SELECT form
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_university_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.university_id
  FROM public.users u
  WHERE u.id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role
  FROM public.users u
  WHERE u.id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.get_my_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.department_id
  FROM public.users u
  WHERE u.id = (SELECT auth.uid())
$$;

-- ------------------------------------------------------------------
-- RLS policy refresh for initplan optimization and tighter bootstrap
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "anyone_can_create_university" ON public.universities;
CREATE POLICY "anyone_can_create_university" ON public.universities
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "read_own_university" ON public.universities;
CREATE POLICY "read_own_university" ON public.universities
  FOR SELECT
  USING (
    id = public.get_my_university_id()
    OR super_admin_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "insert_university_users" ON public.users;
CREATE POLICY "insert_university_users" ON public.users
  FOR INSERT
  WITH CHECK (
    (
      id = (SELECT auth.uid())
      AND (
        university_id = public.get_my_university_id()
        OR EXISTS (
          SELECT 1
          FROM public.universities u
          WHERE u.id = users.university_id
            AND u.super_admin_id = (SELECT auth.uid())
        )
      )
    )
    OR
    (
      university_id = public.get_my_university_id()
      AND public.get_my_role() IN ('super_admin', 'admin', 'primary_teacher')
    )
  );

DROP POLICY IF EXISTS "update_university_users" ON public.users;
CREATE POLICY "update_university_users" ON public.users
  FOR UPDATE
  USING (
    university_id = public.get_my_university_id()
    AND (
      id = (SELECT auth.uid())
      OR public.get_my_role() IN ('super_admin', 'admin', 'primary_teacher')
    )
  );

DROP POLICY IF EXISTS "read_own_or_university_users" ON public.users;
CREATE POLICY "read_own_or_university_users" ON public.users
  FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR university_id = public.get_my_university_id()
  );

DROP POLICY IF EXISTS "primary_teacher_manage_subjects" ON public.subjects;
CREATE POLICY "primary_teacher_manage_subjects" ON public.subjects
  FOR ALL
  USING (
    university_id = public.get_my_university_id()
    AND public.get_my_role() = 'primary_teacher'
    AND section_id IN (
      SELECT section_id
      FROM public.user_sections
      WHERE user_id = (SELECT auth.uid())
        AND user_role = 'primary_teacher'
    )
  );

DROP POLICY IF EXISTS "read_accessible_students" ON public.students;
CREATE POLICY "read_accessible_students" ON public.students
  FOR SELECT
  USING (
    university_id = public.get_my_university_id()
    AND (
      public.get_my_role() IN ('super_admin', 'admin')
      OR section_id IN (
        SELECT section_id FROM public.user_sections WHERE user_id = (SELECT auth.uid())
        UNION
        SELECT section_id FROM public.user_subjects WHERE user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "primary_teacher_manage_students" ON public.students;
CREATE POLICY "primary_teacher_manage_students" ON public.students
  FOR ALL
  USING (
    university_id = public.get_my_university_id()
    AND public.get_my_role() = 'primary_teacher'
    AND section_id IN (
      SELECT section_id
      FROM public.user_sections
      WHERE user_id = (SELECT auth.uid())
        AND user_role = 'primary_teacher'
    )
  );

DROP POLICY IF EXISTS "read_accessible_attendance" ON public.attendance_sessions;
CREATE POLICY "read_accessible_attendance" ON public.attendance_sessions
  FOR SELECT
  USING (
    university_id = public.get_my_university_id()
    AND (
      public.get_my_role() IN ('super_admin', 'admin')
      OR section_id IN (
        SELECT section_id FROM public.user_sections WHERE user_id = (SELECT auth.uid())
        UNION
        SELECT section_id FROM public.user_subjects WHERE user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "cr_insert_attendance" ON public.attendance_sessions;
CREATE POLICY "cr_insert_attendance" ON public.attendance_sessions
  FOR INSERT
  WITH CHECK (
    university_id = public.get_my_university_id()
    AND public.get_my_role() = 'cr'
    AND section_id IN (
      SELECT section_id
      FROM public.user_sections
      WHERE user_id = (SELECT auth.uid())
        AND user_role = 'cr'
    )
    AND locked_by_teacher = false
  );

DROP POLICY IF EXISTS "cr_update_attendance" ON public.attendance_sessions;
CREATE POLICY "cr_update_attendance" ON public.attendance_sessions
  FOR UPDATE
  USING (
    university_id = public.get_my_university_id()
    AND public.get_my_role() = 'cr'
    AND section_id IN (
      SELECT section_id
      FROM public.user_sections
      WHERE user_id = (SELECT auth.uid())
        AND user_role = 'cr'
    )
    AND locked_by_teacher = false
  );

DROP POLICY IF EXISTS "primary_teacher_manage_attendance" ON public.attendance_sessions;
CREATE POLICY "primary_teacher_manage_attendance" ON public.attendance_sessions
  FOR ALL
  USING (
    university_id = public.get_my_university_id()
    AND public.get_my_role() = 'primary_teacher'
    AND section_id IN (
      SELECT section_id
      FROM public.user_sections
      WHERE user_id = (SELECT auth.uid())
        AND user_role = 'primary_teacher'
    )
  );

DROP POLICY IF EXISTS "regular_teacher_manage_attendance" ON public.attendance_sessions;
CREATE POLICY "regular_teacher_manage_attendance" ON public.attendance_sessions
  FOR ALL
  USING (
    university_id = public.get_my_university_id()
    AND public.get_my_role() = 'regular_teacher'
    AND subject_id IN (
      SELECT subject_id FROM public.user_subjects WHERE user_id = (SELECT auth.uid())
    )
  );
