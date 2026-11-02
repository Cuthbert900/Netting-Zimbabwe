import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin, type AppUser } from '@/lib/admin/dal';
import { UsersPageClient } from '@/components/admin/users-page-client';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const { identity } = await verifyAdmin();
  const admin = createAdminClient();
  const { data: users } = await admin
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <UsersPageClient
      users={(users as AppUser[]) ?? []}
      currentUserId={identity.userId}
    />
  );
}
