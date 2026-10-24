# Nesmi account deletion: persisted-session release acceptance

**Status:** Draft PR #35 offline gate PASS at exact test/source head `a04029df920b430cf6e506f542328b5ca6f43678` (2026-10-24 Task101: 14 Node source tests, **3 real installed Supabase SDK tests in a synthetic offline memory adapter**, 39 mocked jsdom/RTL tests, TypeScript typecheck). The SDK scenarios exercise successful local logout, simulated auth-storage removal failure, and intercepted HTTP 503 logout failure. **No actual backend deletion, disposable account, same-origin browser, physical iPhone, selected App Store Connect build, or Apple approval was verified. Release HOLD.**  
**Owner:** Nesmi release QA. **Candidate:** existing draft PR #35 only; base is the known TestFlight B122 source `d0610712e1dfedbe970d6d8c4ae54213d9a2dddc`.  
**Do not mistake this document or passing mocked CI for validation of installed iOS Build 122 or an App Store release.**

## Why this is a release gate

Current draft `AuthContext.deleteAccount()` waits for `delete-account` to return `{ deleted: true }` before it clears the two Nesmi-owned cache keys and invokes `supabase.auth.signOut({ scope: 'local' })`. It then clears React auth state, and warns on local cleanup errors. A rejected SDK sign-out can leave a persisted Supabase session even though the *current provider* shows the signed-out form. A **new** provider instance on full reload is a separate risk, because `getSession()` can read persisted data. No current mock or TestFlight availability notification proves this real SDK/device boundary is safe.

**Promotion rule:** Do not promote PR #35 as a fully validated release candidate until the persisted-session/relaunch row below is observed on the exact candidate build and the current App Store Connect selected build is independently confirmed.

## Latest offline CI evidence (2026-10-24 14:14 PDT; Task101)

