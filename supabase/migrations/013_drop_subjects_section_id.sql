-- Migration 013: Remove section_id from subjects table
-- Breaking change: Drops subjects.section_id column after data migration
-- All application code must use subject_sections table instead

-- First, drop the RLS policy that depends on section_id
DROP POLICY IF EXISTS primary_teacher_manage_subjects ON subjects;

-- Recreate the policy using subject_sections junction table instead
CREATE POLICY "primary_teacher_manage_subjects"
  ON subjects FOR ALL
  USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'primary_teacher'
    AND EXISTS (
      SELECT 1 FROM subject_sections ss
      JOIN user_sections us ON us.section_id = ss.section_id
      WHERE ss.subject_id = subjects.id
        AND us.user_id = auth.uid()
        AND us.user_role = 'primary_teacher'
    )
  );

-- Drop the foreign key constraint
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_section_id_fkey;

-- Drop the column
ALTER TABLE subjects DROP COLUMN IF EXISTS section_id;

-- Add comment
COMMENT ON TABLE subjects IS 'Subjects table - section relationships now managed via subject_sections junction table';
