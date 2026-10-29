-- TBOS-v3 Supabase Auth / RLS policy design
-- DESIGN DRAFT ONLY. DO NOT RUN AGAINST PRODUCTION.
-- Review exact role labels, client write needs, grants, views/functions, and current policy names first.
-- Prerequisite: additive public.users.auth_user_id UUID UNIQUE REFERENCES auth.users(id)
-- must be created and correctly mapped on a staging project.
--
-- Preserve public.users.id: existing operational foreign keys point to it.
-- Never trust role/status/hub from localStorage or user-editable Auth metadata.
-- Exact admin role labels below are provisional ('admin', 'administrator').

-- 1) Trusted identity helpers. SECURITY DEFINER is needed to read the profile mapping
-- without creating recursive RLS; keep a fixed search_path and restrict EXECUTE.
CREATE OR REPLACE FUNCTION public.tbos_my_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.id
  FROM public.users AS u
  WHERE u.auth_user_id = auth.uid()
    AND lower(trim(coalesce(u.status, ''))) = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tbos_my_hub()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.hub
  FROM public.users AS u
  WHERE u.auth_user_id = auth.uid()
    AND lower(trim(coalesce(u.status, ''))) = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tbos_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE u.auth_user_id = auth.uid()
      AND lower(trim(coalesce(u.status, ''))) = 'active'
      AND lower(trim(coalesce(u.role, ''))) IN ('admin', 'administrator')
  )
$$;

-- In the reviewed implementation, revoke helper execution from PUBLIC and grant only
-- to authenticated. Validate function ownership and table-owner RLS behaviour in staging.
-- REVOKE ALL ON FUNCTION public.tbos_my_profile_id() FROM PUBLIC;
-- REVOKE ALL ON FUNCTION public.tbos_my_hub() FROM PUBLIC;
-- REVOKE ALL ON FUNCTION public.tbos_is_admin() FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.tbos_my_profile_id() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.tbos_my_hub() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.tbos_is_admin() TO authenticated;

-- 2) Policy intent (replace existing permissive policies after a complete inventory).
-- Do not apply these policies until grants, functions, and frontend compatibility have
-- been tested together on staging. Existing permissive policies OR together, so merely
-- adding these policies beside current public/true policies does NOT secure the tables.

-- public.jobs:
-- SELECT: active mapped staff AND jobs.hub = public.tbos_my_hub(), OR admin.
-- INSERT: active mapped staff AND hub = own hub AND created_by = own legacy profile id,
--         OR admin. Confirm whether users may create jobs on behalf of others.
-- UPDATE: own hub before and after update, OR admin.
-- DELETE: admin only unless an explicit workflow requires more.
--
-- public.clients:
-- SELECT: active mapped staff AND clients' staff hub equals own hub, OR admin.
--         Since clients has no hub column, use its staff_id -> public.users.id -> hub.
-- INSERT: staff_id must equal own profile id for staff, OR admin.
-- UPDATE: both old and new staff_id must resolve to own hub; staff must not reassign
--         clients across hubs. Prefer admin-only DELETE.
--
-- public.daily_reports:
-- SELECT: staff_id = public.tbos_my_profile_id(), OR admin (supervisor role can be
--         added explicitly after role review).
-- INSERT: staff_id = own profile id and staff_name/hub must match trusted profile values.
-- UPDATE/DELETE: own report only if workflow requires edits; otherwise admin-only.
--         Do not trust staff_name/hub supplied by the browser.
--
-- public.inventory:
-- Admin-only SELECT/INSERT/UPDATE/DELETE in the baseline design. If staff need stock
-- visibility, add a separate read-only policy; do not give staff inventory write access
-- merely to support stock-usage logging.
--
-- public.announcements:
-- SELECT: active mapped staff and (target_hub = 'all' OR target_hub = own hub), OR admin.
-- INSERT/UPDATE/DELETE: admin only; constrain target_hub to a valid hub or 'all'.
--
-- public.staff_activities:
-- INSERT: active mapped staff may create only a row whose staff_id equals own profile id;
--         role/name/date/time should be derived or validated, not trusted from the client.
-- SELECT: own activity, OR admin.
-- UPDATE/DELETE: admin only; ideally treat as append-only audit history.
--
-- public.users:
-- Do not grant direct table SELECT to browser clients while legacy password is present.
-- After Auth is proven, replace browser access with a safe-column profile function/view;
-- only admins should be able to list/manage staff profiles. Staff cannot update role,
-- hub, status, id, password, or auth_user_id. Drop legacy password in a separate,
-- verified post-cutover migration.
--
-- 3) Grants / anonymous access:
-- Revoke anon table privileges on all seven operational tables and public.users.
-- Revoke broad PUBLIC grants where present. Grant authenticated only the minimum table
-- operations needed by the frontend; RLS policies then restrict rows/actions.
-- Do not blindly grant all operations just because RLS is enabled.
--
-- 4) Registration:
-- Use Supabase Auth signup plus a constrained registration-request workflow. No public
-- insert/update to public.users. A new request must not self-assign role/status/hub.
-- Prefer a dedicated registration_requests table or trusted server/Edge Function with
-- rate limiting and verification. Pending Auth users must fail the active-profile
-- helper and therefore receive no operational data access.
--
-- 5) Rollout:
-- Apply on staging only after taking a restorable backup and testing every allow/deny
-- case. Do not drop old policies until the replacement set and grants are ready to be
-- applied together. Do not run this draft as a standalone migration.
