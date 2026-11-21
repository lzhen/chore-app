import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../docs/sql/agent-oauth-grants.draft.sql', import.meta.url), 'utf8')
const executable = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')

test('grant table is owner-bound and expires', () => {
  assert.match(executable, /owner_id uuid not null references auth\.users\(id\) on delete cascade/i)
  assert.match(executable, /expires_at timestamptz not null/i)
  assert.match(executable, /revoked_at timestamptz/i)
})
test('grant scope is restricted to supported task scopes', () => {
  assert.match(executable, /scopes\s*<@\s*array\['tasks:read','tasks:write'\]/i)
})
test('grant table denies anonymous and authenticated direct access', () => {
  assert.match(executable, /enable row level security/i)
  assert.match(executable, /revoke all on table public\.agent_oauth_grants from anon, authenticated/i)
  assert.doesNotMatch(executable, /create policy\s+/i)
})
test('grant schema does not persist bearer credentials', () => {
  assert.doesNotMatch(executable, /\b(access_token|refresh_token|supabase_jwt|bearer_token)\s+(text|varchar|bytea)\b/i)
})
