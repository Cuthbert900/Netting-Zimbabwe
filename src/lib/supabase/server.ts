import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  isSupabaseConfigured,
  getServerSupabaseUrl,
} from '@/lib/supabase/config';

/** Session-aware Supabase client for Server Components, Server Actions,
 * and Route Handlers — reads/writes the auth cookies proxy.ts refreshes,
 * uses the anon key, and respects RLS. This is how the app knows *who's*
 * signed in; it is not how the app reads admin data (see admin.ts). */
export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase isn't configured — set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY (see terraform/README.md)."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    getServerSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component that can't set cookies (no
            // response to attach them to) — proxy.ts is what actually
            // refreshes the session cookie on every request, so this is
            // safe to swallow here.
          }
        },
      },
    }
  );
}
