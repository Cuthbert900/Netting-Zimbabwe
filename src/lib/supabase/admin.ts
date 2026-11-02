import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  getServerSupabaseUrl,
} from '@/lib/supabase/config';

/** Privileged Supabase client using the service_role key — bypasses RLS
 * entirely. This is the only thing that ever reads or writes
 * provider_keys / app_users / audit_log; those tables ship with RLS
 * enabled and no policies, so the anon/authenticated Postgres roles (the
 * only ones a browser can ever hold, even signed in) get nothing. Never
 * import this into anything that runs in the browser — it has no cookie
 * handling and doesn't need any, since it isn't tied to a particular
 * visitor's session. */
export function createAdminClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase isn't configured — set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY (see terraform/README.md)."
    );
  }

  return createSupabaseClient(
    getServerSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
