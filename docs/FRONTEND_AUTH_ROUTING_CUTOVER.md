# TBOS-v3 Frontend Cutover Checklist (Draft)

Status: planning checklist only. No live application behavior is changed by this document.

## Current code paths reviewed

- `index.html` currently compares the submitted password with the `password` field returned from `public.users`, then stores the returned user object in `localStorage.currentUser`.
- `jobs.html` reads `localStorage.currentUser` for identity and hub display.
- `jobs.html` has a stage-selection interface and an `updateJobStage()` path that writes a selected value directly to `jobs.stage`. This must not be treated as secure hub routing or as approval of a handoff.
- The existing job stage and payment fields are distinct in the UI. The routing migration must preserve payment fields and avoid silently redefining existing `jobs.status` or `jobs.stage` values.
- `config.js` includes legacy data-access/offline fallback behavior. Protected writes must not report success if the database write failed or was replaced by a local-only fallback.
- The legacy registration page must be checked and updated so visitors submit a request rather than directly inserting a profile or choosing privileged role/status values.

## Required frontend changes before cutover

### Authentication and session

1. Replace browser-side password comparison with Supabase Auth sign-in.
2. Restore the Supabase Auth session on page load and use `auth.getUser()`/the supported session APIs to establish the authenticated identity.
3. Load the safe profile through the reviewed safe-profile RPC; deny operational pages if no active mapped profile is returned.
4. Replace `localStorage.currentUser` as an authority source. A display cache may contain only non-sensitive UI preferences; never trust cached role, hub, status, profile ID, or password to authorize an action.
5. Implement sign-out using Supabase Auth and password reset/invitation handling.
6. Make database failures visible; remove any success-like local fallback for protected writes.

### Job routing UI

1. Keep existing job details and payment displays working while the new routing UI is introduced.
2. Replace direct stage mutation as a routing mechanism with the approved transition flow:
   - request handoff;
   - destination secretary/admin review;
   - receiving hub explicit acceptance;
   - stage work and next handoff;
   - completion review and final approval.
3. Add separate views/queues for outgoing pending requests, destination review, approved incoming work awaiting acceptance, active accepted work, rejected requests, and completion review.
4. Show route history with source/destination hubs, stage, requester, reviewer, accepter, timestamps, and notes.
5. Route templates suggest a next hub; authorized per-job destination selection remains available. Overrides must be permission-checked and include a reason.
6. Do not move `jobs.hub` from the browser. The reviewed acceptance RPC should update the active hub and transfer record atomically after verifying destination authorization.
7. Keep routing status separate from payment status. Do not overload `payment_status` or assume the existing `jobs.status` means routing status.

### Registration and profile administration

1. Public registration creates a pending request only.
2. Admin review must reconcile an existing profile by normalized email before creating or linking any profile.
3. No public form can assign role, Active status, Auth UID, or an unrestricted hub.
4. Existing profile IDs and their operational foreign keys must remain unchanged.
5. Preserve the legacy password column until all required Auth mappings and login tests have passed; remove it only in a separate verified post-cutover migration.

## Cutover gates

Do not deploy the frontend cutover until all of these are true:

- Actual database column types, constraints, and all relevant policy/grant names have been reviewed.
- Secure transition RPCs and minimal grants have been tested on staging.
- Active staff mappings have been reconciled without ambiguous identities.
- Login, refresh, logout, registration request, admin approval, route request/review/acceptance, completion approval, and cross-hub denial tests pass.
- Existing jobs, staff profile IDs, and foreign-key relationships have been counted and verified before/after.
- The CBT Center to Tech In Schools (TIS) rename has a compatibility plan for historical jobs, reports, and announcement targets.
- Database and frontend changes are deployed as one coordinated release; broad legacy policies are not removed while the old frontend still depends on them.

## Important distinction

This checklist is not a substitute for code review or staging tests. The current branch contains draft planning and schema documents only; do not infer that the login, routing UI, RLS policies, or production app have been migrated.
