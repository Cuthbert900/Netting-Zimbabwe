'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  faqItems,
  teamContacts,
  projectStatus,
  type FaqCategory,
  type ProjectStatusState,
} from '@/lib/support-content';
import {
  SearchIcon,
  ChevronDownIcon,
  BookOpenIcon,
  MessageSquarePlusIcon,
  ActivityIcon,
  MailIcon,
  UploadIcon,
  GitCompareIcon,
  CopyIcon,
  LockIcon,
  SparklesIcon,
  HelpCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CircleDashedIcon,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = 'faq' | 'contact' | 'status';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'faq', label: 'FAQ', icon: <BookOpenIcon className="size-4" /> },
  {
    id: 'contact',
    label: 'Contact',
    icon: <MessageSquarePlusIcon className="size-4" />,
  },
  {
    id: 'status',
    label: 'Project Status',
    icon: <ActivityIcon className="size-4" />,
  },
];

const categoryIcons: Record<FaqCategory, React.ReactNode> = {
  'data-sources': <UploadIcon className="size-3.5" />,
  matching: <GitCompareIcon className="size-3.5" />,
  duplicates: <CopyIcon className="size-3.5" />,
  privacy: <LockIcon className="size-3.5" />,
  ai: <SparklesIcon className="size-3.5" />,
  general: <HelpCircleIcon className="size-3.5" />,
};

const categoryColors: Record<FaqCategory, string> = {
  'data-sources': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  matching: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  duplicates: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  privacy: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  ai: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  general: 'bg-muted text-muted-foreground',
};

const categoryLabels: Record<FaqCategory, string> = {
  'data-sources': 'Data Sources',
  matching: 'Matching',
  duplicates: 'Duplicates',
  privacy: 'Privacy',
  ai: 'AI Assistant',
  general: 'General',
};

// ── FAQ Tab ──────────────────────────────────────────────────────────────────

const categoryFilters: (FaqCategory | 'all')[] = [
  'all',
  'data-sources',
  'matching',
  'duplicates',
  'privacy',
  'ai',
  'general',
];

function FaqTab() {
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<
    FaqCategory | 'all'
  >('all');
  const [openId, setOpenId] = React.useState<string | null>(null);

  const filtered = faqItems.filter((item) => {
    const matchesSearch =
      !search ||
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Search + category pills */}
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search for answers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categoryFilters.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              {cat === 'all' ? 'All Topics' : categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ List */}
      <Card>
        <CardContent className="p-0">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
              >
                <SearchIcon className="size-10 opacity-30" />
                <p className="text-sm font-medium">No matching questions</p>
                <p className="text-xs">
                  Try a different search term or category
                </p>
              </motion.div>
            ) : (
              filtered.map((item, i) => {
                const isOpen = openId === item.id;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15, delay: i * 0.02 }}
                    className="border-b last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
                          categoryColors[item.category]
                        )}
                      >
                        {categoryIcons[item.category]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm',
                            isOpen ? 'font-semibold' : 'font-medium'
                          )}
                        >
                          {item.question}
                        </p>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {item.answer}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-0.5 shrink-0"
                      >
                        <ChevronDownIcon className="size-4 text-muted-foreground" />
                      </motion.div>
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Contact Tab ──────────────────────────────────────────────────────────────
// Real people, real mailto links — no fake live-chat bot or ticket form
// promising a backend that doesn't exist yet.

function ContactTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Get in touch</CardTitle>
          <CardDescription>
            There&apos;s no support queue yet — for now, reach the project team
            directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamContacts.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {c.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')}
                </div>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.role}</p>
                </div>
              </div>
              {c.email ? (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={`mailto:${c.email}`} />}
                >
                  <MailIcon className="size-3.5" />
                  Email
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  via {teamContacts[0].name.split(' ')[0]}
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Found a bug or have a feature request?</CardTitle>
          <CardDescription>
            This app is under active development. Backlog and in-progress work
            is tracked in the NAZ project on Jira (Netting Automation ZW) —
            email the project lead above and it'll get logged.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// ── Project Status Tab ───────────────────────────────────────────────────────
// Real build status, mirroring the README — not a fake uptime dashboard.

const stateConfig: Record<
  ProjectStatusState,
  { label: string; icon: React.ReactNode; className: string }
> = {
  done: {
    label: 'Done',
    icon: <CheckCircle2Icon className="size-3.5" />,
    className:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  'in-progress': {
    label: 'In Progress',
    icon: <ClockIcon className="size-3.5" />,
    className:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  blocked: {
    label: 'Blocked',
    icon: <CircleDashedIcon className="size-3.5" />,
    className: 'bg-muted text-muted-foreground border-border',
  },
};

function StatusTab() {
  const doneCount = projectStatus.filter((s) => s.state === 'done').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2Icon className="size-7" />
          </div>
          <div>
            <p className="text-lg font-semibold">Active build</p>
            <p className="text-sm text-muted-foreground">
              Answers about how this app works, who to contact, and what's built
              so far
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Build status by area</CardTitle>
          <CardDescription>
            What's working today, and what's still ahead
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {projectStatus.map((item, i) => {
            const cfg = stateConfig[item.state];
            return (
              <motion.div
                key={item.area}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.area}</p>
                  <p className="text-xs text-muted-foreground">{item.note}</p>
                </div>
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                    cfg.className
                  )}
                >
                  {cfg.icon}
                  {cfg.label}
                </span>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function SupportPageClient() {
  const [activeTab, setActiveTab] = React.useState<TabId>('faq');

  const tabContent: Record<TabId, React.ReactNode> = {
    faq: <FaqTab />,
    contact: <ContactTab />,
    status: <StatusTab />,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-primary dark:text-foreground">
          Help & Support
        </h1>
        <p className="text-sm text-muted-foreground">
          Answers about how this app works, who to contact, and what's built so
          far
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <div className="flex shrink-0 flex-col gap-4 lg:w-52">
          <nav className="hidden flex-col gap-1 lg:flex">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'justify-start gap-2',
                  activeTab === tab.id && 'font-semibold'
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </Button>
            ))}
          </nav>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 lg:hidden">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                size="sm"
                className="shrink-0 gap-1.5 text-xs"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">{tabContent[activeTab]}</div>
      </div>
    </div>
  );
}
