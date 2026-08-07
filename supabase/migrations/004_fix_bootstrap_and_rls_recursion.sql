-- Fix bootstrap deadlock and RLS recursion issues
-- 1) Remove circular FK that blocks creating first university/user pair
-- 2) Recreate helper functions as SECURITY DEFINER to avoid recursive RLS on users table
-- 3) Allow initial super_admin profile insert during registration

-- Circular FK causes impossible insert order during /register flow
ALTER TABLE public.universities
  DROP CONSTRAINT IF EXISTS universities_super_admin_id_fkey;

-- Recreate helpers with SECURITY DEFINER so policy checks do not recurse on users RLS
CREATE OR REPLACE FUNCTION public.get_my_university_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.university_id
  FROM public.users u
  WHERE u.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role
  FROM public.users u
  WHERE u.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.department_id
  FROM public.users u
  WHERE u.id = auth.uid()
$$;

-- First profile insert should be allowed after university creation
DROP POLICY IF EXISTS "insert_university_users" ON public.users;

CREATE POLICY "insert_university_users" ON public.users
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND (
      university_id = public.get_my_university_id()
      OR EXISTS (
        SELECT 1
        FROM public.universities u
        WHERE u.id = users.university_id
          AND u.super_admin_id = auth.uid()
      )
    )
  );
