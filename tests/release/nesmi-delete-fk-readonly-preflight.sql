-- Nesmi / Chorely — READ-ONLY hosted account-deletion foreign-key preflight
-- Task217 | 2026-10-29 PDT | REVIEW ONLY | RELEASE HOLD
--
-- Purpose: verify that all six known owner-linked application tables have
-- a direct ON DELETE CASCADE foreign key to auth.users. This query reads
-- PostgreSQL catalog metadata ONLY: no identities, household rows, secrets,
-- writes, transactions, migrations, RPCs, user deletion, or service roles.
--
-- First run independently against a separately approved non-production
-- project. The initial 2026-10-29 read-only metadata execution on the EXISTING
-- Nesmi project rosofbnimiothwxsabyr returned PASS (6/6) with zero failures.
-- That was NOT a user/account deletion test and does NOT authorize running
-- any write, deploying v2, or treating account deletion as accepted.
--
-- Limitations: this only covers the listed direct FKs. It does not certify
-- Auth admin.deleteUser behavior, functions/triggers, object storage,
-- external processors, retention, backups, deletion receipts, network
-- failures, or installed B123 bodyless-client compatibility. Do not infer
-- compliance or end-to-end deletion safety from PASS.
WITH expected(child_table, constraint_name) AS (
  VALUES
    ('public.profiles'::regclass, 'profiles_id_fkey'),
    ('public.team_members'::regclass, 'team_members_owner_id_fkey'),
    ('public.chores'::regclass, 'chores_owner_id_fkey'),
    ('public.chore_completions'::regclass, 'chore_completions_owner_id_fkey'),
    ('public.categories'::regclass, 'categories_owner_id_fkey'),
    ('public.member_availability'::regclass, 'member_availability_owner_id_fkey')
),
matched AS (
  SELECT
    e.child_table::text AS table_name,
    e.constraint_name,
    co.oid IS NOT NULL AS constraint_exists,
    (co.confrelid = 'auth.users'::regclass AND
      co.confdeltype = 'c' AND co.contype = 'f') AS cascades_from_auth_user
  FROM expected e
  LEFT JOIN pg_constraint AS co
    ON co.conrelid = e.child_table
   AND co.conname = e.constraint_name
)
SELECT
  CASE
    WHEN COUNT(*) = 6 AND bool_and(constraint_exists AND cascades_from_auth_user)
      THEN 'PASS'
    ELSE 'FAIL'
  END AS result,
  COUNT(*) AS expected_constraints,
  COUNT(*) FILTER (
    WHERE constraint_exists AND cascades_from_auth_user
  ) AS verified_cascade_constraints,
  COALESCE(
    array_agg(table_name || '.' || constraint_name)
      FILTER (WHERE NOT constraint_exists OR NOT cascades_from_auth_user),
    ARRAY[]::text[]
  ) AS failures
FROM matched;
