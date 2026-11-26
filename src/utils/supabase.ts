import { createClient } from '@supabase/supabase-js';
import { parseEmailVerificationCallback } from './emailVerification';

const supabaseUrl = 'https://rosofbnimiothwxsabyr.supabase.co';
const supabaseAnonKey = 'sb_publishable_9qRf5tZIn0deozmhcqqmqw_4Z_3Dodi';

// Capture the fragment before the SDK can remove it during client startup.
let startupEmailVerification = parseEmailVerificationCallback(window.location.hash, window.location.search);

export function takeStartupEmailVerification() {
  const callback = startupEmailVerification;
  startupEmailVerification = null;
  return callback;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
