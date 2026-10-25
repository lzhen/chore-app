'use strict';
// Nesmi account deletion UI regression, source-executed against this branch
// AccountSettings UI event handlers with a minimal deterministic JSX / hooks adapter.
// No React runtime, real browser, SDK, Supabase, account, network, or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const ts = (() => {
  try { return require('typescript'); } catch {
    const root = execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
    return require(resolve(root, 'typescript'));
  }
})();
const candidatePath = resolve(__dirname, '../../src/components/AccountSettings.tsx');

function makeDeferred() {
  let accept, reject;
  const promise = new Promise((yes,no) => {accept=yes;reject=no});
  return {promise,accept,reject};
}
function makeHarness(path, deleteAccount = async () => ({error:null}), options = {}) {
  const storage = options.storage || new Map();
  const storageAdapter = {
    getItem(key) {
      if (options.readBlocked) throw new Error('synthetic localStorage read failure');
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      if (options.writeBlocked) throw new Error('synthetic localStorage write failure');
      storage.set(key, String(value));
    },
  };
  // Execute the ACTUAL compiled utility, not a hand-copied guard function.
  const guardPath = resolve(__dirname, '../../src/utils/accountDeletionAttempt.ts');
  const guardSource = readFileSync(guardPath, 'utf8');
  const guardCompiled = ts.transpileModule(guardSource, {compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
  }}).outputText;
  const guardModule = { exports: {} };
  vm.runInNewContext(guardCompiled, {
    module: guardModule, exports: guardModule.exports,
    window: { localStorage: storageAdapter }, Error,
  }, {filename:'accountDeletionAttempt.compiled.cjs',timeout:1000});
  const attemptGuard = guardModule.exports;
  const data = {calls:0, signouts:0, closes:0, insights:0, deletionNotices:0, lastExpectedUserId:null};
  let states = [];
  let idx = 0;
  const jsx=(type,props,key)=>({type, props:props||{}, key});
  const mockReact={
    useState(initial){const n=idx++;if(!(n in states))states[n]=typeof initial==='function'?initial():initial;
      return [states[n], next=>{states[n]=typeof next==='function'?next(states[n]):next;}];},
    useRef(initial){const n=idx++;if(!(n in states))states[n]={current:initial};return states[n];}
  };
  const auth={
    user:{id:'synthetic-user-A',email:'synthetic@example.invalid'},
    signOut: ()=>{data.signouts++},
    deleteAccount:(id)=>{data.calls++;data.lastExpectedUserId=id;return deleteAccount(id);}
  };
  const mockRequire=id=>{
    if(id==='react')return mockReact;
    if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:Symbol('Fragment')};
    if(id==='../context/AuthContext')return {useAuth:()=>auth};
    if(id==='../utils/accountDeletionAttempt')return attemptGuard;
    if(id==='./ThemeSelector')return {ThemeSelector:function ThemeSelector(){}};
    if(id==='./AccountTools')return {AccountTools:function AccountTools(){}};
    throw Error('Unallowed module in isolated test: '+id);
  };
  const src=readFileSync(path,'utf8');
  // Only the build-time import.meta env reference is supplied as inert '/' in this offline adapter.
  // The auth/delete control flow itself is byte-exact, not rewritten or hand-copied.
  const compiled=ts.transpileModule(src.replaceAll('import.meta.env.BASE_URL', "'/'"),{compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
    jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,
  }});
  const module={exports:{}};
  vm.runInNewContext(compiled.outputText,{exports:module.exports,module,require:mockRequire,console,Error,Promise},
    {filename:'AccountSettings.compiled.cjs',timeout:1000});
  const Component=module.exports.AccountSettings;
  const props={isOpen:true,onClose:()=>{data.closes++},embedded:false,onInsights:()=>{data.insights++},onDeletionAttempt:()=>{data.deletionNotices++}};
  function render(){idx=0;return Component(props);}
  function nodes(root){const out=[];const visit=node=>{
    if(node==null || node===false || typeof node==='boolean')return;
    if(Array.isArray(node)){node.forEach(visit);return;}
    if(typeof node==='object' && 'type' in node){out.push(node);visit(node.props?.children);}
  };visit(root);return out;}
  function label(node){let out='';const visit=c=>{
    if(c==null || typeof c==='boolean')return;
    if(Array.isArray(c)){c.forEach(visit);return;}
    if(typeof c==='object'){visit(c.props?.children);return;}
    out+=String(c);
  };visit(node.props?.children);return out;}
  function button(name){return nodes(render()).find(n=>n.type==='button' && label(n).includes(name));}
  function alert(){return nodes(render()).find(n=>n.props?.role==='alert');}
  function childrenByName(name){return nodes(render()).filter(n=>n.type?.name===name);}
  return {data,auth,props,render,nodes,label,button,alert,childrenByName,storage};
}
function press(b){assert.ok(b,'Expected button');assert.equal(typeof b.props.onClick,'function');return b.props.onClick();}
function confirm(h){press(h.button('Delete my account'));assert.ok(h.button('Delete permanently'))}


