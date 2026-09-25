# Chorely mobile UX release — 25 September 2026

This release keeps the existing app identity `com.pawssible.chorely` and signing setup.

Changes:
- Task-first Today page on phones, with a week picker, person filter and overdue/today/completed groups.
- Calendar, All chores, Insights and Account are consistent top-level destinations.
- Three-field chore creation; advanced time/repeat/notes options; fixed dialog actions with isolated background and keyboard focus handling.
- Persist explicit end times; keep calendar dates in local time; fix old recurring chores disappearing after 100 occurrences.
- Await saves; preserve drafts and expose retryable failures. Search and family filters work in both calendar and list views.
- Completion requires an explicitly selected family member instead of defaulting to the first person.
- Authenticated data loads after sign-in and resets between accounts; load failures are not presented as an empty household.

Backend prerequisite APPLIED through Supabase migration `chorely_persist_optional_end_time`:

```sql
alter table public.chores add column if not exists end_time time without time zone;
```

The new column is optional, leaves existing chore rows intact and does not change existing row access policies.

Verification:
- `npm run test:run`
- `npm run build`
- `npx playwright test -c playwright.ux.config.ts`
- Existing iOS Release Check / Xcode Cloud pipelines

Browser tests use synthetic accounts and intercepted database responses; no production accounts or chores are created by the tests. Browser screenshots are review evidence, NOT actual iPhone App Store screenshots.

Still requires real-device acceptance: keyboard and safe areas, VoiceOver, sign-in/recovery and account deletion with a disposable user, and actual multi-device behavior. Apple upload processing and App Review are separate from compilation. This commit does not submit an app for review or change App Store pricing/availability.
