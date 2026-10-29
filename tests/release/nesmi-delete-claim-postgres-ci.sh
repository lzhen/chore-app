#!/usr/bin/env bash
# Nesmi account-delete claim: PostgreSQL-only isolated synthetic regression.
# Runs exclusively in GitHub Actions ephemeral postgres:16; never uses Supabase.
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" || "${PGDATABASE:-}" != "nesmi_claim_test" ||
      ! "${PGHOST:-}" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
  echo "Refusing to run outside the dedicated local CI database" >&2
  exit 2
fi

cd "$(dirname "$0")/../.."
temp="$(mktemp -d)"
cleanup() {
  # This disposable CI service is destroyed after the job; explicitly clean
  # objects to make failure modes observable and avoid leaving test fixtures.
  psql -X -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null 2>&1 || true
DROP FUNCTION IF EXISTS public.nesmi_delete_claim_draft_finalize(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.nesmi_delete_claim_draft_acquire(uuid);
DROP TABLE IF EXISTS public.nesmi_account_deletion_claim_draft;
SQL
  rm -rf "$temp"
}
trap cleanup EXIT

psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
-- Model Supabase's JWT service role in disposable PG, not postgres superuser.
CREATE ROLE service_role NOLOGIN BYPASSRLS;
SQL

# Run the prototype UNMODIFIED: real PostgreSQL parses and executes the
# sequential assertions, then its own ROLLBACK must remove every object.
psql -X -v ON_ERROR_STOP=1 -q   -f docs/release/prototypes/nesmi_delete_claim_nondeploy.sql
rolled_back="$(psql -X -qAt -c "SELECT to_regclass('public.nesmi_account_deletion_claim_draft') IS NULL")"
[[ "$rolled_back" == "t" ]] || { echo "Prototype did not roll back" >&2; exit 1; }

# This alteration of BEGIN/ROLLBACK is ONLY for the isolated, empty CI database
# to make the fixture visible to two independent postgres connections. The
# original prototype file remains rollback-only and outside migrations.
sed -e '/^BEGIN;$/d' -e '/^ROLLBACK;$/d'   docs/release/prototypes/nesmi_delete_claim_nondeploy.sql   | psql -X -v ON_ERROR_STOP=1 -q

# Assert service-role-only privileges and no cascading dependency on auth.users.
privileges="$(psql -X -qAt -c "
 SELECT
   has_function_privilege('service_role', 'public.nesmi_delete_claim_draft_acquire(uuid)', 'EXECUTE')
   AND has_function_privilege('service_role', 'public.nesmi_delete_claim_draft_finalize(uuid,uuid,text)', 'EXECUTE')
   AND NOT has_function_privilege('anon', 'public.nesmi_delete_claim_draft_acquire(uuid)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.nesmi_delete_claim_draft_finalize(uuid,uuid,text)', 'EXECUTE')
   AND NOT has_table_privilege('anon', 'public.nesmi_account_deletion_claim_draft', 'SELECT')
   AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.nesmi_account_deletion_claim_draft'::regclass)
   AND NOT EXISTS (
     SELECT 1 FROM pg_constraint
     WHERE conrelid='public.nesmi_account_deletion_claim_draft'::regclass
       AND contype='f'
   )")"
[[ "$privileges" == "t" ]] || { echo "Claim privilege or retention contract failed" >&2; exit 1; }

# Verify executed RPC rights under simulated Supabase API roles, rather than
# only inspecting privilege metadata from the postgres superuser.
service_account='00000000-0000-4000-8000-00000000c333'
service_receipts="$(psql -X -v ON_ERROR_STOP=1 -qAt <<SQL
BEGIN;
SET LOCAL ROLE service_role;
SELECT count(*) FROM public.nesmi_delete_claim_draft_acquire('$service_account');
SELECT public.nesmi_delete_claim_draft_finalize(
  '$service_account',
  (SELECT claim_id FROM public.nesmi_account_deletion_claim_draft
   WHERE account_id = '$service_account'), 'confirmed');
SELECT count(*) FROM public.nesmi_delete_claim_draft_acquire('$service_account');
COMMIT;
SQL
)"
[[ "$service_receipts" == $'1\nt\n0' ]] || {
  echo "Service-role acquire/finalize/replay receipts unexpected: $service_receipts" >&2
  exit 1
}

