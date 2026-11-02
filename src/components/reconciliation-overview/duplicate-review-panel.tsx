'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/components/matches/match-status-badge';
import { SOURCE_LABELS, type SourceKey } from '@/lib/data-sources-context';
import { useDuplicateOverrides } from '@/lib/duplicate-overrides-context';
import type { DuplicateGroup } from '@/lib/duplicate-detection';
import { CopyIcon, CheckIcon } from 'lucide-react';

interface DuplicateReviewPanelProps {
  duplicates: DuplicateGroup[];
}

export function DuplicateReviewPanel({
  duplicates,
}: DuplicateReviewPanelProps) {
  const { dismissed, dismiss, restore } = useDuplicateOverrides();

  const totalExtraRecords = useMemo(
    () => duplicates.reduce((s, g) => s + (g.records.length - 1), 0),
    [duplicates]
  );
  const totalValue = useMemo(
    () =>
      duplicates.reduce(
        (s, g) => s + g.records.reduce((rs, r) => rs + (r.amount ?? 0), 0),
        0
      ),
    [duplicates]
  );

  if (duplicates.length === 0 && dismissed.size === 0) return null;

  if (duplicates.length === 0) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="flex items-center justify-between gap-3 py-4 text-sm">
          <span className="text-muted-foreground">
            No possible duplicates right now — {dismissed.size} group
            {dismissed.size === 1 ? '' : 's'} previously confirmed as genuinely
            separate transactions.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismissed.forEach((id) => restore(id))}
          >
            Restore all for re-review
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CopyIcon className="size-4 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-base font-semibold">
            Possible Duplicates
          </CardTitle>
        </div>
        <CardDescription>
          {totalExtraRecords.toLocaleString()} record
          {totalExtraRecords === 1 ? '' : 's'} across {duplicates.length} group
          {duplicates.length === 1 ? '' : 's'} look like the same transaction
          entered more than once — {formatMoney(totalValue)} excluded from
          matching until reviewed. Remove the extra file on Data Sources if it's
          a re-upload, or dismiss here if these are genuinely separate
          transactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {duplicates.slice(0, 8).map((group) => {
          const first = group.records[0];
          return (
            <div
              key={group.key}
              className="flex items-center justify-between gap-3 rounded-lg border bg-amber-50/50 px-3 py-2 text-sm dark:bg-amber-950/10"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {SOURCE_LABELS[group.source as SourceKey]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {group.reason === 'reference'
                      ? 'shared reference'
                      : 'identical rows'}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {group.records
                    .map((r) => r.fileName)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .join(', ')}
                  {first.date ? ` · ${format(first.date, 'd MMM yyyy')}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {formatMoney(first.amount ?? 0, first.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    × {group.records.length}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => dismiss(group.key)}
                  title="Confirm these are genuinely separate transactions"
                >
                  <CheckIcon className="size-3" />
                  Not a duplicate
                </Button>
              </div>
            </div>
          );
        })}
        {duplicates.length > 8 && (
          <p className="text-xs text-muted-foreground">
            + {duplicates.length - 8} more groups
          </p>
        )}
        {dismissed.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {dismissed.size} group{dismissed.size === 1 ? '' : 's'} previously
            dismissed as not duplicates.{' '}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => dismissed.forEach((id) => restore(id))}
            >
              Restore all
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
