'use client';

import { createBrowserClient } from '@supabase/ssr';

// Only NEXT_PUBLIC_-prefixed vars are ever inlined into the client
// bundle — SUPABASE_SERVICE_ROLE_KEY (checked by the server-side
// isSupabaseConfigured()) is never present here, deliberately, so this
// checks just the two the browser actually needs.
export function isBrowserSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Browser-side Supabase client — used only by the /admin/login form to
 * call supabase.auth.signInWithPassword(). Writes the same auth cookies
 * the server client and proxy.ts read, via the anon key. Never used to
 * read app data directly (see admin.ts) — the browser only ever proves
 * who's signed in, the server decides what that person can see. */
export function createClient() {
  if (!isBrowserSupabaseConfigured()) {
    throw new Error("Supabase isn't configured for this deployment yet.");
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
