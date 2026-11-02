'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2Icon,
  FileDownIcon,
  Loader2Icon,
  SaveIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDataSources, SOURCE_LABELS } from '@/lib/data-sources-context';
import { useDuplicateOverrides } from '@/lib/duplicate-overrides-context';
import { useAiUsage } from '@/lib/ai-usage-context';
import { prepareRecords } from '@/lib/reconciliation-engine';
import type { TokenUsage } from '@/lib/ai/providers';
import {
  DEFAULT_REPORT_CURRENCY,
  NETTING_ACCOUNT,
  computeBalanceFigures,
  computeReconcilingItems,
  detectReportingPeriod,
  formatAccounting,
  formatPeriodClosing,
  formatPeriodOpening,
  formatPeriodShort,
  periodKey,
  previousPeriod,
  type BalanceFigures,
  type ReconcilingItemsResult,
} from '@/lib/balance-reconciliation';
import {
  exportFrontPageToExcel,
  exportFrontPageToPdf,
  SIGN_OFF_DESIGNATIONS,
  type FrontPageData,
} from '@/lib/balance-reconciliation-export';
import {
  getBalanceReconciliations,
  saveBalanceReconciliation,
  type SavedBalanceReconciliation,
} from '@/lib/balance-reconciliation-actions';
import { cn } from '@/lib/utils';

const COMMENTS_PROVIDER = 'gemini';
/** About what still fits the printed Comments box at its smallest size. */
const COMMENTS_MAX = 1200;

