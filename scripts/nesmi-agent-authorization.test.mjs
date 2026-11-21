import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'

const source = readFileSync(new URL('../supabase/functions/_shared/agentAuthorization.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const module = { exports: {} }
vm.runInNewContext(js, { module, exports: module.exports, Object, Number })
const { authorizeAgentOperation: authorize } = module.exports

const now = 1_800_000_000
const grant = {
  ownerId: 'owner-a',
  clientId: 'agent-a',
  audience: 'nesmi-mcp',
  scopes: ['tasks:read'],
  expiresAtEpochSeconds: now + 300,
  revokedAtEpochSeconds: null,
}
const request = {
  ownerId: 'owner-a',
  clientId: 'agent-a',
  audience: 'nesmi-mcp',
  operation: 'list_chores',
  nowEpochSeconds: now,
}
const check = (grantPatch = {}, requestPatch = {}) =>
  authorize({ ...grant, ...grantPatch }, { ...request, ...requestPatch })

test('valid read grant can list tasks and members', () => {
  assert.equal(check().allowed, true)
  assert.equal(check({}, { operation: 'list_members' }).allowed, true)
})
test('read-only grant cannot create or complete tasks', () => {
  assert.equal(check({}, { operation: 'create_chore' }).reason, 'insufficient_scope')
  assert.equal(check({}, { operation: 'complete_chore' }).reason, 'insufficient_scope')
})
test('write scope allows writes but does not imply read scope', () => {
  assert.equal(check({ scopes: ['tasks:write'] }, { operation: 'create_chore' }).allowed, true)
  assert.equal(check({ scopes: ['tasks:write'] }).reason, 'insufficient_scope')
})
test('owner, client and audience must match', () => {
  assert.equal(check({}, { ownerId: 'owner-b' }).reason, 'owner_mismatch')
  assert.equal(check({}, { clientId: 'agent-b' }).reason, 'client_mismatch')
  assert.equal(check({}, { audience: 'another-resource' }).reason, 'audience_mismatch')
})
test('expired, revoked, unknown operation and missing grant are rejected', () => {
  assert.equal(check({ expiresAtEpochSeconds: now }).reason, 'expired')
  assert.equal(check({ revokedAtEpochSeconds: now - 1 }).reason, 'revoked')
  assert.equal(check({}, { operation: 'delete_chore' }).reason, 'unknown_operation')
  assert.equal(authorize(null, request).reason, 'missing_grant')
})
