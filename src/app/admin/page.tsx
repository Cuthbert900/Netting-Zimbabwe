import { redirect } from 'next/navigation';
import { verifyAdmin } from '@/lib/admin/dal';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

// verifyAdmin() itself redirects to /admin/login (no session) or
// /admin/not-authorized (signed in, not an admin) — reaching the
// redirect below means they're a confirmed admin.
export default async function AdminIndexPage() {
  if (!isSupabaseConfigured()) {
    redirect('/admin/login');
  }
  await verifyAdmin();
  redirect('/admin/environment');
}