test('auth switch during confirmation safely aborts before any deletion request', async () => {
  const h=makeHarness(candidatePath,async()=>({error:null, deletionConfirmed:true}));
  confirm(h); // identity A
  h.auth.user={id:'synthetic-user-B',email:'switched@example.invalid'};
  await press(h.button('Delete permanently'));
  assert.equal(h.data.calls,0);
  assert.equal(h.data.deletionNotices,0);
  assert.match(h.label(h.alert()),/no deletion request was sent/i);
  assert.doesNotMatch(h.label(h.alert()),/do not repeat account deletion/i);
  assert.ok(h.button('Delete my account'));
  confirm(h); // explicit new confirmation for identity B
  await press(h.button('Delete permanently'));
  assert.equal(h.data.calls,1);
  assert.equal(h.data.lastExpectedUserId,'synthetic-user-B');
});
test('no irreversible call before explicit two-step confirmation', () => {
  const h=makeHarness(candidatePath);
  assert.ok(h.button('Delete my account')); assert.equal(h.data.calls,0);
  confirm(h); assert.equal(h.data.calls,0);
  press(h.button('Cancel')); assert.equal(h.data.calls,0);
});
test('same-turn double click cannot start second delete', async () => {
  const d=makeDeferred(); const h=makeHarness(candidatePath,()=>d.promise); confirm(h);
  const b=h.button('Delete permanently');
  const p=press(b); await press(b);
  assert.equal(h.data.calls,1);
  assert.equal(h.button('Deleting…').props.disabled,true);
  d.accept({error:null, deletionConfirmed:true}); await p;
  assert.equal(h.button('Deletion attempted').props.disabled,true);
  assert.equal(h.data.calls,1);
});
test('signout, close and insights cannot navigate during unresolved delete', async () => {
  const d=makeDeferred(); const h=makeHarness(candidatePath,()=>d.promise); confirm(h);
  const p=press(h.button('Delete permanently'));
  press(h.button('Sign Out'));
  press(h.nodes(h.render()).find(n=>n.type==='button' && n.props?.['aria-label']==='Close account settings'));
  press(h.button('View activity'));
  assert.deepEqual([h.data.signouts,h.data.closes,h.data.insights],[0,0,0]);
  d.accept({error:null, deletionConfirmed:true}); await p;
});
test('rejected SDK promise cannot leave Deleting forever or invite a retry', async () => {
  const h=makeHarness(candidatePath,async()=>{throw new Error('simulated rejection')}); confirm(h);
  await press(h.button('Delete permanently'));
  assert.equal(h.data.calls,1);
  const alert=h.alert(); assert.ok(alert); assert.match(h.label(alert),/could not be confirmed/i);
  assert.equal(alert.props.role,'alert');
  assert.equal(h.button('Deletion attempted').props.disabled,true);
  press(h.button('Deletion attempted'));
  assert.equal(h.data.calls,1);
});
test('ambiguous error response is not displayed as safe-to-retry', async () => {
  const h=makeHarness(candidatePath,async()=>({error:new Error('transport unknown')})); confirm(h);
  await press(h.button('Delete permanently'));
  assert.match(h.label(h.alert()),/contact support before trying again/i);
  assert.equal(h.button('Deletion attempted').props.disabled,true);
  assert.equal(h.data.calls,1);
});
test('missing deletion ACK with a null SDK error stays uncertain and cannot be retried', async () => {
  const h=makeHarness(candidatePath,async()=>({error:null, deletionConfirmed:false}));
  confirm(h);
  await press(h.button('Delete permanently'));
  assert.equal(h.data.calls,1);
  assert.match(h.label(h.alert()),/deletion could not be confirmed/i);
  assert.match(h.label(h.alert()),/do not repeat account deletion from another tab or device/i);
  assert.equal(h.button('Deletion attempted').props.disabled,true);
});