/** Accepts "9,443,163.62", "-5809523.5" or "(5,809,523.50)". */
function parseMoney(text: string): number | null {
  const t = text.trim().replace(/[,\s]/g, '');
  if (!t) return null;
  const negative = /^\(.*\)$/.test(t);
  const n = Number(negative ? t.slice(1, -1) : t);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function toInput(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function commentsPrompt(
  shortPeriod: string,
  currency: string,
  items: ReconcilingItemsResult['items'],
  figures: BalanceFigures
): { context: string; message: string } {
  const context = [
    `Netting Account (${NETTING_ACCOUNT.number}) balance reconciliation for ${shortPeriod}, in ${currency}.`,
    `Opening balance: ${formatAccounting(figures.openingBalance)}`,
    ...items.map(
      (i) =>
        `${i.label}: ${formatAccounting(i.value)} — ${i.leftUnmatchedCount} unmatched ${SOURCE_LABELS[i.left]} item(s) totalling ${formatAccounting(i.leftUnmatchedValue)}, ${i.rightUnmatchedCount} unmatched ${SOURCE_LABELS[i.right]} item(s) totalling ${formatAccounting(i.rightUnmatchedValue)}`
    ),
    `Total reconciling items: ${formatAccounting(figures.reconcilingTotal)}`,
    `Subtotal: ${formatAccounting(figures.subtotal)}`,
    `Balance as per General Ledger (TB): ${formatAccounting(figures.glBalance)}`,
    `Difference: ${formatAccounting(figures.difference)}`,
    'Amounts in brackets are negative; "-" means nil.',
  ].join('\n');
  const message =
    `Write the Comments box for this month's Netting Account reconciliation. ` +
    'Plain text only: no markdown, headings or bullet points, two to four sentences, under 600 characters. ' +
    'Explain what drives each non-nil reconciling item and say whether the difference is nil; ' +
    'if it is not, say it needs investigation. Use only the figures given above — do not ' +
    'introduce, estimate or recalculate any other number.';
  return { context, message };
}

export function BalanceReconciliationCard() {
  const { filesBySource } = useDataSources();
  const { dismissed } = useDuplicateOverrides();
  const { logUsage } = useAiUsage();

  const bySource = useMemo(
    () => prepareRecords(filesBySource, dismissed).bySource,
    [filesBySource, dismissed]
  );
  const period = useMemo(
    () =>
      detectReportingPeriod([
        ...bySource.dynamics,
        ...bySource.prism,
        ...bySource.bank,
      ]),
    [bySource]
  );
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null);
  const items = useMemo(
    () =>
      period ? computeReconcilingItems(bySource, period, chosenCurrency) : null,
    [bySource, period, chosenCurrency]
  );

  const [openingText, setOpeningText] = useState('');
  const [glText, setGlText] = useState('');
  const [comments, setComments] = useState('');
  const [saved, setSaved] = useState<SavedBalanceReconciliation | null>(null);
  const [carriedFrom, setCarriedFrom] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);

  const key = period ? periodKey(period) : null;
  const currency = items?.currency ?? DEFAULT_REPORT_CURRENCY;

  // Load this month's saved reconciliation in this currency, or carry last
  // month's closing balance over as this month's opening balance. Changing
  // the month or the currency starts from a clean slate.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setSaved(null);
    setOpeningText('');
    setGlText('');
    setComments('');
    setCarriedFrom(null);
    getBalanceReconciliations(key, currency).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setStorageNote(res.error);
        return;
      }
      setStorageNote(null);
      const { current, previous } = res.data;
      setSaved(current);
      if (current) {
        setOpeningText(toInput(current.openingBalance));
        setGlText(toInput(current.glBalance));
        setComments(current.comments ?? '');
        setCarriedFrom(null);
      } else if (previous) {
        setOpeningText(toInput(previous.glBalance));
        setCarriedFrom(previous.period);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, currency]);

  if (!period || !items) return null;

  const opening = parseMoney(openingText);
  const gl = parseMoney(glText);
  const figures = computeBalanceFigures(opening, items.items, gl);
  const shortPeriod = formatPeriodShort(period);
  // Anything here keeps the month from being saved as final; exports are
  // still allowed but are marked as drafts.
  const blockers: string[] = [];
  for (const i of items.items) {
    if (i.value === null)
      blockers.push(
        `${i.label} can't be worked out: upload ${SOURCE_LABELS[i.left]} and ${SOURCE_LABELS[i.right]} extracts.`
      );
  }
  if (opening === null) blockers.push('Enter the opening balance.');
  if (gl === null)
    blockers.push('Enter the balance as per General Ledger (TB).');
  const complete = blockers.length === 0;

  const frontPage: FrontPageData = {
    period,
    currency,
    figures,
    items: items.items.map((i) => ({ label: i.label, value: i.value })),
    comments,
    draftReasons: blockers,
  };

  async function draftComments() {
    setDrafting(true);
    setDraftError(null);
    try {
      const { context, message } = commentsPrompt(
        shortPeriod,
        currency,
        items!.items,
        figures
      );
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: COMMENTS_PROVIDER,
          context,
          messages: [{ role: 'user', content: message }],
        }),
      });
      const data: {
        reply: string;
        usage?: TokenUsage;
        configured: boolean;
        error?: string;
      } = await res.json();
      if (!res.ok)
        throw new Error(data.error || `Request failed (${res.status})`);
      if (!data.configured)
        throw new Error(
          'No API key is configured for the AI provider, so no comment was drafted.'
        );
      setComments(data.reply.trim().slice(0, COMMENTS_MAX));
      logUsage({
        provider: COMMENTS_PROVIDER,
        usage: data.usage ?? null,
        source: 'reports',
      });
    } catch (e) {
      setDraftError(
        e instanceof Error ? e.message : 'Could not draft comments'
      );
    } finally {
      setDrafting(false);
    }
  }

  async function exportAs(kind: 'pdf' | 'xlsx') {
    setExporting(kind);
    try {
      if (kind === 'pdf') await exportFrontPageToPdf(frontPage);
      else await exportFrontPageToExcel(frontPage);
    } finally {
      setExporting(null);
    }
  }

  async function finalise() {
    if (!complete || opening === null || gl === null) return;
    setSaving(true);
    setSaveError(null);
    const res = await saveBalanceReconciliation({
      periodKey: key!,
      currency,
      openingBalance: opening,
      reconcilingItems: items!.items.map((i) => ({
        id: i.id,
        label: i.label,
        value: i.value ?? 0,
      })),
      glBalance: gl,
      comments,
    });
    setSaving(false);
    if (res.ok) setSaved(res.data);
    else setSaveError(res.error);
  }

  const differenceNonZero =
    figures.difference !== null && figures.difference !== 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Netting Account Reconciliation — {shortPeriod}
        </CardTitle>
        <CardDescription>
          The signed-off front page for GL account {NETTING_ACCOUNT.number}.
          Reconciling items are calculated from the uploaded extracts dated in{' '}
          {shortPeriod}; the AI only drafts the comments.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Inputs */}
        <div className="flex flex-col gap-4">
          {items.availableCurrencies.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bal-currency" className="text-sm font-medium">
                Report currency
              </label>
              <select
                id="bal-currency"
                value={currency}
                onChange={(e) => setChosenCurrency(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {items.availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.count.toLocaleString()} record
                    {c.count === 1 ? '' : 's'} in {shortPeriod}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Only {currency} records are counted. Each currency is reconciled
                and saved separately.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bal-opening" className="text-sm font-medium">
              1. Balance as at {formatPeriodOpening(period)}
            </label>
            <Input
              id="bal-opening"
              inputMode="decimal"
              placeholder="e.g. 9,443,163.62"
              value={openingText}
              onChange={(e) => {
                setOpeningText(e.target.value);
                setCarriedFrom(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {carriedFrom
                ? `Carried over from the ${carriedFrom.slice(0, 7)} closing balance. Edit if needed.`
                : 'Carried over from last month once that month is saved as final.'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bal-gl" className="text-sm font-medium">
              2. Balance as per General Ledger (TB) –{' '}
              {formatPeriodClosing(period)}
            </label>
            <Input
              id="bal-gl"
              inputMode="decimal"
              placeholder="e.g. 3,633,640.12"
              value={glText}
              onChange={(e) => setGlText(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="bal-comments" className="text-sm font-medium">
                Comments
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={draftComments}
                disabled={drafting}
              >
                {drafting ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <SparklesIcon className="size-3.5 text-brand-magenta" />
                )}
                Draft with AI
              </Button>
            </div>
            <Textarea
              id="bal-comments"
              rows={5}
              placeholder="Explain the reconciling items, or draft them with AI and edit."
              maxLength={COMMENTS_MAX}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            {draftError && (
              <p className="text-xs text-destructive">{draftError}</p>
            )}
          </div>

          {(blockers.length > 0 ||
            storageNote ||
            items.otherCurrencyRecords + items.noCurrencyRecords > 0 ||
            items.recordsOutsidePeriod + items.undatedRecords > 0) && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              {blockers.map((b) => (
                <p key={b} className="flex gap-1.5">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  {b}
                </p>
              ))}
              {items.recordsOutsidePeriod + items.undatedRecords > 0 && (
                <p className="text-muted-foreground">
                  {items.recordsOutsidePeriod} record(s) dated outside{' '}
                  {shortPeriod}
                  {items.undatedRecords > 0 &&
                    ` and ${items.undatedRecords} undated record(s)`}{' '}
                  are left out of these figures.
                </p>
              )}
              {items.otherCurrencyRecords > 0 && (
                <p className="text-muted-foreground">
                  {items.otherCurrencyRecords.toLocaleString()} {shortPeriod}{' '}
                  record(s) in other currencies are left out — pick their
                  currency above to reconcile them.
                </p>
              )}
              {items.noCurrencyRecords > 0 && (
                <p className="flex gap-1.5">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  {items.noCurrencyRecords.toLocaleString()} record(s) have no
                  currency and are left out. Set the currency on their files in
                  Data Sources.
                </p>
              )}
              {storageNote && (
                <p className="text-muted-foreground">
                  Saving is unavailable: {storageNote}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Live preview of the front page */}
        <div className="overflow-x-auto rounded-lg border bg-white p-5 text-[11px] text-neutral-900 shadow-xs">
          <div className="min-w-[440px]">
            <div className="flex items-start justify-between">
              <p className="font-bold leading-tight text-[#1f3a7a]">
                Netting Account
                <br />
                Reconciliation
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/liquid-colour.png"
                alt="Liquid Intelligent Technologies"
                className="h-7 w-auto"
              />
            </div>
            <div className="my-3 border-t-2 border-neutral-900" />
            {[
              ['General Ledger Account Name', NETTING_ACCOUNT.name],
              ['General Ledger Account Number', NETTING_ACCOUNT.number],
              ['Financial Reporting Period', shortPeriod],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 py-1">
                <span className="w-44 shrink-0 font-bold">{k}</span>
                <span className="flex-1 border-b border-neutral-900">{v}</span>
              </div>
            ))}
            <p className="mt-3 text-right font-bold">{currency}</p>
            <PreviewRow
              label={`1. Balance as at ${formatPeriodOpening(period)}`}
              value={figures.openingBalance}
              boxed
            />
            <PreviewRow
              label="1.1. Reconciling Items:"
              value={figures.reconcilingTotal}
              boxed
              className="mt-2"
            />
            {items.items.map((i) => (
              <PreviewRow key={i.id} label={i.label} value={i.value} plain />
            ))}
            <PreviewRow
              label="Subtotal"
              value={figures.subtotal}
              boxed
              alignLabelRight
              className="mt-3"
            />
            <PreviewRow
              label={`2. Balance as per General Ledger (TB)- ${formatPeriodClosing(period)}`}
              value={figures.glBalance}
              boxed
              className="mt-2"
            />
            <PreviewRow
              label="3. Difference"
              value={figures.difference}
              boxed
              className={cn('mt-2', differenceNonZero && 'text-red-700')}
            />
            <p className="mt-3 font-bold">Comments</p>
            <div className="min-h-14 whitespace-pre-wrap border-2 border-neutral-900 p-1.5">
              {comments}
            </div>
            <div className="mt-4 border-t-2 border-neutral-900 pt-2">
              {SIGN_OFF_DESIGNATIONS.map((d, i) => (
                <div key={i} className="flex items-end gap-3 py-1">
                  <span className="w-28 shrink-0 font-bold">{d}</span>
                  <span className="h-3 flex-1 border-b border-neutral-400" />
                  <span className="h-3 w-20 border-b border-neutral-400" />
                  <span className="h-3 w-20 border-b border-neutral-400" />
                </div>
              ))}
            </div>
            <div className="mt-2 border-t-2 border-neutral-900" />
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => exportAs('pdf')}
          disabled={exporting !== null}
        >
          {exporting === 'pdf' ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <FileDownIcon className="size-3.5" />
          )}
          {complete ? 'Export PDF' : 'Export draft PDF'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportAs('xlsx')}
          disabled={exporting !== null}
        >
          {exporting === 'xlsx' ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <FileDownIcon className="size-3.5" />
          )}
          {complete ? 'Export Excel' : 'Export draft Excel'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={finalise}
          disabled={!complete || saving || storageNote !== null}
        >
          {saving ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SaveIcon className="size-3.5" />
          )}
          {saved ? 'Save changes as final' : 'Save as final'}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2Icon className="size-3.5 text-emerald-600" />
            Saved as final on{' '}
            {new Date(saved.finalisedAt).toLocaleDateString('en-GB')}
            {saved.finalisedByEmail && ` by ${saved.finalisedByEmail}`}
          </span>
        )}
        {saveError && (
          <span className="text-xs text-destructive">{saveError}</span>
        )}
      </CardFooter>
    </Card>
  );
}

function PreviewRow({
  label,
  value,
  boxed,
  plain,
  alignLabelRight,
  className,
}: {
  label: string;
  value: number | null;
  boxed?: boolean;
  plain?: boolean;
  alignLabelRight?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 py-0.5', className)}>
      <span
        className={cn(
          'flex-1',
          !plain && 'font-bold',
          alignLabelRight && 'text-right'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'w-32 shrink-0 px-1 text-right tabular-nums',
          boxed && 'border-2 border-neutral-900 font-bold'
        )}
      >
        {formatAccounting(value, boxed ? 'number' : 'dash')}
      </span>
    </div>
  );
}
