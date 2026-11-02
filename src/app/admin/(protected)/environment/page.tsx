import { createAdminClient } from '@/lib/supabase/admin';
import { PROVIDERS } from '@/lib/ai/providers';
import {
  EnvironmentPageClient,
  type ProviderKeyStatus,
} from '@/components/admin/environment-page-client';

export const dynamic = 'force-dynamic';

export default async function AdminEnvironmentPage() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('provider_keys')
    .select('provider_id, key_value, updated_at, updated_by');

  const byId = new Map((rows ?? []).map((r) => [r.provider_id, r]));

  const statuses: ProviderKeyStatus[] = PROVIDERS.map((p) => {
    const row = byId.get(p.id);
    const envConfigured = Boolean(process.env[p.envKey]);
    return {
      providerId: p.id,
      label: p.label,
      configuredInDb: Boolean(row),
      maskedKey: row ? maskKey(row.key_value) : null,
      updatedAt: row?.updated_at ?? null,
      updatedBy: row?.updated_by ?? null,
      envFallbackConfigured: envConfigured && !row,
      envKey: p.envKey,
    };
  });

  return <EnvironmentPageClient statuses={statuses} />;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}${'•'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}
