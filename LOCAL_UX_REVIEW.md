# Local UX candidate

Base: 4eee560. This branch fixes screenshot-reported mobile layout and consistency issues without changing the installed TestFlight build.

- Bounded date field with themed picker, explicit apply/cancel, keyboard date navigation and manual ISO input.
- Phone agenda instead of narrow time grids; account page does not show unrelated create action.
- Account action alignment, common mobile editor/tools presentation and nearest-only focus scrolling.
- Missing assistant task names prompt for a name instead of becoming a task named “called”.
- Explicit Google client configuration, load/error handling and account selection; no credentials or server configuration changed.

Validation: production web build passed; 48 test files / 321 tests passed. Synthetic Chromium geometry and dialog interaction checks at 320/375/390/768px passed with no page errors. No screenshots or real account actions. Actual iOS keyboard, VoiceOver and large text remain required before release. Google authorization is not proven repaired without the original error code and live client configuration.

No signed build, push, deployment or upload. Temporary QA harness and dependency links are excluded locally and are not product assets.
