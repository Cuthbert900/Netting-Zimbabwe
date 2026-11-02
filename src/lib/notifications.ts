// Notifications, derived live from the current reconciliation state rather
// than stored as a fake event log — there's no backend to persist real
// events yet, so instead of inventing history, every render recomputes
// "what's actually true right now that someone should know about": recent
// uploads, high-value exceptions, possible duplicates, and a low match rate.
// Read/dismissed state is tracked separately (notification-state-context.tsx)
// so a notification can be marked read or dismissed without needing a real
// event store — an id stays stable as long as the underlying fact does.

import { formatMoney } from '@/components/matches/match-status-badge';
import type { SourceKey, StoredExtract } from '@/lib/data-sources-context';
import { SOURCE_LABELS } from '@/lib/data-sources-context';
import type { ReconciliationResult } from '@/lib/reconciliation-engine';

export type NotificationType = 'upload' | 'exception' | 'duplicate' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  /** ISO timestamp — drives both display time and sort order. */
  timestamp: string;
  href: string;
}

const DEFAULT_HIGH_VALUE_THRESHOLD = 5000;
const DEFAULT_LOW_MATCH_RATE_THRESHOLD = 0.5;

export interface AlertThresholds {
  /** Flag exceptions at or above this amount as high-value. */
  highValueThreshold: number;
  /** Flag the overall match rate when it falls below this fraction (0–1). */
  lowMatchRateThreshold: number;
}

function latestRecordDate(dates: (Date | null)[], fallback: string): string {
  const valid = dates.filter((d): d is Date => d !== null);
  if (valid.length === 0) return fallback;
  return new Date(Math.max(...valid.map((d) => d.getTime()))).toISOString();
}

export function deriveNotifications(
  result: ReconciliationResult,
  filesBySource: Record<SourceKey, StoredExtract[]>,
  thresholds: AlertThresholds = {
    highValueThreshold: DEFAULT_HIGH_VALUE_THRESHOLD,
    lowMatchRateThreshold: DEFAULT_LOW_MATCH_RATE_THRESHOLD,
  }
): AppNotification[] {
  const { highValueThreshold, lowMatchRateThreshold } = thresholds;
  const notifications: AppNotification[] = [];
  const now = new Date().toISOString();

  // One notification per uploaded file — real upload timestamps, so these
  // sort naturally alongside everything else.
  for (const source of Object.keys(filesBySource) as SourceKey[]) {
    for (const file of filesBySource[source]) {
      notifications.push({
        id: `upload:${file.id}`,
        type: 'upload',
        title: `${file.fileName} uploaded`,
        description: `${file.rowCount.toLocaleString()} record${file.rowCount === 1 ? '' : 's'} loaded into ${SOURCE_LABELS[source]}`,
        timestamp: file.uploadedAt,
        href: '/data-sources',
      });
    }
  }

  const highValue = result.groups.filter(
    (g) => g.status === 'investigate' && g.amount >= highValueThreshold
  );
  if (highValue.length > 0) {
    const total = highValue.reduce((s, g) => s + g.amount, 0);
    const ts = latestRecordDate(
      highValue.flatMap((g) => g.records.map((r) => r.date)),
      now
    );
    notifications.push({
      id: 'exceptions-high-value',
      type: 'exception',
      title: `${highValue.length} high-value exception${highValue.length === 1 ? '' : 's'} need review`,
      description: `${formatMoney(total)} with no counterpart found, ≥ ${highValueThreshold.toLocaleString()} each`,
      timestamp: ts,
      href: '/cards',
    });
  }

  if (result.duplicates.length > 0) {
    const extraRecords = result.duplicates.reduce(
      (s, g) => s + (g.records.length - 1),
      0
    );
    const total = result.duplicates.reduce(
      (s, g) => s + g.records.reduce((rs, r) => rs + (r.amount ?? 0), 0),
      0
    );
    const ts = latestRecordDate(
      result.duplicates.flatMap((g) => g.records.map((r) => r.date)),
      now
    );
    notifications.push({
      id: 'duplicates-detected',
      type: 'duplicate',
      title: `${result.duplicates.length} possible duplicate group${result.duplicates.length === 1 ? '' : 's'} detected`,
      description: `${extraRecords.toLocaleString()} record${extraRecords === 1 ? '' : 's'} excluded from matching, ${formatMoney(total)} — review on Overview`,
      timestamp: ts,
      href: '/dashboard',
    });
  }

  const totalGroups = result.groups.length;
  if (totalGroups > 0) {
    const matchRate = result.summary.matched / totalGroups;
    if (matchRate < lowMatchRateThreshold) {
      notifications.push({
        id: 'match-rate-low',
        type: 'system',
        title: `Match rate is low (${Math.round(matchRate * 100)}%)`,
        description:
          'Fewer than half of loaded groups matched cleanly — check that sources cover the same period',
        timestamp: now,
        href: '/dashboard',
      });
    }
  }

  return notifications.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
