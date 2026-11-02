import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { AdminIdentity } from '@/lib/admin/dal';
import logger from '@/lib/logger';

/** Appends one row to audit_log. Every mutating Server Action in
 * src/lib/admin/actions.ts calls this on the way through — see the
 * migration file's header comment for what this log does and doesn't
 * cover (admin actions only, not ordinary anonymous app usage). */
export async function logAuditEvent(
  actor: AdminIdentity,
  action: string,
  target?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('audit_log').insert({
    actor_id: actor.userId,
    actor_email: actor.email,
    actor_name: actor.displayName,
    action,
    target: target ?? null,
    details: details ?? null,
  });
  if (error) {
    // Never let a logging failure block the action it's logging — but
    // surface it loudly, since a silent gap here defeats the point of
    // having an audit log at all.
    logger.error({ error, action }, 'Failed to log audit event');
  }
}
