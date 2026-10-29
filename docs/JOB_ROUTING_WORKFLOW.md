# TBOS-v3 Job Routing Workflow (Draft)

Status: requirements/design draft for the coordinated Supabase Auth and RLS migration. This document does not change the live application or production database.

## Goal

Allow a job to move between hubs that perform the work. When a hub finishes its part, the current hub can request a handoff to the next or a designated hub. The receiving hub gets a visible queue item. A secretary or administrator can approve the handoff and/or approve completion. The route and every decision must be auditable.

## Proposed user journey

1. **Create job.** A job is created with its originating/current hub and existing tracking ID. The job retains its existing UUID and creator reference.
2. **Work at current hub.** Authorized staff in the current hub see the job in their work queue and update permitted work details.
3. **Request handoff.** When the current hub finishes its stage, an authorized staff member chooses a destination hub from the allowed hub list, optionally chooses a next stage, adds a handoff note, and submits the request. The job is not silently moved just because a staff member edits the hub field.
4. **Review handoff.** The destination hub's secretary, scoped to that hub, or any administrator reviews the request and approves or rejects it. An admin may override where needed; the action and reason are logged. Approval activates the handoff and makes the job visible in the receiving hub's queue.
5. **Receiving hub performs work.** The receiving hub can acknowledge/accept the task, work on its stage, and request the next handoff when ready. If a route is designated in advance, the UI should suggest the configured next hub but allow an authorized override with a recorded reason.
6. **Completion review.** When the final work is done, staff submit completion for review. A secretary or administrator approves final completion. Only then does the job enter its final completed state.
7. **History.** The job detail view shows its route timeline: source hub, destination hub, stage, who requested the transfer, who approved/rejected it, timestamps, and notes.

## Suggested workflow statuses

- In Progress — current hub is working on its stage.
- Handoff Requested — source hub has requested a destination; awaiting authorized review.
- Handoff Rejected — request rejected with a reason; job remains with source hub until corrected/resubmitted.
- Awaiting Hub Acceptance — approved transfer is waiting for the receiving hub to acknowledge it, if this acceptance step is enabled.
- In Progress — receiving hub has accepted and is working on the stage.
- Completion Review — current/final hub says work is complete; secretary/admin review is pending.
- Completed — final completion approved.
- On Hold — authorized staff/admin pauses work with a reason.

Keep routing statuses distinct from payment status (UNPAID, PARTIAL, PAID) and delivery status. The existing jobs.status and jobs.stage fields need a compatibility review before reuse; a separate normalized routing state/transfer table may be safer than silently changing the meaning of legacy values.

## Proposed data design (for schema review, not execution)

Prefer an append-only transfer/history table instead of relying only on a mutable jobs.hub field. Possible table: public.job_hub_transfers with:

- id uuid primary key default gen_random_uuid()
- job_id uuid not null references public.jobs(id)
- from_hub text not null
- to_hub text not null
- stage_name text
- status text not null constrained to pending/approved/rejected/cancelled/accepted/completed as refined during implementation
- requested_by uuid not null references public.users(id)
- reviewed_by uuid references public.users(id)
- requested_at timestamptz not null default now()
- reviewed_at timestamptz
- accepted_by uuid references public.users(id)
- accepted_at timestamptz
- handoff_note text
- review_note text
- route_order integer or an explicit route configuration reference if jobs need a predefined sequence

This is a design sketch, not final SQL. Check the actual schema and app queries before choosing columns. Consider a separate route-steps/configuration table if routes vary by job type. A designated route should be explicit per job or template; do not infer it from a hub name or a hard-coded sequence.

## Authorization requirements

- Active, Auth-mapped staff can request handoffs only for jobs they are permitted to work on in their current hub.
- A request must derive requested_by from the authenticated identity/profile mapping, not trust a client-supplied staff ID.
- The source hub must match the job's current authorized hub at request time.
- Only the destination hub's secretary (scoped to that destination hub) or any administrator may approve/reject a handoff. A source-hub secretary cannot approve solely because they belong to the sending hub, unless they are also authorized for the destination hub. Administrators can approve across all hubs.
- Receiving hub staff can see an approved incoming handoff only after approval; they cannot approve their own handoff unless explicitly allowed by policy.
- Only authorized receiving-hub staff can accept and work on the incoming stage.
- Final completion requires secretary/admin approval. Record the reviewer and timestamp.
- Staff cannot skip stages, alter routing history, impersonate another hub, or update the current hub directly to bypass the transfer process.
- Admin override must require a reason and be recorded in the audit trail.
- RLS and/or trusted database functions must enforce these rules; hiding buttons in the frontend is not security.
- Avoid broad direct INSERT/UPDATE access to the routing table. Prefer narrow RPCs or carefully constrained policies for requesting, reviewing, accepting, and completing transitions.

## Hub rename compatibility

The active label for the former CBT Center hub is Tech In Schools (TIS). Include the rename in the coordinated migration:

- Update the active hub option list, staff profile for Nwadigo David, filters, dashboards, report forms, registration form, policy predicates, and route configuration.
- Audit legacy jobs.hub, daily_reports.hub, announcement targets, and any other hub text before migrating labels.
- Preserve historical meaning and row IDs; use a reviewed data migration or compatibility mapping so old records remain traceable.
- Do not run a standalone production UPDATE before the app and policies understand the new label.

## Acceptance tests

- A staff member cannot request a handoff for a job outside their authorized hub.
- A forged from_hub, requested_by, reviewed_by, or destination cannot bypass server-side checks.
- A handoff request is visible only to authorized reviewers and relevant hubs.
- Rejection records a reason and leaves the job assigned to the source hub.
- Approval moves the workflow to the receiving hub without changing the job UUID or losing its history.
- An unauthorized staff member cannot approve, accept, or mark another hub's work complete.
- A final completion request remains pending until secretary/admin approval.
- Admin overrides require a reason and are auditable.
- Payment fields and statuses remain independent from routing statuses.
- Existing job records, profile IDs, and foreign keys remain intact.
- CBT Center legacy records remain understandable after the active hub label changes.

## Remaining decisions before implementation

1. Should the receiving hub explicitly click Accept, or should the approved handoff appear immediately in its active queue? Recommended default: show it in the incoming queue and require acceptance.
2. Are hub routes usually predefined by job type, or should staff choose the next/designated hub per job with an admin/secretary override? Recommended default: support both route templates and per-job destination selection.
