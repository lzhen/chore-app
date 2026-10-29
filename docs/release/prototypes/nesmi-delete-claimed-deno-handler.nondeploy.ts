// INTERNAL REVIEW-ONLY Deno Edge candidate. NOT deployed or imported by the
// live `supabase/functions/delete-account/index.ts` handler. Release HOLD.
// Requires an independently approved, durable, service-role-only PostgreSQL
// claim RPC, staged disposable-account verification, privacy/retention review,
// and a B123 bodyless-client compatibility rollout decision BEFORE deployment.
// In particular, HTTP 400 below is current strict behavior, not an approved
// upgrade policy, and this file MUST NOT be copied to a live Edge endpoint.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const reply = (status, code) => new Response(JSON.stringify({ deleted: false, code }), { status, headers: cors })
const uncertain = () => reply(503, 'OUTCOME_UNCERTAIN_DO_NOT_RETRY')
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED')

  const bearer = request.headers.get('Authorization')
  if (typeof bearer !== 'string' || !/^Bearer\s+\S+$/i.test(bearer)) return reply(401, 'AUTH_REQUIRED')

  let payload
  try { payload = await request.json() } catch { return reply(400, 'EXPECTED_ACCOUNT_REQUIRED') }
  const expected = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload.expectedUserId : null
  if (typeof expected !== 'string' || !uuid.test(expected)) return reply(400, 'EXPECTED_ACCOUNT_REQUIRED')

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (![url, anonKey, serviceKey].every(x => typeof x === 'string' && x.length)) return uncertain()

  // Every privileged action must follow successful bearer authentication and
  // an exact match to the identity captured in the UI confirmation step.
  let user
  try {
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false },
    })
    const response = await client.auth.getUser()
    if (response?.error || typeof response?.data?.user?.id !== 'string') return reply(401, 'AUTH_UNVERIFIED')
    user = response.data.user
  } catch { return reply(401, 'AUTH_UNVERIFIED') }
  if (user.id !== expected) return reply(409, 'SUBJECT_MISMATCH')

  // The draft acquire RPC is a PostgreSQL PK-backed reservation; it is NOT a
  // per-process Map. It is not installed in any live environment by this file.
  let admin
  try {
    admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  } catch { return uncertain() }
  let acquired
  try { acquired = await admin.rpc('nesmi_delete_claim_draft_acquire', { p_account_id: user.id }) }
  catch { return uncertain() }
  if (acquired?.error || !Array.isArray(acquired?.data)) return uncertain()
  if (acquired.data.length === 0) return reply(409, 'EXISTING_CLAIM_DO_NOT_RETRY')
  if (acquired.data.length !== 1 || typeof acquired.data[0]?.claim_id !== 'string' ||
      !uuid.test(acquired.data[0].claim_id)) return uncertain()
  const claimId = acquired.data[0].claim_id

  const finalize = async state => {
    try {
      const result = await admin.rpc('nesmi_delete_claim_draft_finalize', {
        p_account_id: user.id, p_claim_id: claimId, p_state: state,
      })
      return result?.error == null && result?.data === true
    } catch { return false }
  }

  let deleted = false
  try {
    const result = await admin.auth.admin.deleteUser(user.id)
    // Supabase JS v2 may return data.user={} for successful deletion.
    deleted = result?.error === null && result?.data?.user !== null &&
      typeof result?.data?.user === 'object' && !Array.isArray(result.data.user)
  } catch { /* A timeout can follow a committed irreversible deletion. */ }
  if (!deleted) {
    await finalize('uncertain') // Best effort; durable claim stays locked on failure.
    return uncertain()
  }
  if (!(await finalize('confirmed'))) {
    await finalize('uncertain')
    return uncertain()
  }
  return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: cors })
})