# Nesmi cross-agent authorization design (v0.2)

**Decision:** The deployed `nesmi-service` function is a first-party API. The
`nesmi-mcp-prototype` is NOT approved for third-party connection or deployment.
Do not hand a Supabase user session JWT to an external AI platform.

## User journey

1. The user selects **Connect Nesmi** inside a supported agent client.
2. The client opens the Nesmi authorization page in a browser.
3. The user signs in to Nesmi using its existing Supabase Auth account.
4. Nesmi shows the requesting client and exact permissions:
   - **View tasks** (`tasks:read`)
   - **Create and complete tasks** (`tasks:write`), optional and separately
     confirmed for consequential operations
5. User consents; Nesmi issues a short-lived, audience-bound access token
   and a revocable grant specific to that client.
6. The client calls the MCP endpoint with **only the scoped Nesmi token**.
7. Nesmi validates token issuer, audience, expiry, grant status, user,
   allowed tool and requested household. A revoked grant is rejected.
8. Nesmi executes the service operation in the authenticated account owner's
   context, preserving RLS, then returns only authorized data.

## Required components (not yet implemented)

- OAuth authorization server (authorization code + PKCE S256)
- OAuth authorization server metadata and protected resource metadata
- Consent UI with scopes and client identification
- Authorization code single-use exchange, token rotation/revocation
- Resource server validating audience and authorization grant
- Grant store with hashed tokens, client ID, account owner ID, scopes,
  expiration, last used, revocation time
- Agent-specific audit events and write confirmations
- Rate limits, anti-CSRF, redirect URI validation and origin enforcement
- Protocol conformance testing for target clients

## Permissions matrix

| Operation | Scope | User confirmation |
| --- | --- | --- |
| List household members | `tasks:read` | Consent at connection |
| List chores and completions | `tasks:read` | Consent at connection |
| Create chore | `tasks:write` | Confirm proposed title, date, assignee |
| Complete chore | `tasks:write` | Confirm specific chore instance and member |
| Delete chores / invite accounts | Not offered in v0.2 | Not available |

**Important:** Existing Nesmi household members are not independent Supabase
Auth users. The account owner remains the sole authorized principal. Child
accounts and member-level delegated access are out of scope.

## Threat-model checklist

- [ ] No Supabase Auth JWT in agent prompts, logs, external client configs
- [ ] No `service_role` database bypass in tool request path
- [ ] RLS enforced for every read and write
- [ ] Second user cannot access first user's chores by guessing UUIDs
- [ ] Grant for `tasks:read` cannot call write tools
- [ ] Grant for Agent A cannot be used by Agent B
- [ ] Revocation takes effect on subsequent requests
- [ ] Stolen or expired tokens fail; refresh rotation tested
- [ ] Tool prompt injection cannot change grant scopes
- [ ] Duplicate task completion does not award twice
- [ ] No data from Care, MoveLight, or DLS Magician included
- [ ] Audit log records who authorized, client, operation, outcome
- [ ] Production connection requires separate security review

## Acceptance test

With two separate consenting clients and one test account:

1. Agent A creates a test chore.
2. Nesmi Web/iOS shows it in the same owner's task board.
3. User completes the dated instance.
4. Agent B lists chores and sees that completion.
5. Revoke Agent B: next request is denied.
6. Agent A's read-only grant cannot create a chore.
7. Another Nesmi account cannot access any test account records.

No production rollout until this entire flow is demonstrated with test
accounts, documented logs, and a rollback procedure.
