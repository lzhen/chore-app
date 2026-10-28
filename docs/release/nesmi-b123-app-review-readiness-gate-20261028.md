# Nesmi B123 — App Review evidence and release go/no-go gate
**Checked:** 2026-10-28 09:18 PDT. **Status:** HOLD. **Scope:** Nesmi only. This is a read-only evidence checkpoint, NOT permission to merge, deploy, delete accounts, submit to Apple, or publish.

## Current source-of-truth snapshot
| Gate | Evidence as checked | Decision |
| --- | --- | --- |
| Last first-party TestFlight install notice | Apple email **Nesmi 1.0 (123)**, received 2026-10-25 17:39 PDT; [original notice](https://mail.google.com/mail/u/?authuser=rainbow0229%40gmail.com#all/1a175a5dbd92a101). This proves TestFlight availability only, not the review-selected build. | **PASS: install notice only** |
| Actual App Store Connect distribution review version / selected build / reviewer status | **UNKNOWN.** The authenticated browser tab read requires the originating browser context. Scoped recent Apple mail search is not an authoritative substitute for App Store Connect. | **BLOCKED: evidence missing** |
| Tracked B123 code baseline | `fix/chorely-auth-viewport-20260927-icon-family-20261026` at `6eab3d3b20a32d07376c1bd938979219a3565a74` (team's canonical B123 source baseline). No exact binary/source provenance independently established in this check. | **SOURCE BASELINE ONLY** |
| Unshipped release candidates | [Draft PR #35](https://github.com/lzhen/chore-app/pull/35) at `97b264ff3e8807039e53e7efc24d03d4b7acf644`; [Draft PR #36](https://github.com/lzhen/chore-app/pull/36) at `f11360ada6b9bbd1256a6e706a9e7c1e289b2009` **before this documentation update**. Both open, unmerged; green CI does not establish installed-build QA. | **NOT SHIPPED** |
| Live production Edge function | Linked Nesmi Supabase `rosofbnimiothwxsabyr` lists **only** `delete-account` ACTIVE v1, `verify_jwt=true`, digest `589f4d5f888678251c976ee287c4b450623eaa088a56c22d9136249daf6d5e5e`; read-only source confirms legacy handler, no explicit expected-user-ID claim. No `delete-account-v2`. | **P0: v2 absent** |
| Non-production two-account HTTP and current physical iPhone | **NOT RUN**. Both linked Supabase projects are existing company projects, not approved disposable environments. Offline mocks/CI and TestFlight availability do not substitute. | **P0: unverified** |

## Critical compatibility decision (actual source, not inference from old reviews)
- B123 `src/context/AuthContext.tsx` calls `supabase.functions.invoke('delete-account', { method: 'POST' })` **without a body**. Current v1 accepts that shape; this does **not** establish safe deletion semantics or an end-to-end live test.
- PR #35's **unshipped** client calls `delete-account-v2` with `{ expectedUserId }`. Its proposed `supabase/functions/delete-account-v2/index.ts` rejects a missing/empty expected ID with **400** and depends on a **non-deployed** durable claim RPC. It cannot be released against currently live v1-only infrastructure.
- **Stop rules:** Never replace the live `delete-account` endpoint with strict v2 (would break still-installed bodyless B123 clients); never publish the v2-dependent client before separately authorized, proven v2 deployment + claim/retention policy; never use Nesmi or DLS company Supabase projects as disposable test targets. Never perform a real account deletion as a smoke test.

## Single shortest path to an auditable release decision
1. **App Store Connect read-only evidence** (authenticated owner session only): record screenshot/text showing app `Nesmi`, app ID, App Store distribution version, exact **selected build number**, current **review status**, latest reviewer message and its date, and timestamp of capture. Keep TestFlight installability separate. Do not submit/respond/mutate.
2. **Source-to-build mapping**: match selected build to Xcode Cloud run, archive commit SHA, TestFlight build and intended PR base. Record any mismatch before changing code or selecting a build.
3. **Non-production acceptance**: after separately approved disposable project/accounts exist, execute real A/B HTTP RLS read/write/isolation and delete-v2/claim contract checks, including no unexpected retries, permission/grant checks, and exact receipts; retain sanitized logs. Do not use existing company projects.
4. **Owner-specific decisions, only when release-ready**: approve legacy client retirement/compatibility strategy; privacy retention and recovery of uncertain claims; any production-sensitive backend rollout or final App Store submission. These are pre-existing release gates, not a new approval request.
5. **Physical iPhone / actual candidate build**: verify sign-up/login/logout, member + chore save/relaunch persistence, completion, second-account isolation and error feedback; account deletion only on specifically authorized disposable non-production identities. Capture build number, OS, date and observable results.

**Go** requires a single evidenced selected App Review build, matching built source, backend/client compatibility, real nonproduction integration safety, current exact-build iPhone acceptance, and explicit authorization for sensitive deploy/Store action. Until then: **HOLD**. Focus on these gates; defer unrelated UI exploration and MoveLight feature scope.

## Audit boundary
This checkpoint uses: direct Apple email (2026-10-25), 2026-10-28 Gmail scoped searches (absence of a match is *not* proof of no change), current PR metadata and source, production Edge read-only inventory + source, and the immediately preceding Library Task193. Browser App Store Connect access was unavailable. No customer rows inspected, account deleted, production config changed, branch merged, or external message sent.
