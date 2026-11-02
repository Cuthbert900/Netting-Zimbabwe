'use client';

// Logs real token usage from every AI Assistant / AI Summary call so the
// AI Usage page can show what's actually been spent — no backend yet, so
// this persists to localStorage like every other piece of app state.
// Demo-mode replies (no provider configured) are logged with usage: null
// so they show up as calls made without inflating token totals.

import * as React from 'react';
import type { ProviderId, TokenUsage } from '@/lib/ai/providers';

export interface AiUsageRecord {
  id: string;
  timestamp: string;
  provider: ProviderId;
  /** null when the call was answered in demo mode (no API key configured) —
   * no tokens were actually billed. */
  usage: TokenUsage | null;
  /** Where the call came from, for the breakdown on the usage page. */
  source: 'ai-assistant' | 'ai-summary' | 'reports';
}

interface AiUsageState {
  records: AiUsageRecord[];
  logUsage: (record: Omit<AiUsageRecord, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

const STORAGE_KEY = 'netting-recon:ai-usage:v1';
const MAX_RECORDS = 500;

const AiUsageContext = React.createContext<AiUsageState | null>(null);

function loadFromStorage(): AiUsageRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(records: AiUsageRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Best effort.
  }
}

export function AiUsageProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = React.useState<AiUsageRecord[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setRecords(loadFromStorage());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    saveToStorage(records);
  }, [records, hydrated]);

  const logUsage = React.useCallback(
    (entry: Omit<AiUsageRecord, 'id' | 'timestamp'>) => {
      setRecords((prev) => {
        const next: AiUsageRecord = {
          ...entry,
          id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
        };
        return [next, ...prev].slice(0, MAX_RECORDS);
      });
    },
    []
  );

  const clear = React.useCallback(() => setRecords([]), []);

  const value = React.useMemo(
    () => ({ records, logUsage, clear }),
    [records, logUsage, clear]
  );

  return (
    <AiUsageContext.Provider value={value}>{children}</AiUsageContext.Provider>
  );
}

export function useAiUsage() {
  const ctx = React.useContext(AiUsageContext);
  if (!ctx) {
    throw new Error('useAiUsage must be used within an AiUsageProvider');
  }
  return ctx;
}
