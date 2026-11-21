import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

/**
 * Nesmi Service v0.1: authenticated, account-owner-scoped HTTP adapter.
 * Not an MCP server or an OAuth provider. Never use a service_role key here.
 *
 * The existing Nesmi schema models each household as a private board owned by
 * one Supabase Auth user. Team members are records, not authenticated users.
 */
type JsonRecord = Record<string, unknown>
const ACTIONS = ['list_chores', 'list_members', 'create_chore', 'complete_chore'] as const
type Action = typeof ACTIONS[number]

function response(body: JsonRecord, status = 200, cors: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
  })
}

function isObject(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
function optionalEnum(value: unknown, values: readonly string[], fallback: string): string | null {
  if (value === undefined) return fallback
  return typeof value === 'string' && values.includes(value) ? value : null
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin')
  const allowedOrigins = (Deno.env.get('NESMI_ALLOWED_ORIGINS') || '')
    .split(',').map(value => value.trim()).filter(Boolean)
  const cors = origin && allowedOrigins.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
    : {}

  if (origin && !allowedOrigins.includes(origin)) return response({ error: 'Origin not permitted' }, 403)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405, cors)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'Unauthorized' }, 401, cors)
  const token = authorization.slice(7).trim()
  if (!token) return response({ error: 'Unauthorized' }, 401, cors)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!supabaseUrl || !publicKey) return response({ error: 'Service not configured' }, 503, cors)

  const supabase = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return response({ error: 'Unauthorized' }, 401, cors)

  let raw: string
  try {
    raw = await request.text()
    if (raw.length > 8192) return response({ error: 'Payload too large' }, 413, cors)
  } catch {
    return response({ error: 'Invalid request body' }, 400, cors)
  }

  let body: unknown
  try { body = JSON.parse(raw) } catch { return response({ error: 'Invalid JSON' }, 400, cors) }
  if (!isObject(body) || !ACTIONS.includes(body.action as Action)) {
    return response({ error: 'Unsupported action' }, 400, cors)
  }
  const action = body.action as Action
  const args = isObject(body.params) ? body.params : {}

  try {
    if (action === 'list_members') {
      const { data, error } = await supabase.from('team_members')
        .select('id, name, color').eq('owner_id', user.id).order('name').limit(100)
      if (error) throw error
      return response({ members: data || [] }, 200, cors)
    }

    if (action === 'list_chores') {
      const { data: chores, error } = await supabase.from('chores')
        .select('id,title,description,date,due_time,assignee_id,recurrence,priority')
        .eq('owner_id', user.id).order('date', { ascending: true }).limit(100)
      if (error) throw error
      if (!chores?.length) return response({ chores: [], completions: [] }, 200, cors)
      const { data: completions, error: completionError } = await supabase.from('chore_completions')
        .select('chore_id,instance_date,completed_at,completed_by')
        .eq('owner_id', user.id).in('chore_id', chores.map(chore => chore.id)).limit(500)
      if (completionError) throw completionError
      // A recurring chore can have multiple completed instances. Keep instance_date.
      return response({ chores, completions: completions || [] }, 200, cors)
    }

    if (action === 'create_chore') {
      const title = typeof args.title === 'string' ? args.title.trim() : ''
      if (!title || title.length > 120 || !isDate(args.date)) {
        return response({ error: 'Valid title (1–120 characters) and date (YYYY-MM-DD) required' }, 422, cors)
      }
      const priority = optionalEnum(args.priority, ['low', 'medium', 'high'], 'medium')
      const recurrence = optionalEnum(args.recurrence, ['none', 'daily', 'weekly', 'monthly'], 'none')
      if (!priority || !recurrence) return response({ error: 'Invalid priority or recurrence' }, 422, cors)
      const assigneeId = args.assignee_id === undefined || args.assignee_id === null ? null : args.assignee_id
      if (assigneeId !== null) {
        if (!isUuid(assigneeId)) return response({ error: 'Invalid assignee_id' }, 422, cors)
        const { data: member, error } = await supabase.from('team_members')
          .select('id').eq('owner_id', user.id).eq('id', assigneeId).maybeSingle()
        if (error) throw error
        if (!member) return response({ error: 'Member not found' }, 404, cors)
      }
      const { data, error } = await supabase.from('chores').insert({
        owner_id: user.id, title, date: args.date, priority, recurrence, assignee_id: assigneeId,
      }).select('id,title,date,assignee_id,priority,recurrence').single()
      if (error) throw error
      return response({ chore: data }, 201, cors)
    }

    // complete_chore: completion is recorded per chore instance/date, not by
    // toggling a global boolean. Only members on the owner's private board may
    // be credited. The caller is the signed-in board owner, not the member.
    if (!isUuid(args.chore_id) || !isUuid(args.completed_by) || !isDate(args.instance_date)) {
      return response({ error: 'Valid chore_id, completed_by and instance_date required' }, 422, cors)
    }
    const [choreResult, memberResult] = await Promise.all([
      supabase.from('chores').select('id').eq('owner_id', user.id).eq('id', args.chore_id).maybeSingle(),
      supabase.from('team_members').select('id').eq('owner_id', user.id).eq('id', args.completed_by).maybeSingle(),
    ])
    if (choreResult.error || memberResult.error) throw choreResult.error || memberResult.error
    if (!choreResult.data || !memberResult.data) return response({ error: 'Chore or member not found' }, 404, cors)

    const { data: existing, error: existingError } = await supabase.from('chore_completions')
      .select('id,chore_id,instance_date,completed_by,completed_at')
      .eq('owner_id', user.id).eq('chore_id', args.chore_id)
      .eq('instance_date', args.instance_date).maybeSingle()
    if (existingError) throw existingError
    if (existing) return response({ completion: existing, already_completed: true }, 200, cors)

    const { data: completion, error: insertError } = await supabase.from('chore_completions').insert({
      owner_id: user.id, chore_id: args.chore_id, instance_date: args.instance_date,
      completed_by: args.completed_by, completed_at: new Date().toISOString(),
    }).select('id,chore_id,instance_date,completed_by,completed_at').single()
    if (insertError) {
      // Concurrent identical requests may race against the unique instance constraint.
      if (insertError.code === '23505') return response({ error: 'Already completed; refresh status' }, 409, cors)
      throw insertError
    }
    return response({ completion, already_completed: false }, 201, cors)
  } catch (error) {
    console.error('Nesmi service operation failed', error instanceof Error ? error.message : 'unknown')
    return response({ error: 'Service operation failed' }, 500, cors)
  }
})
