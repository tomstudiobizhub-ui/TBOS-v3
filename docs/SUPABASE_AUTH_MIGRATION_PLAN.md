# TBOS-v3 Supabase Auth and RLS migration plan

Status: preparation only. This plan and the accompanying SQL policy design are drafts on the preparation branch. No production database changes have been applied.

## Confirmed current state

- The app is static HTML/CSS/JavaScript using Supabase JS v2 and `config.js`.
- The login page currently reads `public.users`, compares the submitted password in browser code, and stores the full profile in `localStorage.currentUser`.
- Registration currently writes a plaintext password and client-supplied profile fields to `public.users`.
- `config.js` falls back to localStorage when database reads/writes fail and can return `success: true` for an offline write. This is not acceptable for authentication or protected records.
- `public.users.id` is a UUID referenced by `announcements.created_by`, `clients.staff_id`, `daily_reports.staff_id`, `jobs.created_by`, and `staff_activities.staff_id`.
- The supplied audit found six legacy profile rows, all with status `active`; no duplicate normalized emails, missing/blank emails, legacy IDs already present in Auth, or email collision groups were reported.
- RLS is enabled on the seven supplied tables, but existing policies/grants include permissive public and authenticated access. RLS being enabled does not make those tables safe while permissive policies remain.
- The app's role labels, all data access paths, and the operational need for staff to read inventory still require a code-level review before final cutover.

## Decisions requested and policy intent

1. **Jobs — hub scope.** Active staff may read and operate on jobs in their own hub, subject to the operation-level permissions approved for each role. The current `jobs` schema has `hub` and `created_by`, but no assignment column. This design is hub-scoped, not assignment-scoped.
2. **Daily reports — own.** Staff may create and read only reports whose `staff_id` maps to their legacy profile UUID. They must not impersonate another staff member. A separate admin/supervisor read policy can be added only after the management roles are confirmed.
3. **Inventory — admin administration.** Draft baseline is admin-only read/write. Confirm whether staff need read-only stock visibility or a separate stock-usage request flow before enabling staff access.
4. **Announcements — admin administration.** Admins manage announcements. Active staff can read announcements targeted to `all` or their own hub; staff cannot publish, edit, or delete them.
5. **Clients — hub scope.** Active staff can read/create/update clients for their hub, with row checks preventing moving records to another hub. Delete should be denied to staff unless an explicit business need is confirmed.
6. **Staff registration — request.** Registration must not allow a visitor to select a trusted role/status. The request is pending until an admin approves it. Pending/inactive users must not gain operational-table access even if they have an Auth session.

## Identity mapping — preserve existing foreign keys

Do **not** replace `public.users.id`. Add a nullable `auth_user_id uuid UNIQUE REFERENCES auth.users(id)` mapping column in a later additive migration. Keep the existing profile UUID as the primary key so current foreign keys remain valid. Backfill mappings only after Auth users have been created and individually reconciled. Require one-to-one mapping and verify all six existing profiles are accounted for before cutover.

Do not directly insert into `auth.users` with SQL. Use a trusted one-time server-side Admin Auth API process if existing credentials can be safely and correctly migrated; otherwise preserve the profiles and use invite/password-reset onboarding. Never place a service-role key in browser code, GitHub Pages, or the repository.

## Staged implementation

### Stage 0 — read-only preflight (complete based on supplied results; re-run before change)
- Re-run `supabase/preflight/auth_migration_audit.sql` and save results privately.
- Confirm a restorable backup and recovery procedure.
- Review all tables, views, functions, grants, triggers, and application calls; inventory every current policy before replacing anything.
- Confirm exact role/status values and whether staff need inventory read access.
- Never export or share password values, access tokens, or service-role keys.

### Stage 1 — application and schema preparation (no production cutover)
- Add the `auth_user_id` mapping column in a reviewed, additive migration on a staging project first.
- Implement Supabase Auth sign-in/session restoration/sign-out and password reset.
- Load only safe profile fields after Auth sign-in; stop reading `password` from `public.users`.
- Replace role/status checks based on localStorage with database-enforced checks. Local checks may control navigation only.
- Replace offline fallback success with explicit database errors for protected writes. Do not persist passwords or full user objects in localStorage.
- Build registration requests so self-registration cannot assign role, hub, status, or approval. Use a trusted approval path.

### Stage 2 — map existing staff accounts
- Use a secure server-side Admin Auth API script, or invite/reset flow, based on the real format and suitability of legacy password values.
- Preserve each `public.users.id`; populate `auth_user_id` only after identity reconciliation.
- Log counts and non-sensitive error identifiers only; never log passwords.
- Do not remove `public.users.password` until every account has a verified Auth mapping and login tests pass.

### Stage 3 — apply least-privilege RLS on staging
- Replace the permissive policies and excessive grants for all affected tables as one reviewed, tested change.
- Ensure anonymous users cannot query staff profiles or operational records.
- Use an internal mapping helper based on `auth.uid() -> public.users.auth_user_id`; only active mapped profiles qualify.
- Protect role, hub, status, and identity mapping from staff self-updates.
- Apply the policy intent in `supabase/drafts/rls_policy_design.sql` only after its assumptions are checked against the staging schema.
- Test both allowed and denied actions for anonymous visitors, pending staff, active staff in each hub, and admins.

### Stage 4 — coordinated cutover
- Deploy database policies and matching frontend changes in a controlled sequence with a rollback plan.
- Verify login, session refresh, logout, reset/invites, registration requests, admin approvals, all table operations, and cross-hub denials.
- Compare pre/post counts and confirm all original profile IDs and foreign-key relationships remain intact.
- Only after verification, remove legacy password storage and old browser-based login logic in a separate migration.

## Mandatory acceptance tests

- Anonymous clients cannot read staff profiles, jobs, reports, clients, inventory, or announcements.
- An Auth user without a mapped active profile cannot access operational data.
- Staff cannot change their own role, hub, status, or `auth_user_id`.
- Staff in Hub A cannot read or modify Hub B jobs or clients.
- Staff can read/create only their own daily reports.
- Staff cannot manage inventory or publish/edit/delete announcements.
- Staff can read only announcements targeted to `all` or their hub.
- Registration cannot create an active/admin profile; a request remains pending until admin approval.
- A rejected database write is shown as a failure and is never saved as a successful protected write in localStorage.
- Existing profile IDs and all five listed foreign-key relationships remain valid.

## Stop / rollback conditions

Do not apply production changes if backup restoration is unverified, role labels are unresolved, any profile-to-Auth mapping is ambiguous, a foreign key would be broken, tests have not passed, or a service-role secret would be exposed. Roll back by restoring the previous frontend deployment and using the tested database rollback/restore procedure; do not attempt ad-hoc deletion of migrated Auth users or staff records.
