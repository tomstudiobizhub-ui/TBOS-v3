-- TBOS-v3 coordinated RLS cutover draft
-- REVIEW / STAGING ONLY. Do not execute in production until frontend and RPC work is tested.
-- Replaces permissive legacy policies; permissive policies are OR-combined, so they must be removed.
-- Preserves all existing rows and profile IDs. Does not drop legacy users.password.

BEGIN;

-- Identity helpers: SECURITY DEFINER avoids recursive users-table RLS checks.
CREATE OR REPLACE FUNCTION public.tbos_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.role
  FROM public.users AS u
  WHERE u.auth_user_id = auth.uid()
    AND lower(trim(coalesce(u.status, ''))) = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tbos_can_manage_hub(target_hub text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(public.tbos_is_admin(), false)
      OR (
        lower(trim(coalesce(public.tbos_my_role(), ''))) IN ('secretary', 'branch manager')
        AND lower(trim(coalesce(public.tbos_my_hub(), ''))) =
            lower(trim(coalesce(target_hub, '')))
      )
$$;

CREATE OR REPLACE FUNCTION public.tbos_can_access_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(public.tbos_is_admin(), false)
      OR target_profile_id = public.tbos_my_profile_id()
      OR EXISTS (
        SELECT 1
        FROM public.users AS target
        WHERE target.id = target_profile_id
          AND lower(trim(coalesce(target.status, ''))) = 'active'
          AND lower(trim(coalesce(target.hub, ''))) =
              lower(trim(coalesce(public.tbos_my_hub(), '')))
      )
$$;

REVOKE ALL ON FUNCTION public.tbos_my_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tbos_can_manage_hub(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tbos_can_access_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tbos_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tbos_can_manage_hub(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tbos_can_access_profile(uuid) TO authenticated;

-- Remove every existing policy on these tables, including broad policies with USING (true).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users', 'jobs', 'clients', 'daily_reports',
        'announcements', 'staff_activities', 'registration_requests'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- Remove PUBLIC/anon/authenticated table-level grants. Regrant only what policies allow.
REVOKE ALL PRIVILEGES ON TABLE
  public.users, public.jobs, public.clients, public.daily_reports,
  public.announcements, public.staff_activities, public.registration_requests
FROM PUBLIC, anon, authenticated;

-- users contains legacy plaintext passwords: no direct table access for browser roles.
-- Profile reads must use public.tbos_my_safe_profile(); admin profile-management RPCs
-- must be added and tested before the admin UI is cut over.

-- Operational tables: authenticated-only row access; RLS enforces hub/ownership boundaries.
GRANT SELECT, INSERT, DELETE ON TABLE public.clients, public.daily_reports,
  public.announcements, public.staff_activities TO authenticated;
GRANT UPDATE (name, phone, email, comment, date, staff_id)
  ON TABLE public.clients TO authenticated;
GRANT UPDATE (staff_name, hub, date, tasks, challenges, plans, hours_worked,
  jobs_completed, images, report_number)
  ON TABLE public.daily_reports TO authenticated;
GRANT UPDATE (message, type, target_hub)
  ON TABLE public.announcements TO authenticated;
GRANT UPDATE (staff_name, role, activity, date, time)
  ON TABLE public.staff_activities TO authenticated;

-- Jobs: routing fields (hub, stage, status) are intentionally not directly writable.
GRANT SELECT, DELETE ON TABLE public.jobs TO authenticated;
GRANT INSERT (tracking_id, client_name, client_phone, client_email, hub, description,
  amount, paid, balance, payment_status, delivery_date, created_by,
  exp_materials, exp_labor, exp_other, total_expenses, profit)
  ON TABLE public.jobs TO authenticated;
GRANT UPDATE (client_name, client_phone, client_email, description, amount, paid,
  balance, payment_status, delivery_date, exp_materials, exp_labor, exp_other,
  total_expenses, profit)
  ON TABLE public.jobs TO authenticated;

-- Clients: record access is limited to the staff member's hub; administrators can access all.
CREATE POLICY clients_select_hub ON public.clients
  FOR SELECT TO authenticated
  USING (public.tbos_can_access_profile(staff_id));
CREATE POLICY clients_insert_hub ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (staff_id = public.tbos_my_profile_id()
              OR public.tbos_can_access_profile(staff_id));
CREATE POLICY clients_update_hub ON public.clients
  FOR UPDATE TO authenticated
  USING (public.tbos_can_access_profile(staff_id))
  WITH CHECK (public.tbos_can_access_profile(staff_id));
CREATE POLICY clients_delete_hub ON public.clients
  FOR DELETE TO authenticated
  USING (public.tbos_can_access_profile(staff_id));

-- Jobs: prevent direct cross-hub movement. Routing RPCs will own hub/stage/status transitions.
CREATE POLICY jobs_select_hub ON public.jobs
  FOR SELECT TO authenticated
  USING (coalesce(public.tbos_is_admin(), false)
         OR lower(trim(hub)) = lower(trim(coalesce(public.tbos_my_hub(), ''))));
CREATE POLICY jobs_insert_hub ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (coalesce(public.tbos_is_admin(), false)
         OR lower(trim(hub)) = lower(trim(coalesce(public.tbos_my_hub(), ''))));
CREATE POLICY jobs_update_hub ON public.jobs
  FOR UPDATE TO authenticated
  USING (coalesce(public.tbos_is_admin(), false)
         OR lower(trim(hub)) = lower(trim(coalesce(public.tbos_my_hub(), ''))))
  WITH CHECK (coalesce(public.tbos_is_admin(), false)
         OR lower(trim(hub)) = lower(trim(coalesce(public.tbos_my_hub(), ''))));
CREATE POLICY jobs_delete_admin ON public.jobs
  FOR DELETE TO authenticated
  USING (coalesce(public.tbos_is_admin(), false));

-- Daily reports: staff can manage their own reports; hub secretaries/admins can review hub reports.
CREATE POLICY daily_reports_select_scope ON public.daily_reports
  FOR SELECT TO authenticated
  USING (
    staff_id = public.tbos_my_profile_id()
    OR coalesce(public.tbos_is_admin(), false)
    OR (public.tbos_can_manage_hub(hub))
  );
CREATE POLICY daily_reports_insert_scope ON public.daily_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id = public.tbos_my_profile_id()
    AND lower(trim(hub)) = lower(trim(coalesce(public.tbos_my_hub(), '')))
  );
CREATE POLICY daily_reports_update_scope ON public.daily_reports
  FOR UPDATE TO authenticated
  USING (
    staff_id = public.tbos_my_profile_id()
    OR coalesce(public.tbos_is_admin(), false)
    OR public.tbos_can_manage_hub(hub)
  )
  WITH CHECK (
    (staff_id = public.tbos_my_profile_id()
      AND lower(trim(hub)) = lower(trim(coalesce(public.tbos_my_hub(), ''))))
    OR coalesce(public.tbos_is_admin(), false)
    OR public.tbos_can_manage_hub(hub)
  );
CREATE POLICY daily_reports_delete_scope ON public.daily_reports
  FOR DELETE TO authenticated
  USING (coalesce(public.tbos_is_admin(), false) OR public.tbos_can_manage_hub(hub));

-- Announcements: staff can read global and own-hub messages; only hub managers/admins write.
CREATE POLICY announcements_select_scope ON public.announcements
  FOR SELECT TO authenticated
  USING (
    lower(trim(coalesce(target_hub, 'all'))) = 'all'
    OR lower(trim(target_hub)) = lower(trim(coalesce(public.tbos_my_hub(), '')))
    OR coalesce(public.tbos_is_admin(), false)
  );
CREATE POLICY announcements_insert_scope ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    coalesce(public.tbos_is_admin(), false)
    OR public.tbos_can_manage_hub(target_hub)
  );
CREATE POLICY announcements_update_scope ON public.announcements
  FOR UPDATE TO authenticated
  USING (coalesce(public.tbos_is_admin(), false) OR public.tbos_can_manage_hub(target_hub))
  WITH CHECK (coalesce(public.tbos_is_admin(), false) OR public.tbos_can_manage_hub(target_hub));
CREATE POLICY announcements_delete_scope ON public.announcements
  FOR DELETE TO authenticated
  USING (coalesce(public.tbos_is_admin(), false) OR public.tbos_can_manage_hub(target_hub));

-- Staff activity: users can create their own activity; managers/admins can review hub activity.
CREATE POLICY staff_activities_select_scope ON public.staff_activities
  FOR SELECT TO authenticated
  USING (public.tbos_can_access_profile(staff_id));
CREATE POLICY staff_activities_insert_scope ON public.staff_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id = public.tbos_my_profile_id()
    OR public.tbos_can_access_profile(staff_id)
  );
