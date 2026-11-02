'use server';

// Server Actions behind the Netting Account Reconciliation card on /reports:
// reading last month's closing balance (so it carries over as this month's
// opening balance) and saving a finalised month. Any signed-in user can do
// both — this is the reconciliation team's own workflow, not an admin task —
// and every save is written to audit_log.

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { logAuditEvent } from '@/lib/admin/audit';
import { NETTING_ACCOUNT } from '@/lib/balance-reconciliation';

export interface SavedBalanceReconciliation {
  period: string;
  currency: string;
  openingBalance: number;
  reconcilingItems: { id: string; label: string; value: number }[];
  subtotal: number;
  glBalance: number;
  difference: number;
  comments: string | null;
  finalisedAt: string;
  finalisedByEmail: string | null;
}

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

const PERIOD_KEY = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const CURRENCY = /^[A-Z]{3}$/;
const NOT_CONFIGURED =
  "Saving needs the Supabase backend, which isn't configured on this deployment.";

interface Row {
  period: string;
  currency: string;
  opening_balance: number | string;
  reconciling_items: { id: string; label: string; value: number }[];
  subtotal: number | string;
  gl_balance: number | string;
  difference: number | string;
  comments: string | null;
  finalised_at: string;
  finalised_by_email: string | null;
}

function fromRow(row: Row): SavedBalanceReconciliation {
  return {
    period: row.period,
    currency: row.currency,
    openingBalance: Number(row.opening_balance),
    reconcilingItems: row.reconciling_items,
    subtotal: Number(row.subtotal),
    glBalance: Number(row.gl_balance),
    difference: Number(row.difference),
    comments: row.comments,
    finalisedAt: row.finalised_at,
    finalisedByEmail: row.finalised_by_email,
  };
}

async function signedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && user.email ? user : null;
}

/** The finalised reconciliations for `periodKey` and the month before it, in
 * one currency — the month before supplies the carried-over opening
 * balance. */
export async function getBalanceReconciliations(
  periodKey: string,
  currency: string
): Promise<
  ActionResult<{
    current: SavedBalanceReconciliation | null;
    previous: SavedBalanceReconciliation | null;
  }>
> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };
  if (!PERIOD_KEY.test(periodKey)) return { ok: false, error: 'Bad period' };
  if (!CURRENCY.test(currency)) return { ok: false, error: 'Bad currency' };
  if (!(await signedInUser())) return { ok: false, error: 'Not signed in' };

  const [y, m] = periodKey.split('-').map(Number);
  const prevKey =
    m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('balance_reconciliations')
    .select('*')
    .eq('account_number', NETTING_ACCOUNT.number)
    .eq('currency', currency)
    .in('period', [periodKey, prevKey]);
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as Row[];
  const find = (key: string) => {
    const row = rows.find((r) => r.period === key);
    return row ? fromRow(row) : null;
  };
  return {
    ok: true,
    data: { current: find(periodKey), previous: find(prevKey) },
  };
}

export interface SaveBalanceReconciliationInput {
  periodKey: string;
  currency: string;
  openingBalance: number;
  reconcilingItems: { id: string; label: string; value: number }[];
  glBalance: number;
  comments: string;
}

/** Finalises a month. Subtotal and difference are recomputed here rather than
 * trusted from the browser. Saving the same month again replaces it; the
 * audit log keeps both saves. */
export async function saveBalanceReconciliation(
  input: SaveBalanceReconciliationInput
): Promise<ActionResult<SavedBalanceReconciliation>> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const user = await signedInUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const money = [
    input.openingBalance,
    input.glBalance,
    ...input.reconcilingItems.map((i) => i.value),
  ];
  if (!PERIOD_KEY.test(input.periodKey))
    return { ok: false, error: 'Bad period' };
  if (!CURRENCY.test(input.currency))
    return { ok: false, error: 'Bad currency' };
  if (!money.every((n) => typeof n === 'number' && Number.isFinite(n)))
    return { ok: false, error: 'Every figure must be a number' };
  if (input.comments.length > 1200)
    return { ok: false, error: 'Comments are too long' };

  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const reconcilingTotal = round(
    input.reconcilingItems.reduce((s, i) => s + i.value, 0)
  );
  const subtotal = round(input.openingBalance + reconcilingTotal);
  const difference = round(subtotal - input.glBalance);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('balance_reconciliations')
    .upsert(
      {
        account_number: NETTING_ACCOUNT.number,
        period: input.periodKey,
        currency: input.currency,
        opening_balance: round(input.openingBalance),
        reconciling_items: input.reconcilingItems.map((i) => ({
          id: i.id,
          label: i.label,
          value: round(i.value),
        })),
        subtotal,
        gl_balance: round(input.glBalance),
        difference,
        comments: input.comments.trim() || null,
        finalised_at: new Date().toISOString(),
        finalised_by_id: user.id,
        finalised_by_email: user.email,
      },
      { onConflict: 'account_number,period,currency' }
    )
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };

  await logAuditEvent(
    { userId: user.id, email: user.email!, displayName: null },
    'balance_reconciliation.finalised',
    `${NETTING_ACCOUNT.number} ${input.periodKey} ${input.currency}`,
    { subtotal, glBalance: round(input.glBalance), difference }
  );

  return { ok: true, data: fromRow(data as Row) };
}
