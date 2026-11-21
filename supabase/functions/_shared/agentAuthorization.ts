/**
 * Nesmi agent authorization policy — pure functions, no tokens or persistence.
 * A future OAuth resource server MUST authenticate the caller and load a
 * revocable grant from trusted server-side storage before calling this module.
 */
export type AgentScope = 'tasks:read' | 'tasks:write'
export type AgentOperation = 'list_chores' | 'list_members' | 'create_chore' | 'complete_chore'

export interface VerifiedAgentGrant {
  ownerId: string
  clientId: string
  audience: string
  scopes: readonly AgentScope[]
  expiresAtEpochSeconds: number
  revokedAtEpochSeconds: number | null
}

export interface AgentAuthorizationRequest {
  ownerId: string
  clientId: string
  audience: string
  operation: AgentOperation
  nowEpochSeconds: number
}

const requiredScope: Readonly<Record<AgentOperation, AgentScope>> = {
  list_chores: 'tasks:read',
  list_members: 'tasks:read',
  create_chore: 'tasks:write',
  complete_chore: 'tasks:write',
}

export function authorizeAgentOperation(
  grant: VerifiedAgentGrant | null,
  request: AgentAuthorizationRequest,
): { allowed: true } | { allowed: false; reason: string } {
  if (!grant) return { allowed: false, reason: 'missing_grant' }
  if (!request.ownerId || grant.ownerId !== request.ownerId) {
    return { allowed: false, reason: 'owner_mismatch' }
  }
  if (!request.clientId || grant.clientId !== request.clientId) {
    return { allowed: false, reason: 'client_mismatch' }
  }
  if (!request.audience || grant.audience !== request.audience) {
    return { allowed: false, reason: 'audience_mismatch' }
  }
  if (!Number.isFinite(request.nowEpochSeconds) ||
      !Number.isFinite(grant.expiresAtEpochSeconds) ||
      request.nowEpochSeconds >= grant.expiresAtEpochSeconds) {
    return { allowed: false, reason: 'expired' }
  }
  if (grant.revokedAtEpochSeconds !== null) {
    return { allowed: false, reason: 'revoked' }
  }
  if (!Object.prototype.hasOwnProperty.call(requiredScope, request.operation)) {
    return { allowed: false, reason: 'unknown_operation' }
  }
  if (!grant.scopes.includes(requiredScope[request.operation])) {
    return { allowed: false, reason: 'insufficient_scope' }
  }
  return { allowed: true }
}
