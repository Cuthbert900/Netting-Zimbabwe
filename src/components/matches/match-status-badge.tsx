import {
  CheckCircle2Icon,
  ClockIcon,
  AlertTriangleIcon,
  SearchIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MatchStatus } from '@/lib/reconciliation-engine';

export const STATUS_META: Record<
  MatchStatus,
  {
    label: string;
    icon: typeof CheckCircle2Icon;
    className: string;
  }
> = {
  matched: {
    label: 'Matched',
    icon: CheckCircle2Icon,
    className:
      'bg-success-bg text-success-text border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center text-xs',
  },
  timing: {
    label: 'Timing difference',
    icon: ClockIcon,
    className:
      'bg-warning-bg text-warning-text border border-amber-500/20 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center text-xs',
  },
  mispost: {
    label: 'Mis-post',
    icon: AlertTriangleIcon,
    className:
      'bg-alert-bg text-alert-text border border-rose-500/20 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center text-xs',
  },
  investigate: {
    label: 'Investigate',
    icon: SearchIcon,
    className:
      'bg-alert-bg text-alert-text border border-rose-500/20 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center text-xs',
  },
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <div className={cn('gap-1', meta.className)}>
      <Icon className="size-3" />
      {meta.label}
    </div>
  );
}

export function formatMoney(amount: number, currency?: string | null) {
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}
