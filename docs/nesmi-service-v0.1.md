# Nesmi Service v0.1 — cross-agent service foundation

**Status:** implementation on a feature branch; **not deployed, not connected to ChatGPT or Claude**.

## Product hypothesis

Nesmi is a persistent family-task service, not just another agent chatbot.
A person can use different authorized agents to operate the same task board
while Nesmi remains the system of record.

### Current architecture and important constraint

- App: React + TypeScript + Vite, Supabase Auth and database.
- Existing entities: `chores`, `team_members`, `chore_completions`,
  `categories`, `member_availability`.
- Existing migration `20260826234000_owner_isolation.sql` makes these
  records private to an **authenticated account owner** using `owner_id`
  and row-level security (RLS).
- **Family members are not separate authenticated accounts.** They are
  records on the account owner's board. This v0.1 must not represent them
  as independently authorized agent principals.
- The Edge Function queries using the caller's Supabase Auth JWT and the
  publishable/anon key. It **does not** use a service role key or bypass RLS.

## Proposed contract (HTTP, not MCP yet)

Deployable source: `supabase/functions/nesmi-service/index.ts`.

`POST /functions/v1/nesmi-service` with
`Authorization: Bearer <signed-in-owner-access-token>` and
`Content-Type: application/json`.

| Action | Required `params` | Result |
| --- | --- | --- |
| `list_members` | none | `members` (id, name, color) |
| `list_chores` | none | `chores` and dated `completions` |
| `create_chore` | `title`, `date`; optional `assignee_id`, `priority`, `recurrence` | created `chore` |
| `complete_chore` | `chore_id`, `completed_by`, `instance_date` | dated `completion` |

Example create:

```json
{
  "action": "create_chore",
  "params": {
    "title": "Water the plants",
    "date": "2026-11-21",
    "assignee_id": null,
    "priority": "medium",
    "recurrence": "none"
  }
}
```

Example list:

```json
{ "action": "list_chores" }
```

Example complete:

```json
{
  "action": "complete_chore",
  "params": {
    "chore_id": "<chore-uuid>",
    "completed_by": "<member-uuid>",
    "instance_date": "2026-11-21"
  }
}
```

The member id comes from `list_members`. Dates identify instances of
recurring chores; completion is **not** a global boolean.

## Security boundaries

1. Verify a real Supabase **user** access token with `auth.getUser`.
   Reject missing/invalid tokens.
2. Use a per-request user-scoped Supabase client; rely on RLS **and** an
   explicit `owner_id` predicate. No service-role access.
3. Validate supported actions, UUIDs, ISO dates, title length, recurrence,
   and priority. Reject members/chores not visible to that account owner.
4. No public CORS wildcard: configure `NESMI_ALLOWED_ORIGINS` as a
   comma-separated allowlist before browser integrations. This is not
   an authorization substitute.
5. This endpoint accepts the **owner's existing Supabase session token**.
   Never put such a token into prompts, agent tool arguments, documentation,
   build logs, or third-party systems. A proper third-party Agent OAuth
   authorization flow and scoped grants must be built before connecting
   external agent products.
6. Human confirmation for task creation/completion belongs in the agent's
   user interface. This v0.1 HTTP adapter does not enforce agent consent
   receipts or maintain an independent audit log.
7. No family member self-service, no cross-household sharing, no permission
   delegation, and no Care data sharing in this version.

## Test checklist (pending environment access)

- [ ] Confirm the application's production Supabase project and applied
      schema; **do not** deploy to the unrelated `empathie-agent-staging`
      project just because it is the currently connected account.
- [ ] Test a valid owner token: list/create/list/complete/list.
- [ ] Test unauthenticated, expired token, and a second account owner.
- [ ] Ensure second account cannot list or modify another owner's chores.
- [ ] Test invalid IDs, invalid dates, duplicate completion, and recurrence.
- [ ] Run existing TypeScript, unit, E2E, and app build checks on the branch.
- [ ] Configure approved browser origins only if needed; rate limit writes
      before exposing this endpoint to substantial traffic.
- [ ] Verify no existing Nesmi UI or iOS behavior changes.

## Next integration milestone

Build an MCP adapter that delegates to these service operations **only after**
a user-facing OAuth authorization flow and scoped tokens are implemented.
First connect one supported Agent client; then verify a second client reads
the same authorized state. Keep production changes behind review.

### Success scenario

1. User authorizes an Agent to create a chore in Nesmi.
2. Nesmi stores the chore in the owner's existing private task board.
3. The user finishes it in Nesmi Web/iOS (or via an authorized operation).
4. A second authorized Agent reads the updated completion for that dated
   chore instance.

This document defines the intended scenario; **the complete cross-agent
workflow has not been demonstrated yet**.
