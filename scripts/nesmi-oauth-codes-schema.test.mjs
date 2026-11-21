import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../docs/sql/agent-oauth-codes.draft.sql', import.meta.url), 'utf8')
const statements = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
const exchange = sql.slice(sql.indexOf('-- UPDATE public.agent_oauth_codes'))

test('stores only SHA-256 hashes of authorization codes', () => {
  assert.match(statements, /code_hash bytea not null unique check \(octet_length\(code_hash\) = 32\)/i)
  assert.doesNotMatch(statements, /\bcode\s+(text|varchar|bytea)\b/i)
})
test('codes bind to owner, client, redirect URI, PKCE and expiry', () => {
  for (const field of ['owner_id', 'client_id', 'redirect_uri', 'code_challenge', 'expires_at', 'consumed_at']) {
    assert.match(statements, new RegExp('\\b' + field + '\\b'))
  }
  assert.match(statements, /code_challenge_method\s*=\s*'S256'/i)
})
test('codes cannot be read directly by anonymous or signed-in users', () => {
  assert.match(statements, /enable row level security/i)
  assert.match(statements, /revoke all on public\.agent_oauth_codes from public, anon, authenticated/i)
  assert.doesNotMatch(statements, /create policy\s+/i)
})
test('proposed exchange is atomic and refuses reused, expired or mismatched codes', () => {
  assert.match(exchange, /UPDATE public\.agent_oauth_codes/i)
  assert.match(exchange, /SET consumed_at = now\(\)/i)
  for (const predicate of ['code_hash = :code_hash', 'client_id = :client_id',
    'redirect_uri = :redirect_uri', 'consumed_at IS NULL', 'expires_at > now()']) {
    assert.ok(exchange.includes(predicate), 'missing exchange predicate: ' + predicate)
  }
  assert.match(exchange, /RETURNING id, owner_id, client_id, scopes, code_challenge/i)
})
