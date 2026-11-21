/**
 * OAuth 2.1 PKCE S256 primitives for the future Nesmi authorization server.
 * Pure helpers: do not issue tokens or expose Supabase Auth sessions.
 */
export function validPkceVerifier(verifier: unknown): verifier is string {
  return typeof verifier === 'string' &&
    verifier.length >= 43 && verifier.length <= 128 &&
    /^[A-Za-z0-9._~-]+$/.test(verifier)
}
export function validPkceChallenge(challenge: unknown): challenge is string {
  return typeof challenge === 'string' && /^[A-Za-z0-9_-]{43}$/.test(challenge)
}
export async function derivePkceChallenge(verifier: string): Promise<string> {
  if (!validPkceVerifier(verifier)) throw new Error('Invalid PKCE code verifier')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const bytes = new Uint8Array(digest)
  // Base64url encoding without padding, using a platform-independent encoder.
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export async function verifyPkceS256(verifier: unknown, expectedChallenge: unknown): Promise<boolean> {
  if (!validPkceVerifier(verifier) || !validPkceChallenge(expectedChallenge)) return false
  const actual = await derivePkceChallenge(verifier)
  const expected = expectedChallenge as string
  let mismatch = actual.length ^ expected.length
  for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
    mismatch |= (actual.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0)
  }
  return mismatch === 0
}
