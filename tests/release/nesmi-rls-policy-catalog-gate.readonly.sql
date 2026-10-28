-- NESMI INTERNAL RELEASE GATE: SELECT-ONLY PostgreSQL RLS policy catalog audit.
-- No customer rows, auth identities, passwords, keys, INSERT/UPDATE/DELETE,
-- DDL, migrations or production configuration changes.
-- Expected policy signatures are pinned to the verified 2026-10-27 catalog.
-- A FAIL means policy/role drift requires human inspection; a PASS means
-- only metadata consistency, NOT live two-account RLS or iPhone acceptance.
WITH expected_seed (table_name, policy_name, command, role_name, identity_column, needs_check) AS (
  VALUES
    ('categories', 'categories_owner_access', 'ALL', 'authenticated', 'owner_id', true),
    ('chores', 'chores_owner_access', 'ALL', 'authenticated', 'owner_id', true),
    ('chore_completions', 'chore_completions_owner_access', 'ALL', 'authenticated', 'owner_id', true),
    ('member_availability', 'member_availability_owner_access', 'ALL', 'authenticated', 'owner_id', true),
    ('team_members', 'team_members_owner_access', 'ALL', 'authenticated', 'owner_id', true),
    ('profiles', 'Users can update their own profile', 'UPDATE', 'public', 'id', true),
    ('profiles', 'Users can view their own profile', 'SELECT', 'public', 'id', false)
),
expected AS (
  SELECT table_name, policy_name, command, role_name AS role_set,
         'PERMISSIVE'::text AS permissive,
         format('(( SELECT auth.uid() AS uid) = %I)', identity_column) AS using_expr,
         CASE WHEN needs_check
              THEN format('(( SELECT auth.uid() AS uid) = %I)', identity_column)
              ELSE NULL::text END AS check_expr
  FROM expected_seed
),
actual AS (
  SELECT tablename::text AS table_name, policyname::text AS policy_name,
         cmd::text AS command, array_to_string(roles, ',') AS role_set,
         permissive::text, qual::text AS using_expr, with_check::text AS check_expr
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename::text IN (SELECT DISTINCT table_name FROM expected)
),
policy_drift AS (
  SELECT * FROM (SELECT * FROM expected EXCEPT SELECT * FROM actual) missing_expected
  UNION ALL
  SELECT * FROM (SELECT * FROM actual EXCEPT SELECT * FROM expected) unexpected_actual
),
audit AS (
  SELECT t.table_name, COALESCE(c.relrowsecurity, false) AS rls_enabled,
         COALESCE(c.relforcerowsecurity, false) AS force_rls,
         (SELECT count(*) FROM expected e WHERE e.table_name = t.table_name) AS expected_policy_count,
         (SELECT count(*) FROM actual a WHERE a.table_name = t.table_name) AS actual_policy_count,
         (SELECT count(*) FROM policy_drift d WHERE d.table_name = t.table_name) AS drift_count
  FROM (SELECT DISTINCT table_name FROM expected) t
  LEFT JOIN pg_catalog.pg_class c
    ON c.relname = t.table_name AND c.relnamespace = 'public'::regnamespace
)
SELECT table_name, rls_enabled, force_rls, expected_policy_count,
       actual_policy_count, drift_count,
       CASE WHEN rls_enabled AND drift_count = 0
                      AND actual_policy_count = expected_policy_count
            THEN 'PASS' ELSE 'FAIL' END AS catalog_gate
FROM audit ORDER BY table_name;
