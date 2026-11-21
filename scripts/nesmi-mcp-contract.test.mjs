import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'

const source = readFileSync(new URL('../supabase/functions/nesmi-mcp-prototype/index.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import 'jsr:.*'\s*/m, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

function server() {
  let handler
  const upstream = []
  const context = {
    Deno: {
      serve: callback => { handler = callback },
      env: { get: name => name === 'SUPABASE_URL' ? 'https://example.supabase.co' : undefined },
    },
    Response, Headers, AbortSignal, JSON, Object,
    fetch: async (url, options) => {
      upstream.push({ url, options })
      return new Response(JSON.stringify({ chores: [] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    },
  }
  vm.runInNewContext(js, context, { filename: 'nesmi-mcp-prototype.js' })
  assert.equal(typeof handler, 'function')
  return { handler, upstream }
}

function request(method, params, opts = {}) {
  return new Request('https://example.supabase.co/functions/v1/nesmi-mcp-prototype', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.origin ? { Origin: opts.origin } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }),
  })
}

test('rejects missing bearer and browser origins', async () => {
  const { handler } = server()
  assert.equal((await handler(request('tools/list'))).status, 401)
  assert.equal((await handler(request('tools/list', null, { token: 'test', origin: 'https://evil.example' }))).status, 403)
})

test('supports initialization and lists four tools without contacting database', async () => {
  const { handler, upstream } = server()
  const init = await (await handler(request('initialize', null, { token: 'test' }))).json()
  assert.equal(init.result.serverInfo.name, 'nesmi-service-prototype')
  const listed = await (await handler(request('tools/list', null, { token: 'test' }))).json()
  assert.equal(listed.result.tools.length, 4)
  assert.equal(upstream.length, 0)
})

test('rejects unknown tool and unexpected arguments', async () => {
  const { handler, upstream } = server()
  const unknown = await (await handler(request('tools/call', { name: 'nesmi_delete_chore' }, { token: 'test' }))).json()
  assert.equal(unknown.error.code, -32602)
  const extra = await (await handler(request('tools/call', {
    name: 'nesmi_list_chores', arguments: { owner_id: 'someone-else' },
  }, { token: 'test' }))).json()
  assert.equal(extra.error.code, -32602)
  assert.equal(upstream.length, 0)
})

test('forwards supported read call only to Nesmi service, with bearer', async () => {
  const { handler, upstream } = server()
  const result = await (await handler(request('tools/call', {
    name: 'nesmi_list_chores', arguments: {},
  }, { token: 'dummy-test-token' }))).json()
  assert.deepEqual(JSON.parse(JSON.stringify(result.result.structuredContent)), { chores: [] })
  assert.equal(upstream.length, 1)
  assert.equal(upstream[0].url, 'https://example.supabase.co/functions/v1/nesmi-service')
  assert.equal(upstream[0].options.headers.Authorization, 'Bearer dummy-test-token')
  assert.equal(JSON.parse(upstream[0].options.body).action, 'list_chores')
})

test('rejects missing required write arguments before forwarding', async () => {
  const { handler, upstream } = server()
  const result = await (await handler(request('tools/call', {
    name: 'nesmi_complete_chore', arguments: { chore_id: 'a' },
  }, { token: 'test' }))).json()
  assert.equal(result.error.code, -32602)
  assert.equal(upstream.length, 0)
})
