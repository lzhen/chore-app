-- Nesmi / Chorely structural release gate (Task165, 2026-10-27).
-- READ ONLY: catalog metadata; never reads, updates, or deletes customer/account rows.
-- Run against explicitly confirmed Nesmi Supabase project; do not put credentials here.
-- PASS verifies an auth.users ON DELETE CASCADE link and RLS for six core tables.
-- It does NOT demonstrate a real delete, all-storage erasure, claim RPC safety,
-- multi-account authorization, device behavior or App Store review readiness.
WITH expected(table_name, owner_column) AS (
  VALUES
    ('profiles', 'id'),
    ('team_members', 'owner_id'),
    ('chores', 'owner_id'),
    ('chore_completions', 'owner_id'),
    ('categories', 'owner_id'),
    ('member_availability', 'owner_id')
),
checked AS (
  SELECT e.table_name, e.owner_column, c.oid AS table_oid,
         COALESCE(c.relrowsecurity, false) AS rls_enabled,
         EXISTS (
           SELECT 1
           FROM pg_constraint fk
           JOIN pg_attribute col ON col.attrelid=fk.conrelid
                                AND col.attnum=fk.conkey[1]
           WHERE fk.contype='f'
             AND fk.conrelid=c.oid
             AND fk.confrelid='auth.users'::regclass
             AND fk.confdeltype='c'
             AND array_length(fk.conkey, 1)=1
             AND col.attname=e.owner_column
         ) AS owner_auth_cascade
  FROM expected e
  LEFT JOIN pg_namespace ns ON ns.nspname='public'
  LEFT JOIN pg_class c ON c.relnamespace=ns.oid AND c.relname=e.table_name
                       AND c.relkind IN ('r','p')
)
SELECT table_name, owner_column, rls_enabled, owner_auth_cascade,
       CASE WHEN table_oid IS NULL THEN 'FAIL_TABLE_MISSING'
            WHEN NOT rls_enabled THEN 'FAIL_RLS_DISABLED'
            WHEN NOT owner_auth_cascade THEN 'FAIL_AUTH_CASCADE_MISSING'
            ELSE 'PASS'
       END AS gate
FROM checked
ORDER BY table_name;
