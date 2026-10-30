# Tech in Schools workspace — release checklist

## Included in this branch
- Dedicated `tech-in-schools.html` workspace and dashboard.
- TBOS dashboard menu entry.
- Schools, facilitator assignments, classes/terms, student register, attendance, school payments, commissions, remittances, visit receipts/evidence, and daily/weekly/monthly reporting screens.
- Admin-only financial summary cards and review actions.
- Facilitator records scoped to assigned schools by database RLS; facilitators see their own submitted payment/remittance records.
- Attendance records are separate from payment/remittance records.
- Private receipt/remittance evidence bucket and upload UI.
- Mobile responsive layout, horizontal table scrolling, PWA manifest shortcut, install instructions, service-worker caching.
- UI smoke-test route added for the TIS page.

## Required before production
1. Review `supabase/drafts/tis_workspace_schema.sql` against the live Supabase helper functions and table structure.
2. Confirm `tbos_my_profile_id()` returns the existing `public.users.id`, and `tbos_my_role()` returns the current authenticated role.
3. Review the TIS RLS policies, especially assigned-school isolation, administrator review, and private storage evidence access.
4. Apply the reviewed schema in Supabase. The frontend cannot load or save TIS records until these tables and policies exist.
5. Test with an administrator and at least two facilitators assigned to different schools. Verify that neither facilitator can see or write to the other's school.
6. Verify upload and retrieval of receipt images from the private `tis-receipts` bucket.
7. Agree the commission policy before treating any commission value as payable. This implementation records explicit commission amounts and a basis note; it does not invent a rate.
8. Run responsive browser tests at mobile, tablet and desktop widths, then merge to `main` to publish through GitHub Pages.

## Safety
This branch does not modify production data and does not run SQL against Supabase. It preserves existing TBOS profile IDs. Do not merge or describe the TIS module as production-ready until the database migration and role-isolation tests above pass.
