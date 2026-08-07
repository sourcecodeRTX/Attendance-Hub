-- Migration 012: Migrate existing subject-section relationships
-- Copies all existing subjects.section_id data to subject_sections junction table
-- This preserves all existing relationships before we drop the column

-- Migrate existing data
INSERT INTO subject_sections (id, subject_id, section_id, created_at, created_by)
SELECT 
  gen_random_uuid() as id,
  s.id as subject_id,
  s.section_id,
  s.created_at,
  s.created_by
FROM subjects s
WHERE s.section_id IS NOT NULL
ON CONFLICT (subject_id, section_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE subject_sections IS 'Migrated existing subject-section relationships from subjects.section_id';
