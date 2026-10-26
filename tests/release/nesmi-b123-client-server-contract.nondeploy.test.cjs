'use strict';
// Release-compatibility QA only. No Supabase calls, user data or account deletion.
// This test intentionally proves a remaining incompatibility rather than
// certifying a releasable client/server pair. NEVER use a green result to ship.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../..');
const B123_SHA = '6eab3d3b20a32d07376c1bd938979219a3565a74';
const releaseSource = execFileSync(
  'git', ['show', B123_SHA + ':src/context/AuthContext.tsx'],
  { cwd: repo, encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 }
);
const proposedClient = fs.readFileSync(path.join(repo, 'src/context/AuthContext.tsx'), 'utf8');
const proposedUI = fs.readFileSync(path.join(repo, 'src/components/AccountSettings.tsx'), 'utf8');
const proposedEdge = fs.readFileSync(
  path.join(repo, 'docs/release/prototypes/nesmi-delete-claimed-deno-handler.nondeploy.ts'),
  'utf8'
);
const deletionBlock = source => {
  const start = source.indexOf('const deleteAccount = async ');
  const end = source.indexOf('const resetPassword = async ', start);
  assert.ok(start >= 0 && end > start, 'Cannot isolate the actual deleteAccount implementation');
  return source.slice(start, end);
};
const invocationOptions = source => {
  const match = deletionBlock(source).match(
    /supabase\.functions\.invoke\('delete-account',\s*\{([\s\S]*?)\}\s*\)/
  );
  assert.ok(match, 'Missing deletion Edge invocation');
  return match[1];
};

test('immutable Nesmi B123 client sends bodyless POST (source evidence, not an Edge test)', () => {
  const options = invocationOptions(releaseSource);
  assert.match(options, /method:\s*'POST'/);
  assert.doesNotMatch(options, /\bbody\s*:/);
  assert.doesNotMatch(options, /expectedUserId/);
});

test('unmerged draft client binds exact confirmed ID and uses a scoped local cleanup', () => {
  const options = invocationOptions(proposedClient);
  assert.match(options, /method:\s*'POST'/);
  assert.match(options, /body:\s*\{\s*expectedUserId\s*\}/);
  assert.match(proposedUI, /confirmedAccountIdRef\.current/);
  assert.match(proposedUI, /deleteAccount\(confirmedAccountId\)/);
  assert.doesNotMatch(deletionBlock(proposedClient), /localStorage\.clear\s*\(/);
});

test('nondeployed Edge requires the ID; B123 is therefore NOT compatible with that candidate', () => {
  assert.match(proposedEdge, /INTERNAL REVIEW-ONLY Deno Edge candidate/);
  assert.match(proposedEdge, /await request\.json\(\)/);
  assert.match(proposedEdge, /payload\.expectedUserId/);
  assert.match(proposedEdge, /reply\(400, 'EXPECTED_ACCOUNT_REQUIRED'\)/);
  assert.doesNotMatch(invocationOptions(releaseSource), /\bbody\s*:/);
  // This assertion documents an outstanding HOLD, not permission to deploy.
});

test('current B123 transition worksheet retains strict bodyless-client release HOLD', () => {
  const gatePath = path.join(repo, 'docs/release/nesmi-b122-to-claimed-edge-transition-gate-20261025.md');
  const gate = fs.readFileSync(gatePath, 'utf8');
  assert.ok(gate.includes(B123_SHA), 'transition worksheet must cite the immutable B123 source SHA');
  const begin = gate.indexOf('### Current transition matrix (B123 is the installed-source anchor)');
  const end = gate.indexOf('### Decision-free next verification and hard stop rules', begin);
  assert.ok(begin !== -1 && end > begin, 'current B123 matrix must be present before historical B122 notes');
  const rows = gate.slice(begin, end).split('\n').filter(line => line.startsWith('|'));
  const findRow = fragment => rows.find(line => line.includes(fragment));
  const unknown = findRow('unknown live deployed Edge');
  const strict = findRow('existing PR #35 strict Edge');
  const candidate = findRow('nondeployed claimed Deno candidate');
  const legacy = findRow('Legacy B122');
  assert.ok(unknown && strict && candidate && legacy, 'matrix must retain live, strict, candidate, and legacy cases');
  assert.match(unknown, /\*\*STOP\*\*/);
  assert.match(strict, /400/);
  assert.match(strict, /\*\*HOLD/);
  assert.match(candidate, /400/);
  assert.match(candidate, /\*\*HOLD/);
  assert.match(legacy, /\*\*HOLD/);
  assert.match(gate.slice(begin, end), /HOLD \//, 'matrix must continue to reject unsafe transitions');
  // This safeguards release-document integrity, not production behavior or approval.
});
