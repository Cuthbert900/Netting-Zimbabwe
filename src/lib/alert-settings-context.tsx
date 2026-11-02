'use client';

// User-configurable thresholds that drive the "system" notifications derived
// in notifications.ts (see deriveNotifications) — what counts as a
// high-value exception worth flagging, and how low a match rate has to fall
// before it's worth a heads-up. Persisted locally so the choice survives a
// reload; there's no backend yet, so this is genuinely all there is.

import * as React from 'react';

interface AlertSettings {
  highValueThreshold: number;
  lowMatchRateThreshold: number;
  setHighValueThreshold: (value: number) => void;
  setLowMatchRateThreshold: (value: number) => void;
  resetDefaults: () => void;
}

export const DEFAULT_HIGH_VALUE_THRESHOLD = 5000;
export const DEFAULT_LOW_MATCH_RATE_THRESHOLD = 0.5;

const STORAGE_KEY = 'netting-recon:alert-settings:v1';

const AlertSettingsContext = React.createContext<AlertSettings | null>(null);

interface Persisted {
  highValueThreshold: number;
  lowMatchRateThreshold: number;
}

function loadFromStorage(): Persisted {
  const fallback: Persisted = {
    highValueThreshold: DEFAULT_HIGH_VALUE_THRESHOLD,
    lowMatchRateThreshold: DEFAULT_LOW_MATCH_RATE_THRESHOLD,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      highValueThreshold:
        typeof parsed.highValueThreshold === 'number'
          ? parsed.highValueThreshold
          : fallback.highValueThreshold,
      lowMatchRateThreshold:
        typeof parsed.lowMatchRateThreshold === 'number'
          ? parsed.lowMatchRateThreshold
          : fallback.lowMatchRateThreshold,
    };
  } catch {
    return fallback;
  }
}

function saveToStorage(state: Persisted) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best effort.
  }
}

export function AlertSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [highValueThreshold, setHighValueThresholdState] = React.useState(
    DEFAULT_HIGH_VALUE_THRESHOLD
  );
  const [lowMatchRateThreshold, setLowMatchRateThresholdState] = React.useState(
    DEFAULT_LOW_MATCH_RATE_THRESHOLD
  );
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const loaded = loadFromStorage();
    setHighValueThresholdState(loaded.highValueThreshold);
    setLowMatchRateThresholdState(loaded.lowMatchRateThreshold);
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    saveToStorage({ highValueThreshold, lowMatchRateThreshold });
  }, [highValueThreshold, lowMatchRateThreshold, hydrated]);

  const setHighValueThreshold = React.useCallback((value: number) => {
    setHighValueThresholdState(
      Number.isFinite(value) && value >= 0
        ? value
        : DEFAULT_HIGH_VALUE_THRESHOLD
    );
  }, []);

  const setLowMatchRateThreshold = React.useCallback((value: number) => {
    setLowMatchRateThresholdState(
      Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : DEFAULT_LOW_MATCH_RATE_THRESHOLD
    );
  }, []);

  const resetDefaults = React.useCallback(() => {
    setHighValueThresholdState(DEFAULT_HIGH_VALUE_THRESHOLD);
    setLowMatchRateThresholdState(DEFAULT_LOW_MATCH_RATE_THRESHOLD);
  }, []);

  const value = React.useMemo(
    () => ({
      highValueThreshold,
      lowMatchRateThreshold,
      setHighValueThreshold,
      setLowMatchRateThreshold,
      resetDefaults,
    }),
    [
      highValueThreshold,
      lowMatchRateThreshold,
      setHighValueThreshold,
      setLowMatchRateThreshold,
      resetDefaults,
    ]
  );

  return (
    <AlertSettingsContext.Provider value={value}>
      {children}
    </AlertSettingsContext.Provider>
  );
}

export function useAlertSettings() {
  const ctx = React.useContext(AlertSettingsContext);
  if (!ctx) {
    throw new Error(
      'useAlertSettings must be used within an AlertSettingsProvider'
    );
  }
  return ctx;
}
