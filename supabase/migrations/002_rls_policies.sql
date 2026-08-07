-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: get current user's university_id
-- ============================================
CREATE OR REPLACE FUNCTION get_my_university_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT university_id FROM users WHERE id = auth.uid()
$$;

-- ============================================
-- HELPER FUNCTION: get current user's role
-- ============================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- ============================================
-- HELPER FUNCTION: get current user's department_id
-- ============================================
CREATE OR REPLACE FUNCTION get_my_department_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT department_id FROM users WHERE id = auth.uid()
$$;

-- ============================================
-- UNIVERSITIES TABLE POLICIES
-- ============================================
-- Anyone can insert (register new university)
CREATE POLICY "anyone_can_create_university" ON universities
  FOR INSERT WITH CHECK (true);

-- Users can only read their own university
CREATE POLICY "read_own_university" ON universities
  FOR SELECT USING (id = get_my_university_id());

-- Only super_admin can update their university
CREATE POLICY "super_admin_update_university" ON universities
  FOR UPDATE USING (
    id = get_my_university_id()
    AND get_my_role() = 'super_admin'
  );

-- ============================================
-- USERS TABLE POLICIES
-- ============================================
-- Users can read all users in their university
CREATE POLICY "read_university_users" ON users
  FOR SELECT USING (university_id = get_my_university_id());

-- Users can insert new users (system-level, controlled by app logic)
CREATE POLICY "insert_university_users" ON users
  FOR INSERT WITH CHECK (university_id = get_my_university_id());

-- Users can only update their own record, or admins can update their department's users
CREATE POLICY "update_university_users" ON users
  FOR UPDATE USING (
    university_id = get_my_university_id()
    AND (
      id = auth.uid()  -- own record
      OR get_my_role() IN ('super_admin', 'admin', 'primary_teacher')
    )
  );

-- ============================================
-- DEPARTMENTS TABLE POLICIES
-- ============================================
CREATE POLICY "read_university_departments" ON departments
  FOR SELECT USING (university_id = get_my_university_id());

CREATE POLICY "super_admin_manage_departments" ON departments
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
  );

-- ============================================
-- BRANCHES TABLE POLICIES
-- ============================================
CREATE POLICY "read_university_branches" ON branches
  FOR SELECT USING (university_id = get_my_university_id());

CREATE POLICY "admin_manage_branches" ON branches
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
  );

-- ============================================
-- SPECIALISATIONS TABLE POLICIES
-- ============================================
CREATE POLICY "read_university_specialisations" ON specialisations
  FOR SELECT USING (university_id = get_my_university_id());

CREATE POLICY "admin_manage_specialisations" ON specialisations
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
  );

-- ============================================
-- SECTIONS TABLE POLICIES
-- ============================================
CREATE POLICY "read_university_sections" ON sections
  FOR SELECT USING (university_id = get_my_university_id());

CREATE POLICY "admin_manage_sections" ON sections
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
  );

-- ============================================
-- USER_SECTIONS TABLE POLICIES
-- ============================================
CREATE POLICY "read_user_sections" ON user_sections
  FOR SELECT USING (university_id = get_my_university_id());

CREATE POLICY "manage_user_sections" ON user_sections
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() IN ('super_admin', 'admin', 'primary_teacher')
  );

-- ============================================
-- SUBJECTS TABLE POLICIES
-- ============================================
CREATE POLICY "read_university_subjects" ON subjects
  FOR SELECT USING (university_id = get_my_university_id());

CREATE POLICY "primary_teacher_manage_subjects" ON subjects
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'primary_teacher'
    AND section_id IN (
      SELECT section_id FROM user_sections
      WHERE user_id = auth.uid() AND user_role = 'primary_teacher'
    )
  );

-- ============================================
-- USER_SUBJECTS TABLE POLICIES
-- ============================================
CREATE POLICY "read_user_subjects" ON user_subjects
  FOR SELECT USING (university_id = get_my_university_id());

CREATE POLICY "admin_manage_user_subjects" ON user_subjects
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
  );

-- ============================================
-- STUDENTS TABLE POLICIES
-- ============================================
-- All roles can read students in their accessible sections
CREATE POLICY "read_accessible_students" ON students
  FOR SELECT USING (
    university_id = get_my_university_id()
    AND (
      get_my_role() IN ('super_admin', 'admin')
      OR section_id IN (
        SELECT section_id FROM user_sections WHERE user_id = auth.uid()
        UNION
        SELECT section_id FROM user_subjects WHERE user_id = auth.uid()
      )
    )
  );

-- Only primary_teacher can modify students in their section
CREATE POLICY "primary_teacher_manage_students" ON students
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'primary_teacher'
    AND section_id IN (
      SELECT section_id FROM user_sections
      WHERE user_id = auth.uid() AND user_role = 'primary_teacher'
    )
  );

-- ============================================
-- ATTENDANCE_SESSIONS TABLE POLICIES
-- ============================================
-- Read: all roles can read sessions in their accessible sections/subjects
CREATE POLICY "read_accessible_attendance" ON attendance_sessions
  FOR SELECT USING (
    university_id = get_my_university_id()
    AND (
      get_my_role() IN ('super_admin', 'admin')
      OR section_id IN (
        SELECT section_id FROM user_sections WHERE user_id = auth.uid()
        UNION
        SELECT section_id FROM user_subjects WHERE user_id = auth.uid()
      )
    )
  );

-- CR can insert sessions in their section (only when not locked_by_teacher)
CREATE POLICY "cr_insert_attendance" ON attendance_sessions
  FOR INSERT WITH CHECK (
    university_id = get_my_university_id()
    AND get_my_role() = 'cr'
    AND section_id IN (
      SELECT section_id FROM user_sections
      WHERE user_id = auth.uid() AND user_role = 'cr'
    )
    AND locked_by_teacher = false
  );

-- CR can update sessions in their section (only when not locked_by_teacher)
CREATE POLICY "cr_update_attendance" ON attendance_sessions
  FOR UPDATE USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'cr'
    AND section_id IN (
      SELECT section_id FROM user_sections
      WHERE user_id = auth.uid() AND user_role = 'cr'
    )
    AND locked_by_teacher = false
  );

-- Primary teacher can manage all sessions in their section
CREATE POLICY "primary_teacher_manage_attendance" ON attendance_sessions
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'primary_teacher'
    AND section_id IN (
      SELECT section_id FROM user_sections
      WHERE user_id = auth.uid() AND user_role = 'primary_teacher'
    )
  );

-- Regular teacher can manage sessions for their assigned subjects
CREATE POLICY "regular_teacher_manage_attendance" ON attendance_sessions
  FOR ALL USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'regular_teacher'
    AND subject_id IN (
      SELECT subject_id FROM user_subjects WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- ACTIVITY_LOGS TABLE POLICIES
-- ============================================
-- Super admin reads all logs in their university
CREATE POLICY "super_admin_read_logs" ON activity_logs
  FOR SELECT USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'super_admin'
  );

-- Admin reads logs for their department
CREATE POLICY "admin_read_logs" ON activity_logs
  FOR SELECT USING (
    university_id = get_my_university_id()
    AND get_my_role() = 'admin'
    AND department_id = get_my_department_id()
  );

-- All authenticated users can insert logs
CREATE POLICY "insert_activity_logs" ON activity_logs
  FOR INSERT WITH CHECK (university_id = get_my_university_id());
