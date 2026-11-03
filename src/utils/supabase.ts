import { Capacitor } from '@capacitor/core';
import { isMagicReturn } from './magicLink';
import { createEmailLinkAuth, verifierOnlyStorage } from './emailLinkAuth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rosofbnimiothwxsabyr.supabase.co';
const supabaseAnonKey = 'sb_publishable_9qRf5tZIn0deozmhcqqmqw_4Z_3Dodi';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Our guarded handler owns magic-link callbacks; preserve the existing implicit flow elsewhere.
    detectSessionInUrl: !Capacitor.isNativePlatform() && !isMagicReturn(window.location.href),
  },
});

// Separate verifier/session namespace so requesting a magic link does not alter
// existing signup/password-recovery flows or overwrite their pending verifier.
const magicClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: false,
    autoRefreshToken: false,
    storageKey: 'nesmi-magic-pkce',
    storage: verifierOnlyStorage(localStorage),
  },
});
export const emailLinkAuth = createEmailLinkAuth(supabase.auth, magicClient.auth);
