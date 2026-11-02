import { redirect } from 'next/navigation';
import { verifyAdmin } from '@/lib/admin/dal';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { AdminNav } from '@/components/admin/admin-nav';
import { AdminIdleTimeout } from '@/components/admin/admin-idle-timeout';

// These pages read the signed-in admin's session and live Supabase data
// on every request — never statically generated at build time, and
// nothing here should be cached across visitors.
export const dynamic = 'force-dynamic';

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    redirect('/admin/login');
  }

  // The real gate — proxy.ts only checked "is anyone signed in at all";
  // this checks the app_users role, redirecting to /admin/not-authorized
  // if it isn't 'admin'.
  const { identity } = await verifyAdmin();

  return (
    <div className="mx-auto max-w-5xl p-4">
      <AdminIdleTimeout />
      <AdminNav email={identity.email} />
      {children}
    </div>
  );
}
