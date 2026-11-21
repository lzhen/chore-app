#!/usr/bin/env node
/**
 * Nesmi Service HTTP smoke test.
 * Requires NESMI_SERVICE_URL and NESMI_OWNER_JWT.
 * Optional NESMI_SECOND_OWNER_JWT proves cross-account isolation.
 * By default, READ ONLY. Set NESMI_TEST_WRITES=true and supply a test
 * member UUID to create/complete a disposable chore on a TEST database.
 *
 * Never commit tokens. Never run write mode against production.
 */
import assert from 'node:assert/strict'

const endpoint = process.env.NESMI_SERVICE_URL
const owner = process.env.NESMI_OWNER_JWT
const second = process.env.NESMI_SECOND_OWNER_JWT
const writeMode = process.env.NESMI_TEST_WRITES === 'true'
const memberId = process.env.NESMI_TEST_MEMBER_ID

if (!endpoint || !owner) {
  console.error('Set NESMI_SERVICE_URL and NESMI_OWNER_JWT to run smoke tests.')
  process.exit(2)
}
if (!endpoint.startsWith('https://') && !endpoint.startsWith('http://localhost:')) {
  console.error('Only HTTPS or localhost endpoints are permitted.')
  process.exit(2)
}
if (writeMode && (!second || !memberId || process.env.NESMI_TEST_DATABASE !== 'true')) {
  console.error('Write tests require a second account, member ID and NESMI_TEST_DATABASE=true.')
  process.exit(2)
}

async function call(token, action, params = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
  const body = await res.json()
  return { status: res.status, body }
}
function checkSuccess(result, label) {
  assert.ok(result.status >= 200 && result.status < 300, `${label}: status ${result.status}`)
  console.log('PASS', label)
}

const missing = await fetch(endpoint, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'list_chores' }),
})
assert.equal(missing.status, 401)
console.log('PASS unauthenticated request rejected')

const invalid = await call('invalid-token', 'list_chores')
assert.equal(invalid.status, 401)
console.log('PASS invalid token rejected')

const members = await call(owner, 'list_members')
checkSuccess(members, 'owner list_members')
assert.ok(Array.isArray(members.body.members))

const chores = await call(owner, 'list_chores')
checkSuccess(chores, 'owner list_chores')
assert.ok(Array.isArray(chores.body.chores))
assert.ok(Array.isArray(chores.body.completions))

const invalidDate = await call(owner, 'create_chore', { title: 'invalid', date: '2026-02-30' })
assert.equal(invalidDate.status, 422)
console.log('PASS invalid date rejected')

if (second) {
  const other = await call(second, 'list_chores')
  checkSuccess(other, 'second owner list_chores')
  const ownIds = new Set(chores.body.chores.map(item => item.id))
  assert.ok(other.body.chores.every(item => !ownIds.has(item.id)))
  console.log('PASS account owners see disjoint chore records')

  if (chores.body.chores.length) {
    const cross = await call(second, 'complete_chore', {
      chore_id: chores.body.chores[0].id,
      completed_by: memberId || '00000000-0000-4000-8000-000000000001',
      instance_date: chores.body.chores[0].date,
    })
    assert.equal(cross.status, 404)
    console.log('PASS second owner cannot complete first owner chore')
  }
}

if (writeMode) {
  const date = new Date().toISOString().slice(0, 10)
  const created = await call(owner, 'create_chore', {
    title: `Service smoke test ${Date.now()}`, date, assignee_id: memberId,
  })
  assert.equal(created.status, 201)
  console.log('PASS create_chore')
  const id = created.body.chore.id

  const afterCreate = await call(owner, 'list_chores')
  assert.ok(afterCreate.body.chores.some(item => item.id === id))
  console.log('PASS newly created chore is visible')

  const completed = await call(owner, 'complete_chore', {
    chore_id: id, completed_by: memberId, instance_date: date,
  })
  assert.equal(completed.status, 201)
  console.log('PASS complete_chore')

  const again = await call(owner, 'complete_chore', {
    chore_id: id, completed_by: memberId, instance_date: date,
  })
  assert.equal(again.status, 200)
  assert.equal(again.body.already_completed, true)
  console.log('PASS repeated completion is idempotent')

  const afterComplete = await call(owner, 'list_chores')
  assert.ok(afterComplete.body.completions.some(item => item.chore_id === id && item.instance_date === date))
  console.log('PASS completed instance is visible')
  console.log('NOTE: test chore was not deleted; remove it from the test board.')
}
console.log('Nesmi Service smoke checks finished.')
