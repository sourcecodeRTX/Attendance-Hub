-- Fix RLS policy for attendance_sessions to allow primary_teacher role
-- to manage attendance in sections where they are assigned as regular teachers
-- via user_subjects (not just user_sections).
--
-- Previously, primary_teacher users could ONLY manage attendance in their
-- primary section (via user_sections). If a primary_teacher was also assigned
-- as a regular teacher in another section (via user_subjects), they were blocked
-- by RLS because the regular_teacher_manage_attendance policy only checked
-- for get_my_role() = 'regular_teacher'.

DROP POLICY IF EXISTS regular_teacher_manage_attendance ON attendance_sessions;

CREATE POLICY regular_teacher_manage_attendance ON attendance_sessions FOR ALL USING (
  (university_id = get_my_university_id())
  AND (get_my_role() IN ('regular_teacher', 'primary_teacher'))
  AND (subject_id IN (
    SELECT user_subjects.subject_id
    FROM user_subjects
    WHERE user_subjects.user_id = (SELECT auth.uid())
  ))
  AND (section_id IN (
    SELECT user_subjects.section_id
    FROM user_subjects
    WHERE user_subjects.user_id = (SELECT auth.uid())
  ))
);
