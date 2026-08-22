-- =====================================================================
-- Migration: 021_rls_escalation_audit_and_scope_fixes
-- Fixes (see ATTENDANCE_HUB_AUDIT_FINDINGS.md):
--   F-004 — RLS lets primary_teacher/admin self-promote to super_admin
--           via users UPDATE (and the symmetric INSERT path).
--   F-012 — Activity logs forgeable by any member (performed_by_* taken
--           verbatim from the client payload).
--   F-025 — Any authenticated user can spam-create universities.
--   F-026 — Admin read/write scope asymmetry (cross-department reads).
--
-- Notes:
--   * University creation is fully server-side: registerUniversity
--     (src/app/(auth)/register/actions.ts) inserts via the service-role
--     admin client, which bypasses RLS. No client-JWT path inserts into
--     universities, so the permissive INSERT policy is removed without
--     a replacement.
--   * Legitimate client-JWT writes to public.users today are:
--       - self-update of must_change_password (change-password flow)
--       - admin changing another user's role between
--         primary_teacher/regular_teacher (teachers page sync queue)
--       - super_admin department handover (deactivate old admin via
--         sync queue; mint replacement admin via upsert)
--     All of these keep working under the policies below; introducing
--     the super_admin role does not.
-- =====================================================================

-- -------------------------------------------------------------------
-- F-004 (part 1): guard trigger — an authenticated session may never
-- introduce the super_admin role on any row (INSERT or UPDATE).
-- Server code using the service key runs with auth.uid() NULL and is
-- unaffected (registration, restore, managed-user actions).
-- Fires only when the role column is a write target.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_super_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'super_admin'
     AND (
       TG_OP = 'INSERT'
       OR OLD.role <> 'super_admin'
     )
     AND (SELECT auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION
      'super_admin role may only be assigned by server-side flows'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_escalation ON public.users;
CREATE TRIGGER trg_prevent_super_admin_escalation
  BEFORE INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_escalation();

-- -------------------------------------------------------------------
-- F-004 (part 2): replace the blanket update_university_users policy
-- (which let any primary_teacher/admin edit ANY row in their
-- university, including their own role) with two scoped policies:
--   - users_self_update: own row only; role and university pinned to
--     their current (pre-update) values via the SECURITY DEFINER
--     helpers, which observe the statement-start snapshot.
--   - admins_update_university_users: super_admin/admin may update
--     other rows in their university; the guard trigger above blocks
--     granting super_admin, and WITH CHECK keeps rows inside the
--     caller's university.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "update_university_users" ON public.users;

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND university_id = public.get_my_university_id()
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = public.get_my_role()
    AND university_id = public.get_my_university_id()
  );

CREATE POLICY "admins_update_university_users" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    id <> (SELECT auth.uid())
    AND university_id = public.get_my_university_id()
    AND public.get_my_role() IN ('super_admin', 'admin')
  )
  WITH CHECK (
    id <> (SELECT auth.uid())
    AND university_id = public.get_my_university_id()
    AND public.get_my_role() IN ('super_admin', 'admin')
  );

-- -------------------------------------------------------------------
-- F-012: activity-log actor attribution enforced server-side.
-- A BEFORE INSERT trigger rewrites performed_by_id/role/name from the
-- verified session's profile row, so client-supplied values can no
-- longer forge the audit trail. Service-key inserts (auth.uid() NULL)
-- pass through untouched. The INSERT policy additionally pins
-- performed_by_id to the caller (belt and braces; evaluated after the
-- trigger has normalized the row).
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_activity_log_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_role text;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.role, u.full_name
    INTO v_role, v_name
    FROM public.users u
   WHERE u.id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'authenticated caller has no profile row; cannot attribute activity log'
      USING ERRCODE = '42501';
  END IF;

  NEW.performed_by_id   := v_uid;
  NEW.performed_by_role := v_role;
  NEW.performed_by_name := v_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_activity_log_actor ON public.activity_logs;
CREATE TRIGGER trg_enforce_activity_log_actor
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_log_actor();

DROP POLICY IF EXISTS "insert_activity_logs" ON public.activity_logs;
CREATE POLICY "insert_activity_logs" ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    university_id = public.get_my_university_id()
    AND performed_by_id = (SELECT auth.uid())
  );

-- -------------------------------------------------------------------
-- F-025: remove the open university-bootstrap INSERT policy.
-- University rows are created exclusively by the server-side
-- registration flow through the service-role client; authenticated
-- callers no longer hold any INSERT grant path on this table.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "anyone_can_create_university" ON public.universities;

-- -------------------------------------------------------------------
-- F-026: align admin READ scope with their (already department-scoped)
-- WRITE scope on students and attendance_sessions. Super_admin keeps
-- whole-university reads; teacher/CR assignment-based scoping is
-- preserved verbatim. Every admin-facing surface in the app
-- (/students, /export, dashboard) already filters to the caller's
-- department, so behavior visible to users is unchanged.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "read_accessible_students" ON public.students;
CREATE POLICY "read_accessible_students" ON public.students
  FOR SELECT
  USING (
    university_id = public.get_my_university_id()
    AND (
      public.get_my_role() = 'super_admin'
      OR (
        public.get_my_role() = 'admin'
        AND department_id = public.get_my_department_id()
      )
      OR section_id IN (
        SELECT section_id FROM public.user_sections WHERE user_id = (SELECT auth.uid())
        UNION
        SELECT section_id FROM public.user_subjects WHERE user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "read_accessible_attendance" ON public.attendance_sessions;
CREATE POLICY "read_accessible_attendance" ON public.attendance_sessions
  FOR SELECT
  USING (
    university_id = public.get_my_university_id()
    AND (
      public.get_my_role() = 'super_admin'
      OR (
        public.get_my_role() = 'admin'
        AND department_id = public.get_my_department_id()
      )
      OR section_id IN (
        SELECT section_id FROM public.user_sections WHERE user_id = (SELECT auth.uid())
        UNION
        SELECT section_id FROM public.user_subjects WHERE user_id = (SELECT auth.uid())
      )
    )
  );
