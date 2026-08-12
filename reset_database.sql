-- WARNING: THIS SCRIPT WILL PERMANENTLY DELETE ALL DATA IN YOUR DATABASE
-- Run this script in the Supabase SQL Editor to wipe everything and start fresh.

-- 1. Delete all authentication users (this will usually cascade to public.users and other tables if configured)
DELETE FROM auth.users;

-- 2. Truncate all application tables to ensure everything is wiped out
TRUNCATE TABLE 
  public.attendance_records,
  public.attendance_sessions,
  public.user_subjects,
  public.user_sections,
  public.subject_sections,
  public.subjects,
  public.students,
  public.sections,
  public.specialisations,
  public.branches,
  public.departments,
  public.users,
  public.universities,
  public.activity_logs
CASCADE;
