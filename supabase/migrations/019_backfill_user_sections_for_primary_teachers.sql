-- ============================================
-- Migration: 019_backfill_user_sections_for_primary_teachers
-- Date: 2026-08-09
-- Purpose: Backfill user_sections entries for primary teachers who were
--          assigned via sections.primary_teacher_id but never got a
--          user_sections row. This is required for RLS policies that
--          check user_sections for primary_teacher access.
-- ============================================

INSERT INTO user_sections (id, university_id, user_id, section_id, user_role, assigned_at, assigned_by)
SELECT
  gen_random_uuid(),
  s.university_id,
  s.primary_teacher_id,
  s.id,
  'primary_teacher',
  NOW(),
  s.primary_teacher_id
FROM sections s
WHERE s.primary_teacher_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_sections us
    WHERE us.user_id = s.primary_teacher_id
      AND us.section_id = s.id
  );
