'use client';

// A real AI-generated executive summary of the current reconciliation
// period — grounded in the same context the AI Assistant uses, run through
// whichever provider is configured. Generated on demand (not automatically,
// so it doesn't burn tokens on every page load) and not persisted, since
// it goes stale the moment new extracts are uploaded.

import { useMemo, useState } from 'react';
import {
  SparklesIcon,
  Loader2Icon,
  InfoIcon,
  RefreshCwIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useReconciliation } from '@/lib/reconciliation-context';
import { buildContextSummary } from '@/lib/ai/context';
import { useAiUsage } from '@/lib/ai-usage-context';
import type { TokenUsage } from '@/lib/ai/providers';

const DEFAULT_PROVIDER = 'ai-factory';

const SUMMARY_PROMPT =
  'Give a concise executive summary of this reconciliation period for a Treasury & Billing reviewer: ' +
  'overall health, the two or three things most worth their attention, and any pattern across exceptions ' +
  'worth flagging. Keep it to a short paragraph or a few bullet points — no preamble.';

export function AiSummaryCard() {
  const result = useReconciliation();
  const contextSummary = useMemo(() => buildContextSummary(result), [result]);
  const { logUsage } = useAiUsage();

  const [summary, setSummary] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: DEFAULT_PROVIDER,
          context: contextSummary,
          messages: [{ role: 'user', content: SUMMARY_PROMPT }],
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

      setSummary(data.reply);
      setDemo(!data.configured);
      logUsage({
        provider: DEFAULT_PROVIDER,
        usage: data.usage ?? null,
        source: 'ai-summary',
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Something went wrong generating the summary'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <SparklesIcon className="size-4 text-primary" />
            AI Summary
          </CardTitle>
          <CardDescription>
            A generated read of the current reconciliation period, from the same
            data as the AI Assistant
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generate}
          disabled={loading}
        >
          {loading ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-3.5" />
          )}
          {summary ? 'Regenerate' : 'Generate'}
        </Button>
      </CardHeader>
      {(summary || error) && (
        <CardContent>
          {summary && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {summary}
              {demo && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground opacity-80">
                  <InfoIcon className="size-3" />
                  Demo mode — no API key configured for this provider
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
