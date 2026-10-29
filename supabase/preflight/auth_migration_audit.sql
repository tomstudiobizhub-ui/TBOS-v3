-- TBOS-v3 Auth migration preflight — READ ONLY
-- Run each SELECT separately in Supabase SQL Editor.
-- Do not export or share user rows or password values.

-- 1. Confirm RLS state (should match the earlier result).
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'r';

-- 2. Count legacy profile rows only; no personal data returned.
SELECT count(*) AS legacy_profile_count FROM public.users;

-- 3. Check duplicate email addresses case-insensitively without exposing addresses.
SELECT count(*) AS duplicate_email_groups
FROM (
  SELECT lower(trim(email)) AS normalized_email
  FROM public.users
  GROUP BY lower(trim(email))
  HAVING count(*) > 1
) d;

-- 4. Count missing/blank emails only.
SELECT count(*) AS missing_or_blank_email_count
FROM public.users
WHERE email IS NULL OR trim(email) = '';

-- 5. Count IDs already present in Supabase Auth; does not return emails or IDs.
SELECT count(*) AS legacy_ids_already_in_auth
FROM public.users u
JOIN auth.users a ON a.id = u.id;

-- 6. Count Auth email collisions without exposing email addresses.
SELECT count(*) AS email_collision_groups
FROM (
  SELECT lower(trim(u.email)) AS normalized_email
  FROM public.users u
  JOIN auth.users a ON lower(trim(a.email)) = lower(trim(u.email))
  WHERE u.email IS NOT NULL AND trim(u.email) <> ''
  GROUP BY lower(trim(u.email))
) d;

-- 7. List foreign-key dependencies pointing to public.users (names only).
SELECT
  con.conname AS constraint_name,
  src_ns.nspname AS source_schema,
  src.relname AS source_table,
  src_col.attname AS source_column,
  tgt_col.attname AS target_column
FROM pg_constraint con
JOIN pg_class src ON src.oid = con.conrelid
JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
JOIN pg_class tgt ON tgt.oid = con.confrelid
JOIN pg_attribute src_col
  ON src_col.attrelid = src.oid AND src_col.attnum = con.conkey[1]
JOIN pg_attribute tgt_col
  ON tgt_col.attrelid = tgt.oid AND tgt_col.attnum = con.confkey[1]
WHERE con.contype = 'f'
  AND tgt.relnamespace = 'public'::regnamespace
  AND tgt.relname = 'users'
ORDER BY source_schema, source_table, constraint_name;

-- 8. Inventory exposed public tables and their RLS state; no rows/data.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 9. Show current grants for public.users (privilege names only).
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'users'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, privilege_type;

-- 10. Count profiles with likely active/pending statuses; no identities exposed.
SELECT lower(trim(coalesce(status, '(null)'))) AS status_label,
       count(*) AS profile_count
FROM public.users
GROUP BY lower(trim(coalesce(status, '(null)')))
ORDER BY status_label;

-- 11. Inventory policies for all public tables. Review policy expressions before cutover.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression, with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 12. Read-only column/type inventory needed before routing RPC implementation.
-- Returns schema metadata only; no business records or personal values.
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('jobs', 'users', 'daily_reports', 'announcements')
ORDER BY table_name, ordinal_position;

-- 13. Read-only constraints/indexes for jobs and users.
SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name AS referenced_table,
       ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_schema = ccu.constraint_schema
 AND tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('jobs', 'users')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
