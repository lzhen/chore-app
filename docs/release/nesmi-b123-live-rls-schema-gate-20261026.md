# Nesmi B123 — production schema / RLS release evidence (Task159)

**Checked:** 2026-10-26 ~23:09 PDT (2026-10-27 06:09 UTC). **Scope:** read-only production metadata only; no application rows, credentials, identities, or live account operations inspected. **Product:** Nesmi/Chorely. **Release gate:** HOLD.

## Evidence and narrow conclusions

- Connected Supabase projects listing independently identified `rosofbnimiothwxsabyr` as an active/healthy project previously associated with Nesmi. This checkpoint queried only `public` schema metadata (via `list_tables`, `pg_class` and `pg_policies`) and Supabase Security Advisor. **This is not an authorized user-session / network integration test.**
- `public.team_members`, `public.chores`, `public.chore_completions`, `public.categories` and `public.member_availability` all have RLS enabled and `authenticated` `ALL` policies requiring `auth.uid() = owner_id` for both row visibility (`USING`) and mutations (`WITH CHECK`). `public.profiles` has RLS enabled with identity-matched read/update policies using `auth.uid() = id`.
- Production schema exposes the `team_members` write columns used by unmerged PR #36's `memberWritePayload`: `name`, `color`, `email`, `skills`, `working_hours_start`, `working_hours_end`, `working_days`, `points`, `badges`, `weekly_capacity_minutes`. `owner_id` has `auth.uid()` default. PR #36 `updateTeamMember` uses `.eq('id', member.id)` and relies on production RLS for account isolation rather than a client-supplied owner.
- Production introspection also returns composite owner-aware foreign keys joining `chores.assignee_id/owner_id` to `team_members.id/owner_id`, `chore_completions.completed_by/owner_id` to `team_members.id/owner_id`, and `member_availability.member_id/owner_id` to `team_members.id/owner_id`. This is *schema evidence*, not executed tenant isolation.
- Security Advisor (observed 2026-10-27 06:09 UTC) flags `public."chore app"` as RLS-enabled with **no policies**, distinct from the above application tables. This is default-deny, not evidence of user-data exposure. It also reports signed-in GraphQL schema discoverability on six tables and disabled leaked-password protection. Review those separately; neither warning alone proves cross-account data access. See [RLS policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [GraphQL visibility](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed), and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## What was actually completed

**Read-only current production schema / policy inventory and exact PR #36 payload-to-schema reconciliation.** Source: connected Supabase metadata and [Draft PR #36](https://github.com/lzhen/chore-app/pull/36), head `7881629134a727b214017237a361b143f9206a79` immediately before this documentation-only commit. No database mutation, privileged call, real user record read, Edge deployment, merge, TestFlight build or App Store action.

## Remaining critical release gates

1. **P0, distinct from this schema check:** installed Apple-confirmed TestFlight B123 `6eab3d3` sends bodyless account-deletion POST; draft PR #35 strict Edge requires `expectedUserId`. Do not deploy strict Edge/claim SQL alone while B123 clients exist. Production legacy Edge v1 accepts the shape but lacks intended confirmation-id binding/claim safeguards.
2. **P1 validation gap:** demonstrate with *approved synthetic disposable accounts* via authenticated SDK requests that account A cannot read/update B's members, chores, completions or availability, and that saved data survives reload. Metadata plus offline mocked tests cannot certify this.
3. Confirm selected App Store Connect reviewer build, exact-build physical iPhone login/task/delete flows and approved server rollout. This audit does not change the **HOLD** decision; no new founder-only approval requested.

**Next bounded action:** add an opt-in, non-production two-account RLS/persistence integration test harness once test environment and disposable credentials are authorized; do not run against real accounts by assumption.