test('truthy non-boolean deletion ACK never unlocks a false success', async () => {
  // A malformed future adapter response must not be accepted by truthiness.
  // Use synthetic values only; no live account or deletion call.
  for (const invalidAck of ['true', 1, { deleted: true }]) {
    const h=makeHarness(candidatePath,async()=>({error:null, deletionConfirmed:invalidAck}));
    confirm(h);
    await press(h.button('Delete permanently'));
    assert.equal(h.data.calls,1);
    assert.match(h.label(h.alert()),/deletion could not be confirmed/i);
    assert.match(h.label(h.alert()),/do not repeat account deletion/i);
    assert.equal(h.button('Deletion attempted').props.disabled,true);
  }
});

test('confirmed response has no spurious alert and disables repeat from same mounted UI', async () => {
  const h=makeHarness(candidatePath,async()=>({error:null, deletionConfirmed:true})); confirm(h);
  await press(h.button('Delete permanently'));
  assert.equal(h.alert(),undefined);
  assert.equal(h.button('Deletion attempted').props.disabled,true);
  assert.equal(h.data.calls,1);
});

test('nested appearance, calendar and notification buttons become inert during and after an attempted delete', async () => {
  const d=makeDeferred();
  const h=makeHarness(candidatePath,()=>d.promise);
  const scopedSettings=()=>h.nodes(h.render()).find(node=>node.type==='fieldset' &&
    h.nodes(node).some(child=>child.type?.name==='ThemeSelector') &&
    h.nodes(node).some(child=>child.type?.name==='AccountTools'));
  assert.ok(scopedSettings(), 'expected settings controls in fieldset');
  assert.equal(scopedSettings().props.disabled,false);
  confirm(h);
  assert.equal(scopedSettings().props.disabled,false);
  const p=press(h.button('Delete permanently'));
  assert.equal(scopedSettings().props.disabled,true);
  assert.equal(h.button('View activity').props.disabled,true);
  d.reject(new Error('uncertain network response'));
  await p;
  assert.equal(scopedSettings().props.disabled,true);
  assert.equal(h.button('View activity').props.disabled,true);
  assert.equal(h.data.calls,1);
});

 // An unacknowledged delete may already have succeeded server-side. The mounted UI
 // must explain the risk of remounting or opening a second browser/device.
 test('ambiguous result warns against retrying in other tabs or devices, but successful result does not', async () => {
   const uncertain=makeHarness(candidatePath,async()=>({error:new Error('unknown transport outcome')}));
   assert.equal(uncertain.alert(),undefined);
   confirm(uncertain);
   await press(uncertain.button('Delete permanently'));
   assert.ok(uncertain.alert(), 'warning should be accessible');
   assert.match(uncertain.label(uncertain.alert()), /do not repeat account deletion from another tab or device/i);
   assert.equal(uncertain.data.calls,1);
   const success=makeHarness(candidatePath,async()=>({error:null, deletionConfirmed:true}));
   confirm(success);
   await press(success.button('Delete permanently'));
   assert.equal(success.alert(),undefined);
 });


test('uncertain deletion disables close, signout and confirmation cancel after completion', async () => {
  const h=makeHarness(candidatePath,async()=>({error:new Error('unknown acknowledgement')}));
  confirm(h);
  await press(h.button('Delete permanently'));
  const close=h.nodes(h.render()).find(n=>n.type==='button' && n.props?.['aria-label']==='Close account settings');
  const signout=h.button('Sign Out');
  const cancel=h.button('Cancel');
  assert.deepEqual([close.props.disabled,signout.props.disabled,cancel.props.disabled],[true,true,true]);
  press(close); press(signout); press(cancel);
  assert.deepEqual([h.data.closes,h.data.signouts,h.data.calls],[0,0,1]);
  assert.ok(h.button('Deletion attempted').props.disabled);
  assert.ok(h.alert());
});

