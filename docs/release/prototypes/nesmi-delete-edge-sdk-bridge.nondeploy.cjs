'use strict';
// REVIEW-ONLY / NON-DEPLOYED Supabase SDK-shaped bridge; release HOLD.
// Does not import Supabase, read credentials, call a network endpoint, or
// register Deno.serve. The caller injects createClient and synthetic values.
// This exercises the gap between the isolated claim RPC prototype and the
// separately tested orchestrator; it is NOT wired into the actual Edge handler.
// B122 sends bodyless POST, so this MUST NOT be deployed without a coordinated
// old-client compatibility decision, staging tests, and production approval.
const { coordinateNonDeployedDeletion } = require('./nesmi-delete-edge-orchestration.nondeploy.cjs');

function createNonDeployedSdkDeleteHandler({ createClient, url, anonKey, serviceRoleKey } = {}) {
  if (typeof createClient !== 'function' ||
      ![url, anonKey, serviceRoleKey].every(x => typeof x === 'string' && x.length)) {
    throw new TypeError('Injected test-only SDK factory and values are required');
  }

  return async function handle(request) {
    // Parse errors, including B122's missing body, fail closed before any SDK
    // client is created. The coordinator's 426 is illustrative, NOT live policy.
    let body;
    try { body = await request?.json?.(); } catch { body = undefined; }
    const authorization = request?.headers?.get?.('Authorization') ?? null;
    let admin;
    function adminClient() {
      if (!admin) {
        admin = createClient(url, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      }
      return admin;
    }

    return coordinateNonDeployedDeletion({ authorization, body }, {
      async authenticateBearer(header) {
        const client = createClient(url, anonKey, {
          global: { headers: { Authorization: header } },
          auth: { persistSession: false },
        });
        const response = await client.auth.getUser();
        if (response?.error || typeof response?.data?.user?.id !== 'string') {
          throw new Error('AUTH_UNVERIFIED');
        }
        return { id: response.data.user.id };
      },

      async acquireClaim(accountId) {
        const response = await adminClient().rpc('nesmi_delete_claim_draft_acquire', {
          p_account_id: accountId,
        });
        if (response?.error || !Array.isArray(response?.data)) {
          throw new Error('CLAIM_OUTCOME_UNCERTAIN');
        }
        // A PostgreSQL RETURNS TABLE(uuid) RPC is an array. Only exactly zero
        // rows proves a clean conflict; malformed shapes must NOT allow delete.
        if (response.data.length === 0) return null;
        if (response.data.length !== 1 ||
            typeof response.data[0]?.claim_id !== 'string' ||
            !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(response.data[0].claim_id)) {
          throw new Error('CLAIM_MALFORMED');
        }
        return { claim_id: response.data[0].claim_id };
      },

      async adminDeleteUser(accountId) {
        const response = await adminClient().auth.admin.deleteUser(accountId);
        // Supabase JS v2 may return data.user={} on successful deletion. It
        // cannot be checked by ID. Refuse error/null/missing-data responses.
        // See https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
        return response?.error === null &&
          response?.data?.user !== null &&
          typeof response?.data?.user === 'object';
      },

      async finalizeClaim(accountId, claimId, state) {
        const response = await adminClient().rpc('nesmi_delete_claim_draft_finalize', {
          p_account_id: accountId, p_claim_id: claimId, p_state: state,
        });
        if (response?.error) throw new Error('FINALIZE_OUTCOME_UNCERTAIN');
        return response?.data === true;
      },
    });
  };
}

module.exports = { createNonDeployedSdkDeleteHandler };
