// Only local flow state is stored here. Never persist or log callback URLs/codes.
export const NATIVE_MAGIC_REDIRECT = 'com.pawssible.chorely://auth/magic-link';
const PENDING_KEY = 'nesmi-magic-link-request';
const MAX_AGE = 15 * 60 * 1000;
const RETRY_DELAY = 60 * 1000;
export const LINK_ERROR = 'This sign-in link is invalid or expired. Request a new link and open it on the same device and app where you requested it.';
export const SEND_ERROR = 'Unable to send a sign-in link. Please try again later.';

// Only allowlisted classifications reach the UI. Never expose provider messages,
// response bodies, addresses, URLs, or arbitrary error codes.
export function magicSendError(error: unknown): Error {
  const details = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown; name?: unknown } : {};
  if (details.code === 'over_email_send_rate_limit') return new Error('The email service has temporarily limited sign-in emails. Please wait before requesting another link. [EMAIL_LIMIT]');
  if (details.code === 'over_request_rate_limit' || details.status === 429) return new Error('Too many sign-in requests. Please wait before requesting another link. [REQUEST_LIMIT]');
  if (details.code === 'email_address_not_authorized') return new Error('The current email service is not configured to send to this address. Contact support. [EMAIL_DELIVERY]');
  if (details.code === 'otp_disabled' || details.code === 'email_provider_disabled') return new Error('Email link sign-in is currently unavailable. Contact support. [EMAIL_DISABLED]');
  if (typeof details.status === 'number' && details.status >= 500 && details.status <= 599) return new Error('The sign-in service is temporarily unavailable. Please try again later. [SERVICE_UNAVAILABLE]');
  if (details.name === 'AuthRetryableFetchError' && details.status === 0) return new Error('Could not reach the sign-in service. Check your connection before trying again. [CONNECTION]');
  return new Error(SEND_ERROR);
}
export const SENT_MESSAGE = 'If this email belongs to an existing account, a sign-in link will arrive shortly. Open the email on the same device where you requested it, then tap the link to return to Nesmi. If you requested it on an iPad or iPhone, do not open it on your computer. The link works once.';

type Result = { error: Error | null };
type Auth = {
  getSession: () => Promise<{ data: { session: unknown }; error?: unknown }>;
  signInWithOtp: (options: { email: string; options: { shouldCreateUser: false; emailRedirectTo: string } }) => Promise<{ error: unknown }>;
  exchangeCodeForSession: (code: string) => Promise<{ data: { session: unknown }; error: unknown }>;
};
type Pending = { state: string; createdAt: number; consumed?: boolean; completed?: boolean };

export function isMagicReturn(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'com.pawssible.chorely:' || url.searchParams.has('nesmi_magic');
  } catch { return false; }
}

export function magicRedirect(native: boolean, origin: string, basePath: string): string {
  if (native) return NATIVE_MAGIC_REDIRECT;
  const base = new URL(basePath, `${origin}/`);
  if (base.origin !== origin || base.username || base.password ||
      !(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))) {
    throw new Error('Email link sign-in is unavailable at this address.');
  }
  base.search = '?nesmi_magic=1';
  base.hash = '';
  return base.href;
}

export function createMagicLinkFlow(auth: Auth, redirect: string, storage: Storage, now = Date.now, randomState: () => string = () => crypto.randomUUID()) {
  let sending = false;
  let exchanging = false;
  const read = (): Pending | null => {
    try {
      const value = JSON.parse(storage.getItem(PENDING_KEY) || 'null');
      return value && typeof value.state === 'string' && Number.isFinite(value.createdAt) ? value : null;
    } catch { return null; }
  };
  const hasSession = async () => {
    const { data, error } = await auth.getSession();
    if (error) throw error;
    return Boolean(data.session);
  };
  return {
    async send(email: string): Promise<Result> {
      if (sending || exchanging) return { error: new Error('A sign-in link request is already in progress.') };
      const previous = read();
      if (previous && now() - previous.createdAt < RETRY_DELAY) return { error: new Error('Please wait one minute before requesting another link.') };
      sending = true;
      try {
        if (await hasSession()) return { error: new Error('You are already signed in. Sign out before using another account.') };
        const normalized = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { error: new Error('Enter a valid email address.') };
        const pending: Pending = { state: randomState(), createdAt: now() };
        storage.setItem(PENDING_KEY, JSON.stringify(pending));
        const target = new URL(redirect);
        target.searchParams.set('state', pending.state);
        const { error } = await auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: false, emailRedirectTo: target.href } });
        if (error) return { error: magicSendError(error) };
        return { error: null };
      } catch (error) { return { error: magicSendError(error) }; }
      finally { sending = false; }
    },
    async receive(raw: string): Promise<{ handled: boolean; error: Error | null }> {
      if (!isMagicReturn(raw)) return { handled: false, error: null };
      let ownsExchange = false;
      try {
        const url = new URL(raw);
        const expected = new URL(redirect);
        const keys = [...url.searchParams.keys()];
        const allowed = new Set(['nesmi_magic', 'state', 'code', 'error', 'error_code', 'error_description']);
        if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname ||
            url.username || url.password || url.hash || keys.some(key => !allowed.has(key)) ||
            keys.length !== new Set(keys).size ||
            (expected.searchParams.has('nesmi_magic') && url.searchParams.get('nesmi_magic') !== '1')) throw new Error();
        const pending = read();
        if (!pending || url.searchParams.get('state') !== pending.state) throw new Error();
        // A cold launch can replay an old URL after a successful exchange. Ignore
        // that completed flow without authenticating again or reporting expiry.
        if (pending.completed) return { handled: true, error: null };
        if (now() < pending.createdAt || now() - pending.createdAt > MAX_AGE) throw new Error();
        if (pending.consumed || exchanging) return { handled: true, error: null };
        const code = url.searchParams.get('code');
        if (url.searchParams.has('error') || url.searchParams.has('error_code') || !code || !/^[A-Za-z0-9_-]{8,2048}$/.test(code)) throw new Error();
        exchanging = true;
        ownsExchange = true;
        // Retain only the state as a tombstone: repeated cold/warm delivery must not exchange again.
        storage.setItem(PENDING_KEY, JSON.stringify({ ...pending, consumed: true }));
        if (await hasSession()) return { handled: true, error: new Error('You are already signed in. This link did not change your account.') };
        const { data, error } = await auth.exchangeCodeForSession(code);
        if (error || !data.session) throw new Error();
        try {
          storage.setItem(PENDING_KEY, JSON.stringify({ ...pending, consumed: true, completed: true }));
        } catch { /* A bookkeeping failure must not report an established session as failed. */ }
        return { handled: true, error: null };
      } catch { return { handled: true, error: new Error(LINK_ERROR) }; }
      finally { if (ownsExchange) exchanging = false; }
    },
  };
}