test('normal close and signout remain usable before an irreversible attempt', () => {
  const h=makeHarness(candidatePath);
  const close=h.nodes(h.render()).find(n=>n.type==='button' && n.props?.['aria-label']==='Close account settings');
  assert.equal(close.props.disabled,false);
  assert.equal(h.button('Sign Out').props.disabled,false);
  press(close); press(h.button('Sign Out'));
  assert.deepEqual([h.data.closes,h.data.signouts,h.data.calls],[1,1,0]);
});

// App can immediately hide/close a portal mounted outside Account. This source-
// executed check proves the child signal, not a React DOM portal integration.
test('deletion attempt notifies App exactly once before an async response', async () => {
  const d=makeDeferred(); const h=makeHarness(candidatePath,()=>d.promise);
  confirm(h);
  assert.equal(h.data.deletionNotices,0);
  const button=h.button('Delete permanently');
  const pending=press(button);
  assert.equal(h.data.deletionNotices,1);
  assert.equal(h.data.calls,1);
  await press(button); // stale same-turn button cannot signal again
  assert.equal(h.data.deletionNotices,1);
  d.reject(new Error('synthetic ambiguous acknowledgement'));
  await pending;
  assert.equal(h.data.deletionNotices,1);
  assert.ok(h.alert());
});

test('cancelled confirmation never signals App deletion lock', () => {
  const h=makeHarness(candidatePath);
  confirm(h);
  press(h.button('Cancel'));
  assert.equal(h.data.deletionNotices,0);
  assert.equal(h.data.calls,0);
});
test('inherited App lock disables a remounted AccountSettings before any new attempt', () => {
  const h=makeHarness(candidatePath, async () => ({error:null}));
  h.props.deletionLocked=true; // reconstructed component after leaving and returning to Account tab
  const tree=h.render();
  const scoped=h.nodes(tree).find(n=>n.type==='fieldset');
  assert.equal(scoped.props.disabled,true);
  assert.equal(h.button('Delete my account').props.disabled,true);
  assert.equal(h.button('Sign Out').props.disabled,true);
  assert.equal(h.button('View activity').props.disabled,true);
  const close=h.nodes(tree).find(n=>n.props?.['aria-label']==='Close account settings');
  assert.equal(close.props.disabled,true);
  assert.ok(h.alert(), 'remounted lock must have accessible explanation');
  assert.match(h.label(h.alert()),/may already have been attempted/i);
  assert.match(h.label(h.alert()),/another tab or device/i);
  press(h.button('Delete my account')); press(h.button('Sign Out')); press(h.button('View activity')); press(close);
  assert.deepEqual([h.data.calls,h.data.signouts,h.data.insights,h.data.closes,h.data.deletionNotices],[0,0,0,0,0]);
  assert.ok(h.nodes(tree).some(n=>n.type==='a' && String(n.props?.href).endsWith('privacy.html')), 'privacy remains accessible');
});

test('parent lock arriving during confirmation disables another delete', async () => {
  const h=makeHarness(candidatePath);
  confirm(h);
  h.props.deletionLocked=true;
  assert.equal(h.button('Deletion attempted').props.disabled,true);
  assert.equal(h.button('Cancel').props.disabled,true);
  assert.equal(h.button('Sign Out').props.disabled,true);
  await press(h.button('Deletion attempted'));
  assert.deepEqual([h.data.calls,h.data.deletionNotices],[0,0]);
});


