'use strict';
/**
 * NON-DEPLOYED design contract only (Nesmi release HOLD).
 * No Supabase imports, network, real identifiers, migration, or production writes.
 * Illustrates the server-side orchestration needed AROUND the separately
 * PostgreSQL-tested atomic-claim SQL prototype; it is NOT an Edge handler.
 *
 * B122 installed clients send bodyless delete requests. This contract fails
 * closed on them, so it MUST NOT be wired to the active Edge endpoint without
 * an approved compatible client/Edge rollout and disposable-account E2E test.
 *
 * The injected acquireClaim adapter represents durable account-scoped RPC,
 * not a JS process-local lock. A rejected or ambiguous RPC MUST NOT trigger an
 * admin delete. A successful delete needs a durable finalize ACK before a
 * deleted:true response. No automatic retry/unlock/expiry is implemented.
 */
const blocked = (status, code) => ({ status, body: { deleted: false, code } });
const uncertain = () => blocked(503, 'OUTCOME_UNCERTAIN_DO_NOT_RETRY');

async function coordinateNonDeployedDeletion(request, adapter) {
  if (typeof request?.authorization !== 'string' ||
      !/^Bearer\s+\S+$/i.test(request.authorization)) {
    return blocked(401, 'AUTH_REQUIRED');
  }

  const body = request?.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body) ||
      typeof body.expectedUserId !== 'string' || !body.expectedUserId.trim()) {
    // Illustrative status only, not an approved policy for installed B122.
    return blocked(426, 'CLIENT_UPGRADE_REQUIRED');
  }

  let user;
  try {
    user = await adapter.authenticateBearer(request.authorization);
  } catch {
    return blocked(401, 'AUTH_UNVERIFIED');
  }
  if (typeof user?.id !== 'string' || !user.id) {
    return blocked(401, 'AUTH_UNVERIFIED');
  }
  if (user.id !== body.expectedUserId) {
    return blocked(409, 'SUBJECT_MISMATCH');
  }

  let acquired;
  try {
    acquired = await adapter.acquireClaim(user.id);
  } catch {
    // An RPC error may follow a committed acquire: no retry or delete.
    return blocked(503, 'CLAIM_OUTCOME_UNCERTAIN_DO_NOT_RETRY');
  }
  if (acquired === null) {
    return blocked(409, 'EXISTING_CLAIM_DO_NOT_RETRY');
  }
  // Strict payload check: a malformed successful RPC result is not permission
  // to perform an irreversible admin operation.
  if (typeof acquired?.claim_id !== 'string' || !acquired.claim_id.trim()) {
    return blocked(503, 'CLAIM_OUTCOME_UNCERTAIN_DO_NOT_RETRY');
  }

  const accountId = user.id;
  const claimId = acquired.claim_id;
  const finalizeUncertainBestEffort = async () => {
    try { await adapter.finalizeClaim(accountId, claimId, 'uncertain'); }
    catch { /* Leave durable pending claim locked; manual reconciliation. */ }
  };

  let deleteResult;
  try {
    deleteResult = await adapter.adminDeleteUser(accountId);
  } catch {
    await finalizeUncertainBestEffort();
    return uncertain();
  }
  if (deleteResult !== true) {
    await finalizeUncertainBestEffort();
    return uncertain();
  }

  let finalized = false;
  try {
    finalized = await adapter.finalizeClaim(accountId, claimId, 'confirmed');
  } catch {
    // The successful admin delete cannot be assumed durably recorded.
  }
  if (finalized !== true) {
    await finalizeUncertainBestEffort();
    return uncertain();
  }
  return { status: 200, body: { deleted: true } };
}

module.exports = { coordinateNonDeployedDeletion };
