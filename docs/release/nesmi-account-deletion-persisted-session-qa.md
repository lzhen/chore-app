# Nesmi account deletion: persisted-session release acceptance

**Status:** PR #35 mocked release gate executed and PASS on head `163baca1a9a1407d43153ca741c65f61c8181df3`; real Supabase SDK, disposable account and physical-device gates NOT YET EXECUTED.  
**Owner:** Nesmi release QA. **Candidate:** existing draft PR #35 only; base is the known TestFlight B122 source `d0610712e1dfedbe970d6d8c4ae54213d9a2dddc`.  
**Do not mistake this document or passing mocked CI for validation of installed iOS Build 122 or an App Store release.**

## Why this is a release gate

Current draft `AuthContext.deleteAccount()` waits for `delete-account` to return `{ deleted: true }` before it clears the two Nesmi-owned cache keys and invokes `supabase.auth.signOut({ scope: 'local' })`. It then clears React auth state, and warns on local cleanup errors. A rejected SDK sign-out can leave a persisted Supabase session even though the *current provider* shows the signed-out form. A **new** provider instance on full reload is a separate risk, because `getSession()` can read persisted data. No current mock or TestFlight availability notification proves this real SDK/device boundary is safe.

**Promotion rule:** Do not promote PR #35 as a fully validated release candidate until the persisted-session/relaunch row below is observed on the exact candidate build and the current App Store Connect selected build is independently confirmed.

## Executed CI evidence (2026-10-24 04:33 PDT)

- **Source:** PR #35 draft head `163baca1a9a1407d43153ca741c65f61c8181df3` (test commit: in-flight auth superseded by cross-tab deletion), not the installed TestFlight Build 122.
- **[Executed GitHub Actions run 40090374131](https://github.com/lzhen/chore-app/actions/runs/40090374131):** completed/success. The actual job log reports **14/14 Node source regressions**, **38/38 jsdom/RTL tests across four files**, and a completed **TypeScript `tsc --noEmit` check**. This closes **PD-01 for this SHA only**. The separate dependency-report workflow is not an App Review or device acceptance gate.
- The earlier **[run 40077441340](https://github.com/lzhen/chore-app/actions/runs/40077441340)** failed due to a TypeScript library incompatibility in test code (`Array.at`); the newer success supersedes that specific failure. Do not quote the older failure as the current release status.
- Current mocked tests include a remounted **React AuthProvider**, a synthetic stale session, and simulated same-origin `storage` events. They **do not prove the real Supabase SDK persisted storage adapter, real cross-tab browser semantics, server-side ACK/idempotency, or iOS force-quit/relaunch**.
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
| PD-06 | Isolated staging/local harness only | After synthetic `deleted: true`, make `signOut({scope:'local'})` return an error, then separately reject; re-create AuthProvider to model a reload with a real SDK storage adapter. | Cleanup warning is visible on signed-out surface; local data state is measured without reading token values; no silent old-session resurrection. Current mocked tests now exercise a *fresh React AuthProvider* with a synthetic persisted stale session, but **not** the real Supabase SDK storage adapter or the physical iPhone relaunch boundary. |
| PD-07 | Isolated same-origin Web fixture | Seed named `chore-app-chores`, `chore-app-members`, and unrelated sibling-app fixture keys with dummy values; run synthetic confirmed deletion. | Only Nesmi-owned keys removed; sibling fixture remains. `localStorage.clear()` is a STOP. |
| PD-08 | Controlled transport-failure harness | Time out or reject deletion response after user confirms once. Switch Account tabs and reopen the panel. | Treat outcome as unknown; do not issue a second irreversible request or expose a retry button. Support/reconciliation path remains visible. |
| PD-09 | Exact nominated release candidate | Re-check login, keyboard focus/dismissal, Today 7-day state, Add chore, all bottom tabs, chore save/reopen/complete, Account Privacy and deletion paths. | No P0/P1 regressions; record all untested items separately. |
| PD-10 | Release administration | Independently verify App Store Connect *selected review build*, reviewer sign-in details, IAP/paid-features configuration, rights and territory statements. | Document the exact evidence and gaps. **No resubmission or public release from this script.** |

## Observations template

| Field | Value |
| --- | --- |
| Candidate branch / SHA | `fix/nesmi-b122-account-delete-ui-guard-20261023` / draft head `163baca1a9a1407d43153ca741c65f61c8181df3` (NOT a frozen release candidate) |
| PR / CI run URL | [Draft PR #35](https://github.com/lzhen/chore-app/pull/35) / [CI run 40090374131](https://github.com/lzhen/chore-app/actions/runs/40090374131), completed/success at exact SHA above |
| Physical iOS app build / availability proof | **NOT VERIFIED FOR PR #35**; B122 available-to-test does not contain these changes |
| Device / iOS / date | **NOT TESTED** |
| Disposable QA identity (redacted) | **NOT CREATED / NOT TESTED** |
| PD-01..PD-10 result and linked evidence | **PD-01: PASS, mocked CI only** (14 Node + 38 RTL + typecheck, exact draft SHA); **PD-02–PD-10: NOT EXECUTED / no real-world acceptance evidence** |
| Current ASC selected App Review build | **NOT VERIFIED** |
| Release decision | **HOLD** pending real SDK persistence + exact-device candidate evidence and other App Review requirements |

## Scope and safety

Do not read or delete production tokens manually to make this test pass; do not assume Supabase storage-key format is a stable API. Do not delete any non-disposable account, touch production authentication settings, change an Apple compliance questionnaire, trigger a build, merge, deploy, invite outside testers, or submit App Review as a side effect of this QA document.

**Source evidence at script creation:** `src/context/AuthContext.tsx`, `src/context/AuthContext.delete-account.test.tsx`, `.github/workflows/nesmi-account-delete-rtl-gate.yml` in PR #35. The previously recorded CI run [40069780752](https://github.com/lzhen/chore-app/actions/runs/40069780752) passed 14 source tests, 32 jsdom/RTL tests, and typecheck on prior head `8b9eeb38030b4944cdc3c589e6185733cab58460`; run 40090374131 has since passed on `163baca1a9a1407d43153ca741c65f61c8181df3`. Rerun release-gate tests after any subsequent app or test change; the evidence above applies only to its stated SHA.
