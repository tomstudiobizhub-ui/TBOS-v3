-- TBOS-v3 Auth migration implementation draft
-- DRAFT ONLY: do not run against production until reviewed and tested on staging.
-- This file is additive and does not alter existing policies or privileges on operational tables.
-- Assumptions: public.users.auth_user_id already exists; Supabase Auth is used for passwords.

BEGIN;

-- Public registration collects a request only. It does not create or activate a staff profile.
CREATE TABLE IF NOT EXISTS public.registration_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
    email text NOT NULL CHECK (length(trim(email)) BETWEEN 3 AND 320),
    phone text NOT NULL CHECK (length(trim(phone)) BETWEEN 3 AND 40),
    requested_hub text NOT NULL CHECK (length(trim(requested_hub)) BETWEEN 1 AND 100),
    address text,
    location text,
    status text NOT NULL DEFAULT 'Pending Approval'
        CHECK (status IN ('Pending Approval', 'Approved', 'Rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_requests_created_at_idx
    ON public.registration_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS registration_requests_email_lower_idx
    ON public.registration_requests (lower(trim(email)));

ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- Remove implicit table-level access; then permit only request submission.
REVOKE ALL ON TABLE public.registration_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT (name, email, phone, requested_hub, address, location)
    ON TABLE public.registration_requests TO anon, authenticated;

DROP POLICY IF EXISTS registration_requests_submit ON public.registration_requests;
CREATE POLICY registration_requests_submit
    ON public.registration_requests
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (status = 'Pending Approval');

-- Return only the signed-in user's safe profile fields. Never expose password or mapping ID.
-- JSON avoids assuming legacy numeric column types in this draft.
CREATE OR REPLACE FUNCTION public.tbos_my_safe_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'name', u.name,
        'role', u.role,
        'hub', u.hub,
        'phone', u.phone,
        'address', u.address,
        'location', u.location,
        'photo', u.photo,
        'status', u.status,
        'score', u.score,
        'jobs_logged', u.jobs_logged,
        'jobs_completed', u.jobs_completed,
        'revenue_generated', u.revenue_generated,
        'created_at', u.created_at
    )
    FROM public.users AS u
    WHERE u.auth_user_id = auth.uid()
      AND lower(trim(coalesce(u.status, ''))) = 'active'
    LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.tbos_my_safe_profile()
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tbos_my_safe_profile()
    TO authenticated;

COMMIT;

-- Important review notes:
-- 1. This is not a full RLS cutover. Existing broad policies/grants on the seven legacy
--    tables remain unchanged by design.
-- 2. The browser must call Supabase Auth signUp and then submit a registration request.
--    Do not insert into public.users and never store a plaintext password there.
-- 3. Admin approval must be implemented through a trusted admin-only workflow; do not
--    expose UPDATE/SELECT grants on registration_requests to anonymous clients.
-- 4. Confirm the exact numeric types of score/jobs/revenue columns before staging execution.
-- 5. Test whether signup returns a session or requires email confirmation in this project.
