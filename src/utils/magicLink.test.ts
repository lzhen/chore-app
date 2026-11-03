import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMagicLinkFlow, magicRedirect, NATIVE_MAGIC_REDIRECT, LINK_ERROR, SEND_ERROR } from './magicLink';

const state = 'local-test-state';
const code = 'synthetic-code-only';
const callback = `${NATIVE_MAGIC_REDIRECT}?state=${state}&code=${code}`;
function setup() {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'existing-user' } } }, error: null }),
  };
  let time = 100_000;
  const flow = createMagicLinkFlow(auth, NATIVE_MAGIC_REDIRECT, localStorage, () => time, () => state);
  return { auth, flow, advance: (ms: number) => { time += ms; } };
}
beforeEach(() => localStorage.clear());
describe('email link flow, using mocks only', () => {
  it('requests an existing-account link with fixed callback and no password', async () => {
    const { flow, auth } = setup();
    expect((await flow.send(' Person@Example.com ')).error).toBeNull();
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'person@example.com', options: { shouldCreateUser: false, emailRedirectTo: `${NATIVE_MAGIC_REDIRECT}?state=${state}` } });
  });
  it('suppresses concurrent sends and applies cooldown', async () => {
    const { flow, auth } = setup();
    await Promise.all([flow.send('a@example.com'), flow.send('a@example.com')]);
    await flow.send('a@example.com');
    expect(auth.signInWithOtp).toHaveBeenCalledTimes(1);
  });
  it('survives restart, exchanges once and never persists the authorization code', async () => {
    const { flow, auth } = setup();
    await flow.send('a@example.com');
    const coldFlow = createMagicLinkFlow(auth, NATIVE_MAGIC_REDIRECT, localStorage, () => 100_001);
    expect((await coldFlow.receive(callback)).error).toBeNull();
    await coldFlow.receive(callback);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith(code);
    expect(localStorage.getItem('nesmi-magic-link-request')).not.toContain(code);
  });
  it.each([
    `${NATIVE_MAGIC_REDIRECT}?state=wrong&code=${code}`,
    `com.pawssible.chorely://evil/magic-link?state=${state}&code=${code}`,
    `com.pawssible.chorely://auth/other?state=${state}&code=${code}`,
    `com.pawssible.chorely://person@auth/magic-link?state=${state}&code=${code}`,
    `${callback}&next=https://evil.invalid`,
    `${callback}&code=second-code`,
    `${callback}#access_token=not-a-token`,
    `${NATIVE_MAGIC_REDIRECT}?state=${state}`,
  ])('rejects invalid or untrusted callbacks without an auth call: %s', async (url) => {
    const { flow, auth } = setup(); await flow.send('a@example.com');
    expect((await flow.receive(url)).error?.message).toBe(LINK_ERROR);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('ignores unrelated links without navigation or authentication', async () => {
    const { flow, auth } = setup();
    expect(await flow.receive('https://evil.invalid/?code=synthetic')).toEqual({ handled: false, error: null });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('rejects expired local requests', async () => {
    const { flow, auth, advance } = setup(); await flow.send('a@example.com'); advance(16 * 60_000);
    expect((await flow.receive(callback)).error?.message).toBe(LINK_ERROR);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('ignores a successfully consumed callback replayed after the request window', async () => {
    const { flow, auth, advance } = setup();
    await flow.send('a@example.com');
    expect((await flow.receive(callback)).error).toBeNull();
    advance(16 * 60_000);
    const restarted = createMagicLinkFlow(auth, NATIVE_MAGIC_REDIRECT, localStorage, () => 1_060_000);
    expect(await restarted.receive(callback)).toEqual({ handled: true, error: null });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect((await restarted.receive(`${NATIVE_MAGIC_REDIRECT}?state=wrong&code=${code}`)).error?.message).toBe(LINK_ERROR);
  });
  it('does not expose provider error descriptions', async () => {
    const { flow, auth } = setup(); await flow.send('a@example.com');
    expect((await flow.receive(`${NATIVE_MAGIC_REDIRECT}?state=${state}&error=access_denied&error_description=untrusted-text`)).error?.message).toBe(LINK_ERROR);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('does not report invalid-link after successful auth if completion storage fails', async () => {
    const { auth } = setup();
    const storage = {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => {
        if (JSON.parse(value).completed) throw new Error('storage unavailable');
        localStorage.setItem(key, value);
      },
    } as Storage;
    const flow = createMagicLinkFlow(auth, NATIVE_MAGIC_REDIRECT, storage, () => 100_000, () => state);
    await flow.send('a@example.com');
    expect((await flow.receive(callback)).error).toBeNull();
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
  it('handles expired/used server codes without logging or retries', async () => {
    const { flow, auth } = setup(); await flow.send('a@example.com');
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: new Error('private details') } as never);
    expect((await flow.receive(callback)).error?.message).toBe(LINK_ERROR);
    await flow.receive(callback);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
  it('does not replace an already signed-in account', async () => {
    const { flow, auth } = setup(); await flow.send('a@example.com');
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'other-existing-user' } } } } as never);
    expect((await flow.receive(callback)).error?.message).toContain('did not change your account');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect((await flow.send('b@example.com')).error).not.toBeNull();
  });
  it('sanitizes thrown network failures and permits a later request', async () => {
    const { flow, auth, advance } = setup(); auth.signInWithOtp.mockRejectedValueOnce(new Error('sensitive response'));
    expect((await flow.send('a@example.com')).error?.message).toBe(SEND_ERROR);
    advance(61_000); expect((await flow.send('a@example.com')).error).toBeNull();
  });
  it('accepts only the exact web callback origin/path and marker', async () => {
    const { auth } = setup();
    const flow = createMagicLinkFlow(auth, magicRedirect(false, 'https://nesmi.example', '/app/'), localStorage, () => 100_000, () => state);
    await flow.send('a@example.com');
    expect((await flow.receive(`https://evil.invalid/app/?nesmi_magic=1&state=${state}&code=${code}`)).error).not.toBeNull();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect((await flow.receive(`https://nesmi.example/app/?nesmi_magic=1&state=${state}&code=${code}`)).error).toBeNull();
  });
  it('rejects externally supplied redirect bases', () => {
    expect(() => magicRedirect(false, 'https://nesmi.example', 'https://evil.invalid')).toThrow();
    expect(() => magicRedirect(false, 'http://public.example', '/')).toThrow();
    expect(magicRedirect(true, 'capacitor://localhost', '/')).toBe(NATIVE_MAGIC_REDIRECT);
  });
});

describe('safe send failure classification', () => {
  it.each([
    [{ code: 'over_email_send_rate_limit', status: 429 }, '[EMAIL_LIMIT]'],
    [{ code: 'over_request_rate_limit', status: 429 }, '[REQUEST_LIMIT]'],
    [{ status: 429 }, '[REQUEST_LIMIT]'],
    [{ code: 'email_address_not_authorized', status: 403 }, '[EMAIL_DELIVERY]'],
    [{ code: 'otp_disabled', status: 422 }, '[EMAIL_DISABLED]'],
    [{ status: 503, name: 'AuthRetryableFetchError' }, '[SERVICE_UNAVAILABLE]'],
    [{ status: 0, name: 'AuthRetryableFetchError' }, '[CONNECTION]'],
    [{ code: 'unknown_private_code', status: 400 }, SEND_ERROR],
  ])('classifies returned failure without revealing details or retrying', async (details, expected) => {
    const { auth, flow } = setup();
    auth.signInWithOtp.mockResolvedValue({ error: { ...details, message: 'private-provider-payload' } } as never);
    const result = await flow.send('a@example.com');
    expect(result.error?.message).toContain(expected);
    expect(result.error?.message).not.toContain('private-provider-payload');
    expect(result.error?.message).not.toContain('unknown_private_code');
    expect(auth.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('classifies thrown SDK connection errors without automatic retry', async () => {
    const { auth, flow } = setup();
    auth.signInWithOtp.mockRejectedValue({ name: 'AuthRetryableFetchError', status: 0, message: 'private' });
    expect((await flow.send('a@example.com')).error?.message).toContain('[CONNECTION]');
    expect(auth.signInWithOtp).toHaveBeenCalledTimes(1);
  });
  it('does not send when the initial session check fails', async () => {
    const { auth, flow } = setup();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: { status: 503 } } as never);
    expect((await flow.send('a@example.com')).error?.message).toContain('[SERVICE_UNAVAILABLE]');
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
});
