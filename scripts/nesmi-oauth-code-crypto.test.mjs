import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'

const source = readFileSync(new URL('../supabase/functions/_shared/oauthCodeCrypto.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const module = { exports: {} }
vm.runInNewContext(js, {
  module, exports: module.exports, crypto: webcrypto, TextEncoder,
  Uint8Array, btoa, String, Array, Error,
})
const { generateAuthorizationCode, validAuthorizationCode, authorizationCodeHash, hashToHex } = module.exports

test('generates 256-bit unpredictable base64url codes without padding', () => {
  const codes = Array.from({ length: 128 }, () => generateAuthorizationCode())
  assert.equal(new Set(codes).size, codes.length)
  for (const code of codes) {
    assert.equal(code.length, 43)
    assert.equal(validAuthorizationCode(code), true)
    assert.equal(/[+/=]/.test(code), false)
  }
})
test('hashes code deterministically without persisting raw code', async () => {
  const code = generateAuthorizationCode()
  const first = hashToHex(await authorizationCodeHash(code))
  const second = hashToHex(await authorizationCodeHash(code))
  assert.equal(first, second)
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.equal(first.includes(code), false)
  assert.notEqual(first, hashToHex(await authorizationCodeHash(generateAuthorizationCode())))
})
test('rejects malformed authorization codes', async () => {
  assert.equal(validAuthorizationCode('short'), false)
  assert.equal(validAuthorizationCode('a'.repeat(43) + '='), false)
  await assert.rejects(authorizationCodeHash('short'), /Invalid authorization code/)
})
