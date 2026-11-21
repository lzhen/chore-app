# Nesmi MCP prototype — internal only

Source: `supabase/functions/nesmi-mcp-prototype/index.ts`.

This prototype implements a small stateless JSON-RPC MCP surface
(`initialize`, `ping`, `tools/list`, `tools/call`) and maps four
MCP tools to the existing authenticated `nesmi-service` Edge Function.
It is **not deployed**, and **must not be registered as a public MCP server**.

## Current supported tools

- `nesmi_list_chores` → `list_chores`
- `nesmi_list_members` → `list_members`
- `nesmi_create_chore` → `create_chore`
- `nesmi_complete_chore` → `complete_chore`

## Why it is not yet a ChatGPT / Claude connector

The current prototype expects a signed-in account owner's Supabase Auth JWT.
That is a first-party application credential, **not** a scoped OAuth token for
an external AI agent. Never paste it into a chat or put it in an agent
configuration. No external platform is connected by this branch.

Before public use:
1. Implement OAuth 2.1 authorization server / resource-server behavior,
   metadata discovery, client registration as supported, PKCE, token
   audience and scope validation, expiration and revocation.
2. Issue separate consented grants for each agent client, and separate
   `tasks:read` from `tasks:write`.
3. Bind external access tokens to a Nesmi account via a secure server-side
   grant store. Never expose the user's Supabase session to the agent.
4. Validate origin, token audience, and the caller's allowed operations;
   enforce rate limits, write confirmation and audit events.
5. Run protocol conformance and integration tests with the target client
   implementations; validate both successful and denied requests.
6. Test on a separate Nesmi staging database with non-sensitive fixtures.
7. Only then consider production deployment.

## Known limitations

- This is a narrow MCP JSON transport subset, not an audited MCP server.
- It does not implement external OAuth, resource metadata, sessions,
  server-sent events, fine-grained scopes, or a consent UI.
- Its JSON-RPC initialize/list surface does not independently validate the
  bearer; it cannot return user data without an authenticated upstream call.
  Nevertheless, do not deploy it publicly in this state.
- Existing household members are records on one owner's board, not
  independently authenticated users.
- No live cross-agent demonstration has been completed.
