// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same mechanism, see
// node_modules/next/dist/docs/.../proxy.md) — this is what refreshes the
// Supabase session cookie on every request and does the optimistic "no
// session at all" redirect. Originally this only covered /admin/:path*;
// the whole platform now requires sign-in (previously the rest of the
// app had no gate at all — Real auth for it was "Not started" per the
// README, this is that work), so the matcher below covers every route
// except static assets, and PUBLIC_PATHS is the small allowlist of pages
// that must stay reachable while signed out.
//
// This deliberately does NOT check the admin role — that's a database
// read, and the Next.js authentication guide is explicit that Proxy
// should only do cheap, cookie-only checks. The real role check
// (verifyAdmin() in src/lib/admin/dal.ts) runs again in every /admin
// page/action — this is just the fast path that keeps a logged-out
// visitor from ever rendering a gated page at all, admin or otherwise.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getServerSupabaseUrl } from '@/lib/supabase/config';

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// /sign-up is public but no longer does anything but point people at an
// admin — see src/app/(auth)/sign-up/page.tsx. It stays in this list so
// a signed-out visitor can actually see that message instead of being
// bounced to /sign-in first.
const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/admin/login'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p);

  if (!isSupabaseConfigured()) {
    // Nothing to refresh and nowhere safe to send them — the pages
    // themselves render a clear "not configured" state instead.
    return response;
  }

  const supabase = createServerClient(
    getServerSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPublicPath && !user) {
    const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = isAdminPath ? '/admin/login' : '/sign-in';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Excludes Next's own asset routes and common static file extensions
  // (logos, avatars, etc. under /public) — those need to load on the
  // sign-in page itself, before anyone has a session.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
