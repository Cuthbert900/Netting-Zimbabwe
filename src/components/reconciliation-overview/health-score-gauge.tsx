'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import { useReconciliation } from '@/lib/reconciliation-context';
import { useDataSources } from '@/lib/data-sources-context';
import {
  HeartPulseIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CheckCircle2Icon,
  ClockIcon,
  AlertTriangleIcon,
  DatabaseIcon,
} from 'lucide-react';

function getScoreGradient(score: number) {
  if (score >= 80)
    return { from: 'var(--status-good)', to: 'var(--status-good)' };
  if (score >= 60)
    return { from: 'var(--status-warning)', to: 'var(--status-warning)' };
  if (score >= 40)
    return { from: 'var(--status-serious)', to: 'var(--status-serious)' };
  return { from: 'var(--status-critical)', to: 'var(--status-critical)' };
}

function getScoreLabel(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs attention';
  return 'At risk';
}

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame>>(0);

  useEffect(() => {
    const duration = 1200;
    const startTime = performance.now();
    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    }
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  return <>{count}</>;
}

const GAUGE_W = 180;
const GAUGE_H = 110;
const ARC_R = 70;
const ARC_CX = GAUGE_W / 2;
const ARC_CY = 95;
const STROKE = 12;
const HALF_CIRC = Math.PI * ARC_R;

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const start = {
    x: cx + r * Math.cos((startAngle * Math.PI) / 180),
    y: cy + r * Math.sin((startAngle * Math.PI) / 180),
  };
  const end = {
    x: cx + r * Math.cos((endAngle * Math.PI) / 180),
    y: cy + r * Math.sin((endAngle * Math.PI) / 180),
  };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function ScoreGauge({ score }: { score: number }) {
  const { from, to } = getScoreGradient(score);
  const gradientId = 'recon-health-gauge-grad';
  const glowId = 'recon-health-gauge-glow';
  const trackPath = describeArc(ARC_CX, ARC_CY, ARC_R, -180, 0);
  const scoreDash = (score / 100) * HALF_CIRC;
  const scoreGap = HALF_CIRC - scoreDash;

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute top-0 h-[90px] w-[160px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(ellipse, ${from}18 0%, transparent 70%)`,
        }}
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <svg
        width={GAUGE_W}
        height={GAUGE_H}
        viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor={from} stopOpacity={0.35} />
            <stop offset="50%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={trackPath}
          fill="none"
          stroke="var(--color-muted-foreground)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          opacity={0.15}
        />
        <motion.path
          d={trackPath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${HALF_CIRC}`}
          initial={{ strokeDashoffset: HALF_CIRC }}
          animate={{ strokeDashoffset: scoreGap }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          filter={`url(#${glowId})`}
        />
        <text
          x={ARC_CX - ARC_R - 2}
          y={ARC_CY + 14}
          textAnchor="middle"
          className="fill-muted-foreground/40 text-[9px] tabular-nums"
        >
          0
        </text>
        <text
          x={ARC_CX}
          y={ARC_CY - ARC_R - 6}
          textAnchor="middle"
          className="fill-muted-foreground/40 text-[9px] tabular-nums"
        >
          50
        </text>
        <text
          x={ARC_CX + ARC_R + 2}
          y={ARC_CY + 14}
          textAnchor="middle"
          className="fill-muted-foreground/40 text-[9px] tabular-nums"
        >
          100
        </text>
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums tracking-tight">
          <AnimatedCounter target={score} />
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          {getScoreLabel(score)}
        </span>
      </div>
    </div>
  );
}

export function HealthScoreGauge() {
  const result = useReconciliation();
  const { filesBySource } = useDataSources();

  const factors = useMemo(() => {
    const total = result.groups.length;
    const matchRate = total > 0 ? result.summary.matched / total : 0;
    const timingRate = total > 0 ? 1 - result.summary.timing / total : 1;
    const mispostRate = total > 0 ? 1 - result.summary.mispost / total : 1;
    const sourcesLoaded = (['dynamics', 'prism', 'bank'] as const).filter(
      (s) => filesBySource[s].length > 0
    ).length;
    const coverage = sourcesLoaded / 3;

    type Status = 'good' | 'warning' | 'critical';
    const matchStatus: Status =
      matchRate >= 0.8 ? 'good' : matchRate >= 0.5 ? 'warning' : 'critical';
    const timingStatus: Status =
      timingRate >= 0.8 ? 'good' : timingRate >= 0.5 ? 'warning' : 'critical';
    const mispostStatus: Status =
      mispostRate >= 0.9 ? 'good' : mispostRate >= 0.7 ? 'warning' : 'critical';
    const coverageStatus: Status =
      coverage >= 1 ? 'good' : coverage >= 0.66 ? 'warning' : 'critical';

    return [
      {
        id: 'match',
        label: 'Match Rate',
        score: Math.round(matchRate * 100),
        icon: <CheckCircle2Icon className="size-4" />,
        status: matchStatus,
      },
      {
        id: 'timing',
        label: 'Timing Accuracy',
        score: Math.round(timingRate * 100),
        icon: <ClockIcon className="size-4" />,
        status: timingStatus,
      },
      {
        id: 'mispost',
        label: 'Mis-post Control',
        score: Math.round(mispostRate * 100),
        icon: <AlertTriangleIcon className="size-4" />,
        status: mispostStatus,
      },
      {
        id: 'coverage',
        label: 'Source Coverage',
        score: Math.round(coverage * 100),
        icon: <DatabaseIcon className="size-4" />,
        status: coverageStatus,
      },
    ];
  }, [result, filesBySource]);

  const overall = Math.round(
    factors.reduce((s, f) => s + f.score, 0) / factors.length
  );
  const prevOverallRef = useRef(overall);
  const trendDelta = overall - prevOverallRef.current;
  useEffect(() => {
    prevOverallRef.current = overall;
  }, [overall]);

  const statusColor: Record<
    'good' | 'warning' | 'critical',
    { text: string; bg: string; fill: string }
  > = {
    good: {
      text: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      fill: 'var(--status-good)',
    },
    warning: {
      text: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      fill: 'var(--status-warning)',
    },
    critical: {
      text: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-500/10',
      fill: 'var(--status-critical)',
    },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <HeartPulseIcon className="size-4 text-primary" />
          Reconciliation Health
        </CardTitle>
        <CardAction>
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              trendDelta >= 0
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            )}
          >
            {trendDelta >= 0 ? (
              <TrendingUpIcon className="size-3" />
            ) : (
              <TrendingDownIcon className="size-3" />
            )}
            {overall} / 100
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <ScoreGauge score={overall} />
          <div className="w-full space-y-1">
            {factors.map((factor, i) => {
              const cfg = statusColor[factor.status];
              return (
                <div
                  key={factor.id}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5"
                >
                  <div
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md',
                      cfg.bg,
                      cfg.text
                    )}
                  >
                    {factor.icon}
                  </div>
                  <span className="flex-1 truncate text-xs font-medium">
                    {factor.label}
                  </span>
                  <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: cfg.fill }}
                      initial={{ width: 0 }}
                      animate={{ width: `${factor.score}%` }}
                      transition={{ duration: 0.7, delay: 0.2 + i * 0.06 }}
                    />
                  </div>
                  <span className="w-8 text-right text-[11px] font-semibold tabular-nums">
                    {factor.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
