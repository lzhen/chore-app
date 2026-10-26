# Nesmi — B122/B123 ↔ claimed Edge transition gate (INTERNAL / NON-DEPLOYED)

## Task132 — current B123 compatibility reconciliation (2026-10-25 ~21:12 PDT)

**Supersedes the Task126 "last installable B122" and latest-draft-SHA statements below; Task126 is preserved as a dated historical worksheet.** **RELEASE HOLD** remains. This change is documentation on the existing open/draft/unmerged PR #35 only; not a deploy, migration, privileged operation, account deletion, build, App Review action, or user communication.

### Source-of-truth snapshot, independently re-read

- **Latest Apple-email-confirmed installable Nesmi:** iOS TestFlight **1.0 (123)**, 2026-10-25 17:39 PDT (Apple mail id `1a175a5dbd92a101`), with Xcode Cloud Build123 success (`1a175a591b3c652c`) from `fix/chorely-auth-viewport-20260927-icon-family-20261026` SHA [`6eab3d3b20a32d07376c1bd938979219a3565a74`](https://github.com/lzhen/chore-app/commit/6eab3d3b20a32d07376c1bd938979219a3565a74). GitHub exact comparison to B122 `d0610712e...` = **one commit ahead, zero behind**, changes only iOS AppIcon PNG and `verify_app_icon.swift`. [Pinned B123 AuthContext](https://github.com/lzhen/chore-app/blob/6eab3d3b20a32d07376c1bd938979219a3565a74/src/context/AuthContext.tsx) still invokes `delete-account` with **`{ method: 'POST' }` and no JSON body**, checks `data?.deleted === true`, and deletes only two Nesmi-owned cache keys; do **not** revive the old broad `localStorage.clear()` claim for B123.
- Existing [draft PR #35](https://github.com/lzhen/chore-app/pull/35) read back **open/draft/unmerged**, base `d0610712e...`, head [`bef03aabea4503f359cc303001ec6ac841f848ce`](https://github.com/lzhen/chore-app/commit/bef03aabea4503f359cc303001ec6ac841f848ce) before this documentation edit. The **actual** PR path `supabase/functions/delete-account/index.ts` requires `expectedUserId` (missing body -> 400; mismatch -> 409) but directly calls `admin.deleteUser` without a persisted claim. It is **not** the currently installed B123 client and was not deployed by this work.
- Separately, the **review-only, explicitly nondeployed** [Deno claimed-delete handler](https://github.com/lzhen/chore-app/blob/bef03aabea4503f359cc303001ec6ac841f848ce/docs/release/prototypes/nesmi-delete-claimed-deno-handler.nondeploy.ts) requires `expectedUserId` and draft claim/finalize RPCs. There is no demonstrated deployed claim ledger, privacy/retention decision, production server compatibility, or real account deletion. It is intentionally outside `supabase/functions`.
- [Source-executed synthetic CI run 40263232784](https://github.com/lzhen/chore-app/actions/runs/40263232784) completed success on `bef03a... ` (13/13 Deno-handler tests plus separate isolation, SDK bridge, client/server compatibility and disposable/rollback PostgreSQL tests); [UI regression 40263232767](https://github.com/lzhen/chore-app/actions/runs/40263232767) and [dependency report 40263232752](https://github.com/lzhen/chore-app/actions/runs/40263232752) also completed success at that SHA. These results are **offline/synthetic and explicitly not release acceptance**. This doc-only edit does not establish a new green CI run.
- Scoped company Gmail search after October 24 found B123 TestFlight and Xcode notices but no matching new Nesmi reviewer-detail message. **Absence from a scoped mailbox is not evidence of the current selected App Store Connect build or review status.** Actual selected build, real physical iPhone acceptance, current deployed backend revision and live customer cohort remain **UNVERIFIED**.

### Current transition matrix (B123 is the installed-source anchor)

| Client / server pair | Source-observed outcome | Release gate |
| --- | --- | --- |
| **B123 bodyless** + **unknown live deployed Edge** | Do not infer server behavior from an old repository copy; current production code/state not verified. | **STOP** until authoritative inventory. |
| **B123 bodyless** + **existing PR #35 strict Edge** | Synthetic/pinned code: missing `expectedUserId` -> **400**, no admin deletion. Deletion UI would lose its existing function if strict Edge were deployed alone. | **HOLD; do not deploy one-sided**. |
| **B123 bodyless** + **nondeployed claimed Deno candidate** | Source-executed: missing JSON body -> **400**, before SDK/claim/admin initialization. | **HOLD; candidate is incompatible and nondeployed**. |
| **Future ID-bearing client** + **existing PR #35 strict Edge** | Intended ID match/mismatch checked, but direct `admin.deleteUser` lacks durable replay claim/finalize. | **HOLD; still not idempotent/reconciled**. |
| **Future ID-bearing client** + **claimed Deno candidate + draft SQL/RPC** | Synthetic tests cover claim/finalize/error/parallel replay, but live RPC is not installed or privacy-approved; no network/device proof. | **HOLD; test-only prototype**. |
| **Legacy B122** alongside B123 during any cutover | B122 is also bodyless; a client-only icon update to B123 has not eliminated legacy compatibility risk. | **HOLD until owner-approved legacy policy**. |

### Decision-free next verification and hard stop rules

1. **CT-01:** Before any action against production, read actual current deployed Edge version, ASC review-selected SHA/build, and any installed legacy-client exposure without exporting credentials. If unavailable, leave **UNKNOWN**, do not assume.
2. **CT-02/03:** A production transition requires an owner-approved legacy-client experience and privacy/retention disposition for durable claim records. Do not silently replace bodyless deletion with unexplained 400, infer that suggested 426 is currently implemented, or roll back to insecure bearer-only deletion as an automatic recovery.
3. **CT-04/05:** In separately approved staging with disposable identities only, validate real SDK/HTTP/claim state, ambiguous ACK, no automatic destructive retry, cross-tab reload and sibling-app storage isolation. **No real identity/deletion has been exercised by the cited CI.**
4. **CT-06/07:** Match final compatible client/server SHAs, real physical iPhone validation and App Review evidence before owner-approved protected merge, sensitive backend deployment or formal store submission. TestFlight availability `1.0(123)` alone is not a release gate pass.

**Net decision:** **HOLD / do not deploy** either strict Edge against installed B123 or the proposed Deno handler/SQL. No new founder-only blocker was discovered beyond previously logged approval/device/backend-release gates. Work remains Nesmi-only; no Care/DLS/MoveLight expansion.

---

## Historical Task126 worksheet (state as of 2026-10-25 ~14:24 PDT)

**Task:** NESMI-LS-126 | **Checked:** 2026-10-25 14:24 PDT  
**Owner workflow:** Nova / Leo / Iris / Kai / Vera / Mira are responsibilities, not separate deployed agents.  
**Decision:** **HOLD**. This document is an executable *review and acceptance worksheet*, not a migration, Edge deployment, Apple action, customer notice, or approval to delete accounts.

## Canonical evidence, pinned rather than inferred

- Last Apple-email-confirmed installable Nesmi iOS candidate: **1.0 (122)**, TestFlight ready email dated **2026-10-21 16:54 UTC**, source commit [`d0610712`](https://github.com/lzhen/chore-app/commit/d0610712e1dfedbe970d6d8c4ae54213d9a2dddc). Its [AuthContext](https://github.com/lzhen/chore-app/blob/d0610712e1dfedbe970d6d8c4ae54213d9a2dddc/src/context/AuthContext.tsx) invokes POST `delete-account` **without a JSON body**. It already requires `data.deleted === true` and deletes only two Nesmi cache keys; **do not reintroduce the superseded `localStorage.clear()` finding for B122**.
- Existing [draft PR #35](https://github.com/lzhen/chore-app/pull/35), branch `fix/nesmi-b122-account-delete-ui-guard-20261023`, source verified here at **`951b10d76e990801a628af690fbfb7642f81b48e`** before this *documentation-only* commit. The [draft client](https://github.com/lzhen/chore-app/blob/951b10d76e990801a628af690fbfb7642f81b48e/src/context/AuthContext.tsx) sends `{expectedUserId}`; the [draft Edge handler](https://github.com/lzhen/chore-app/blob/951b10d76e990801a628af690fbfb7642f81b48e/supabase/functions/delete-account/index.ts) rejects missing body with **400**, identity mismatch with **409**, but **calls admin.deleteUser directly without a durable claim**. The draft is **not** the installed TestFlight version and is not known to be deployed.
- [Task125 actual-source regression](https://github.com/lzhen/chore-app/blob/951b10d76e990801a628af690fbfb7642f81b48e/tests/release/nesmi-edge-actual-source-compatibility.nondeploy.test.cjs) executed the *actual draft Edge source* under synthetic VM stubs. [Workflow 40231562875](https://github.com/lzhen/chore-app/actions/runs/40231562875) passed: 7/7 actual-source cases, 17/17 non-deployed orchestration cases, and disposable PostgreSQL claim concurrency. Negative evidence: **two synthetic matching POSTs can each reach admin deletion** in the current draft Edge. No live Supabase/HTTP, client/store deployment, or real deletion was tested.
- The [rollback-only SQL claim prototype](https://github.com/lzhen/chore-app/blob/951b10d76e990801a628af690fbfb7642f81b48e/docs/release/prototypes/nesmi_delete_claim_nondeploy.sql) and [dependency-injected orchestration prototype](https://github.com/lzhen/chore-app/blob/951b10d76e990801a628af690fbfb7642f81b48e/docs/release/prototypes/nesmi-delete-edge-orchestration.nondeploy.cjs) are outside the deployed Edge path. The source has **not** been migrated to use RPC claim/finalize.
- Selected App Store Connect review build, deployed Edge source at this exact moment, and physical-device acceptance are **not established** by the above email/code checks. Latest scoped Apple messages after B122 do not by themselves establish the absence of an ASC change.

## Decision table — behavior before a deployment window

| Installed client | Edge variant | Actual or source-backed behavior | Go / no-go |
| --- | --- | --- | --- |
| B122 | Legacy B122-era Edge | Bodyless POST uses current bearer without a separately frozen expected identity. | **NO-GO** as hardened deletion; legacy behavior must be documented, not silently treated as safe. |
| B122 | Draft strict Edge | Actual-source synthetic test: bodyless POST returns **400** without admin call. Installed client has no tailored compatibility notice. | **NO-GO** one-sided server deployment; user loses existing delete function. |
| Draft PR client | Legacy Edge | New body is ignored by legacy handler; bearer remains authoritative. | **NO-GO** client-first alone; claim and server binding absent. |
| Draft PR client | Draft strict Edge | Authenticated ID must match `expectedUserId`; returns 409 on mismatch; repeat matching synthetic calls **both** reach admin. | **NO-GO** until durable server claim/reconciliation. |
| Upgraded, exact-build client | Future Edge with tested persisted claim + finalization | Intended contract: one durable claim before delete; uncertainty fails closed; confirmed finalize before `deleted:true`. | **NOT YET ELIGIBLE**: implementation, coordinated compatibility policy, real Edge/SDK and device tests pending. |
| Any client | Unknown live Edge or unknown ASC-selected build | Source history alone cannot resolve deployed version or reviewer-facing build. | **STOP**; read authoritative state before changing anything. |

**Critical non-equivalence:** A `400` from current strict handler is observed synthetic *source* behavior; a suggested `426 CLIENT_UPGRADE_REQUIRED` from the non-deployed coordinator is *proposal only*. Do not mix them in a customer message or claim they are production behavior.

## Controlled transition — prepare and verify, do not execute

| Gate | Required evidence / check | Current state |
| --- | --- | --- |
| CT-01 Inventory | Read live Edge version/source, current App Store Connect selected review build, installed legacy cohort exposure; record exact SHA and date. No secrets exported. | **OPEN** |
| CT-02 Security semantics | Implement and test durable atomic account-scoped claim in actual Edge path, no release from ambiguous outcome, finalize semantics, manual reconciliation ownership. Review privacy retention of claim records. | **OPEN** (isolated SQL / coordinator proof only) |
| CT-03 Legacy compatibility | Explicit product/security choice: installed B122 bodyless delete behavior during transition, user-facing no-retry/support path, whether interruption is acceptable, and feasible deployment ordering. No implicit decision by CI. | **OPEN / owner approval required before production change** |
| CT-04 Fully staged matrix | In an approved isolated test environment with disposable identity only, exercise old/new client × old/new Edge, including no body, mismatch, duplicate/replay, claim RPC timeout, admin ambiguity, failed finalize, and exactly one confirmed ACK. Log response classes only; redact account IDs/tokens. | **NOT EXECUTED** |
| CT-05 Shared-origin / session | Real browser test preserves MoveLight localStorage and unrelated keys. Reload, second tab, blocked storage, authenticated-user switch, unsuccessful sign-out, and force-quit relaunch must not resurrect or retarget an old deletion. | **NOT EXECUTED** |
| CT-06 iOS / review | Verify *exact* new candidate SHA → TestFlight availability → actual physical iPhone flows → review video/account → ASC selected build and metadata. No archive/CI-only substitution. | **NOT EXECUTED** |
| CT-07 Promotion | Security + owner approve window, compatibility messaging and recovery, privileged migration/config, separate formal Apple submission approval. | **NOT APPROVED** |

### Isolation steps for the future CT-04 run

1. Confirm authorized disposable environment and test identity; avoid everyday, customer, or Apple review accounts. Pre-validate domain/project identifiers without reading sensitive values into reports.
2. Record the exact client/Edge artifact versions **before** each test; no automatic retry of destructive requests after timeout or uncertain response. Separate harmless parser tests from authorized deletion tests.
3. First test invalid/missing bearer and malformed body: must fail before claim/admin call. Then expected-ID/bearer mismatch: **409**, no claim/admin. Old-client bodyless request must follow **only the approved** legacy response policy.
4. Exercise two concurrent requests for one *synthetic* account in isolated tests: exactly one claim winner and at most one admin call; no second winner across workers/processes. Force acquire RPC error, admin ambiguity and finalization error separately; no `deleted:true` and no automatic unlock/retry.
5. With the approved disposable identity, require server-verified final state, durable claim state, explicit `{deleted:true}` only after successful finalized deletion. Inspect no secret-bearing logs, no sibling-app key removal, no leaked/stale persisted session.
6. Capture redacted QA evidence (timestamps, exact SHA pairs, status codes, CI/test reference, device/OS, observed data boundary) and mark each gate PASS/FAIL/UNTESTED. **Any unknown outcome stays STOP**, not retry.

### Stop, recover, and rollback invariants

- **Never** deploy the current strict Edge as a one-sided "fix" while legacy B122 is known installed: it rejects bodyless deletion and changes user-visible behavior.
- **Never** automatically roll back to the bearer-only legacy delete route to restore functionality after an incident; that reopens the original identity-binding risk. Any temporary compatibility mechanism, support channel or policy exception needs explicit product/security approval and new verification.
- If Edge/claim/RPC is inconsistent or result ambiguous: **disable further irreversible retry paths as appropriate**, preserve the durable claim, use authorized manual reconciliation, and avoid claiming deletion succeeded. Do not grant broader DB roles or expose service keys to clients.
- If a client build is still absent from TestFlight, its passing CI is **not** physical-device validation. A new review-selected build requires fresh QA even if an older recording exists.

## Status at this document commit

**HOLD — no approval to ship.** The completed increment is a source-pinned, operator-usable compatibility and fail-closed verification worksheet in an existing draft PR. No new Edge implementation, SQL migration, CI execution, app build, real HTTP request, account deletion, public deployment, merge, store submission, user outreach, or production config change is implied. The next practical internal implementation must connect a *durable claim* to the real Edge handler in a deliberately unshipped candidate and prove it without production traffic; operational CT-01 / CT-03 gates remain blocked on authenticated platform facts and owner decisions.
