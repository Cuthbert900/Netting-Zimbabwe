'use client';

// Combines live-derived notifications (notifications.ts) with persisted
// read/dismissed state (notification-state-context.tsx) into the single
// hook the sidebar dropdown and the /notifications page both consume.

import * as React from 'react';
import { useAlertSettings } from '@/lib/alert-settings-context';
import { useDataSources } from '@/lib/data-sources-context';
import { deriveNotifications, type AppNotification } from '@/lib/notifications';
import { useNotificationState } from '@/lib/notification-state-context';
import { useReconciliation } from '@/lib/reconciliation-context';

export interface DisplayNotification extends AppNotification {
  read: boolean;
}

export function useAppNotifications() {
  const result = useReconciliation();
  const { filesBySource } = useDataSources();
  const { seen, dismissed, markSeen, markAllSeen, dismiss } =
    useNotificationState();
  const { highValueThreshold, lowMatchRateThreshold } = useAlertSettings();

  const notifications = React.useMemo<DisplayNotification[]>(() => {
    return deriveNotifications(result, filesBySource, {
      highValueThreshold,
      lowMatchRateThreshold,
    })
      .filter((n) => !dismissed.has(n.id))
      .map((n) => ({ ...n, read: seen.has(n.id) }));
  }, [
    result,
    filesBySource,
    dismissed,
    seen,
    highValueThreshold,
    lowMatchRateThreshold,
  ]);

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markAllRead = React.useCallback(() => {
    markAllSeen(notifications.map((n) => n.id));
  }, [markAllSeen, notifications]);

  return {
    notifications,
    unreadCount,
    markSeen,
    markAllRead,
    dismiss,
  };
}
