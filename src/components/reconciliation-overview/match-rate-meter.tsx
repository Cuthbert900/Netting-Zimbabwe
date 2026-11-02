'use client';

interface MatchRateMeterProps {
  matched: number;
  total: number;
}

export function MatchRateMeter({ matched, total }: MatchRateMeterProps) {
  const rate = total > 0 ? matched / total : 0;
  const pct = Math.round(rate * 100);
  const unmatched = Math.max(total - matched, 0);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
      <span className="text-sm font-semibold">Match rate</span>
      <span className="text-4xl leading-none font-extrabold tabular-nums text-primary dark:text-foreground">
        {pct}%
      </span>
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${matched} of ${total} reconciliation groups matched cleanly`}
      >
        {matched > 0 && (
          <div className="h-full bg-primary" style={{ flexGrow: matched }} />
        )}
        {unmatched > 0 && (
          <div
            className="h-full bg-brand-magenta"
            style={{ flexGrow: unmatched }}
          />
        )}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 rounded-sm bg-primary" />
          <span className="flex-1">Matched cleanly</span>
          <span className="font-bold tabular-nums">
            {matched.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 rounded-sm bg-brand-magenta" />
          <span className="flex-1">Not matched</span>
          <span className="font-bold tabular-nums">
            {unmatched.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
