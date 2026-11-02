'use client';

// Persists which duplicate groups a reviewer has confirmed are actually
// separate, legitimate transactions (not a real duplicate) — keyed by the
// same DuplicateGroup.key the engine and the review panel use. Dismissing a
// group folds all of its records back into matching; it does not delete
// anything.

import * as React from 'react';

interface DuplicateOverridesState {
  dismissed: Set<string>;
  dismiss: (id: string) => void;
  restore: (id: string) => void;
}

const STORAGE_KEY = 'netting-recon:duplicate-overrides:v1';

const DuplicateOverridesContext =
  React.createContext<DuplicateOverridesState | null>(null);

function loadFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveToStorage(set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Best effort — dismissals just won't survive a reload if this fails.
  }
}

export function DuplicateOverridesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setDismissed(loadFromStorage());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    saveToStorage(dismissed);
  }, [dismissed, hydrated]);

  const dismiss = React.useCallback((id: string) => {
    setDismissed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const restore = React.useCallback((id: string) => {
    setDismissed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({ dismissed, dismiss, restore }),
    [dismissed, dismiss, restore]
  );

  return (
    <DuplicateOverridesContext.Provider value={value}>
      {children}
    </DuplicateOverridesContext.Provider>
  );
}

export function useDuplicateOverrides() {
  const ctx = React.useContext(DuplicateOverridesContext);
  if (!ctx) {
    throw new Error(
      'useDuplicateOverrides must be used within a DuplicateOverridesProvider'
    );
  }
  return ctx;
}
