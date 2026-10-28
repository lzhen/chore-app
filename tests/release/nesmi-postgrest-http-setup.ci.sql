-- Ephemeral ONLY: authenticated PostgREST A/B HTTP acceptance, after SQL migration gate.
-- The GitHub Actions DB is destroyed after each run. No remote Supabase data.
\set ON_ERROR_STOP on
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'nesmi_http_ci_only';
GRANT anon, authenticated TO authenticator;

-- PostgREST 12 emits request.jwt.claims as JSON. Match Supabase auth.uid()
-- semantics while preserving the legacy per-claim setting used by SQL tests.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  )
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
\echo 'PASS: local-only PostgREST authenticator and auth.uid JWT-claims fixture ready.'
