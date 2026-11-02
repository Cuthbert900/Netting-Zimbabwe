'use client';

import { PageHeader } from '@/components/page-header';
import { useMemo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { GaugeIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatTile } from '@/components/reconciliation-overview/stat-tile';
import { useAiUsage } from '@/lib/ai-usage-context';
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers';

const SOURCE_LABELS: Record<'ai-assistant' | 'ai-summary' | 'reports', string> =
  {
    'ai-assistant': 'AI Assistant chat',
    'ai-summary': 'Analytics AI Summary',
    reports: 'Reports — AI narrative',
  };

export function AiUsagePageClient() {
  const { records, clear } = useAiUsage();

  const stats = useMemo(() => {
    const byProvider: Record<
      ProviderId,
      {
        calls: number;
        demoCalls: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    > = {
      'ai-factory': {
        calls: 0,
        demoCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      claude: {
        calls: 0,
        demoCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      mistral: {
        calls: 0,
        demoCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      gemini: {
        calls: 0,
        demoCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
    let totalCalls = 0;
    let demoCalls = 0;
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    for (const r of records) {
      totalCalls++;
      byProvider[r.provider].calls++;
      if (!r.usage) {
        demoCalls++;
        byProvider[r.provider].demoCalls++;
        continue;
      }
      totalTokens += r.usage.totalTokens;
      promptTokens += r.usage.promptTokens;
      completionTokens += r.usage.completionTokens;
      byProvider[r.provider].totalTokens += r.usage.totalTokens;
      byProvider[r.provider].promptTokens += r.usage.promptTokens;
      byProvider[r.provider].completionTokens += r.usage.completionTokens;
    }

    return {
      totalCalls,
      demoCalls,
      totalTokens,
      promptTokens,
      completionTokens,
      byProvider,
    };
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="AI Usage"
          description="Real token counts reported by each provider — not estimated. Stored only in this browser."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-brand-magenta/10">
              <GaugeIcon className="size-7 text-brand-magenta" />
            </div>
            <p className="font-medium">No AI calls yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Usage fills in once you ask the AI Assistant a question or
              generate an AI Summary on Analytics — token counts here are the
              real numbers each provider reports, not estimates.
            </p>
            <Button
              render={<Link href="/ai-assistant" />}
              nativeButton={false}
              size="sm"
              className="mt-2"
            >
              <SparklesIcon />
              Open AI Assistant
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Usage"
        description="Real token counts reported by each provider — not estimated. Stored only in this browser."
        actions={
          <Button variant="outline" size="sm" onClick={clear}>
            <Trash2Icon className="size-3.5" />
            Clear log
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Total calls"
          value={stats.totalCalls.toLocaleString()}
          sub="across every provider"
          variant="purple"
        />
        <StatTile
          label="Total tokens"
          value={stats.totalTokens.toLocaleString()}
          sub={`${stats.promptTokens.toLocaleString()} prompt / ${stats.completionTokens.toLocaleString()} completion`}
        />
        <StatTile
          label="Demo-mode calls"
          value={stats.demoCalls.toLocaleString()}
          sub="no provider configured, 0 tokens"
          variant="pink"
        />
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">By provider</CardTitle>
          <CardDescription>
            Only providers with at least one call are shown
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          {PROVIDERS.filter((p) => stats.byProvider[p.id].calls > 0).map(
            (p) => {
              const s = stats.byProvider[p.id];
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.calls} call{s.calls === 1 ? '' : 's'}
                      {s.demoCalls > 0 ? ` (${s.demoCalls} demo)` : ''}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {s.totalTokens.toLocaleString()} tokens
                  </p>
                </div>
              );
            }
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">Recent calls</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.slice(0, 50).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.timestamp), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    {PROVIDERS.find((p) => p.id === r.provider)?.label ??
                      r.provider}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {SOURCE_LABELS[r.source]}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.usage ? (
                      r.usage.totalTokens.toLocaleString()
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        demo
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {records.length > 50 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the 50 most recent of {records.length} calls.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