- **Exact current draft HEAD:** [`a04029df920b430cf6e506f542328b5ca6f43678`](https://github.com/lzhen/chore-app/commit/a04029df920b430cf6e506f542328b5ca6f43678). The branch `fix/nesmi-b122-account-delete-ui-guard-20261023` remains open/draft/unmerged; this commit and preceding Tasks 99–101 are not in confirmed TestFlight **Nesmi 1.0(122)**.
- **[GitHub Actions run 40133257489](https://github.com/lzhen/chore-app/actions/runs/40133257489)**, at exact HEAD: completed/success; job **120989312989**. Independently checked the runner job and its successful source regressions, real Supabase SDK offline storage-adapter gate, jsdom/RTL regressions and TypeScript typecheck. Detailed counts **14/14 source Node, 3/3 real-SDK synthetic offline, 39/39 mocked RTL, typecheck PASS** are reported in the preceding Task101 execution record.
- The three SDK cases use an actually installed `@supabase/supabase-js` library and intercepted `.invalid` endpoint, but **synthetic identities, in-memory storage, no real session/browser, no production traffic or user deletion**. Two negative cases demonstrate a recoverable synthetic stale identity after local cleanup errors; they are failure characterizations, **not release-safety PASS evidence**.
- Current release interpretation: **PD-01 offline gate PASS only** (including narrower real-SDK offline adapter observations). **PD-02–PD-10 and PD-05a real-environment/device gates remain UNEXECUTED**. Release stays HOLD.

## Historical executed CI evidence (2026-10-24 09:59 PDT; Task97)

- **Current exact draft test/source head:** [`0c52ea34d4d9ce523cf88ff4ce1a1622ad471b2d`](https://github.com/lzhen/chore-app/commit/0c52ea34d4d9ce523cf88ff4ce1a1622ad471b2d), **not installed TestFlight Build 122**. Task97 strengthens a mocked confirmed-deletion test with the five exact MoveLight keys observed in `lzhen/empathie-website/movelight/web/index.html`, plus an unrelated synthetic key. Prior Task95 commit [`aed0630`](https://github.com/lzhen/chore-app/commit/aed063087164e994eca5a7ff4e17eb4b931179a4) added the startup-session vs cross-tab deletion race regression.
- **[Executed GitHub Actions run 40113944229](https://github.com/lzhen/chore-app/actions/runs/40113944229):** completed/success at this exact Task97 app/test commit. Runner logs (verified in company Task97) report **14/14 Node source regressions**, **39/39 mocked jsdom/React Testing Library cases in four files**, and **TypeScript typecheck** successful. The count remains 39 because an existing case was strengthened. This is **PD-01 only**, not real Supabase SDK/browser/device acceptance.
- Previous successful Task95 run [40105682864](https://github.com/lzhen/chore-app/actions/runs/40105682864) passed 14 Node, 39 RTL and typecheck on `aed0630...`; the later Task97 run supersedes it for the current test head. Historical prior run [40090374131](https://github.com/lzhen/chore-app/actions/runs/40090374131) passed at `163baca1a...` with 14 Node, 38 RTL and typecheck; the later 39-case run supersedes those counts. Older [run 40077441340](https://github.com/lzhen/chore-app/actions/runs/40077441340) had a test-only `Array.at` typecheck failure; it does **not** describe the current gate. The separate dependency report does not establish App Review/device readiness.
- Current mocked tests include a remounted **React AuthProvider**, a synthetic stale session, and simulated same-origin `storage` events, including a *pending initial* `getSession()` result racing a cross-tab deletion receipt. They **do not prove real browser persistent-storage behavior, cross-tab browser semantics, server-side ACK/idempotency, or iOS force-quit/relaunch**. Tasks 99–101 separately exercise the installed SDK with synthetic memory-backed storage only.
- **Release HOLD:** Do not promote this unshipped draft to TestFlight/App Review based on CI alone; PD-02–PD-10 each retain their own real-world gates.

## Test preconditions

- Use a **new disposable QA account**, never a founder account, Apple review account, household member's account, or existing customer identity. Approval to create/delete a real account and to run destructive testing must come from the account holder when required.
- Use a controlled staging/local harness for injected storage/SDK errors; **never fault-inject or wipe data in production**.
- Record app name, exact commit SHA, build number, TestFlight availability evidence, actual installed build, device model, iOS version, test date/time/timezone. A simulator or Web mock is not a physical-device pass.
- Capture only redacted screenshots and pass/fail facts. Do **not** export passwords, JWTs, refresh/access tokens, cookies, auth Storage values, customer data or raw server logs.
- Distinguish three environments in evidence: **offline mocked CI**, **real SDK in staging/local harness**, **physical iPhone on exact TestFlight candidate**. A result in one is not evidence for another.

## Acceptance scenarios

| ID | Where / setup | Actions | Required observations / fail condition |
| --- | --- | --- | --- |
| PD-01 | Offline draft CI | Run `npm run test:release-delete`, the selected RTL/Vitest suite, and `npm run typecheck` from the **exact** candidate commit. | Commands finish successfully; save run URL and SHA. Mocked success only. |
| PD-02 | Real SDK; fresh disposable account | Sign in, quit and relaunch; confirm the valid session survives before deletion. | Baseline persistence works. Do not count an SDK mock as this baseline. |
| PD-03 | Real SDK / physical iPhone | Cancel at the final delete-confirmation screen. | No deletion request; account remains usable. |
| PD-04 | Real SDK / physical iPhone; disposable account | Explicitly confirm deletion once, obtain the server's acknowledged `deleted: true` outcome through safe QA instrumentation, observe signed-out form. | No duplicate deletion call, no authenticated UI after success. Never infer server deletion solely from changed React UI. |
| PD-05 | Same candidate; **after PD-04** | Force-quit app, reopen twice; retry navigating to previously authenticated screens. If Web applies, hard-refresh and open another tab. | **No deleted identity appears as signed in**. Persistent SDK storage is cleared or safely invalidated. Any stale logged-in UI is a STOP, even if subsequent API calls fail. |
| PD-05a | Isolated real-SDK same-origin two-tab harness; disposable identity only | With Tab B mounting and its *initial* `getSession()` deliberately delayed using the controlled QA adapter, confirm deletion in Tab A. Then release Tab B's pending result. Repeat with a freshly mounted provider. | Tab B must not restore the deleted identity or remain loading; it should show the signed-out/warning surface. A sibling-app fixture key remains intact. Task95 provides **synthetic RTL coverage only**; this real-SDK two-tab scenario has **NOT** been executed. |
| PD-06 | Isolated staging/local harness only | After synthetic `deleted: true`, make `signOut({scope:'local'})` return an error, then separately reject; re-create AuthProvider to model a reload with a real SDK storage adapter. | Cleanup warning is visible on signed-out surface; local data state is measured without reading token values; no silent old-session resurrection. Current mocked tests exercise a *fresh React AuthProvider* with a synthetic persisted stale session; Tasks 99–101 additionally execute actual Supabase SDK storage/logout logic against synthetic offline memory adapters, including failure injection. Neither covers an integrated real-SDK React provider + browser persistent storage, physical iPhone relaunch, or server deletion. |
| PD-07 | Isolated same-origin Web fixture | Seed dummy values at `chore-app-chores` and `chore-app-members`; preserve source-confirmed MoveLight keys `qingbu.state.v1`, `movelight.redesign.v1.state`, `movelight.review.focus1.state`, `movelight_redesign_v1_theme`, `movelight_redesign_v1_language`, plus an unrelated synthetic key. Confirm deletion in a disposable/controlled setup. | Only the two Nesmi-owned keys are removed. Every MoveLight and unrelated fixture key retains its dummy value; any `localStorage.clear()` is a STOP. Task97 mocked assertions cover these names; browser same-origin/SDK behavior still NOT TESTED. |
| PD-08 | Controlled transport-failure harness | Time out or reject deletion response after user confirms once. Switch Account tabs and reopen the panel. | Treat outcome as unknown; do not issue a second irreversible request or expose a retry button. Support/reconciliation path remains visible. |
| PD-09 | Exact nominated release candidate | Re-check login, keyboard focus/dismissal, Today 7-day state, Add chore, all bottom tabs, chore save/reopen/complete, Account Privacy and deletion paths. | No P0/P1 regressions; record all untested items separately. |
| PD-10 | Release administration | Independently verify App Store Connect *selected review build*, reviewer sign-in details, IAP/paid-features configuration, rights and territory statements. | Document the exact evidence and gaps. **No resubmission or public release from this script.** |

## Observations template

| Field | Value |
| --- | --- |
| Candidate branch / SHA | `fix/nesmi-b122-account-delete-ui-guard-20261023` / latest executed offline app/test SHA `a04029df920b430cf6e506f542328b5ca6f43678` (a subsequent documentation-only commit does not turn it into a release candidate) |
| PR / CI run URL | [Draft PR #35](https://github.com/lzhen/chore-app/pull/35) / [CI run 40133257489](https://github.com/lzhen/chore-app/actions/runs/40133257489), completed/success at exact tested SHA above |
| Physical iOS app build / availability proof | **NOT VERIFIED FOR PR #35**; B122 available-to-test does not contain these changes |
| Device / iOS / date | **NOT TESTED** |
| Disposable QA identity (redacted) | **NOT CREATED / NOT TESTED** |
| PD-01..PD-10 (+ PD-05a) result and linked evidence | **PD-01: PASS, offline CI only** (14 Node + 3 real-SDK synthetic offline + 39 mocked RTL + typecheck at `a04029d...`, Task101); **PD-02–PD-10 and PD-05a: NOT EXECUTED / no real-world acceptance evidence** |
| Current ASC selected App Review build | **NOT VERIFIED** |
| Release decision | **HOLD** pending real SDK persistence + exact-device candidate evidence and other App Review requirements |

## Scope and safety

Do not read or delete production tokens manually to make this test pass; do not assume Supabase storage-key format is a stable API. Do not delete any non-disposable account, touch production authentication settings, change an Apple compliance questionnaire, trigger a build, merge, deploy, invite outside testers, or submit App Review as a side effect of this QA document.

**Source evidence at script creation:** `src/context/AuthContext.tsx`, `src/context/AuthContext.delete-account.test.tsx`, `.github/workflows/nesmi-account-delete-rtl-gate.yml` in PR #35. The previously recorded CI run [40069780752](https://github.com/lzhen/chore-app/actions/runs/40069780752) passed 14 source tests, 32 jsdom/RTL tests, and typecheck on prior head `8b9eeb38030b4944cdc3c589e6185733cab58460`; run 40090374131 later passed at `163baca1...` (38 RTL cases), and [run 40105682864](https://github.com/lzhen/chore-app/actions/runs/40105682864) has since passed on `aed0630...` (39 RTL cases). Rerun release-gate tests after any subsequent app or test change; the evidence above applies only to the stated app/test SHA. This QA-documentation edit itself is not a new app test run.
