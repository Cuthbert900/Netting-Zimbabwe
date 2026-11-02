import { createAdminClient } from '@/lib/supabase/admin';
import {
  AuditPageClient,
  type AuditRow,
} from '@/components/admin/audit-page-client';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('audit_log')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(200);

  return <AuditPageClient rows={(rows as AuditRow[]) ?? []} />;
}
