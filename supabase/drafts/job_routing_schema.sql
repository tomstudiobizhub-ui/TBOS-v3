-- TBOS-v3 job routing schema draft
-- DESIGN / STAGING DRAFT ONLY. DO NOT RUN IN PRODUCTION.
-- This file intentionally creates schema objects only. It does not implement the
-- trusted transition RPCs or replace existing policies/grants; those must be reviewed
-- against the exact live schema and frontend calls before any cutover.
--
-- Assumptions to verify on staging:
--   public.jobs.id and public.users.id are UUIDs;
--   public.jobs.hub and public.users.hub are text;
--   public.jobs.stage is legacy data and must not be repurposed blindly.
-- Existing public.jobs rows and public.users IDs must be preserved.

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_route_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
    job_type text NOT NULL CHECK (length(trim(job_type)) BETWEEN 1 AND 120),
    description text,
    active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_route_templates_active_name_job_type_uidx
    ON public.job_route_templates (lower(trim(name)), lower(trim(job_type)))
    WHERE active;

CREATE TABLE IF NOT EXISTS public.job_route_template_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_template_id uuid NOT NULL
        REFERENCES public.job_route_templates(id) ON DELETE CASCADE,
    step_order integer NOT NULL CHECK (step_order > 0),
    hub text NOT NULL CHECK (length(trim(hub)) BETWEEN 1 AND 100),
    stage_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (route_template_id, step_order)
);

-- One row per requested handoff. Keep the history rather than treating jobs.hub as
-- the audit trail. State transitions must be performed only through trusted RPCs.
CREATE TABLE IF NOT EXISTS public.job_hub_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
    from_hub text NOT NULL CHECK (length(trim(from_hub)) BETWEEN 1 AND 100),
    to_hub text NOT NULL CHECK (length(trim(to_hub)) BETWEEN 1 AND 100),
    stage_name text,
    status text NOT NULL DEFAULT 'pending_review'
        CHECK (status IN (
            'pending_review',
            'rejected',
            'approved_awaiting_acceptance',
            'accepted',
            'in_progress',
            'completion_review',
            'completed',
            'cancelled'
        )),
    requested_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    reviewed_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    accepted_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    completed_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    route_template_id uuid REFERENCES public.job_route_templates(id) ON DELETE SET NULL,
    route_order integer CHECK (route_order IS NULL OR route_order > 0),
    requested_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    accepted_at timestamptz,
    completed_at timestamptz,
    handoff_note text,
    review_note text,
    acceptance_note text,
    completion_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (from_hub <> to_hub),
    CHECK (
        (status NOT IN ('rejected') OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL
          AND length(trim(coalesce(review_note, ''))) > 0)
    ),
    CHECK (
        (status NOT IN ('approved_awaiting_acceptance', 'accepted', 'in_progress',
                        'completion_review', 'completed')
         OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
    ),
    CHECK (
        (status NOT IN ('accepted', 'in_progress', 'completion_review', 'completed')
         OR (accepted_at IS NOT NULL AND accepted_by IS NOT NULL)
    ),
    CHECK (
        (status <> 'completed'
         OR (completed_at IS NOT NULL AND completed_by IS NOT NULL
             AND length(trim(coalesce(completion_note, ''))) > 0)
    )
);

CREATE INDEX IF NOT EXISTS job_hub_transfers_job_requested_idx
    ON public.job_hub_transfers (job_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS job_hub_transfers_destination_status_idx
    ON public.job_hub_transfers (to_hub, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS job_hub_transfers_source_status_idx
    ON public.job_hub_transfers (from_hub, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS job_route_template_steps_route_order_idx
    ON public.job_route_template_steps (route_template_id, step_order);

ALTER TABLE public.job_route_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_route_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_hub_transfers ENABLE ROW LEVEL SECURITY;

-- Deliberately no client table grants or policies in this schema-only draft.
-- Do not grant broad direct INSERT/UPDATE/DELETE to anon/authenticated. The reviewed
-- implementation should use narrowly granted SECURITY DEFINER RPCs with fixed
-- search_path and explicit checks against tbos_my_profile_id(), tbos_my_hub(),
-- tbos_is_admin(), role, status, destination hub and current jobs.hub.
--
-- Required trusted transitions:
-- 1. request_job_handoff(job_id, to_hub, stage_name, route_template_id, route_order,
--    handoff_note): derive requester from auth.uid(); require active mapped profile and
--    permission for the job's current hub; validate destination and route-template step.
-- 2. review_job_handoff(transfer_id, approve, review_note): only destination-hub
--    secretary or any admin; rejection requires a reason. Approval sets
--    approved_awaiting_acceptance, but does not change jobs.hub.
-- 3. accept_job_handoff(transfer_id, acceptance_note): only active receiving-hub staff
--    or admin under a logged override; set accepted_by/accepted_at and then change
--    jobs.hub to to_hub in the same transaction. Do not activate before acceptance.
-- 4. submit_job_stage_completion(transfer_id, note): only the current receiving hub;
--    transition to completion_review for the final stage or an appropriate handoff state.
-- 5. approve_job_stage_completion(transfer_id, approve, note): secretary for the
--    relevant hub or admin; final approval marks completed. A rejected completion must
--    return the stage to an actionable state and retain the reason.
-- 6. cancel/return/escalate paths must be explicit, permission-checked, and audited.
--
-- Route templates and per-job destination selection must both be supported. Templates
-- suggest valid next hubs; per-job overrides require permission and a recorded reason.
-- Verify the app's existing job-type field (if any) before linking templates to jobs.
--
-- Before enabling any client access, define RLS read policies for:
--   * source-hub staff while the transfer is pending/rejected;
--   * destination-hub reviewers for pending review;
--   * destination-hub staff for approved incoming handoffs awaiting acceptance;
--   * both relevant hubs and admins for permitted history;
--   * admins for template management, with a read policy for staff if templates are
--     intended to guide route selection.
-- Enforce append-only audit semantics and prevent direct client mutation of history.

COMMIT;
