-- Migration 014: Add unique constraint for teacher-subject-section assignments
-- Enforces section exclusivity: no two teachers can be assigned same section for same subject

-- Add unique constraint to prevent duplicate assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subjects_unique_assignment 
ON user_subjects(subject_id, section_id)
WHERE subject_id IS NOT NULL AND section_id IS NOT NULL;

-- Add comment
COMMENT ON INDEX idx_user_subjects_unique_assignment IS 'Enforces section exclusivity - prevents multiple teachers from being assigned to same subject-section combination';
