/**
 * A best-effort, per-account client-side guard for irreversible deletion.
 * The marker is written BEFORE invoking the Edge function, and survives
 * remount/reload. Missing/unreadable browser storage fails closed.
 *
 * This is not a distributed lock or server idempotency mechanism: simultaneous
 * cross-tab writes can race. Live backend reconciliation remains a release gate.
 * Do not clear the marker on an uncertain response or on routine sign-out.
 */
const ATTEMPT_PREFIX = 'nesmi:account-deletion-attempt:';

export function accountDeletionAttemptKey(accountId: string): string {
  return `${ATTEMPT_PREFIX}${accountId}`;
}

export function wasAccountDeletionAttempted(accountId?: string | null): boolean {
  if (!accountId) return false;
  try {
    return window.localStorage.getItem(accountDeletionAttemptKey(accountId)) !== null;
  } catch {
    // Without a reliable read, do not allow an irreversible request.
    return true;
  }
}

export function reserveAccountDeletionAttempt(accountId?: string | null): boolean {
  if (!accountId) return false;
  try {
    const storage = window.localStorage;
    const key = accountDeletionAttemptKey(accountId);
    if (storage.getItem(key) !== null) return false;
    storage.setItem(key, 'true');
    return storage.getItem(key) === 'true';
  } catch {
    // No request may be sent if the marker cannot be persisted and read back.
    return false;
  }
}
