'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { verifyAdmin, verifySession } from '@/lib/admin/dal';
import { logAuditEvent } from '@/lib/admin/audit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.some((p) => p.id === value);
}

// ---- Environment (provider keys) -----------------------------------------

export async function setProviderKey(
  providerId: string,
  keyValue: string
): Promise<ActionResult> {
  const { identity } = await verifyAdmin();
  if (!isProviderId(providerId))
    return { ok: false, error: 'Unknown provider' };
  if (!keyValue.trim()) return { ok: false, error: "Key can't be empty" };

  const admin = createAdminClient();
  const { error } = await admin
    .from('provider_keys')
    .upsert({
      provider_id: providerId,
      key_value: keyValue.trim(),
      updated_by: identity.email,
      updated_at: new Date().toISOString(),
    });

  if (error) return { ok: false, error: error.message };

  await logAuditEvent(identity, 'provider_key.set', providerId);
  revalidatePath('/admin/environment');
  return { ok: true };
}

export async function clearProviderKey(
  providerId: string
): Promise<ActionResult> {
  const { identity } = await verifyAdmin();
  if (!isProviderId(providerId))
    return { ok: false, error: 'Unknown provider' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('provider_keys')
    .delete()
    .eq('provider_id', providerId);
  if (error) return { ok: false, error: error.message };

  await logAuditEvent(identity, 'provider_key.cleared', providerId);
  revalidatePath('/admin/environment');
  return { ok: true };
}

// ---- Users ----------------------------------------------------------------

export async function createAppUser(
  email: string,
  password: string,
  displayName: string,
  role: 'admin' | 'user'
): Promise<ActionResult> {
  const { identity } = await verifyAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password || password.length < 8) {
    return {
      ok: false,
      error: 'Email and an 8+ character password are required',
    };
  }

  const admin = createAdminClient();
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // no SMTP configured yet — see terraform/README.md
    });
  if (createError || !created.user) {
    return {
      ok: false,
      error: createError?.message ?? 'Failed to create the account',
    };
  }

  const { error: profileError } = await admin.from('app_users').insert({
    id: created.user.id,
    email: normalizedEmail,
    display_name: displayName.trim() || null,
    role,
    created_by: identity.email,
  });
  if (profileError) {
    // Roll back the auth account so we don't leave an orphaned login with no role.
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: profileError.message };
  }

  await logAuditEvent(identity, 'user.created', normalizedEmail, { role });
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function updateUserRole(
  userId: string,
  role: 'admin' | 'user'
): Promise<ActionResult> {
  const { identity } = await verifyAdmin();
  if (userId === identity.userId && role !== 'admin') {
    return { ok: false, error: "You can't demote your own account" };
  }

  const admin = createAdminClient();
  const { data: target, error: fetchError } = await admin
    .from('app_users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  if (fetchError || !target) return { ok: false, error: 'User not found' };

  const { error } = await admin
    .from('app_users')
    .update({ role })
    .eq('id', userId);
  if (error) return { ok: false, error: error.message };

  await logAuditEvent(identity, 'user.role_changed', target.email, { role });
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function removeUser(userId: string): Promise<ActionResult> {
  const { identity } = await verifyAdmin();
  if (userId === identity.userId) {
    return { ok: false, error: "You can't remove your own account" };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('app_users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  // Deleting the auth.users row cascades to app_users via the foreign key.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  await logAuditEvent(identity, 'user.removed', target?.email ?? userId);
  revalidatePath('/admin/users');
  return { ok: true };
}

// ---- Session ----------------------------------------------------------------

export async function signOutAdmin(): Promise<never> {
  const user = await verifySession().catch(() => null);
  const supabase = await createClient();
  await supabase.auth.signOut();
  if (user?.email) {
    await logAuditEvent(
      { userId: user.id, email: user.email, displayName: null },
      'admin.signed_out'
    );
  }
  redirect('/admin/login');
}
