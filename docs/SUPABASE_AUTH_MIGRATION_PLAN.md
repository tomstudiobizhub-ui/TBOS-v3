# TBOS-v3 Supabase Auth and RLS migration plan

Status: preparation and implementation drafts only. Do not merge to main or apply further production database changes until the coordinated frontend/database cutover is reviewed and tested.

## Confirmed current state

- The app is static HTML/CSS/JavaScript using Supabase JS v2 and config.js.
- The login page currently reads public.users, compares the submitted password in browser code, and stores the full profile in localStorage.currentUser.
- Registration currently writes a plaintext password and client-supplied profile fields to public.users.
- config.js falls back to localStorage when database reads/writes fail and can return success: true for an offline write. This is not acceptable for authentication or protected records.
- public.users.id is a UUID referenced by announcements.created_by, clients.staff_id, daily_reports.staff_id, jobs.created_by, and staff_activities.staff_id.
- Six legacy profile rows were found, all Active. Three existing profiles have now been linked to confirmed Supabase Auth accounts: Admin User, Mike jesulana, and OLANREWAJU OBAYEMISI. Preserve all legacy profile IDs.
- The current production database has an auth_user_id mapping column, mapping helper functions, a registration_requests table, and a safe-profile RPC. These additive objects have been applied. Existing broad policies/grants on operational tables have not yet been replaced.
- RLS is enabled on the seven supplied tables, but existing policies/grants include permissive public and authenticated access. RLS being enabled does not make those tables safe while permissive policies remain.
- The live app has not yet been updated to use the complete Auth, registration approval, least-privilege, or job-routing workflow.

## Confirmed requirements

1. Jobs — hub scope and routing. Staff should access jobs in their own hub. Jobs must support an explicit next/designated hub and a traceable handoff workflow. When a hub completes its part, it can request routing to the next hub; a secretary or administrator reviews/approves the handoff or completion. The receiving hub must see work awaiting its action. Jobs can pass through multiple hubs and have a final approval/completion step. See docs/JOB_ROUTING_WORKFLOW.md.
2. Hub rename. Replace the active hub label CBT Center with Tech In Schools (TIS) in application options, filters, dashboards, registration, policy logic, and documentation. Update Nwadigo David's existing profile hub as part of the coordinated migration, not as a standalone production edit. Preserve his profile ID and historical relationships. Plan compatibility/data migration for existing jobs/reports containing the old hub label so history remains understandable.
3. Daily reports — own. Staff may create and read only reports whose staff_id maps to their legacy profile UUID. They must not impersonate another staff member. Admin/supervisor oversight must be explicitly implemented and tested.
4. Inventory — admin administration. Draft baseline is admin-only read/write. Confirm whether staff need read-only stock visibility or a separate stock-usage request flow before enabling staff access.
5. Announcements — admin administration. Admins manage announcements. Active staff can read announcements targeted to all or their own hub; staff cannot publish, edit, or delete them.
6. Clients — hub scope. Active staff can read/create/update clients for their hub, with row checks preventing moving records to another hub. Delete should be denied to staff unless an explicit business need is confirmed.
7. Staff registration — request and approval. Staff can submit a registration request. The request remains pending until an administrator approves it. A request must not allow a visitor to assign a trusted role/status or gain operational access. Existing staff should not be given duplicate profiles if they re-register; admin review should reconcile matching email/profile before creating or linking anything.
8. Existing staff account still pending. Agboola Adewal and Nwadigo David have not yet been linked to Supabase Auth. Awooye Oyinlara is intentionally deferred because the recorded email is inaccessible.

## Identity mapping — preserve existing foreign keys

Do not replace public.users.id. Keep the existing profile UUID as the primary key so current foreign keys remain valid. Backfill auth_user_id only after Auth users have been created and individually reconciled. Require one-to-one mapping and verify all profiles before cutover.

Do not directly insert into auth.users with SQL. Use Supabase Auth invitation/password setup or a trusted server-side Admin Auth API process if appropriate. Never place a service-role key in browser code, GitHub Pages, or the repository.

## Staged implementation

### Stage 0 — read-only preflight
- Re-run supabase/preflight/auth_migration_audit.sql and inspect results before final cutover.
- Review all tables, views, functions, grants, triggers, and application calls; inventory every current policy before replacing anything.
- Confirm exact role/status values and whether staff need inventory read access.
- Never export or share password values, access tokens, or service-role keys.

