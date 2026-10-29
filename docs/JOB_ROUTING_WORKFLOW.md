# TBOS-v3 Job Routing Workflow (Draft)

Status: requirements/design draft for the coordinated Supabase Auth and RLS migration. This document does not change the live application or production database.

## Goal

Allow a job to move between hubs that perform the work. When a hub finishes its part, the current hub can request a handoff to the next or a designated hub. The destination hub's secretary or any administrator reviews the handoff. After approval, the receiving hub must explicitly accept the incoming work before it enters active work. The route and every decision must be auditable.

## Confirmed workflow decisions

- **Handoff approval:** the destination hub's secretary (scoped to that hub) or any administrator can approve/reject.
- **Receiving hub acceptance:** explicit acceptance is required after handoff approval. Approval alone does not put the job into the receiving hub's active work queue.
- **Route selection:** support both predefined route templates (such as routes suggested by job type) and per-job destination selection. An authorized user can select a destination per job; deviations from a configured route require an appropriate permission and a recorded reason.
- **Final completion:** secretary or administrator approval is required before a job enters its final completed state.

## Proposed user journey

1. **Create job.** A job is created with its originating/current hub and existing tracking ID. The job retains its existing UUID and creator reference.
2. **Work at current hub.** Authorized staff in the current hub see the job in their work queue and update permitted work details.
3. **Request handoff.** When the current hub finishes its stage, an authorized staff member chooses a destination hub from the allowed hub list, optionally chooses a next stage, adds a handoff note, and submits the request. A configured route template may suggest the destination. The job is not silently moved just because a staff member edits the hub field.
4. **Review handoff.** The destination hub's secretary, scoped to that hub, or any administrator reviews the request and approves or rejects it. Rejections require a reason. Admin overrides require a reason and are logged.
5. **Await explicit acceptance.** Approval creates an approved incoming handoff visible to the receiving hub, but the job remains awaiting acceptance and is not yet in the receiving hub's active work queue. Authorized receiving-hub staff explicitly accept it. Record the accepting profile and timestamp. If it is declined or cannot be accepted, provide a controlled return/escalation path with a reason rather than silently moving the job.
6. **Receiving hub performs work.** After acceptance, the job enters the receiving hub's active queue. The receiving hub performs its stage and requests the next handoff when ready. Repeat review and explicit acceptance for every subsequent hub transfer.
7. **Completion review.** When final work is done, staff submit completion for review. A secretary or administrator approves final completion. Only then does the job enter its final completed state.
8. **History.** The job detail view shows its route timeline: source hub, destination hub, stage, who requested the transfer, who approved/rejected it, who accepted it, timestamps, and notes.

## Suggested workflow statuses

Keep handoff/acceptance state separate from payment status and delivery status. Suggested states for the transfer record include:

- Pending Review — handoff request awaits destination secretary/admin review.
- Rejected — request rejected with a reason; job remains with source hub until corrected/resubmitted.
- Awaiting Acceptance — handoff approved; receiving hub must explicitly accept.
- Accepted / In Progress — receiving hub accepted and is working on its stage.
- Completion Review — final work submitted; secretary/admin review pending.
- Completed — final completion approved.
- Cancelled — request cancelled through an authorized, auditable action.
- On Hold — authorized staff/admin pauses work with a reason.

The existing jobs.status and jobs.stage fields need a compatibility review before reuse; a separate normalized routing state/transfer table may be safer than silently changing the meaning of legacy values.

## Proposed data design (for schema review, not execution)

Prefer an append-only transfer/history table instead of relying only on a mutable jobs.hub field. Possible table: public.job_hub_transfers with:

- id uuid primary key default gen_random_uuid()
- job_id uuid not null references public.jobs(id)
- from_hub text not null
- to_hub text not null
- stage_name text
- status text not null constrained to pending_review/approved_awaiting_acceptance/rejected/accepted/in_progress/completion_review/completed/cancelled as refined during implementation
- requested_by uuid not null references public.users(id)
- reviewed_by uuid references public.users(id)
- requested_at timestamptz not null default now()
- reviewed_at timestamptz
- accepted_by uuid references public.users(id)
- accepted_at timestamptz
- handoff_note text
- review_note text
- acceptance_note text
- route_template_id uuid nullable if a route template is used
- route_order integer nullable for the current step in a template

This is a design sketch, not final SQL. Check the actual schema and app queries before choosing columns. Add a route-template/configuration table for predefined routes by job type, while retaining per-job destination selection. Do not infer routes from hub names or a hard-coded sequence.

## Authorization requirements

- Active, Auth-mapped staff can request handoffs only for jobs they are permitted to work on in their current hub.
- A request must derive requested_by from the authenticated identity/profile mapping, not trust a client-supplied staff ID.
- The source hub must match the job's current authorized hub at request time.
- Only the destination hub's secretary (scoped to that destination hub) or any administrator may approve/reject a handoff. A source-hub secretary cannot approve solely because they belong to the sending hub, unless they are also authorized for the destination hub. Administrators can approve across all hubs.
- An approved handoff is visible to authorized receiving-hub reviewers/staff in an incoming queue, but is not active work until an authorized receiving-hub staff member explicitly accepts it.
- Acceptance must be performed by authorized staff belonging to the destination hub or an administrator under an explicit override rule; record the accepting profile and timestamp. A user cannot accept on behalf of another person by supplying a forged profile ID.
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
- A forged from_hub, requested_by, reviewed_by, accepted_by, or destination cannot bypass server-side checks.
- A handoff request is visible only to authorized reviewers and relevant hubs.
- Rejection records a reason and leaves the job assigned to the source hub.
- Approval creates an incoming item but does not activate the job until the receiving hub explicitly accepts it.
- Acceptance is recorded with the receiving profile and timestamp; only then can the receiving hub work on the stage.
- An unauthorized staff member cannot approve, accept, or mark another hub's work complete.
- A final completion request remains pending until secretary/admin approval.
- Admin overrides require a reason and are auditable.
- Predefined route templates can suggest destinations, while authorized per-job destination selection remains available.
- Payment fields and statuses remain independent from routing statuses.
- Existing job records, profile IDs, and foreign keys remain intact.
- CBT Center legacy records remain understandable after the active hub label changes.
