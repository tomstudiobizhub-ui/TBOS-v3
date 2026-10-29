# TBOS-v3 Security Cutover Status

Branch: `security/supabase-auth-migration-implementation`

## Changes committed on this branch

- `index.html`: login now uses Supabase Auth `signInWithPassword`, validates the active profile through `tbos_my_safe_profile()`, and clears the legacy local identity cache on failed validation.
- `register.html`: public registration submits a row to `registration_requests`; it no longer inserts a row into `users`, chooses a role, or stores a browser-submitted password in the legacy profile table.
- `config.js`: database errors are no longer converted into successful local-only writes; protected reads no longer fall back to cached local records. User profile reads route through safe-profile/admin-list RPCs.
- `admin.html`: status changes call the proposed admin-only `tbos_admin_set_profile_status` RPC rather than updating `users` directly.
- `jobs.html`: the direct stage mutation action is disabled. It does not silently modify a job; the secure routing RPC/UI is still a required follow-up.
- `supabase/drafts/rls_cutover_review.sql`: draft replacement policies, restricted grants, safe admin profile RPCs, and hub-scoped policies based on the actual supplied schema.

## Important limitations

These changes are on the implementation branch only. They have **not** been deployed to the live GitHub Pages app, and the RLS SQL has **not** been executed against production.

The RLS file is a review/staging draft, not an approved one-click production migration. The app and SQL are not yet a complete release because:

1. Trusted job-routing RPCs and the corresponding request/review/acceptance/completion UI are not yet implemented. Direct stage changes are intentionally blocked rather than left insecure.
2. Admin profile status RPCs manage existing profile status only; they do not create Supabase Auth users or link new profiles. Public registration requests therefore still need a secure admin provisioning/invitation workflow.
3. Existing admin, dashboard, and reporting paths need an end-to-end pass against the proposed least-privilege grants, including the exact columns each page writes.
4. The proposed policies need staging tests with actual mapped admin, secretary, staff, and cross-hub accounts before production execution.
5. The legacy `users.password` column remains in the database and must not be selected by browser code. Removal is a separate post-cutover task after every required Auth mapping has been verified.

## Safe rollout order

1. Review the SQL draft and frontend changes together.
2. Implement the trusted job-routing and registration-provisioning functions.
3. Test in a non-production Supabase project or staging copy with existing-like rows and foreign keys.
4. Verify login, refresh, logout, profile reads, registration submission, admin actions, CRUD permissions, cross-hub denial, and routing transitions.
5. Compare row counts and profile IDs before/after.
6. Deploy the frontend and RLS migration as one coordinated cutover. Do not remove the old policies while the live frontend still depends on them.

## Production state

The earlier additive Auth objects and safe-profile function exist in production, but the broad legacy policies/grants described in the audit remain until a reviewed cutover is completed.
