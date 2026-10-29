# TBOS-v3 Supabase Auth migration plan

Status: preparation only. No production database changes are included in this branch.

## Current confirmed findings

- Project URL: `https://wbmshbmfrteutglydiay.supabase.co`.
- The app is static HTML/CSS/JavaScript using Supabase JS v2 and `config.js`.
- `index.html` reads `public.users`, compares the submitted password in browser code, and stores the entire profile object in `localStorage.currentUser`.
- `register.html` inserts a plaintext `password` plus user-selected profile fields into `public.users`.
- `config.js` falls back to localStorage on failed database reads/writes and may report a write as successful while offline. This must not be used as proof of successful authentication or a protected database write.
- `public.users` has a UUID `id`, required `email` and `password`, and profile / role / status / performance fields.
- RLS is enabled but not forced. The reported policy list includes permissive public SELECT/INSERT/UPDATE policies with `true` expressions. Table grants also include SELECT/INSERT/UPDATE/DELETE for `anon` and `authenticated`.
- Existing users' UUIDs are not yet confirmed to match `auth.users.id`. Do not add a foreign key or alter IDs until this is audited.
- Do not assume current user data, password quality, duplicate emails, foreign-key dependencies, or other tables' RLS state.

## Migration goals

1. Preserve each existing staff profile and its UUID wherever technically possible.
2. Use Supabase Auth for password verification and sessions; never select passwords from `public.users` in browser code.
3. Make role, status, approval, and financial permissions server/database enforced, not derived from editable localStorage.
4. Keep the existing static-site architecture and operational pages; migrate in small, testable stages.
5. Never expose a Supabase service-role/secret key in frontend files, GitHub Pages, browser storage, screenshots, or chat.
6. Do not report a write as successful when the database rejected it or the app is offline.

## Recommended phased plan

### Phase 0 — Read-only preflight (now)
- Run `supabase/preflight/auth_migration_audit.sql` in Supabase SQL Editor.
- Save the results privately. Share only counts, booleans, constraint names and non-sensitive diagnostics; do not share user rows, password values, keys, or tokens.
- Review all application code paths that read or write the users table and all tables referencing `public.users.id`.
- Confirm backup/restore access before any write migration.

### Phase 1 — Build and test without production DB changes
- Add an auth helper using `supabase.auth.signInWithPassword`, `getSession`, `onAuthStateChange`, and `signOut`.
- Replace the login check with Auth sign-in; fetch only the signed-in user's profile from `public.users`.
- Replace browser-trusted role/status checks with server/database policies. Client redirects are navigation only, not authorization.
- Remove user/profile password logging and avoid putting password fields in localStorage.
- Change registration to a controlled pending-approval flow. Public registration must not choose its own role or status.
- Change API wrapper behaviour so database failures are explicit; do not silently claim protected writes succeeded offline.
- Add tests for unauthenticated, staff, pending staff, active staff, and administrator scenarios.

### Phase 2 — Decide how to preserve existing credentials
Preferred options, in order:
1. If the current password values are genuine plaintext passwords and management approves keeping them, run a reviewed, one-time migration script from a trusted local/server environment. The script must use a secret key only in an environment variable, create Auth users through the Auth Admin API, preserve the legacy UUID as Auth user ID when supported and collision-free, hash passwords through Supabase Auth, and log only counts/errors without logging password values. Never run this script in the browser or GitHub Actions with a committed secret.
2. If passwords are invalid, duplicated, unavailable, or not appropriate to migrate, preserve profile rows and UUIDs but invite users / require password reset. This preserves staff accounts but users will need to establish new passwords.
- Do not directly insert rows into Supabase-managed `auth.users` using ad hoc SQL.
- Before importing, detect duplicate normalized emails, empty/invalid emails, and IDs already present in `auth.users`.
- Do not drop `public.users.password` until all accounts are verified in Auth and the new login path passes tests. After cutover, remove the column and rotate any credentials that may have been exposed.

### Phase 3 — Database protection
- Replace permissive policies with least-privilege policies and matching table grants.
- Use `auth.uid()` to bind profiles to the authenticated identity.
- Make role/status changes administrator-only, enforced in the database or trusted server function. Never trust `user_metadata`, `localStorage.currentUser.role`, or a client-supplied role for authorization.
- Restrict public/anon access to staff profiles. Keep registration via Auth signup, with a safe default role and pending status.
- Review each operational table separately; user-table policies do not protect jobs, inventory, clients, receipts, attendance, or finance tables.
- Add SQL tests proving both allowed and denied actions for anon, staff, pending staff, and admin.

### Phase 4 — Cutover and verification
- Test on a staging project or a recoverable backup first.
- Deploy the coordinated frontend and database changes in a controlled order.
- Verify active and pending accounts, password reset/invites, logout/session expiry, staff self-profile updates, admin approvals, and admin-only financial data.
- Confirm unauthenticated requests cannot read profiles/passwords or modify users; staff cannot change their own role/status or see another staff member's restricted records.
- Confirm all existing staff profiles remain and each migrated profile maps to the expected Auth UUID.
- Remove legacy password storage and disable the old browser-based login only after the new flow is proven.

## Stop conditions

Do not apply a write migration if:
- the database backup/restore path is not confirmed;
- duplicate/invalid emails or ID collisions have not been resolved;
- the existing IDs' relationships to other tables are unknown;
- a migration would drop or overwrite staff data;
- the service-role key would be placed in frontend code or committed files;
- login and RLS tests have not passed.

## Current next action

Run the read-only SQL in `supabase/preflight/auth_migration_audit.sql`. This is inspection only. It intentionally does not modify tables, grants, policies, or user records.
