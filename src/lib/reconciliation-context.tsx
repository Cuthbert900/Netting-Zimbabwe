'use client';

import * as React from 'react';
import { useDataSources } from '@/lib/data-sources-context';
import { useDuplicateOverrides } from '@/lib/duplicate-overrides-context';
import {
  reconcile,
  type ReconciliationResult,
} from '@/lib/reconciliation-engine';

const ReconciliationContext = React.createContext<ReconciliationResult | null>(
  null
);

export function ReconciliationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { filesBySource } = useDataSources();
  const { dismissed } = useDuplicateOverrides();

  const result = React.useMemo(
    () => reconcile(filesBySource, dismissed),
    [filesBySource, dismissed]
  );

  return (
    <ReconciliationContext.Provider value={result}>
      {children}
    </ReconciliationContext.Provider>
  );
}

export function useReconciliation() {
  const ctx = React.useContext(ReconciliationContext);
  if (!ctx) {
    throw new Error(
      'useReconciliation must be used within a ReconciliationProvider'
    );
  }
  return ctx;
}
