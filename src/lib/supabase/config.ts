// Whether the self-hosted Supabase instance (see terraform/README.md) has
// actually been wired up. Every admin entry point checks this first and
// shows an honest "not set up yet" state instead of crashing or — worse —
// silently pretending to be gated when it can't actually check anyone's
// role. Same spirit as the AI providers' demo-mode fallback: don't fake
// it, say so.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** The URL server-side code (Server Components, Server Actions, Route
 * Handlers, proxy.ts) should connect to Supabase through — deliberately
 * NOT the NEXT_PUBLIC_-prefixed var, so it's never inlined into the client
 * bundle. NEXT_PUBLIC_SUPABASE_URL gets baked into both the server bundle
 * and the browser bundle at build time (Next.js doesn't distinguish
 * between them for that inlining), which normally doesn't matter because
 * both sides can reach Supabase at the same public URL — but local Docker
 * on Docker Desktop is a real exception: the app container and your
 * browser can't reliably resolve "localhost" to the same place there (see
 * docker/README.md). SUPABASE_URL lets docker-compose point the server at
 * Kong's in-network address (http://kong:8000) while the browser keeps
 * using the publicly-reachable one baked into NEXT_PUBLIC_SUPABASE_URL.
 * Falls back to NEXT_PUBLIC_SUPABASE_URL so any deployment that only sets
 * that one var (e.g. the Azure/Terraform stack, where this distinction
 * doesn't apply) keeps working unchanged. */
export function getServerSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}
