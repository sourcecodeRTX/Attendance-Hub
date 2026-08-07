-- ============================================
-- Migration: 009_fix_rls_policies_comprehensive
-- Date: 2026-03-26
-- Purpose: Fix RLS policies to allow proper access for all roles
-- ============================================

-- ============================================
-- 1. FIX user_subjects TABLE
-- Problem: Only admin could manage, but super_admin and primary_teacher also need access
-- Solution: Replace restrictive policy with comprehensive one
-- ============================================

DROP POLICY IF EXISTS "admin_manage_user_subjects" ON public.user_subjects;

CREATE POLICY "privileged_manage_user_subjects" ON public.user_subjects
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() IN ('super_admin', 'admin', 'primary_teacher')
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() IN ('super_admin', 'admin', 'primary_teacher')
);

-- ============================================
-- 2. FIX subjects TABLE
-- Problem: Only primary_teacher could manage
-- Solution: Add super_admin and admin (department-scoped) access
-- ============================================

CREATE POLICY "super_admin_manage_subjects" ON public.subjects
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
);

CREATE POLICY "admin_manage_subjects" ON public.subjects
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
);

-- ============================================
-- 3. FIX students TABLE
-- Problem: Only primary_teacher could manage students
-- Solution: Add super_admin and admin (department-scoped) access
-- ============================================

CREATE POLICY "super_admin_manage_students" ON public.students
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
);

CREATE POLICY "admin_manage_students" ON public.students
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
);

-- ============================================
-- 4. FIX attendance_sessions TABLE
-- Problem: super_admin/admin could only READ, not write
-- Solution: Add write access for super_admin and admin (department-scoped)
-- ============================================

CREATE POLICY "super_admin_manage_attendance" ON public.attendance_sessions
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
);

CREATE POLICY "admin_manage_attendance" ON public.attendance_sessions
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
);

-- ============================================
-- 5. FIX branches TABLE
-- Problem: super_admin couldn't manage branches across all departments
-- Solution: Add super_admin full access
-- ============================================

CREATE POLICY "super_admin_manage_branches" ON public.branches
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
);

-- ============================================
-- 6. FIX specialisations TABLE
-- Problem: super_admin couldn't manage specialisations across all departments
-- Solution: Add super_admin full access
-- ============================================

CREATE POLICY "super_admin_manage_specialisations" ON public.specialisations
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
);

-- ============================================
-- 7. FIX sections TABLE
-- Problem: super_admin couldn't manage sections across all departments
-- Solution: Add super_admin full access
-- ============================================

CREATE POLICY "super_admin_manage_sections" ON public.sections
FOR ALL
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
)
WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
);

-- ============================================
-- 8. FIX activity_logs TABLE
-- Problem: super_admin cannot delete old logs for cleanup
-- Solution: Add DELETE policy for super_admin
-- ============================================

CREATE POLICY "super_admin_delete_logs" ON public.activity_logs
FOR DELETE
USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
);
