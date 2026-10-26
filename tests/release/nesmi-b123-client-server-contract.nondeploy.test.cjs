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
