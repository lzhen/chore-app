/**
 * OAuth authorization code lifecycle policy.
 * Pure, side-effect-free checks. A real authorization server must store only
 * a hash of a cryptographically random authorization code and consume it in
 * one atomic database transaction. This module alone does not issue tokens.
 */
export interface AuthorizationCodeRecord {
  clientId: string
  redirectUri: string
  ownerId: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
  issuedAtEpochSeconds: number
  expiresAtEpochSeconds: number
  consumedAtEpochSeconds: number | null
}
export interface AuthorizationCodeExchange {
  clientId: string
  redirectUri: string
  nowEpochSeconds: number
}
export type AuthorizationCodeDecision =
  | { allowed: true }
  | { allowed: false; reason: string }

export function authorizeCodeExchange(
  code: AuthorizationCodeRecord | null,
  request: AuthorizationCodeExchange,
): AuthorizationCodeDecision {
  if (!code) return { allowed: false, reason: 'invalid_code' }
  if (!request.clientId || code.clientId !== request.clientId) {
    return { allowed: false, reason: 'client_mismatch' }
  }
  if (!request.redirectUri || code.redirectUri !== request.redirectUri) {
    return { allowed: false, reason: 'redirect_uri_mismatch' }
  }
  if (code.codeChallengeMethod !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(code.codeChallenge)) {
    return { allowed: false, reason: 'invalid_pkce' }
  }
  if (code.consumedAtEpochSeconds !== null) {
    return { allowed: false, reason: 'already_consumed' }
  }
  if (!Number.isFinite(request.nowEpochSeconds) ||
      !Number.isFinite(code.issuedAtEpochSeconds) ||
      !Number.isFinite(code.expiresAtEpochSeconds) ||
      code.expiresAtEpochSeconds <= code.issuedAtEpochSeconds ||
      request.nowEpochSeconds < code.issuedAtEpochSeconds ||
      request.nowEpochSeconds >= code.expiresAtEpochSeconds) {
    return { allowed: false, reason: 'expired_or_invalid' }
  }
  return { allowed: true }
}
