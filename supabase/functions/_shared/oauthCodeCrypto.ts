/**
 * OAuth authorization code generation and hashing primitives.
 *
 * A trusted server must generate the raw code and return it only to the
 * authorization redirect. Store only its SHA-256 digest in the database.
 * This module is NOT an OAuth authorization server or token issuer.
 */
export function generateAuthorizationCode(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function validAuthorizationCode(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Za-z0-9_-]{43}$/.test(code)
}

export async function authorizationCodeHash(code: unknown): Promise<Uint8Array> {
  if (!validAuthorizationCode(code)) throw new Error('Invalid authorization code')
  const bytes = new TextEncoder().encode(code)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
}

export function hashToHex(hash: Uint8Array): string {
  if (hash.length !== 32) throw new Error('Expected SHA-256 digest')
  return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')
}
