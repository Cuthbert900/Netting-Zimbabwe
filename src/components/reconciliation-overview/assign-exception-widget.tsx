'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useReconciliation } from '@/lib/reconciliation-context';
import { formatMoney } from '@/components/matches/match-status-badge';
import { SOURCE_LABELS } from '@/lib/data-sources-context';
import {
  ChevronRightIcon,
  SendIcon,
  LoaderCircleIcon,
  CheckCircle2Icon,
  SearchIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type SendState = 'idle' | 'sending' | 'success';

const REVIEWERS = [
  { id: 'cm', name: 'Christopher Munyau', initials: 'CM' },
  { id: 'cu', name: 'Cuthbert Musengi', initials: 'CU' },
];

export function AssignExceptionWidget() {
  const result = useReconciliation();
  const [selectedReviewer, setSelectedReviewer] = useState(REVIEWERS[0].id);
  const [sendState, setSendState] = useState<SendState>('idle');

  const priorityExceptions = useMemo(
    () =>
      result.groups
        .filter((g) => g.status === 'investigate' || g.status === 'mispost')
        .sort((a, b) => b.amount - a.amount),
    [result.groups]
  );
  const [cursor, setCursor] = useState(0);
  const target =
    priorityExceptions[cursor % Math.max(priorityExceptions.length, 1)];
  const selected = REVIEWERS.find((r) => r.id === selectedReviewer);

  const handleAssign = () => {
    if (sendState !== 'idle' || !target) return;
    setSendState('sending');
    setTimeout(() => {
      setSendState('success');
      setTimeout(() => {
        setSendState('idle');
        setCursor((c) => c + 1);
      }, 1800);
    }, 1100);
  };

  if (!target) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">
            Assign Exception
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[140px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-6 text-emerald-500" />
          No open exceptions to assign right now
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">
          Assign Exception
        </CardTitle>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {priorityExceptions.length} open
          <ChevronRightIcon className="size-3" />
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reviewer avatars */}
        <div className="flex items-center gap-2">
          <div className="flex items-center py-2">
            {REVIEWERS.map((reviewer) => {
              const isSelected = selectedReviewer === reviewer.id;
              return (
                <motion.button
                  key={reviewer.id}
                  onClick={() =>
                    sendState === 'idle' && setSelectedReviewer(reviewer.id)
                  }
                  className="relative shrink-0 rounded-full"
                  animate={{
                    scale: isSelected ? 1.2 : 0.9,
                    marginLeft: isSelected ? 6 : -4,
                    marginRight: isSelected ? 6 : -4,
                    zIndex: isSelected ? 10 : 1,
                    opacity: isSelected ? 1 : 0.7,
                  }}
                  whileHover={{ scale: isSelected ? 1.2 : 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Avatar
                    className={
                      isSelected
                        ? 'size-11 ring-2 ring-primary ring-offset-2 ring-offset-background'
                        : 'size-10'
                    }
                  >
                    <AvatarFallback className="text-xs">
                      {reviewer.initials}
                    </AvatarFallback>
                  </Avatar>
                </motion.button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={selectedReviewer}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-xs text-muted-foreground"
          >
            Assigning to{' '}
            <span className="font-medium text-foreground">
              {selected?.name}
            </span>
          </motion.p>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {sendState === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-2 py-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                  delay: 0.1,
                }}
              >
                <CheckCircle2Icon className="size-10 text-emerald-500" />
              </motion.div>
              <p className="text-sm font-semibold">Assigned!</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(target.amount)} to {selected?.name}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-3"
            >
              <div className="flex-1 space-y-1.5 rounded-lg border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SearchIcon className="size-3" />
                  Priority exception
                </div>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(target.amount)}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {target.sources.map((s) => SOURCE_LABELS[s]).join(' · ')}
                </p>
              </div>
              <Button
                className="h-10 gap-2 px-6"
                disabled={sendState === 'sending'}
                onClick={handleAssign}
              >
                {sendState === 'sending' ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <SendIcon className="size-4" />
                )}
                {sendState === 'sending' ? 'Assigning...' : 'Assign'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
