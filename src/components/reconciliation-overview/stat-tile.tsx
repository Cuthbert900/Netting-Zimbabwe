import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  subClassName?: string;
  variant?: 'default' | 'purple' | 'pink';
}

export function StatTile({
  label,
  value,
  sub,
  subClassName,
  variant = 'default',
}: StatTileProps) {
  const solid = variant !== 'default';

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-5',
        variant === 'purple' && 'border-brand bg-brand text-white',
        variant === 'pink' &&
          'border-brand-magenta bg-brand-magenta text-brand-magenta-foreground'
      )}
    >
      <div
        className={cn(
          'text-sm font-semibold',
          solid ? 'opacity-90' : 'text-muted-foreground'
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          'text-3xl font-extrabold tabular-nums',
          !solid && 'text-primary dark:text-foreground'
        )}
      >
        {value}
      </div>
      {sub && (
        <div
          className={cn(
            'truncate text-xs',
            solid ? 'opacity-90' : cn('text-muted-foreground', subClassName)
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
