import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'

const source = readFileSync(new URL('../supabase/functions/_shared/authorizationCode.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const module = { exports: {} }
vm.runInNewContext(js, { module, exports: module.exports, Number })
const { authorizeCodeExchange: authorize } = module.exports

const now = 1_800_000_000
const code = {
  clientId: 'chatgpt-client',
  redirectUri: 'https://client.example/oauth/callback',
  ownerId: 'nesmi-owner',
  codeChallenge: 'a'.repeat(43),
  codeChallengeMethod: 'S256',
  issuedAtEpochSeconds: now - 60,
  expiresAtEpochSeconds: now + 60,
  consumedAtEpochSeconds: null,
}
const request = {
  clientId: 'chatgpt-client',
  redirectUri: 'https://client.example/oauth/callback',
  nowEpochSeconds: now,
}
const check = (codePatch = {}, requestPatch = {}) =>
  authorize({ ...code, ...codePatch }, { ...request, ...requestPatch })

test('accepts a matching, unexpired, unused authorization code', () => {
  assert.equal(check().allowed, true)
})
test('rejects mismatched client or redirect URI', () => {
  assert.equal(check({}, { clientId: 'claude-client' }).reason, 'client_mismatch')
  assert.equal(check({}, { redirectUri: 'https://evil.example/callback' }).reason, 'redirect_uri_mismatch')
})
test('rejects consumed or expired authorization codes', () => {
  assert.equal(check({ consumedAtEpochSeconds: now - 1 }).reason, 'already_consumed')
  assert.equal(check({ expiresAtEpochSeconds: now }).reason, 'expired_or_invalid')
  assert.equal(check({}, { nowEpochSeconds: now - 120 }).reason, 'expired_or_invalid')
})
test('requires S256 and a valid challenge', () => {
  assert.equal(check({ codeChallengeMethod: 'plain' }).reason, 'invalid_pkce')
  assert.equal(check({ codeChallenge: 'bad' }).reason, 'invalid_pkce')
})
test('fails closed when code is missing or timestamps invalid', () => {
  assert.equal(authorize(null, request).reason, 'invalid_code')
  assert.equal(check({ expiresAtEpochSeconds: now - 100 }).reason, 'expired_or_invalid')
  assert.equal(check({}, { nowEpochSeconds: NaN }).reason, 'expired_or_invalid')
})
