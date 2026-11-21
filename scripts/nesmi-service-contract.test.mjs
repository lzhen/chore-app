import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../supabase/functions/nesmi-service/index.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

const userId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const memberId = '33333333-3333-4333-8333-333333333333'
const choreId = '44444444-4444-4444-8444-444444444444'

function makeServer() {
  let handler
  const calls = []
  const database = {
    team_members: [{ id: memberId, owner_id: userId, name: 'Alex', color: '#aaa' }],
    chores: [{ id: choreId, owner_id: userId, title: 'Water plants', date: '2026-11-21' }],
    chore_completions: [],
  }
  const createClient = (_url, _key, options) => {
    const token = options.global.headers.Authorization
    const uid = token === 'Bearer owner-token' ? userId : token === 'Bearer other-token' ? otherId : null
    return {
      auth: { getUser: async () => ({ data: { user: uid ? { id: uid } : null }, error: uid ? null : { message: 'invalid' } }) },
      from(table) {
        const conditions = []
        let operation = 'select'
        let payload
        const builder = {
          select() { return builder },
          eq(key, value) { conditions.push(row => row[key] === value); return builder },
          in(key, values) { conditions.push(row => values.includes(row[key])); return builder },
          order() { return builder },
          limit() { return Promise.resolve(result()) },
          maybeSingle() { return Promise.resolve({ data: result().data[0] ?? null, error: null }) },
          single() { return Promise.resolve({ data: result().data[0] ?? null, error: null }) },
          insert(value) { operation = 'insert'; payload = value; return builder },
          then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
        }
        function result() {
          calls.push({ table, operation, conditions: conditions.length })
          if (operation === 'insert') {
            if (payload.owner_id !== uid) return { data: null, error: { message: 'RLS' } }
            const row = { id: operation === 'insert' && table === 'chores' ? choreId : '55555555-5555-4555-8555-555555555555', ...payload }
            database[table].push(row)
            return { data: [row], error: null }
          }
          return { data: database[table].filter(row => row.owner_id === uid && conditions.every(fn => fn(row))), error: null }
        }
        return builder
      },
    }
  }
  const context = {
    Deno: {
      serve: callback => { handler = callback },
      env: { get: key => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test-publishable' })[key] },
    },
    createClient, Response, Headers, Date, JSON, Object, console,
  }
  vm.runInNewContext(js, context)
  return { handler, calls, database }
}
function request(token, action, params = {}) {
  return new Request('https://example.supabase.co/functions/v1/nesmi-service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, params }),
  })
}

test('rejects missing and invalid bearer tokens before data access', async () => {
  const { handler, calls } = makeServer()
  assert.equal((await handler(request(null, 'list_chores'))).status, 401)
  assert.equal((await handler(request('invalid', 'list_chores'))).status, 401)
  assert.equal(calls.length, 0)
})
test('lists only account-owner data', async () => {
  const { handler } = makeServer()
  const owner = await (await handler(request('owner-token', 'list_chores'))).json()
  const other = await (await handler(request('other-token', 'list_chores'))).json()
  assert.equal(owner.chores.length, 1)
  assert.equal(other.chores.length, 0)
})
test('rejects malformed dates and missing chore title', async () => {
  const { handler } = makeServer()
  for (const params of [{ title: 'Test', date: '2026-02-30' }, { title: '', date: '2026-11-21' }]) {
    const response = await handler(request('owner-token', 'create_chore', params))
    assert.equal(response.status, 422)
  }
})
test('rejects assignee from another household', async () => {
  const { handler } = makeServer()
  const response = await handler(request('other-token', 'create_chore', {
    title: 'Test', date: '2026-11-21', assignee_id: memberId,
  }))
  assert.equal(response.status, 404)
})
test('rejects completion of another account’s chore', async () => {
  const { handler } = makeServer()
  const response = await handler(request('other-token', 'complete_chore', {
    chore_id: choreId, completed_by: memberId, instance_date: '2026-11-21',
  }))
  assert.equal(response.status, 404)
})
test('creates and completes a dated chore instance for the owner', async () => {
  const { handler } = makeServer()
  const created = await handler(request('owner-token', 'create_chore', {
    title: 'Tidy room', date: '2026-11-21', assignee_id: memberId,
  }))
  assert.equal(created.status, 201)
  const completed = await handler(request('owner-token', 'complete_chore', {
    chore_id: choreId, completed_by: memberId, instance_date: '2026-11-21',
  }))
  assert.equal(completed.status, 201)
  const again = await (await handler(request('owner-token', 'complete_chore', {
    chore_id: choreId, completed_by: memberId, instance_date: '2026-11-21',
  }))).json()
  assert.equal(again.already_completed, true)
})
