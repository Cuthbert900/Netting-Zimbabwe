'use client';

import * as React from 'react';
import type { ParsedExtract } from '@/lib/extract-parser';
import { fingerprintExtract } from '@/lib/duplicate-detection';
import { loadStoredExtracts, saveStoredExtracts } from '@/lib/extract-store';

export type SourceKey = 'dynamics' | 'prism' | 'bank';

export interface StoredExtract extends ParsedExtract {
  id: string;
  source: SourceKey;
}

interface DataSourcesState {
  filesBySource: Record<SourceKey, StoredExtract[]>;
  addFile: (source: SourceKey, extract: ParsedExtract) => void;
  removeFile: (source: SourceKey, id: string) => void;
  clearSource: (source: SourceKey) => void;
  /** Sets the currency for every row of a file that has no currency column
   * (null = unknown). */
  setFileCurrency: (
    source: SourceKey,
    id: string,
    currency: string | null
  ) => void;
  /** Returns an already-loaded file in this source whose content fingerprint
   * matches the incoming extract (same rows, regardless of file name), or
   * null. Call this before addFile so the caller can ask the user whether
   * to replace, skip, or load it anyway rather than silently double-loading
   * the same statement. */
  findDuplicateFile: (
    source: SourceKey,
    extract: ParsedExtract
  ) => StoredExtract | null;
}

const emptyState: Record<SourceKey, StoredExtract[]> = {
  dynamics: [],
  prism: [],
  bank: [],
};

const DataSourcesContext = React.createContext<DataSourcesState | null>(null);

export function DataSourcesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [filesBySource, setFilesBySource] =
    React.useState<Record<SourceKey, StoredExtract[]>>(emptyState);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    loadStoredExtracts()
      .then((stored) => {
        if (!cancelled && stored)
          setFilesBySource({ ...emptyState, ...stored });
      })
      .catch(() => {
        // IndexedDB unavailable (e.g. some private windows) — the app still
        // works for this session, it just won't survive a reload.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    saveStoredExtracts(filesBySource).catch(() => {
      // Same as above: in-memory state still works for this session.
    });
  }, [filesBySource, hydrated]);

  const addFile = React.useCallback(
    (source: SourceKey, extract: ParsedExtract) => {
      setFilesBySource((prev) => {
        const stored: StoredExtract = {
          ...extract,
          id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source,
        };
        return { ...prev, [source]: [...prev[source], stored] };
      });
    },
    []
  );

  const removeFile = React.useCallback((source: SourceKey, id: string) => {
    setFilesBySource((prev) => ({
      ...prev,
      [source]: prev[source].filter((f) => f.id !== id),
    }));
  }, []);

  const clearSource = React.useCallback((source: SourceKey) => {
    setFilesBySource((prev) => ({ ...prev, [source]: [] }));
  }, []);

  const setFileCurrency = React.useCallback(
    (source: SourceKey, id: string, currency: string | null) => {
      setFilesBySource((prev) => ({
        ...prev,
        [source]: prev[source].map((f) =>
          f.id === id ? { ...f, fileCurrency: currency } : f
        ),
      }));
    },
    []
  );

  const findDuplicateFile = React.useCallback(
    (source: SourceKey, extract: ParsedExtract): StoredExtract | null => {
      const incomingFp = fingerprintExtract(extract);
      return (
        filesBySource[source].find(
          (f) => fingerprintExtract(f) === incomingFp
        ) ?? null
      );
    },
    [filesBySource]
  );

  const value = React.useMemo(
    () => ({
      filesBySource,
      addFile,
      removeFile,
      clearSource,
      setFileCurrency,
      findDuplicateFile,
    }),
    [
      filesBySource,
      addFile,
      removeFile,
      clearSource,
      setFileCurrency,
      findDuplicateFile,
    ]
  );

  return (
    <DataSourcesContext.Provider value={value}>
      {children}
    </DataSourcesContext.Provider>
  );
}

export function useDataSources() {
  const ctx = React.useContext(DataSourcesContext);
  if (!ctx) {
    throw new Error('useDataSources must be used within a DataSourcesProvider');
  }
  return ctx;
}

export const SOURCE_LABELS: Record<SourceKey, string> = {
  dynamics: 'Dynamics 365',
  prism: 'Prism BSS',
  bank: 'Bank Statements',
};
