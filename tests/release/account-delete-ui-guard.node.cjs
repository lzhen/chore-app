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
function makeHarness(path, deleteAccount = async () => ({error:null})) {
  const data = {calls:0, signouts:0, closes:0, insights:0};
  let states = [];
  let idx = 0;
  const jsx=(type,props,key)=>({type, props:props||{}, key});
  const mockReact={
    useState(initial){const n=idx++;if(!(n in states))states[n]=typeof initial==='function'?initial():initial;
      return [states[n], next=>{states[n]=typeof next==='function'?next(states[n]):next;}];},
    useRef(initial){const n=idx++;if(!(n in states))states[n]={current:initial};return states[n];}
  };
  const auth={
    user:{email:'synthetic@example.invalid'},
    signOut: ()=>{data.signouts++},
    deleteAccount:()=>{data.calls++;return deleteAccount();}
  };
  const mockRequire=id=>{
    if(id==='react')return mockReact;
    if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:Symbol('Fragment')};
    if(id==='../context/AuthContext')return {useAuth:()=>auth};
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
  const props={isOpen:true,onClose:()=>{data.closes++},embedded:false,onInsights:()=>{data.insights++}};
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
  return {data,props,render,nodes,label,button,alert,childrenByName};
}
function press(b){assert.ok(b,'Expected button');assert.equal(typeof b.props.onClick,'function');return b.props.onClick();}
function confirm(h){press(h.button('Delete my account'));assert.ok(h.button('Delete permanently'))}


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
  d.accept({error:null}); await p;
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
  d.accept({error:null}); await p;
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
test('confirmed response has no spurious alert and disables repeat from same mounted UI', async () => {
  const h=makeHarness(candidatePath,async()=>({error:null})); confirm(h);
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
   const success=makeHarness(candidatePath,async()=>({error:null}));
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
