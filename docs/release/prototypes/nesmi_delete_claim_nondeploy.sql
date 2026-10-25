-- NESMI / CHORELY — NON-DEPLOYED SERVER-SIDE DELETION CLAIM PROTOTYPE
-- 2026-10-25 | Release HOLD | INTERNAL REVIEW ONLY
--
-- INTENTIONALLY OUTSIDE supabase/migrations AND supabase/functions.
-- This file must not be applied to production, staging, or a real customer DB.
-- BEGIN ... ROLLBACK makes the prototype self-reverting even if evaluated in an
-- authorized disposable Supabase-shaped PostgreSQL sandbox. It has NOT been run.
--
-- Purpose: turn Task120's actual-source concurrent-delete negative test and
-- Task121's one-process Map illustration into a reviewable transactional SQL
-- proposal. A PK-backed INSERT ... ON CONFLICT DO NOTHING is the atomic boundary
-- between separate function workers; SELECT-then-INSERT and localStorage are NOT.
--
-- CRITICAL OUTSTANDING PRODUCT / SECURITY DECISIONS:
-- - TestFlight 1.0(122) sends a legacy bodyless deletion request. PR #35's
--   strict draft Edge requires expectedUserId; do not deploy it alone.
-- - Client/Edge rollout and the precise legacy-bodyless policy require approval.
-- - This table intentionally has NO foreign key to auth.users: deletion must
--   not cascade away the durable claim. Retention/erasure and administrative
--   reconciliation of claim records require privacy/security review.
-- - Only the service-role-backed Edge server may call these RPC functions;
--   bearer authentication + expected-user matching MUST happen before acquire.
-- - No automatic claim expiry, unlock or retry after ambiguous auth deletion.
-- - No live accounts, credentials, endpoints or migrations are involved here.
--
-- Endpoint orchestration contract (NOT implemented here):
-- 1. Authenticate bearer with Supabase getUser (not user-supplied ID alone).
-- 2. Resolve B122 versus upgraded body contract under an approved policy.
-- 3. Reject mismatched expectedUserId against authenticated bearer identity.
-- 4. Use service role to RPC acquire(authenticatedUser.id).
-- 5. Only exactly ONE newly returned claim authorizes admin.deleteUser once.
--    Conflict, RPC error, or no claim => never invoke admin.deleteUser.
-- 6. On confirmed admin success, RPC finalize(...,'confirmed'); send {deleted:
--    true} ONLY if finalize itself is durably acknowledged.
-- 7. On admin error / timeout / unknown outcome, try finalize(...,'uncertain').
--    Even if this update fails, leave the existing pending claim locked;
--    never auto retry deletion or claim success. Reconcile manually.
-- 8. An authenticated retry encountering an existing claim must return a safe
--    no-retry response (not deleted:true); deleted users may lack a valid bearer.
--
-- A passing SQL smoke test below does NOT demonstrate concurrent transaction
-- behavior, REST/RPC authorization, actual Edge logic, Supabase compatibility,
-- account removal, TestFlight or App Review acceptance.

BEGIN;

CREATE TABLE public.nesmi_account_deletion_claim_draft (
  account_id uuid PRIMARY KEY,
  claim_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'confirmed', 'uncertain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CHECK (
    (state = 'pending' AND finalized_at IS NULL)
    OR
    (state IN ('confirmed','uncertain') AND finalized_at IS NOT NULL)
  )
);
-- Deliberately NO REFERENCES auth.users; irreversible user deletion may cascade.
ALTER TABLE public.nesmi_account_deletion_claim_draft ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated. Service role bypasses RLS; no client read.
REVOKE ALL ON TABLE public.nesmi_account_deletion_claim_draft
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.nesmi_account_deletion_claim_draft TO service_role;

-- A unique, durable row is the once-only reservation for this account ID.
-- Returns exactly one claim_id to the winner, zero rows to every loser.
CREATE FUNCTION public.nesmi_delete_claim_draft_acquire(p_account_id uuid)
RETURNS TABLE(claim_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $sql$
  INSERT INTO public.nesmi_account_deletion_claim_draft(account_id)
  SELECT p_account_id WHERE p_account_id IS NOT NULL
  ON CONFLICT (account_id) DO NOTHING
  RETURNING nesmi_account_deletion_claim_draft.claim_id;
$sql$;

-- Only the reservation holder may move pending -> one terminal state.
CREATE FUNCTION public.nesmi_delete_claim_draft_finalize(
  p_account_id uuid, p_claim_id uuid, p_state text
)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $sql$
  WITH transitioned AS (
    UPDATE public.nesmi_account_deletion_claim_draft
       SET state = p_state, finalized_at = now()
     WHERE account_id = p_account_id
       AND claim_id = p_claim_id
       AND state = 'pending'
       AND p_state IN ('confirmed', 'uncertain')
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM transitioned);
$sql$;

REVOKE ALL ON FUNCTION public.nesmi_delete_claim_draft_acquire(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nesmi_delete_claim_draft_finalize(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nesmi_delete_claim_draft_acquire(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.nesmi_delete_claim_draft_finalize(uuid,uuid,text)
  TO service_role;

-- Sequential synthetic smoke assertions; deliberately no auth.user or deletion.
-- These would execute only in a separately authorized disposable PG environment.
DO $assert$
DECLARE
  a uuid := '00000000-0000-4000-8000-000000000001';
  b uuid := '00000000-0000-4000-8000-000000000002';
  first_id uuid;
  second_id uuid;
  count_again integer;
  did_finalize boolean;
BEGIN
  SELECT claim_id INTO first_id
    FROM public.nesmi_delete_claim_draft_acquire(a);
  IF first_id IS NULL THEN RAISE EXCEPTION 'first claim failed'; END IF;

  SELECT count(*) INTO count_again
    FROM public.nesmi_delete_claim_draft_acquire(a);
  IF count_again <> 0 THEN RAISE EXCEPTION 'replay re-acquired'; END IF;

  SELECT claim_id INTO second_id
    FROM public.nesmi_delete_claim_draft_acquire(b);
  IF second_id IS NULL OR second_id = first_id
    THEN RAISE EXCEPTION 'account scope violated'; END IF;

  SELECT public.nesmi_delete_claim_draft_finalize(a, first_id, 'confirmed')
    INTO did_finalize;
  IF did_finalize IS NOT TRUE
    THEN RAISE EXCEPTION 'valid terminal transition failed'; END IF;

  SELECT public.nesmi_delete_claim_draft_finalize(a, first_id, 'uncertain')
    INTO did_finalize;
  IF did_finalize IS NOT FALSE
    THEN RAISE EXCEPTION 'terminal claim changed again'; END IF;

  SELECT public.nesmi_delete_claim_draft_finalize(b, first_id, 'confirmed')
    INTO did_finalize;
  IF did_finalize IS NOT FALSE
    THEN RAISE EXCEPTION 'wrong claim token finalized another account'; END IF;
END;
$assert$;

-- Further gates before any deployment: two PostgreSQL connections racing the
-- same subject; transaction abort/timeout; post-auth-deletion claim survival;
-- auth/RPC grants; explicit B122 compatibility, erasure/retention and observed
-- Edge/SDK behavior with an authorized disposable account.
ROLLBACK;
