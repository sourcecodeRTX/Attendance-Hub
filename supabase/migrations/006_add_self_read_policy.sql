-- Add a policy allowing users to always read their own profile
-- This is crucial for the auth flow to work correctly

-- Drop and recreate the read policy to include self-read
DROP POLICY IF EXISTS "read_university_users" ON public.users;

-- Users can read their own profile OR all users in their university
CREATE POLICY "read_own_or_university_users" ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR university_id = public.get_my_university_id()
  );

-- Also allow reading university by super_admin_id match for bootstrap
DROP POLICY IF EXISTS "read_own_university" ON public.universities;

CREATE POLICY "read_own_university" ON public.universities
  FOR SELECT USING (
    id = public.get_my_university_id()
    OR super_admin_id = auth.uid()
  );