# Public API roles must fail when actually executing the privileged RPC.
denied_account='00000000-0000-4000-8000-00000000d444'
for role in anon authenticated; do
  if psql -X -v ON_ERROR_STOP=1 -qAt >"$temp/$role-rpc.log" 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE $role;
SELECT count(*) FROM public.nesmi_delete_claim_draft_acquire('$denied_account');
SQL
  then
    echo "$role unexpectedly executed the privileged delete-claim RPC" >&2
    exit 1
  fi
  if ! grep -Eqi 'permission denied (for function|for schema|for relation|for table)' "$temp/$role-rpc.log"; then
    cat "$temp/$role-rpc.log" >&2
    echo "$role RPC failed for a reason other than a permission denial" >&2
    exit 1
  fi
done
[[ "$(psql -X -qAt -c "SELECT count(*) FROM public.nesmi_account_deletion_claim_draft WHERE account_id='$denied_account'")" == "0" ]] || {
  echo "An unprivileged role changed a protected deletion claim" >&2; exit 1
}
echo "PASS: service-role RPC and anon/authenticated denial (ephemeral PostgreSQL only)"

# Transaction A holds an uncommitted unique-row claim. Its advisory lock is
# solely a synchronization signal for the test driver, NOT application locking.
account="00000000-0000-4000-8000-00000000a111"
(
  PGAPPNAME=nesmi_claim_winner psql -X -v ON_ERROR_STOP=1 -qAt -c "
    BEGIN;
    SELECT claim_id FROM public.nesmi_delete_claim_draft_acquire('$account');
    SELECT pg_advisory_xact_lock(934001);
    SELECT pg_sleep(5);
    COMMIT;" >"$temp/winner.log" 2>&1
) &
winner_pid=$!

ready=false
for _ in $(seq 1 70); do
  active="$(psql -X -qAt -c "
    SELECT EXISTS (SELECT 1 FROM pg_locks
      WHERE locktype='advisory' AND objid=934001 AND granted)")"
  if [[ "$active" == "t" ]]; then ready=true; break; fi
  sleep 0.1
done
[[ "$ready" == "true" ]] || { cat "$temp/winner.log" >&2; echo "Winner never claimed" >&2; exit 1; }

# Transaction B must wait on the unique index conflict until A commits,
# then it must receive ZERO claims; neither worker may win twice.
(
  PGAPPNAME=nesmi_claim_loser psql -X -v ON_ERROR_STOP=1 -qAt     -c "SELECT count(*) FROM public.nesmi_delete_claim_draft_acquire('$account')"     > "$temp/loser.log" 2>&1
) &
loser_pid=$!
blocked=false
for _ in $(seq 1 35); do
  state="$(psql -X -qAt -c "
    SELECT EXISTS (SELECT 1 FROM pg_stat_activity
      WHERE application_name='nesmi_claim_loser' AND wait_event_type='Lock')")"
  if [[ "$state" == "t" ]]; then blocked=true; break; fi
  sleep 0.1
done
[[ "$blocked" == "true" ]] || { echo "No observed cross-connection conflict wait" >&2; exit 1; }
wait "$winner_pid"
wait "$loser_pid"
[[ "$(cat "$temp/loser.log")" == "0" ]] || {
  echo "Losing concurrent request acquired a duplicate claim" >&2; exit 1;
}
[[ "$(psql -X -qAt -c "SELECT count(*) FROM public.nesmi_account_deletion_claim_draft WHERE account_id='$account'")" == "1" ]]   || { echo "Claim uniqueness failed" >&2; exit 1; }
echo "PASS: rollback-only SQL, role grants/RLS, and two-connection atomic claim (synthetic CI only)"
