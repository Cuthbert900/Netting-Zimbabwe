'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  LandmarkIcon,
  BuildingIcon,
  TrendingUpIcon,
  LayersIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { useDataSources } from '@/lib/data-sources-context';
import { useReconciliation } from '@/lib/reconciliation-context';
import { normalizeExtract } from '@/lib/normalization';
import { identifyBank } from '@/lib/bank-logos';
import { cn } from '@/lib/utils';

interface SourceCard {
  id: string;
  label: string;
  sublabel: string;
  value: number;
  count: number;
  style: string;
  logo: string | null;
  icon: React.ReactNode;
}

export function BankSourceCards() {
  const { filesBySource } = useDataSources();
  const result = useReconciliation();

  const cards = useMemo<SourceCard[]>(() => {
    const out: SourceCard[] = [];

    if (filesBySource.dynamics.length > 0) {
      out.push({
        id: 'dynamics',
        label: 'Dynamics 365',
        sublabel: `${filesBySource.dynamics.length} extract${filesBySource.dynamics.length > 1 ? 's' : ''}`,
        value: result.totalsBySource.dynamics.amount,
        count: result.totalsBySource.dynamics.count,
        style: 'text-white',
        logo: null,
        icon: <LayersIcon className="size-5 opacity-40" />,
      });
    }
    if (filesBySource.prism.length > 0) {
      out.push({
        id: 'prism',
        label: 'Prism BSS',
        sublabel: `${filesBySource.prism.length} extract${filesBySource.prism.length > 1 ? 's' : ''}`,
        value: result.totalsBySource.prism.amount,
        count: result.totalsBySource.prism.count,
        style: 'text-white',
        logo: null,
        icon: <BuildingIcon className="size-5 opacity-40" />,
      });
    }

    const byBank = new Map<
      string,
      {
        label: string;
        logo: string | null;
        value: number;
        count: number;
        files: number;
      }
    >();
    for (const file of filesBySource.bank) {
      const bank = identifyBank(file.fileName);
      const normalized = normalizeExtract(file);
      const value = normalized.reduce((s, r) => s + (r.amount ?? 0), 0);
      const entry = byBank.get(bank.key) ?? {
        label: bank.label,
        logo: bank.logo,
        value: 0,
        count: 0,
        files: 0,
      };
      entry.value += value;
      entry.count += normalized.length;
      entry.files += 1;
      byBank.set(bank.key, entry);
    }
    for (const [key, entry] of byBank) {
      out.push({
        id: `bank-${key}`,
        label: entry.label,
        sublabel: `${entry.files} statement${entry.files > 1 ? 's' : ''}`,
        value: entry.value,
        count: entry.count,
        style: 'bg-card text-card-foreground ring-1 ring-border',
        logo: entry.logo,
        icon: <LandmarkIcon className="size-5 opacity-30" />,
      });
    }

    return out;
  }, [filesBySource, result]);

  const [order, setOrder] = useState<number[]>([]);
  useEffect(() => {
    setOrder(cards.map((_, i) => i));
  }, [cards.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const cycle = useCallback(() => {
    setOrder((prev) => {
      if (prev.length < 2) return prev;
      const next = [...prev];
      const front = next.pop()!;
      next.unshift(front);
      return next;
    });
  }, []);

  useEffect(() => {
    if (order.length < 2) return;
    const id = setInterval(cycle, 2600);
    return () => clearInterval(id);
  }, [cycle, order.length]);

  const matchRate =
    result.groups.length > 0
      ? result.summary.matched / result.groups.length
      : 0;
  const totalReconciled = result.summary.matchedValue;

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
          No source extracts uploaded yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div className="relative h-[152px]">
          {order.map((cardIndex, stackPos) => {
            const c = cards[cardIndex];
            if (!c) return null;
            const isFront = stackPos === order.length - 1;
            const maxOffset = 48 / Math.max(order.length - 1, 1);
            const gradientStyle: React.CSSProperties =
              c.id === 'dynamics'
                ? {
                    background:
                      'linear-gradient(135deg, var(--data-dynamics), color-mix(in oklab, var(--data-dynamics) 70%, black))',
                  }
                : c.id === 'prism'
                  ? {
                      background:
                        'linear-gradient(135deg, var(--data-prism), color-mix(in oklab, var(--data-prism) 70%, black))',
                    }
                  : {};
            return (
              <motion.button
                key={c.id}
                onClick={cycle}
                layout
                animate={{
                  y: stackPos * Math.min(maxOffset, 16),
                  scale:
                    1 -
                    (order.length - 1 - stackPos) *
                      (0.12 / Math.max(order.length - 1, 1)),
                  zIndex: stackPos,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                style={gradientStyle}
                className={cn(
                  'absolute inset-x-0 flex h-[152px] cursor-pointer flex-col justify-between rounded-2xl px-5 py-4 text-left',
                  c.style,
                  isFront ? 'shadow-xl' : 'shadow-md'
                )}
              >
                <div className="flex items-center justify-between">
                  {c.logo ? (
                    <div className="flex h-7 items-center rounded-md bg-white/90 px-2 py-1">
                      <Image
                        src={c.logo}
                        alt={c.label}
                        width={72}
                        height={20}
                        className="h-4 w-auto object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <span className="text-sm font-semibold tracking-wide">
                      {c.label}
                    </span>
                  )}
                  {c.icon}
                </div>
                <div>
                  <p className="text-xs opacity-60">
                    {c.logo ? c.label : c.sublabel}
                  </p>
                  <p className="text-[10px] opacity-40">
                    {c.logo ? c.sublabel : null}
                  </p>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-[10px] font-medium tracking-widest opacity-40">
                    {c.count} records
                  </span>
                  <p className="text-xl font-bold tabular-nums tracking-tight">
                    {c.value.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {cards.length} source{cards.length > 1 ? 's' : ''} loaded
          </span>
          <span>Tap to cycle</span>
        </div>

        <div className="space-y-1.5 border-t pt-5">
          <p className="text-xs font-medium text-muted-foreground">
            Total Matched Value
          </p>
          <p className="text-3xl font-bold tabular-nums tracking-tight">
            {totalReconciled.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <TrendingUpIcon className="size-4" />
            <span>{Math.round(matchRate * 100)}% match rate</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
