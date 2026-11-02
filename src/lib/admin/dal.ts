import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasPermission, ROLES, type UserRole } from '@/lib/roles';

export interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  created_at: string;
  created_by: string | null;
  last_active_at: string | null;
}

export interface AdminIdentity {
  userId: string;
  email: string;
  displayName: string | null;
}

/** Optimistic-but-real session check: verifies the GoTrue session cookie
 * against the auth server (auth.getUser(), not the cheaper-but-spoofable
 * getSession()) and redirects to /admin/login if it's missing or
 * invalid. Memoized per request with React's cache() — safe to call from
 * multiple places in one render without re-hitting the network each
 * time. */
export const verifySession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    redirect('/admin/login');
  }

  return user;
});

/** The real authorization check — every /admin page, Server Action, and
 * Route Handler calls this (not just the layout; see the Next.js
 * authentication guide on why a layout check alone isn't enough). Looks
 * up the matching app_users row via the service-role client, since
 * app_users has no RLS policy even a signed-in user can read their own
 * row through. No row, or role !== 'admin', sends them to
 * /admin/not-authorized rather than silently doing nothing. */
export const verifyAdmin = cache(
  async (): Promise<{ identity: AdminIdentity; appUser: AppUser }> => {
    const user = await verifySession();
    const admin = createAdminClient();

    const { data: appUser } = await admin
      .from('app_users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle<AppUser>();

    if (!appUser || !hasPermission(appUser.role, ROLES.ADMIN)) {
      redirect('/admin/not-authorized');
    }

    return {
      identity: {
        userId: user.id,
        email: user.email!,
        displayName: appUser.display_name,
      },
      appUser,
    };
  }
);
