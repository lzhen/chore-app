import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * Nesmi MCP prototype — INTERNAL TESTING ONLY.
 * Do not deploy publicly or register with external agents before implementing
 * OAuth 2.1 authorization, per-client scopes, user consent and token revocation.
 * This prototype accepts a first-party Supabase Auth access token and forwards
 * it only to the existing Nesmi Service endpoint.
 *
 * Stateless JSON-RPC 2.0 / MCP Streamable HTTP JSON response subset.
 * Not a complete public MCP authorization implementation.
 */
const tools = [
  {
    name: 'nesmi_list_chores',
    description: 'Read the signed-in Nesmi account owner’s chores and dated completion records.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'nesmi_list_members',
    description: 'Read the signed-in Nesmi account owner’s household member records.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'nesmi_create_chore',
    description: 'Create a chore on the signed-in account owner’s board, after user confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 120 },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        assignee_id: { type: ['string', 'null'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        recurrence: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly'] },
      },
      required: ['title', 'date'],
      additionalProperties: false,
    },
  },
  {
    name: 'nesmi_complete_chore',
    description: 'Record completion of a specific dated chore instance, after user confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        chore_id: { type: 'string' },
        completed_by: { type: 'string', description: 'Nesmi member UUID; not an auth principal' },
        instance_date: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['chore_id', 'completed_by', 'instance_date'],
      additionalProperties: false,
    },
  },
] as const

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'MCP-Protocol-Version': '2025-06-18',
    },
  })
}
function error(id: unknown, code: number, message: string): Response {
  return json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
}
function validRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
const actionMap: Record<string, string> = {
  nesmi_list_chores: 'list_chores',
  nesmi_list_members: 'list_members',
  nesmi_create_chore: 'create_chore',
  nesmi_complete_chore: 'complete_chore',
}

Deno.serve(async (req: Request) => {
  // No browser CORS enabled. This is an internal server-to-server prototype.
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (req.headers.get('Origin')) return json({ error: 'Browser origins not supported' }, 403)

  const bearer = req.headers.get('Authorization')
  if (!bearer?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  let message: unknown
  try {
    const raw = await req.text()
    if (raw.length > 8192) return json({ error: 'Payload too large' }, 413)
    message = JSON.parse(raw)
  } catch {
    return error(null, -32700, 'Parse error')
  }
  if (!validRecord(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return error(null, -32600, 'Invalid request')
  }

  const id = message.id
  // Notifications have no response body. We do not use session state.
  if (id === undefined) return new Response(null, { status: 202 })

  if (message.method === 'initialize') {
    return json({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'nesmi-service-prototype', version: '0.1.0' },
        instructions: 'Internal testing only. No third-party OAuth. Confirm writes with the human.',
      },
    })
  }
  if (message.method === 'ping') return json({ jsonrpc: '2.0', id, result: {} })
  if (message.method === 'tools/list') return json({ jsonrpc: '2.0', id, result: { tools } })
  if (message.method !== 'tools/call') return error(id, -32601, 'Method not found')

  const params = message.params
  if (!validRecord(params) || typeof params.name !== 'string' || !(params.name in actionMap)) {
    return error(id, -32602, 'Unknown tool')
  }
  const args = params.arguments ?? {}
  if (!validRecord(args)) return error(id, -32602, 'Invalid tool arguments')
  const schema = tools.find(tool => tool.name === params.name)!.inputSchema
  const allowed = Object.keys(schema.properties)
  if (Object.keys(args).some(key => !allowed.includes(key))) {
    return error(id, -32602, 'Unexpected argument')
  }
  if ('required' in schema && schema.required.some(key => !(key in args))) {
    return error(id, -32602, 'Missing required argument')
  }

  const url = Deno.env.get('SUPABASE_URL')
  if (!url) return error(id, -32603, 'Service not configured')
  const endpoint = `${url}/functions/v1/nesmi-service`

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionMap[params.name], params: args }),
      signal: AbortSignal.timeout(10000),
    })
    const result = await upstream.json()
    if (!upstream.ok) {
      return json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }], isError: true },
      })
    }
    return json({
      jsonrpc: '2.0', id,
      result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result },
    })
  } catch {
    return error(id, -32603, 'Nesmi service unavailable')
  }
})
