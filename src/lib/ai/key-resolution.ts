import 'server-only';

// Resolves a provider's API key: an /admin/environment-managed key in
// Supabase first, then the provider's own env var, matching the order
// EnvironmentPageClient shows in the UI ("Configured" vs "Using env
// var"). Kept out of providers.ts on purpose — that file's PROVIDERS
// metadata (ProviderId, TokenUsage, etc.) is imported by several client
// components for display purposes, and importing Supabase's
// service-role client there would pull server-only code into the
// browser bundle.

import { getProviderMeta, type ProviderId } from '@/lib/ai/providers';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSecret } from '@/lib/key-vault';
import logger from '@/lib/logger';

export async function resolveProviderApiKey(
  id: ProviderId
): Promise<string | undefined> {
  const meta = getProviderMeta(id);

  // 1. Azure Key Vault (production-only)
  if (process.env.NODE_ENV === 'production') {
    const secretName = meta.envKey;
    const secret = await getSecret(secretName);
    if (secret) {
      logger.info({ provider: id }, 'Resolved API key from Azure Key Vault');
      return secret;
    }
  }

  // 2. Supabase
  if (isSupabaseConfigured()) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from('provider_keys')
        .select('key_value')
        .eq('provider_id', id)
        .maybeSingle();
      if (data?.key_value) {
        logger.info({ provider: id }, 'Resolved API key from Supabase');
        return data.key_value;
      }
    } catch (err) {
      // A misconfigured or unreachable Supabase instance shouldn't take
      // the AI Assistant down with it — fall through to the env var.
      logger.error({ provider: id, error: err }, 'Supabase lookup failed');
    }
  }

  // 3. Environment variable
  const fromEnv = process.env[meta.envKey];
  if (fromEnv) {
    logger.info({ provider: id }, 'Resolved API key from environment variable');
  }
  return fromEnv;
}
