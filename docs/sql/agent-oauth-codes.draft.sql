-- Nesmi OAuth authorization codes — DRAFT ONLY; not applied to production.
-- A trusted OAuth server generates >=256-bit random codes, stores ONLY SHA-256
-- hashes, and exchanges them in a single atomic UPDATE ... RETURNING statement.
-- Code exchange must also verify PKCE S256 against the stored challenge before
-- issuing tokens. This SQL alone is not an OAuth authorization server.
create table if not exists public.agent_oauth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique check (octet_length(code_hash) = 32),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 256),
  redirect_uri text not null check (length(redirect_uri) between 1 and 2048),
  code_challenge text not null check (
    length(code_challenge) = 43 and code_challenge ~ '^[A-Za-z0-9_-]+$'
  ),
  code_challenge_method text not null default 'S256'
    check (code_challenge_method = 'S256'),
  scopes text[] not null check (
    scopes <@ array['tasks:read', 'tasks:write']::text[]
  ),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint agent_oauth_codes_valid_expiry check (expires_at > created_at)
);

create index if not exists agent_oauth_codes_expiry_idx
  on public.agent_oauth_codes(expires_at);

alter table public.agent_oauth_codes enable row level security;
revoke all on public.agent_oauth_codes from public, anon, authenticated;
comment on table public.agent_oauth_codes is
  'Private hashed authorization codes. OAuth server only; no client access.';

-- Illustrative statement executed by a trusted server in a transaction.
-- Parameters: :code_hash (32-byte digest), :client_id, :redirect_uri.
-- The UPDATE row lock guarantees only one concurrent exchange succeeds.
-- Important: a real server must validate PKCE BEFORE executing this consume
-- operation, and must commit token/grant issuance in the SAME transaction.
--
-- UPDATE public.agent_oauth_codes
-- SET consumed_at = now()
-- WHERE code_hash = :code_hash
--   AND client_id = :client_id
--   AND redirect_uri = :redirect_uri
--   AND code_challenge_method = 'S256'
--   AND consumed_at IS NULL
--   AND expires_at > now()
-- RETURNING id, owner_id, client_id, scopes, code_challenge;
--
-- Never expose this statement as a public RPC without a secure authenticated
-- OAuth-server-only execution boundary and PKCE verification.
