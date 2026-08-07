-- =====================================================================
-- Migration: Fix RLS Infinite Recursion on subjects and subject_sections
-- Issue: 42P17 infinite recursion detected in policy
-- Root Cause: 
--   - subjects.primary_teacher_manage_subjects queries subject_sections
--   - subject_sections policies query subjects to get university_id
--   - This creates a circular dependency causing infinite recursion
-- Solution:
--   1. Create SECURITY DEFINER helper functions to bypass RLS
--   2. Rewrite policies to use these helper functions
-- =====================================================================

-- =====================================================================
-- Step 1: Create SECURITY DEFINER helper functions
-- These bypass RLS to prevent recursion
-- =====================================================================

-- Function to check if user is a primary teacher for a subject
-- This is used by subjects RLS without triggering subject_sections RLS
CREATE OR REPLACE FUNCTION public.is_primary_teacher_for_subject(p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM subject_sections ss
    JOIN user_sections us ON us.section_id = ss.section_id
    WHERE ss.subject_id = p_subject_id
      AND us.user_id = auth.uid()
      AND us.user_role = 'primary_teacher'
  );
$$;

-- Function to get university_id for a subject (bypasses subjects RLS)
-- This is used by subject_sections RLS without triggering subjects RLS
CREATE OR REPLACE FUNCTION public.get_subject_university_id(p_subject_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT university_id FROM subjects WHERE id = p_subject_id;
$$;

-- Function to check if user can access subject_sections for a given subject
CREATE OR REPLACE FUNCTION public.can_access_subject_section(p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM subjects s
    JOIN users u ON u.id = auth.uid()
    WHERE s.id = p_subject_id
      AND s.university_id = u.university_id
  );
$$;

-- =====================================================================
-- Step 2: Drop existing problematic policies on subjects
-- =====================================================================

DROP POLICY IF EXISTS "primary_teacher_manage_subjects" ON subjects;

-- =====================================================================
-- Step 3: Create new non-recursive policy for subjects
-- Uses helper function instead of direct subquery to subject_sections
-- =====================================================================

CREATE POLICY "primary_teacher_manage_subjects"
  ON subjects FOR ALL
  USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'primary_teacher'
    AND is_primary_teacher_for_subject(id)
  )
  WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'primary_teacher'
    AND is_primary_teacher_for_subject(id)
  );

-- =====================================================================
-- Step 4: Drop and recreate subject_sections policies
-- Use helper functions to avoid querying subjects table directly
-- =====================================================================

DROP POLICY IF EXISTS "Users can view subject_sections from their university" ON subject_sections;
DROP POLICY IF EXISTS "Admins can insert subject_sections" ON subject_sections;
DROP POLICY IF EXISTS "Admins can delete subject_sections" ON subject_sections;

-- SELECT policy: Users can view subject_sections from their university
CREATE POLICY "subject_sections_select"
  ON subject_sections FOR SELECT
  USING (
    can_access_subject_section(subject_id)
  );

-- INSERT policy: Admins can insert subject_sections
CREATE POLICY "subject_sections_insert"
  ON subject_sections FOR INSERT
  WITH CHECK (
    get_my_role() IN ('admin', 'super_admin')
    AND get_subject_university_id(subject_id) = get_my_university_id()
  );

-- UPDATE policy: Admins can update subject_sections
CREATE POLICY "subject_sections_update"
  ON subject_sections FOR UPDATE
  USING (
    get_my_role() IN ('admin', 'super_admin')
    AND get_subject_university_id(subject_id) = get_my_university_id()
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'super_admin')
    AND get_subject_university_id(subject_id) = get_my_university_id()
  );

-- DELETE policy: Admins can delete subject_sections
CREATE POLICY "subject_sections_delete"
  ON subject_sections FOR DELETE
  USING (
    get_my_role() IN ('admin', 'super_admin')
    AND get_subject_university_id(subject_id) = get_my_university_id()
  );

-- =====================================================================
-- Step 5: Add primary_teacher write access to subject_sections
-- Primary teachers should be able to manage sections for their subjects
-- =====================================================================

CREATE POLICY "subject_sections_primary_teacher_insert"
  ON subject_sections FOR INSERT
  WITH CHECK (
    get_my_role() = 'primary_teacher'
    AND get_subject_university_id(subject_id) = get_my_university_id()
    AND is_primary_teacher_for_subject(subject_id)
  );

CREATE POLICY "subject_sections_primary_teacher_delete"
  ON subject_sections FOR DELETE
  USING (
    get_my_role() = 'primary_teacher'
    AND get_subject_university_id(subject_id) = get_my_university_id()
    AND is_primary_teacher_for_subject(subject_id)
  );
