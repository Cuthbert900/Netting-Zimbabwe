'use client';

// Tracks which derived notifications (see notifications.ts) a user has seen
// or dismissed. Notification ids are stable for as long as the underlying
// fact is (same file id, same "high-value exceptions" summary) — once the
// fact changes (file removed and re-added, exceptions resolved), the id
// changes too, so a dismissal naturally expires instead of hiding a
// genuinely new event forever.

import * as React from 'react';

interface NotificationState {
  seen: Set<string>;
  dismissed: Set<string>;
  markSeen: (id: string) => void;
  markAllSeen: (ids: string[]) => void;
  dismiss: (id: string) => void;
}

const SEEN_KEY = 'netting-recon:notifications-seen:v1';
const DISMISSED_KEY = 'netting-recon:notifications-dismissed:v1';

const NotificationStateContext = React.createContext<NotificationState | null>(
  null
);

function loadSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // Best effort.
  }
}

export function NotificationStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [seen, setSeen] = React.useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setSeen(loadSet(SEEN_KEY));
    setDismissed(loadSet(DISMISSED_KEY));
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    saveSet(SEEN_KEY, seen);
  }, [seen, hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    saveSet(DISMISSED_KEY, dismissed);
  }, [dismissed, hydrated]);

  const markSeen = React.useCallback((id: string) => {
    setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const markAllSeen = React.useCallback((ids: string[]) => {
    setSeen((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setDismissed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const value = React.useMemo(
    () => ({ seen, dismissed, markSeen, markAllSeen, dismiss }),
    [seen, dismissed, markSeen, markAllSeen, dismiss]
  );

  return (
    <NotificationStateContext.Provider value={value}>
      {children}
    </NotificationStateContext.Provider>
  );
}

export function useNotificationState() {
  const ctx = React.useContext(NotificationStateContext);
  if (!ctx) {
    throw new Error(
      'useNotificationState must be used within a NotificationStateProvider'
    );
  }
  return ctx;
}
