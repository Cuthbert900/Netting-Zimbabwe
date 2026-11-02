'use client';

import { Building2Icon, LandmarkIcon, WalletCardsIcon } from 'lucide-react';
import { SourceCard } from '@/components/data-sources/source-card';
import { useDataSources } from '@/lib/data-sources-context';
import { PageHeader } from '@/components/page-header';
import { StatTile } from '@/components/reconciliation-overview/stat-tile';

export function DataSourcesPageClient() {
  const { filesBySource } = useDataSources();
  const totalFiles =
    filesBySource.dynamics.length +
    filesBySource.prism.length +
    filesBySource.bank.length;
  const totalRows = [
    ...filesBySource.dynamics,
    ...filesBySource.prism,
    ...filesBySource.bank,
  ].reduce((sum, f) => sum + f.rowCount, 0);

  const sourcesLoaded = (['dynamics', 'prism', 'bank'] as const).filter(
    (k) => filesBySource[k].length > 0
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Data Sources"
        description="Upload CSV/XLSX extracts from Dynamics 365, Prism, and the bank to demo reconciliation while live system access is being provisioned. Files are parsed locally in your browser."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Files loaded"
          value={totalFiles.toLocaleString()}
          variant="purple"
        />
        <StatTile label="Total records" value={totalRows.toLocaleString()} />
        <StatTile
          label="Sources with data"
          value={`${sourcesLoaded} of 3`}
          variant="pink"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SourceCard
          source="dynamics"
          title="Dynamics 365"
          description="Netting GL extracts"
          icon={<Building2Icon className="size-4" />}
        />
        <SourceCard
          source="prism"
          title="Prism BSS"
          description="Billing & revenue extracts"
          icon={<WalletCardsIcon className="size-4" />}
        />
        <SourceCard
          source="bank"
          title="Bank Statements"
          description="CABS, CBZ, NMB, Stanbic & more"
          icon={<LandmarkIcon className="size-4" />}
        />
      </div>
    </div>
  );
}