// Source-executed, deterministic offline contract check. The handler is loaded
// from the exact repository Edge source with synthetic Deno/Supabase adapters:
// no live function invocation, real identity, credentials, network or deletion.
// This is PD-01 only; it cannot prove what App Store or production devices run.
test('repository Edge ACK contract only confirms authenticated successful deletes and matches the client guard', async () => {
  const edgeSource = readFileSync(resolve(__dirname, '../../supabase/functions/delete-account/index.ts'), 'utf8');
  const clientSource = readFileSync(resolve(__dirname, '../../src/context/AuthContext.tsx'), 'utf8');
  assert.match(clientSource, /functions\.invoke\(['"]delete-account['"],\s*\{\s*method:\s*['"]POST['"]/);
  assert.match(clientSource, /data\?\.deleted\s*!==\s*true/);
  assert.match(clientSource, /body:\s*\{\s*expectedUserId\s*\}/);

  const code = ts.transpileModule(edgeSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  let handler;
  let authOk = true;
  let authUserId = 'synthetic-user';
  let adminError = null;
  const deletedIds = [];
  const stubClient = (_url, key) => {
    if (key === 'synthetic-anon') return {
      auth: { getUser: async () => authOk
        ? { data: { user: { id: authUserId } }, error: null }
        : { data: { user: null }, error: new Error('synthetic unauthorized') } },
    };
    if (key === 'synthetic-service') return {
      auth: { admin: { deleteUser: async id => {
        deletedIds.push(id);
        return { error: adminError };
      } } },
    };
    throw Error('Unexpected synthetic key');
  };
  const mockRequire = name => {
    if (name === 'jsr:@supabase/functions-js/edge-runtime.d.ts') return {};
    if (name === 'npm:@supabase/supabase-js@2') return { createClient: stubClient };
    throw Error('Blocked external module: ' + name);
  };
  vm.runInNewContext(code, {
    exports: {}, require: mockRequire, console: { error: () => {} },
    Deno: {
      env: { get: name => ({
        SUPABASE_URL: 'https://synthetic.invalid',
        SUPABASE_ANON_KEY: 'synthetic-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
      })[name] },
      serve: fn => { handler = fn; },
    },
    Request, Response, JSON, Error, Promise,
  }, { timeout: 1000, filename: 'delete-account.edge.compiled.cjs' });
  assert.equal(typeof handler, 'function');
  const request = (method, authorized = false, payload = { expectedUserId: 'synthetic-user' }) => {
    const headers = authorized ? { Authorization: 'Bearer synthetic-only', 'Content-Type': 'application/json' } : {};
    return new Request('https://synthetic.invalid/functions/v1/delete-account', {
      method, headers,
      ...(method === 'POST' && payload !== false ? {
        body: typeof payload === 'string' ? payload : JSON.stringify(payload),
      } : {}),
    });
  };

  const options = await handler(request('OPTIONS'));
  assert.equal(options.status, 200);
  assert.equal(await options.text(), 'ok');
  const invalidMethod = await handler(request('GET'));
  assert.equal(invalidMethod.status, 405);
  assert.deepEqual(JSON.parse(await invalidMethod.text()), { error: 'Method not allowed' });
  const withoutAuth = await handler(request('POST'));
  assert.equal(withoutAuth.status, 401);
  assert.deepEqual(JSON.parse(await withoutAuth.text()), { error: 'Unauthorized' });
  assert.deepEqual(deletedIds, [], 'Unverified requests cannot delete a user');

  authOk = false;
  const rejectedUser = await handler(request('POST', true));
  assert.equal(rejectedUser.status, 401);
  assert.deepEqual(JSON.parse(await rejectedUser.text()), { error: 'Unauthorized' });
  assert.deepEqual(deletedIds, [], 'Invalid users cannot invoke the admin delete');

  authOk = true;
  const legacyNoBody = await handler(request('POST', true, false));
  assert.equal(legacyNoBody.status, 400, 'Legacy empty-body request must fail closed');
  const malformedBody = await handler(request('POST', true, '{bad-json'));
  assert.equal(malformedBody.status, 400);
  const missingIdentity = await handler(request('POST', true, {}));
  assert.equal(missingIdentity.status, 400);
  const numericIdentity = await handler(request('POST', true, { expectedUserId: 2 }));
  assert.equal(numericIdentity.status, 400);
  const mismatchedIdentity = await handler(request('POST', true, { expectedUserId: 'user-A' }));
  assert.equal(mismatchedIdentity.status, 409);
  authUserId = 'synthetic-user-B'; // Token swaps after UI captured intent A.
  const switchedBearer = await handler(request('POST', true));
  assert.equal(switchedBearer.status, 409);
  authUserId = 'synthetic-user';
  assert.deepEqual(deletedIds, [], 'No malformed or wrong-account attempt may delete');
  adminError = new Error('synthetic admin failure');
  const failedAdmin = await handler(request('POST', true));
  assert.equal(failedAdmin.status, 500);
  assert.deepEqual(JSON.parse(await failedAdmin.text()), { error: 'Account deletion failed' });

  adminError = null;
  const confirmed = await handler(request('POST', true));
  assert.equal(confirmed.status, 200);
  assert.deepEqual(JSON.parse(await confirmed.text()), { deleted: true });
  assert.deepEqual(deletedIds, ['synthetic-user', 'synthetic-user']);
});

test('ambiguous deletion retains a per-account attempt lock after full remount', async () => {
  const storage = new Map();
  const h = makeHarness(candidatePath, async () => ({error:new Error('synthetic lost ACK'),deletionConfirmed:false}), {storage});
  confirm(h);
  await press(h.button('Delete permanently'));
  assert.equal(h.data.calls, 1);
  assert.equal(storage.get('nesmi:account-deletion-attempt:synthetic-user-A'), 'true');
  const reloaded = makeHarness(candidatePath, async()=>({error:null,deletionConfirmed:true}), {storage});
  assert.equal(reloaded.button('Delete my account').props.disabled, true);
  press(reloaded.button('Delete my account'));
  assert.equal(reloaded.data.calls, 0);
  assert.match(reloaded.label(reloaded.alert()), /may already have been attempted/i);
});

test('storage write failure aborts before irreversible request', async () => {
  const h = makeHarness(candidatePath, async()=>({error:null,deletionConfirmed:true}), {writeBlocked:true});
  confirm(h);
  await press(h.button('Delete permanently'));
  assert.equal(h.data.calls, 0);
  assert.equal(h.data.deletionNotices, 1);
  assert.match(h.label(h.alert()), /cannot safely save the attempt/i);
  assert.equal(h.button('Delete my account').props.disabled, true);
});

test('a lock for account A does not block confirmed deletion for distinct B', async () => {
  const storage = new Map([['nesmi:account-deletion-attempt:synthetic-user-A','true']]);
  const h = makeHarness(candidatePath, async()=>({error:null,deletionConfirmed:true}), {storage});
  h.auth.user = {id:'synthetic-user-B',email:'other@example.invalid'};
  confirm(h);
  await press(h.button('Delete permanently'));
  assert.equal(h.data.calls, 1);
  assert.equal(h.data.lastExpectedUserId, 'synthetic-user-B');
  assert.equal(storage.get('nesmi:account-deletion-attempt:synthetic-user-A'), 'true');
  assert.equal(storage.get('nesmi:account-deletion-attempt:synthetic-user-B'), 'true');
});

test('KNOWN UNSAFE: two synthetic tabs both reserve under deterministic interleaving', () => {
  // Negative release-gate reproducer, NOT a real browser race or a safety PASS.
  // Both contexts execute the current repository TypeScript utility, not a copy.
  const source = readFileSync(resolve(__dirname, '../../src/utils/accountDeletionAttempt.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions:{
    target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS,
  }}).outputText;
  const loadGuard = localStorage => {
    const mod = {exports:{}};
    vm.runInNewContext(compiled, {
      module:mod, exports:mod.exports, window:{localStorage}, Error,
    }, {filename:'accountDeletionAttempt.cross-tab.compiled.cjs', timeout:1000});
    return mod.exports;
  };
  const shared = new Map();
  const storageB = {
    getItem:k=>shared.has(k)?shared.get(k):null,
    setItem:(k,v)=>{shared.set(k,String(v));},
  };
  const tabB = loadGuard(storageB);
  let bReserved = null;
  let interleaved = false;
  const storageA = {
    getItem:k=>shared.has(k)?shared.get(k):null,
    setItem:(k,v)=>{
      // Simulate another tab running after A read absence but before A writes.
      if (!interleaved) {
        interleaved = true;
        bReserved = tabB.reserveAccountDeletionAttempt('synthetic-race-account');
      }
      shared.set(k,String(v));
    },
  };
  const tabA = loadGuard(storageA);
  const aReserved = tabA.reserveAccountDeletionAttempt('synthetic-race-account');
  assert.equal(interleaved,true,'interleaving must actually execute');
  assert.equal(bReserved,true,'tab B would pass the pre-request guard');
  assert.equal(aReserved,true,'tab A can also pass after B has written');
  assert.equal(shared.get('nesmi:account-deletion-attempt:synthetic-race-account'),'true');
  assert.equal(tabB.reserveAccountDeletionAttempt('synthetic-race-account'),false,
    'sequential attempts are blocked, but this does not fix simultaneous tabs');
});
