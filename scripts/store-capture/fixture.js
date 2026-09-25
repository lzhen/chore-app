// SCREENSHOT HARNESS ONLY. Injected into a temporary Simulator build; never shipped.
(() => {
 const OriginalDate=Date,fixed=new OriginalDate(2026,8,25,9,41).getTime();
 window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
 const TODAY='2026-09-25',OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const A='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',B='cccccccc-cccc-4ccc-8ccc-cccccccccccc',C='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 const user={id:OWNER,email:'hello@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const token='eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:OWNER,exp:2000000000,role:'authenticated'})).replace(/=/g,'')+'.screenshot-only';
 localStorage.clear();localStorage.setItem('theme','light');localStorage.setItem('sb-rosofbnimiothwxsabyr-auth-token',JSON.stringify({access_token:token,refresh_token:'not-a-real-token',expires_at:2000000000,expires_in:999999,user,token_type:'bearer'}));
 const members=[{id:A,name:'Alex',color:'#075db8',points:60,badges:[],created_at:TODAY},{id:B,name:'Jamie',color:'#8759bb',points:60,badges:[],created_at:TODAY},{id:C,name:'Sam',color:'#38785a',points:50,badges:[],created_at:TODAY}];
 const chores=[],completions=[];
 function chore(id,title,date,member,start=null,end=null,done=false,recurrence='none'){
  const uuid='11111111-1111-4111-8111-'+String(id).padStart(12,'0');
  chores.push({id:uuid,owner_id:OWNER,title,date,due_time:start,end_time:end,assignee_id:member,recurrence,priority:'medium',description:null,category_id:null,estimated_minutes:20});
  if(done)completions.push({id:'22222222-2222-4222-8222-'+String(id).padStart(12,'0'),owner_id:OWNER,chore_id:uuid,instance_date:date,completed_by:member,completed_at:date+'T08:30:00Z',notes:null});
 }
 chore(1,'Water the plants',TODAY,B);
 chore(2,'Walk the dog',TODAY,A,'17:30:00','18:00:00');
 chore(3,'Take out the recycling',TODAY,C,null,null,true);
 chore(4,'Laundry & fresh linens','2026-09-26',B,'10:00:00','11:00:00');
 chore(5,'Vacuum shared spaces','2026-09-27',A);
 chore(6,'Plan meals for the week','2026-09-27',C,null,null,false,'weekly');
 for(let d=19;d<=24;d++){
  const date='2026-09-'+d,member=[A,B,C][d%3];
  chore(10+d*2,'Clean the kitchen',date,member,null,null,true);
  chore(11+d*2,'Feed our pet',date,[A,B,C][(d+1)%3],null,null,true);
 }
 const db={team_members:members,chores,categories:[],chore_completions:completions,member_availability:[]};
 const nativeFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{
  const raw=typeof input==='string'?input:input.url,u=new URL(raw,location.href);
  if(u.hostname.endsWith('.supabase.co')){
   if(u.pathname.includes('/auth/'))return new Response(JSON.stringify(user),{status:200,headers:{'Content-Type':'application/json'}});
   if(u.pathname.includes('/rest/v1/')){
    const method=(init.method||input.method||'GET').toUpperCase();if(method!=='GET'&&method!=='HEAD')throw new Error('Screenshots never write data');
    const table=u.pathname.split('/').pop(),id=u.searchParams.get('id')?.replace(/^eq\./,'');let data=id?(db[table]||[]).filter(r=>r.id===id):(db[table]||[]);
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
   }
   throw new Error('Unexpected backend endpoint in screenshot harness');
  }
  if(u.origin===location.origin)return nativeFetch(input,init);
  throw new Error('External requests blocked during screenshot capture');
 };
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 async function waitFor(fn,label){for(let i=0;i<150;i++){const value=fn();if(value)return value;await sleep(200);}throw new Error('Timed out: '+label);}
 const nav=async name=>{const b=await waitFor(()=>Array.from(document.querySelectorAll('nav[aria-label="Primary navigation"] button')).find(b=>b.textContent.trim()===name),name);b.click();await sleep(500);};
 const fill=(id,value)=>{const el=document.getElementById(id);if(!el)throw new Error('Missing input '+id);const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
 window.__chorelyCapture=async(scene)=>{
  await nav('Today');await waitFor(()=>document.querySelector('.chore-task'),'sample chores');
  if(scene==='chores'){
   await nav('Chores');const sel=Array.from(document.querySelectorAll('select')).find(e=>Array.from(e.options).some(o=>o.value==='pending'));if(sel){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(sel,'pending');sel.dispatchEvent(new Event('change',{bubbles:true}));}
  }else if(scene==='calendar')await nav('Calendar');
  else if(scene==='add'){
   const add=await waitFor(()=>document.querySelector('[aria-label="Add new chore"]'),'add chore');add.click();await waitFor(()=>document.getElementById('chore-title'),'chore editor');fill('chore-title','Prepare tomorrow’s lunches');fill('chore-member',C);fill('chore-date','2026-09-26');
  }else if(scene==='insights')await nav('Insights');
  else if(scene!=='today')throw new Error('Unknown scene');
  document.activeElement?.blur();await document.fonts.ready;await sleep(1200);
  return {scene,width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,title:document.title,text:document.body.innerText,sourceCommit:'4858c4c82c06b952340b1ce36f9b77541b1385f3',sampleData:true};
 };
})();
