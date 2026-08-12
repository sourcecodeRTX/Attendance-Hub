-- ============================================
-- MAKE SPECIALISATION OPTIONAL
-- ============================================

-- Alter sections table
ALTER TABLE sections ALTER COLUMN specialisation_id DROP NOT NULL;

-- Alter students table
ALTER TABLE students ALTER COLUMN specialisation_id DROP NOT NULL;
