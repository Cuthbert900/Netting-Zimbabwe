'use client';

import { Fragment, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MatchStatusBadge,
  formatMoney,
} from '@/components/matches/match-status-badge';
import { SOURCE_LABELS } from '@/lib/data-sources-context';
import type { MatchGroup } from '@/lib/reconciliation-engine';

interface MatchTableProps {
  groups: MatchGroup[];
  emptyLabel?: string;
}

// Real extracts run to hundreds of thousands of groups; drawing them all at
// once locks the browser up. Show one page at a time.
const PAGE_SIZE = 100;

function safeDate(d: Date | null) {
  if (!d) return '—';
  try {
    return format(d, 'd MMM yyyy');
  } catch {
    return '—';
  }
}

export function MatchTable({
  groups,
  emptyLabel = 'No records match this filter.',
}: MatchTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = groups.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  // A new filter or search starts again from the first page.
  useEffect(() => setPage(0), [groups]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border py-12 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Status</TableHead>
            <TableHead>Sources</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Variance</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((g) => {
            const isOpen = expanded.has(g.id);
            const reference =
              g.records.find((r) => r.reference)?.reference ?? '—';
            return (
              <Fragment key={g.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggle(g.id)}
                >
                  <TableCell>
                    {isOpen ? (
                      <ChevronDownIcon className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <MatchStatusBadge status={g.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {g.sources.map((s) => (
                        <Badge
                          key={s}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {SOURCE_LABELS[s]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatMoney(g.amount, g.records[0]?.currency)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {g.varianceAmount > 0.01
                      ? formatMoney(g.varianceAmount)
                      : g.varianceDays
                        ? `${g.varianceDays}d`
                        : '—'}
                  </TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                    {reference}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                    {g.note}
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={6} className="py-3">
                      <div className="flex flex-col gap-1.5">
                        {g.records.map((r) => (
                          <div
                            key={r.key}
                            className="grid grid-cols-[110px_1fr_100px_90px] items-center gap-3 rounded-md bg-background px-3 py-1.5 text-xs"
                          >
                            <Badge variant="secondary" className="w-fit">
                              {SOURCE_LABELS[r.source]}
                            </Badge>
                            <span
                              className="truncate text-muted-foreground"
                              title={r.fileName}
                            >
                              {r.fileName}
                            </span>
                            <span className="tabular-nums">
                              {safeDate(r.date)}
                            </span>
                            <span className="text-right tabular-nums font-medium">
                              {r.amount !== null
                                ? formatMoney(r.amount, r.currency)
                                : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            {(current * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min(
              (current + 1) * PAGE_SIZE,
              groups.length
            ).toLocaleString()}{' '}
            of {groups.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
            >
              Previous
            </Button>
            <span>
              Page {(current + 1).toLocaleString()} of{' '}
              {pageCount.toLocaleString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(current + 1)}
              disabled={current >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