CREATE POLICY staff_activities_update_scope ON public.staff_activities
  FOR UPDATE TO authenticated
  USING (public.tbos_can_access_profile(staff_id))
  WITH CHECK (public.tbos_can_access_profile(staff_id));
CREATE POLICY staff_activities_delete_scope ON public.staff_activities
  FOR DELETE TO authenticated
  USING (coalesce(public.tbos_is_admin(), false));

-- Public registration may submit a pending request only. No direct request reads or edits.
GRANT INSERT (name, email, phone, requested_hub, address, location)
  ON TABLE public.registration_requests TO anon, authenticated;
CREATE POLICY registration_requests_submit ON public.registration_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'Pending Approval');

COMMIT;

-- Cutover blockers that must be resolved before this draft is executable:
-- 1. Add and test trusted RPCs for admin profile/request review and the complete job routing
--    workflow. Do not restore direct users table access to make the legacy UI work.
-- 2. Confirm helper-function definitions and grants in the live project.
-- 3. Test all intended INSERT/UPDATE columns and existing frontend writes on staging.
-- 4. Test with real staff/admin accounts, including cross-hub denial and unauthenticated access.
-- 5. Preserve profile IDs and historical rows; rename CBT Center to Tech In Schools (TIS)
--    only in a separate reviewed data migration with historical compatibility.
