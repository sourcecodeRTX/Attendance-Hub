-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- UNIVERSITIES TABLE
-- ============================================
CREATE TABLE universities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  code            text NOT NULL UNIQUE,
  super_admin_id  uuid NOT NULL,
  attendance_threshold  integer NOT NULL DEFAULT 75,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id         uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  role                  text NOT NULL CHECK (role IN ('super_admin','admin','primary_teacher','regular_teacher','cr')),
  full_name             text NOT NULL,
  staff_id              text NOT NULL,
  email                 text NOT NULL,
  department_id         uuid,
  is_active             boolean NOT NULL DEFAULT true,
  must_change_password  boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid
);

-- ============================================
-- DEPARTMENTS TABLE
-- ============================================
CREATE TABLE departments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text NOT NULL,
  admin_id        uuid,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL
);

-- ============================================
-- BRANCHES TABLE
-- ============================================
CREATE TABLE branches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id   uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL
);

-- ============================================
-- SPECIALISATIONS TABLE
-- ============================================
CREATE TABLE specialisations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id   uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  branch_id       uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL
);

-- ============================================
-- SECTIONS TABLE
-- ============================================
CREATE TABLE sections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id       uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id       uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  specialisation_id   uuid NOT NULL REFERENCES specialisations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  primary_teacher_id  uuid NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  is_archived         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid NOT NULL
);

-- ============================================
-- USER_SECTIONS TABLE
-- ============================================
CREATE TABLE user_sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id      uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  user_role       text NOT NULL CHECK (user_role IN ('primary_teacher', 'cr')),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  assigned_by     uuid NOT NULL
);

-- ============================================
-- SUBJECTS TABLE
-- ============================================
CREATE TABLE subjects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id   uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  section_id      uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL
);

-- ============================================
-- USER_SUBJECTS TABLE
-- ============================================
CREATE TABLE user_subjects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section_id      uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  assigned_by     uuid NOT NULL
);

-- ============================================
-- STUDENTS TABLE
-- ============================================
CREATE TABLE students (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id       uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id       uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  specialisation_id   uuid NOT NULL REFERENCES specialisations(id) ON DELETE CASCADE,
  section_id          uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  roll_number         text NOT NULL,
  full_name           text NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  uploaded_by         uuid NOT NULL
);

-- ============================================
-- ATTENDANCE_SESSIONS TABLE
-- ============================================
CREATE TABLE attendance_sessions (
  id                  text PRIMARY KEY,
  university_id       uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id       uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  section_id          uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id          uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  date                date NOT NULL,
  period_number       integer NOT NULL,
  period_label        text,
  records             jsonb NOT NULL DEFAULT '[]',
  locked_by_teacher   boolean NOT NULL DEFAULT false,
  is_archived         boolean NOT NULL DEFAULT false,
  created_by          jsonb NOT NULL,
  last_modified_by    jsonb NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- ACTIVITY_LOGS TABLE
-- ============================================
CREATE TABLE activity_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id       uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id       uuid REFERENCES departments(id) ON DELETE SET NULL,
  action_type         text NOT NULL,
  performed_by_role   text NOT NULL,
  performed_by_name   text NOT NULL,
  performed_by_id     uuid NOT NULL,
  target_name         text,
  section_name        text,
  branch_name         text,
  department_name     text,
  details             jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
CREATE INDEX idx_attendance_subject_date ON attendance_sessions(subject_id, date);
CREATE INDEX idx_attendance_section ON attendance_sessions(section_id);
CREATE INDEX idx_attendance_university ON attendance_sessions(university_id);
CREATE INDEX idx_students_section ON students(section_id);
CREATE INDEX idx_students_university ON students(university_id);
CREATE INDEX idx_user_sections_user ON user_sections(user_id);
CREATE INDEX idx_user_sections_section ON user_sections(section_id);
CREATE INDEX idx_user_subjects_user ON user_subjects(user_id);
CREATE INDEX idx_user_subjects_subject ON user_subjects(subject_id);
CREATE INDEX idx_activity_logs_university ON activity_logs(university_id);
CREATE INDEX idx_activity_logs_department ON activity_logs(department_id);
CREATE INDEX idx_departments_university ON departments(university_id);
CREATE INDEX idx_branches_department ON branches(department_id);
CREATE INDEX idx_specialisations_branch ON specialisations(branch_id);
CREATE INDEX idx_sections_department ON sections(department_id);
CREATE INDEX idx_users_university ON users(university_id);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- ADD FOREIGN KEY CONSTRAINTS (after all tables created)
-- ============================================
ALTER TABLE users ADD CONSTRAINT users_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT users_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE departments ADD CONSTRAINT departments_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE departments ADD CONSTRAINT departments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE branches ADD CONSTRAINT branches_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE specialisations ADD CONSTRAINT specialisations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE sections ADD CONSTRAINT sections_primary_teacher_id_fkey
  FOREIGN KEY (primary_teacher_id) REFERENCES users(id);
ALTER TABLE sections ADD CONSTRAINT sections_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_sections ADD CONSTRAINT user_sections_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE subjects ADD CONSTRAINT subjects_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_subjects ADD CONSTRAINT user_subjects_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE students ADD CONSTRAINT students_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE universities ADD CONSTRAINT universities_super_admin_id_fkey
  FOREIGN KEY (super_admin_id) REFERENCES users(id);
