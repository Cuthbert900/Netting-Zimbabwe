'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { SearchIcon } from 'lucide-react';
import { useReconciliation } from '@/lib/reconciliation-context';
import { PageHeader } from '@/components/page-header';
import { MatchSummary } from '@/components/matches/match-summary';
import { MatchTable } from '@/components/matches/match-table';
import type { MatchStatus } from '@/lib/reconciliation-engine';

type FilterTab = 'all' | MatchStatus;

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'matched', label: 'Matched' },
  { value: 'timing', label: 'Timing' },
  { value: 'mispost', label: 'Mis-posts' },
  { value: 'investigate', label: 'Investigate' },
];

export function TransactionsPageClient() {
  const result = useReconciliation();
  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let groups = result.groups;
    if (tab !== 'all') groups = groups.filter((g) => g.status === tab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      groups = groups.filter(
        (g) =>
          g.records.some(
            (r) =>
              r.reference.includes(q) || r.fileName.toLowerCase().includes(q)
          ) || g.note.toLowerCase().includes(q)
      );
    }
    return groups;
  }, [result.groups, tab, search]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Matches"
        description="Every reconciliation group across the uploaded sources, with its status and variance."
      />

      <MatchSummary result={result} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reference or file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <MatchTable groups={filtered} />
    </div>
  );
}
