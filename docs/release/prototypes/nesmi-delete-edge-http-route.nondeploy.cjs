'use strict';
// INTERNAL, NON-DEPLOYED candidate for the real Deno Edge request/response boundary.
// Mirrors the actual draft delete-account method/CORS contract without importing
// a live Edge runtime, reading secrets, registering Deno.serve, or doing I/O.
// The injected SDK factory is synthetic in tests. RELEASE HOLD: B122 bodyless
// clients cannot use the strict expectedUserId contract; 426 remains a PROPOSAL.
const { createNonDeployedSdkDeleteHandler } = require('./nesmi-delete-edge-sdk-bridge.nondeploy.cjs');

const corsHeaders = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
});

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function createNonDeployedEdgeHttpRoute(injectedSdk) {
  const coordinate = createNonDeployedSdkDeleteHandler(injectedSdk);
  return async function route(request) {
    if (request?.method === 'OPTIONS') {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }
    if (request?.method !== 'POST') {
      return json(405, { deleted: false, code: 'METHOD_NOT_ALLOWED' });
    }
    try {
      const result = await coordinate(request);
      const status = result?.status;
      const body = result?.body;
      // Never manufacture a success response from a malformed future adapter.
      if (!Number.isInteger(status) || status < 200 || status > 599 ||
          body === null || typeof body !== 'object' || Array.isArray(body) ||
          (status === 200 && body.deleted !== true) ||
          (status !== 200 && body.deleted === true)) {
        return json(503, { deleted: false, code: 'OUTCOME_UNCERTAIN_DO_NOT_RETRY' });
      }
      return json(status, body);
    } catch {
      // A thrown result is ambiguous. Never retry an irreversible admin call.
      return json(503, { deleted: false, code: 'OUTCOME_UNCERTAIN_DO_NOT_RETRY' });
    }
  };
}

module.exports = { createNonDeployedEdgeHttpRoute };
