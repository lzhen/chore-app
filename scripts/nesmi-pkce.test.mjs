import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'

const source = readFileSync(new URL('../supabase/functions/_shared/pkce.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const module = { exports: {} }
vm.runInNewContext(js, {
  module, exports: module.exports, crypto: webcrypto, TextEncoder, Uint8Array,
  btoa, String, Math, Error,
})
const { derivePkceChallenge, verifyPkceS256, validPkceVerifier, validPkceChallenge } = module.exports

test('matches RFC 7636 Appendix B S256 test vector', async () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
  assert.equal(await derivePkceChallenge(verifier), challenge)
  assert.equal(await verifyPkceS256(verifier, challenge), true)
})
test('rejects wrong verifier and invalid challenge', async () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  const challenge = await derivePkceChallenge(verifier)
  assert.equal(await verifyPkceS256('x'.repeat(43), challenge), false)
  assert.equal(await verifyPkceS256(verifier, 'bad'), false)
  assert.equal(await verifyPkceS256(null, challenge), false)
})
test('enforces PKCE verifier length and character set', () => {
  assert.equal(validPkceVerifier('a'.repeat(42)), false)
  assert.equal(validPkceVerifier('a'.repeat(43)), true)
  assert.equal(validPkceVerifier('a'.repeat(128)), true)
  assert.equal(validPkceVerifier('a'.repeat(129)), false)
  assert.equal(validPkceVerifier('a'.repeat(42) + '!'), false)
  assert.equal(validPkceChallenge('a'.repeat(43)), true)
  assert.equal(validPkceChallenge('a'.repeat(44)), false)
})
