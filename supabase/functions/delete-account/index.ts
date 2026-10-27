import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fail closed for legacy/empty requests: never delete the account of an
  // unrelated bearer if the SDK session switches after user confirmation.
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid deletion request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const expectedUserId = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as { expectedUserId?: unknown }).expectedUserId
    : undefined
  if (typeof expectedUserId !== 'string' || !expectedUserId.trim()) {
    return new Response(JSON.stringify({ error: 'Expected account is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (user.id !== expectedUserId) {
    return new Response(JSON.stringify({ error: 'Account session changed. Deletion was not performed.' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // DRAFT ONLY: requires a separately approved service-role RPC migration.
  // This branch is NOT the deployed Edge source. The installed B123 client still
  // sends a bodyless request, which intentionally fails before reaching here.
  // Never deploy this handler without a backward-compatible rollout decision.
  const failUncertain = () => new Response(JSON.stringify({
    error: 'Deletion outcome uncertain. Contact support before retrying.',
  }), {
    status: 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  let adminClient
  try {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  } catch {
    return failUncertain()
  }

  // Only a durable PK-backed reservation can protect concurrent Edge workers.
  // The RPC is a NONDEPLOYED prototype in docs/release/prototypes; an error or
  // unknown outcome must never fall back to unclaimed admin deletion.
  let acquired
  try {
    acquired = await adminClient.rpc('nesmi_delete_claim_draft_acquire', {
      p_account_id: user.id,
    })
  } catch {
    return failUncertain()
  }
  if (acquired?.error || !Array.isArray(acquired?.data)) return failUncertain()
  if (acquired.data.length === 0) {
    return new Response(JSON.stringify({
      error: 'A deletion attempt already exists. Contact support; do not retry.',
    }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (acquired.data.length !== 1 ||
      typeof acquired.data[0]?.claim_id !== 'string' ||
      !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
        .test(acquired.data[0].claim_id)) return failUncertain()

  const claimId = acquired.data[0].claim_id
  const finalize = async state => {
    try {
      const receipt = await adminClient.rpc('nesmi_delete_claim_draft_finalize', {
        p_account_id: user.id, p_claim_id: claimId, p_state: state,
      })
      return receipt?.error == null && receipt?.data === true
    } catch {
      return false
    }
  }

  // A timeout can occur after the irreversible deletion. Never release or
  // automatically retry a claim. Confirm the SDK receipt AND durable finalize
  // before returning success.
  const deleteResult = await adminClient.auth.admin.deleteUser(user.id).catch(() => null)
  // A structurally valid SDK receipt is not sufficient when it explicitly
  // identifies a different account. Older SDK adapters may omit the id field;
  // preserve that existing shape, but never ACK a conflicting identity.
  const confirmed = deleteResult?.error === null &&
    deleteResult?.data?.user != null &&
    typeof deleteResult.data.user === 'object' &&
    !Array.isArray(deleteResult.data.user) &&
    (!('id' in deleteResult.data.user) || deleteResult.data.user.id === user.id)
  if (!confirmed) {
    await finalize('uncertain') // Best effort; claim remains reserved on failure.
    return failUncertain()
  }
  if (!(await finalize('confirmed'))) {
    await finalize('uncertain')
    return failUncertain()
  }
  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
