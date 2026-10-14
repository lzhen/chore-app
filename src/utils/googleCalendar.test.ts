import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();document.querySelectorAll('script').forEach(s=>s.remove());});
it('does not claim an unconfigured Google connection is ready',async()=>{vi.stubEnv('VITE_GOOGLE_CLIENT_ID','');const api=await import('./googleCalendar');expect(api.isGoogleCalendarConfigured()).toBe(false);expect(await api.initGoogleApi()).toBe(false);expect(await api.signInToGoogle()).toBe(false);expect(document.querySelectorAll('script')).toHaveLength(0);});
it('resolves a blocked Google script as failure without hanging',async()=>{vi.stubEnv('VITE_GOOGLE_CLIENT_ID','synthetic-client');const api=await import('./googleCalendar');const result=api.initGoogleApi();document.querySelector('script')!.dispatchEvent(new Event('error'));expect(await result).toBe(false);});
it('reports account-independent OAuth failures and handles a closed popup',async()=>{
 vi.stubEnv('VITE_GOOGLE_CLIENT_ID','synthetic-client');
 const tokenClient={callback:(_response:unknown)=>{},requestAccessToken:vi.fn()};let popupError:(error:{type:string})=>void=()=>{};
 vi.stubGlobal('gapi',{load:(_name:string,ready:()=>void)=>ready(),client:{init:async()=>{},getToken:()=>null}});
 vi.stubGlobal('google',{accounts:{oauth2:{initTokenClient:(config:{error_callback:typeof popupError})=>{popupError=config.error_callback;return tokenClient}}}});
 const api=await import('./googleCalendar');const init=api.initGoogleApi();document.querySelectorAll('script').forEach(s=>s.dispatchEvent(new Event('load')));expect(await init).toBe(true);
 let result=api.signInToGoogle();expect(tokenClient.requestAccessToken).toHaveBeenCalledWith({prompt:'select_account'});tokenClient.callback({error:'origin_mismatch'});expect(await result).toBe(false);expect(api.getGoogleAuthorizationMessage()).toContain('Switching accounts will not fix');
 result=api.signInToGoogle();popupError({type:'popup_closed'});expect(await result).toBe(false);expect(api.getGoogleAuthorizationMessage()).toContain('was closed');
 tokenClient.requestAccessToken.mockImplementation(()=>{throw new Error('blocked')});expect(await api.signInToGoogle()).toBe(false);
 vi.unstubAllGlobals();
});
