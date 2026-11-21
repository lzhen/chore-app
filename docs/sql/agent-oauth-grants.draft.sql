-- Nesmi delegated agent grants (DRAFT; do not apply to production before review)
-- Tokens MUST be issued by an OAuth 2.1 authorization server and validated
-- before any grant lookup. Never store bearer tokens or Supabase user JWTs here.
create table if not exists public.agent_oauth_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 256),
  audience text not null check (length(audience) between 1 and 256),
  scopes text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint agent_oauth_grants_valid_expiry check (expires_at > created_at),
  constraint agent_oauth_grants_valid_scopes check (
    scopes <@ array['tasks:read','tasks:write']::text[]
  )
);
create index if not exists agent_oauth_grants_owner_idx
  on public.agent_oauth_grants(owner_id, client_id);
create index if not exists agent_oauth_grants_active_idx
  on public.agent_oauth_grants(expires_at) where revoked_at is null;

alter table public.agent_oauth_grants enable row level security;
-- Deliberately no client-facing RLS policies: grants are managed only by a
-- trusted authorization server after authenticating the resource owner.
revoke all on table public.agent_oauth_grants from anon, authenticated;
comment on table public.agent_oauth_grants is
  'Internal OAuth delegated consent grants. Never expose via public PostgREST.';

-- Do not add access tokens or refresh tokens to this table in plaintext.
-- Store opaque token hashes separately, with rotation, binding and expiry.