### Stage 1 — application and schema preparation (no production cutover)
- Implement Supabase Auth sign-in/session restoration/sign-out and password reset.
- Load only safe profile fields after Auth sign-in; stop reading password from public.users.
- Replace role/status checks based on localStorage with database-enforced checks. Local checks may control navigation only.
- Replace offline fallback success with explicit database errors for protected writes. Do not persist passwords or full user objects in localStorage.
- Build registration requests and admin review/approval. Prevent duplicate profiles and client-assigned role/status.
- Design and implement job routing with an audit trail and hub-scoped permissions; see docs/JOB_ROUTING_WORKFLOW.md.
- Update CBT Center to Tech In Schools (TIS) in a coordinated migration, including historical-data compatibility.

### Stage 2 — map existing staff accounts
- Use Auth invitations/password setup, based on verified account ownership and current Auth state.
- Preserve each public.users.id; populate auth_user_id only after identity reconciliation.
- Log counts and non-sensitive error identifiers only; never log passwords.
- Do not remove legacy password storage until every account has a verified Auth mapping and login tests pass.

### Stage 3 — apply least-privilege RLS on staging
- Replace permissive policies and excessive grants for all affected tables as one reviewed, tested change.
- Ensure anonymous users cannot query staff profiles or operational records.
- Only active mapped profiles qualify for operational access.
- Protect role, hub, status, and identity mapping from staff self-updates.
- Apply the policy intent in supabase/drafts/rls_policy_design.sql only after assumptions are checked against the staging schema.
- Add RLS for routing records: only permitted current/receiving hub staff and authorized secretaries/admins may see or act on a transfer; prevent forged hub identities, skipping approval, or changing routing history.
- Test allowed and denied actions for anonymous visitors, pending staff, active staff in each hub, secretaries, and admins.

### Stage 4 — coordinated cutover
- Deploy database policies and matching frontend changes in a controlled sequence.
- Verify login, session refresh, logout, password reset/invites, registration requests, admin approvals, routing, all table operations, and cross-hub denials.
- Compare pre/post counts and confirm original profile IDs and foreign-key relationships remain intact.
- Only after verification, remove legacy password storage and old browser-based login logic in a separate migration.

### Job-routing schema design draft

- A schema-only draft now exists at `supabase/drafts/job_routing_schema.sql`.
- It proposes route templates, ordered template steps, and per-handoff transfer history, including review, explicit receiving-hub acceptance, and completion-review fields.
- The draft intentionally has no client grants or RLS policies and does not implement transition RPCs. It must not be run in production.
- Next implementation work is to validate exact live column types and job-type semantics, then implement and test narrowly granted trusted RPCs for request, review, accept, stage completion, and final approval. Each transition must verify the mapped active profile and hub/role permissions server-side.
- Acceptance must be an explicit step: approving a handoff does not change `jobs.hub`; only the trusted acceptance transition may move the job into the receiving hub's active queue.
- Support both route templates and per-job destination selection; deviations from a configured route require authorization and a recorded reason.

## Mandatory acceptance tests

- Anonymous clients cannot read staff profiles, jobs, reports, clients, inventory, announcements, or routing records.
- An Auth user without a mapped active profile cannot access operational data.
- Staff cannot change their own role, hub, status, or auth_user_id.
- Staff in Hub A cannot read or modify Hub B jobs/clients except for explicitly authorized routing handoffs.
- Staff can read/create only their own daily reports; admin oversight is separately tested.
- Staff cannot manage inventory or publish/edit/delete announcements.
- Staff can read only announcements targeted to all or their hub.
- Registration cannot create an active/admin profile; requests remain pending until admin approval, and duplicate existing staff profiles are prevented.
- A job handoff cannot be silently reassigned or marked complete by unauthorized staff. Each transfer records source hub, destination hub, requester, status, approver, timestamps, and notes.
- A job may route to its designated next hub only through the approved transition; final completion is auditable and requires the configured secretary/admin approval.
- Old CBT Center data remains traceable after the active hub label changes to Tech In Schools (TIS).
- A rejected database write is shown as failure and is never saved as a successful protected write in localStorage.
- Existing profile IDs and all five listed foreign-key relationships remain valid.

## Stop conditions

Do not apply production policy changes if a mapping is ambiguous, a foreign key would be broken, role labels are unresolved, or tests have not passed. The current work is a draft implementation branch. Do not merge it to main or perform destructive policy/grant changes until the coordinated frontend and database changes are reviewed and tested.
