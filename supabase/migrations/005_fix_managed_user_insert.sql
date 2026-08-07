-- Allow admins to insert managed users in their university.
-- Previously the policy required id = auth.uid(), which blocked admins
-- from inserting rows for other users.

DROP POLICY IF EXISTS "insert_university_users" ON public.users;

CREATE POLICY "insert_university_users" ON public.users
  FOR INSERT
  WITH CHECK (
    -- Self-insert during registration bootstrap
    (
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
    )
    OR
    -- Privileged user creating a managed user in their own university
    (
      university_id = public.get_my_university_id()
      AND public.get_my_role() IN ('super_admin', 'admin', 'primary_teacher')
    )
  );
