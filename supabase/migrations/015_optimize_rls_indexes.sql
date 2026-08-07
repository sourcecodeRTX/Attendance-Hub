-- =====================================================================
-- Migration: Optimize RLS Policy Performance
-- Description: Add indexes to improve JOIN performance in RLS policies
-- Created: 2024
-- =====================================================================
--
-- This migration creates indexes on foreign key columns and composite
-- columns that are frequently used in RLS policy checks. These indexes
-- significantly improve the performance of JOIN operations when the
-- database evaluates row-level security policies.
--
-- Performance Impact:
-- - Reduces query execution time for RLS policy evaluation
-- - Improves response times for authenticated user queries
-- - Optimizes teacher and student access pattern lookups
-- =====================================================================

-- =====================================================================
-- Subject Sections Indexes
-- =====================================================================

-- Index on subject_sections(subject_id)
-- Benefits: RLS policies that check subject ownership/access
-- Used by: Policies filtering sections by subject access
CREATE INDEX IF NOT EXISTS idx_subject_sections_subject_id
ON subject_sections(subject_id);

-- Index on subject_sections(section_id)
-- Benefits: RLS policies that join sections to check subject access
-- Used by: Policies filtering subjects by section membership
CREATE INDEX IF NOT EXISTS idx_subject_sections_section_id
ON subject_sections(section_id);

-- =====================================================================
-- User Sections Indexes
-- =====================================================================

-- Composite index on user_sections(user_id, section_id)
-- Benefits: Primary teacher and student membership lookups
-- Used by: Policies checking if user is assigned to a section
-- Covers queries: WHERE user_id = X AND section_id = Y
CREATE INDEX IF NOT EXISTS idx_user_sections_user_section
ON user_sections(user_id, section_id);

-- Composite index on user_sections(section_id, user_role)
-- Benefits: Role-based section access filtering
-- Used by: Policies checking section membership by role (teacher/student)
-- Covers queries: WHERE section_id = X AND user_role = 'teacher'
CREATE INDEX IF NOT EXISTS idx_user_sections_section_role
ON user_sections(section_id, user_role);

-- Index on user_sections(user_id) for reverse lookups
-- Benefits: Finding all sections for a specific user
-- Used by: Policies that need to list all user's sections
CREATE INDEX IF NOT EXISTS idx_user_sections_user_id
ON user_sections(user_id);

-- =====================================================================
-- User Subjects Indexes
-- =====================================================================

-- Composite index on user_subjects(user_id, subject_id)
-- Benefits: Teacher subject assignment checks
-- Used by: Policies verifying if a teacher is assigned to a subject
-- Covers queries: WHERE user_id = X AND subject_id = Y
CREATE INDEX IF NOT EXISTS idx_user_subjects_user_subject
ON user_subjects(user_id, subject_id);

-- Index on user_subjects(subject_id) for reverse lookups
-- Benefits: Finding all teachers assigned to a subject
-- Used by: Policies that check subject instructor lists
CREATE INDEX IF NOT EXISTS idx_user_subjects_subject_id
ON user_subjects(subject_id);

-- =====================================================================
-- Subjects Indexes
-- =====================================================================

-- Composite index on subjects(university_id, department_id)
-- Benefits: Scoped queries filtering by institution hierarchy
-- Used by: Policies checking subject access within university/department context
-- Covers queries: WHERE university_id = X AND department_id = Y
CREATE INDEX IF NOT EXISTS idx_subjects_university_department
ON subjects(university_id, department_id);

-- Index on subjects(department_id)
-- Benefits: Department-level subject filtering
-- Used by: Policies scoped to department access
CREATE INDEX IF NOT EXISTS idx_subjects_department_id
ON subjects(department_id);

-- Index on subjects(university_id)
-- Benefits: University-level subject filtering
-- Used by: Policies scoped to university access
CREATE INDEX IF NOT EXISTS idx_subjects_university_id
ON subjects(university_id);

-- =====================================================================
-- Additional Performance Indexes
-- =====================================================================

-- Index on sections(department_id)
-- Benefits: Department-level section filtering
-- Used by: Policies scoped to department access
CREATE INDEX IF NOT EXISTS idx_sections_department_id
ON sections(department_id);

-- Index on sections(university_id)
-- Benefits: University-level section filtering
-- Used by: Policies scoped to university access
CREATE INDEX IF NOT EXISTS idx_sections_university_id
ON sections(university_id);

-- Index on attendance_sessions(section_id)
-- Benefits: Section-based attendance queries
-- Used by: Policies filtering attendance sessions by section
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_section_id
ON attendance_sessions(section_id);

-- Index on attendance_sessions(subject_id)
-- Benefits: Subject-based attendance queries
-- Used by: Policies filtering attendance sessions by subject
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_subject_id
ON attendance_sessions(subject_id);

-- =====================================================================
-- Index Verification Query
-- =====================================================================
-- Run this query to verify all indexes were created successfully:
--
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
-- =====================================================================
