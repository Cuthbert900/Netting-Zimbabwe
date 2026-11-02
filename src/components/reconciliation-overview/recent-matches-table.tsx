'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MatchStatusBadge,
  formatMoney,
} from '@/components/matches/match-status-badge';
import { useReconciliation } from '@/lib/reconciliation-context';
import { identifyBank } from '@/lib/bank-logos';
import { SOURCE_LABELS } from '@/lib/data-sources-context';
import type { MatchGroup } from '@/lib/reconciliation-engine';
import {
  ChevronRightIcon,
  LayersIcon,
  BuildingIcon,
  LandmarkIcon,
} from 'lucide-react';

function primaryLogo(group: MatchGroup) {
  const bankRecord = group.records.find((r) => r.source === 'bank');
  if (bankRecord) {
    const bank = identifyBank(bankRecord.fileName);
    return {
      logo: bank.logo,
      label: bank.label,
      fallback: <LandmarkIcon className="size-4" />,
    };
  }
  const dynamicsRecord = group.records.find((r) => r.source === 'dynamics');
  if (dynamicsRecord)
    return {
      logo: null,
      label: 'Dynamics 365',
      fallback: <LayersIcon className="size-4" />,
    };
  const prismRecord = group.records.find((r) => r.source === 'prism');
  if (prismRecord)
    return {
      logo: null,
      label: 'Prism BSS',
      fallback: <BuildingIcon className="size-4" />,
    };
  return {
    logo: null,
    label: 'Unknown',
    fallback: <LandmarkIcon className="size-4" />,
  };
}

export function RecentMatchesTable() {
  const result = useReconciliation();

  const recent = useMemo(() => {
    return [...result.groups]
      .sort((a, b) => {
        const da = a.records
          .map((r) => r.date)
          .filter((d): d is Date => d !== null);
        const db = b.records
          .map((r) => r.date)
          .filter((d): d is Date => d !== null);
        const ta = da.length ? Math.max(...da.map((d) => d.getTime())) : 0;
        const tb = db.length ? Math.max(...db.map((d) => d.getTime())) : 0;
        return tb - ta;
      })
      .slice(0, 8);
  }, [result.groups]);

  if (recent.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">
          Recent Matches
        </CardTitle>
        <Button
          render={<Link href="/cards" />}
          nativeButton={false}
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
        >
          See All
          <ChevronRightIcon className="size-3" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[640px] space-y-1">
            <div className="grid grid-cols-[1fr_140px_110px_120px] gap-4 border-b pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Source</span>
              <span className="hidden sm:inline">Reference</span>
              <span className="text-right">Amount</span>
              <span className="hidden md:inline">Status</span>
            </div>

            {recent.map((g) => {
              const { logo, label, fallback } = primaryLogo(g);
              const reference =
                g.records.find((r) => r.reference)?.reference ?? '—';
              const dates = g.records
                .map((r) => r.date)
                .filter((d): d is Date => d !== null);
              const latest = dates.length
                ? new Date(Math.max(...dates.map((d) => d.getTime())))
                : null;

              return (
                <div
                  key={g.id}
                  className="group grid grid-cols-[1fr_140px_110px_120px] items-center gap-4 rounded-lg py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-white/80 dark:bg-white/5">
                      {logo ? (
                        <Image
                          src={logo}
                          alt={label}
                          width={28}
                          height={28}
                          className="size-6 object-contain"
                          unoptimized
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {fallback}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{label}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {g.sources.map((s) => SOURCE_LABELS[s]).join(' · ')}
                        {latest ? ` · ${format(latest, 'd MMM')}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className="hidden truncate font-mono text-xs text-muted-foreground sm:inline">
                    {reference}
                  </span>

                  <span className="text-right text-sm font-semibold tabular-nums">
                    {formatMoney(g.amount, g.records[0]?.currency)}
                  </span>

                  <span className="hidden md:inline">
                    <MatchStatusBadge status={g.status} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
