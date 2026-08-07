-- Migration 011: Create subject_sections junction table
-- This enables many-to-many relationship between subjects and sections
-- Breaking change: Prepares for removal of subjects.section_id

-- Create the junction table
CREATE TABLE IF NOT EXISTS subject_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES users(id),
  
  -- Prevent duplicate subject-section links
  UNIQUE(subject_id, section_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subject_sections_subject_id ON subject_sections(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_sections_section_id ON subject_sections(section_id);
CREATE INDEX IF NOT EXISTS idx_subject_sections_created_by ON subject_sections(created_by);

-- Add RLS policies
ALTER TABLE subject_sections ENABLE ROW LEVEL SECURITY;

-- Users can view subject_sections from their university
CREATE POLICY "Users can view subject_sections from their university"
  ON subject_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subjects s
      JOIN users u ON u.id = auth.uid()
      WHERE s.id = subject_sections.subject_id
        AND s.university_id = u.university_id
    )
  );

-- Admins can insert subject_sections
CREATE POLICY "Admins can insert subject_sections"
  ON subject_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
        AND u.university_id = (
          SELECT university_id FROM subjects WHERE id = subject_sections.subject_id
        )
    )
  );

-- Admins can delete subject_sections
CREATE POLICY "Admins can delete subject_sections"
  ON subject_sections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
        AND u.university_id = (
          SELECT university_id FROM subjects WHERE id = subject_sections.subject_id
        )
    )
  );

-- Add comment
COMMENT ON TABLE subject_sections IS 'Junction table linking subjects to multiple sections (many-to-many relationship)';
