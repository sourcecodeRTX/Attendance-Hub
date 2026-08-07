-- Migration 017: Make sections.primary_teacher_id nullable
-- Problem: The column was defined as NOT NULL in 001_initial_schema.sql,
-- but the application allows creating sections without a primary teacher.
-- This causes sync failures when the local Dexie data (with null) is pushed to Supabase.

ALTER TABLE sections ALTER COLUMN primary_teacher_id DROP NOT NULL;

COMMENT ON COLUMN sections.primary_teacher_id IS 'Optional primary teacher assignment. Can be assigned later after section creation.';
