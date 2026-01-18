import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rosofbnimiothwxsabyr.supabase.co';
const supabaseAnonKey = 'sb_publishable_9qRf5tZIn0deozmhcqqmqw_4Z_3Dodi';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
