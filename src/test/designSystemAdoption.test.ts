import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
const read=(p:string)=>readFileSync(p,'utf8');
it('loads scoped adoption after the approved product styles and semantic tokens',()=>{
 const main=read('src/main.tsx');expect(main.indexOf("'./styles/nesmi-product-adoption.css'")).toBeGreaterThan(main.indexOf("'./styles/nesmi-tokens.css'"));
 const css=read('src/styles/nesmi-product-adoption.css');for(const role of ['body','support','label','section'])expect(css).toContain(`var(--nesmi-type-${role})`);
 expect(css).not.toContain('.text-sm');expect(css).not.toContain('.text-xs');
 for(const role of ['.nesmi-completion-content','.nesmi-availability','.nesmi-auth-state','.nesmi-shortcuts-help','.chore-task-title','.nesmi-calendar-event.is-agenda'])expect(css).toContain(role);
});
it('keeps production entry free of preview bootstrap and reference routing strictly gated',()=>{
 const index=read('index.html');expect(index).not.toMatch(/mock-data|__NESMI_PREVIEW__|preview\/index/);
 const main=read('src/main.tsx');expect(main).toContain('__NESMI_PREVIEW__');expect(read('src/reference/previewReference.ts')).toContain("previewEnabled === true");
 expect(read('src/utils/supabase.ts')).not.toMatch(/example\.test|mock|fixture/);
 expect(read('src/reference/previewReference.ts')).toContain("previewEnabled === true");
});
it('retains visible status language and gives authentication feedback shared error/success styles',()=>{
 const auth=read('src/components/AuthForm.tsx');
 expect(auth).toContain('chore-error nesmi-auth-message');expect(auth).toContain('nesmi-auth-message is-success');
 expect(auth).toContain('role="alert"');expect(auth).toContain('role="status"');
 const css=read('src/styles/nesmi-product-adoption.css');expect(css).toContain('.nesmi-auth-text-action { min-height: 44px');
 expect(css).toContain('.dark .nesmi-auth-message.is-success');expect(css).toContain('.chore-task-body > .chore-task-title');
});
it('keeps adopted secondary text readable on the raised light surface',()=>{
 const luminance=(hex:string)=>hex.match(/[0-9a-f]{2}/gi)!.map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
 const ratio=(a:string,b:string)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
 expect(read('src/nesmi-refinement.css')).toContain('--text-secondary: #6e6e6e');
 expect(ratio('6e6e6e','f3f3f3')).toBeGreaterThanOrEqual(4.5);
 expect(ratio('245b3d','edf7f0')).toBeGreaterThanOrEqual(4.5);
 expect(ratio('b8ddc5','18291f')).toBeGreaterThanOrEqual(4.5);
});
