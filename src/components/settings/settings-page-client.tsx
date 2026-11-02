'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { clearStoredExtracts } from '@/lib/extract-store';
import { useDataSources } from '@/lib/data-sources-context';
import { useDuplicateOverrides } from '@/lib/duplicate-overrides-context';
import { useNotificationState } from '@/lib/notification-state-context';
import {
  useAlertSettings,
  DEFAULT_HIGH_VALUE_THRESHOLD,
  DEFAULT_LOW_MATCH_RATE_THRESHOLD,
} from '@/lib/alert-settings-context';
import {
  UserIcon,
  ShieldIcon,
  BellIcon,
  PaletteIcon,
  CheckIcon,
  MonitorIcon,
  SunIcon,
  MoonIcon,
  Trash2Icon,
  RotateCcwIcon,
  DatabaseIcon,
} from 'lucide-react';

type TabId = 'profile' | 'data' | 'alerts' | 'appearance';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <UserIcon className="size-4" /> },
  {
    id: 'data',
    label: 'Data & Privacy',
    icon: <ShieldIcon className="size-4" />,
  },
  {
    id: 'alerts',
    label: 'Alert Thresholds',
    icon: <BellIcon className="size-4" />,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: <PaletteIcon className="size-4" />,
  },
];

// ── Profile Tab ──────────────────────────────────────────────────────────────
// Editable, but there's no backend yet — this persists to this browser's
// localStorage only, the same way every other piece of local app state does.

const PROFILE_STORAGE_KEY = 'netting-recon:profile:v1';

interface Profile {
  name: string;
  email: string;
  role: string;
}

const DEFAULT_PROFILE: Profile = {
  name: 'Christopher Munyau',
  email: 'christophert.munyau@gmail.com',
  role: 'Project Lead / Accountant — Payables',
};

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function ProfileTab() {
  const [profile, setProfile] = React.useState<Profile>(DEFAULT_PROFILE);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) });
    } catch {
      // Fall back to the default profile.
    }
  }, []);

  function handleSave() {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Best effort — nothing else to fall back to for local-only state.
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Saved to this browser — there&apos;s no shared account store yet, so
          this won&apos;t follow you to another device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src="/avatars/user.jpg" alt={profile.name} />
            <AvatarFallback className="text-lg">
              {initials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{profile.name}</p>
            <p className="text-sm text-muted-foreground">{profile.role}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">
              Full Name
            </label>
            <Input
              id="name"
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="role">
              Role
            </label>
            <Input
              id="role"
              value={profile.role}
              onChange={(e) =>
                setProfile((p) => ({ ...p, role: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckIcon className="size-3.5" />
              Saved
            </span>
          )}
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Data & Privacy Tab ───────────────────────────────────────────────────────
// Replaces the template's fake password/2FA/session-management screens —
// none of that applies to a tool with no real accounts yet. What's real:
// everything this app knows lives in this browser's localStorage, and this
// tab says exactly what's stored and lets a reviewer clear it.

function DataTab() {
  const { filesBySource, clearSource } = useDataSources();
  const { dismissed: dismissedDuplicates, restore } = useDuplicateOverrides();
  const { dismissed: dismissedNotifications } = useNotificationState();
  const [confirming, setConfirming] = React.useState(false);

  const totalFiles = Object.values(filesBySource).reduce(
    (s, files) => s + files.length,
    0
  );
  const totalRows = Object.values(filesBySource).reduce(
    (s, files) => s + files.reduce((rs, f) => rs + f.rowCount, 0),
    0
  );

  const stores = [
    {
      label: 'Uploaded extracts',
      detail:
        totalFiles === 0
          ? 'None uploaded yet'
          : `${totalFiles} file${totalFiles === 1 ? '' : 's'}, ${totalRows.toLocaleString()} record${totalRows === 1 ? '' : 's'}`,
    },
    {
      label: 'Duplicate review decisions',
      detail: `${dismissedDuplicates.size} group${dismissedDuplicates.size === 1 ? '' : 's'} marked not-a-duplicate`,
    },
    {
      label: 'Notification read/dismissed state',
      detail: `${dismissedNotifications.size} dismissed`,
    },
    {
      label: 'Profile & appearance preferences',
      detail: 'Name, role, theme choice',
    },
  ];

  async function clearEverything() {
    for (const source of Object.keys(
      filesBySource
    ) as (keyof typeof filesBySource)[]) {
      clearSource(source);
    }
    try {
      window.localStorage.removeItem(PROFILE_STORAGE_KEY);
      window.localStorage.removeItem('netting-recon:duplicate-overrides:v1');
      window.localStorage.removeItem('netting-recon:notifications-seen:v1');
      window.localStorage.removeItem(
        'netting-recon:notifications-dismissed:v1'
      );
      window.localStorage.removeItem('netting-recon:alert-settings:v1');
    } catch {
      // Best effort.
    }
    // Wait for the extracts to be deleted before reloading, or the reload
    // can race the (asynchronous) IndexedDB delete and bring them back.
    await clearStoredExtracts().catch(() => {});
    setConfirming(false);
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Where your data lives</CardTitle>
          <CardDescription>
            This app runs in demo mode while live D365 / Prism access is being
            provisioned — everything below is stored only in this browser&apos;s
            local storage, never sent to a server (the AI Assistant is the one
            exception: the reconciliation context you ask it about is sent to
            whichever provider you&apos;ve configured).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {stores.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                  <DatabaseIcon className="size-4" />
                </div>
                <span className="font-medium">{s.label}</span>
              </div>
              <span className="text-muted-foreground">{s.detail}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duplicate review overrides</CardTitle>
          <CardDescription>
            Groups you&apos;ve confirmed as genuinely separate transactions are
            excluded from future duplicate flags. Restore them here if you want
            a fresh review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dismissedDuplicates.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              No overrides recorded.
            </p>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {dismissedDuplicates.size} group
                {dismissedDuplicates.size === 1 ? '' : 's'} overridden
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => dismissedDuplicates.forEach((id) => restore(id))}
              >
                <RotateCcwIcon className="size-3.5" />
                Restore all for re-review
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">
            Clear local app data
          </CardTitle>
          <CardDescription>
            Removes every uploaded extract and preference stored in this browser
            and reloads the app. This can&apos;t be undone — it doesn&apos;t
            touch your source files, only what&apos;s been uploaded here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirming ? (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium">
                Clear everything? This can&apos;t be undone.
              </p>
              <Button variant="destructive" size="sm" onClick={clearEverything}>
                Yes, clear it all
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              <Trash2Icon className="size-3.5" />
              Clear local app data
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Alert Thresholds Tab ─────────────────────────────────────────────────────
// Genuinely wired to the notification engine (src/lib/notifications.ts) —
// changing these changes what shows up in the bell dropdown and /notifications.

function AlertsTab() {
  const {
    highValueThreshold,
    lowMatchRateThreshold,
    setHighValueThreshold,
    setLowMatchRateThreshold,
    resetDefaults,
  } = useAlertSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Thresholds</CardTitle>
        <CardDescription>
          Controls when the app raises a notification — these feed directly into
          the bell icon and the Notifications page, not a separate preferences
          list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="high-value">
            High-value exception threshold
          </label>
          <p className="text-sm text-muted-foreground">
            Unmatched exceptions at or above this amount get called out as
            high-value and worth reviewing first.
          </p>
          <div className="flex items-center gap-2">
            <Input
              id="high-value"
              type="number"
              min={0}
              step={100}
              value={highValueThreshold}
              onChange={(e) => setHighValueThreshold(e.target.valueAsNumber)}
              className="max-w-40"
            />
            {highValueThreshold !== DEFAULT_HIGH_VALUE_THRESHOLD && (
              <Badge variant="secondary">
                default {DEFAULT_HIGH_VALUE_THRESHOLD.toLocaleString()}
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="match-rate">
            Low match-rate warning
          </label>
          <p className="text-sm text-muted-foreground">
            If the overall match rate falls below this percentage, you&apos;ll
            get a system notification suggesting you check that sources cover
            the same period.
          </p>
          <div className="flex items-center gap-2">
            <Input
              id="match-rate"
              type="number"
              min={0}
              max={100}
              step={5}
              value={Math.round(lowMatchRateThreshold * 100)}
              onChange={(e) =>
                setLowMatchRateThreshold((e.target.valueAsNumber || 0) / 100)
              }
              className="max-w-40"
            />
            <span className="text-sm text-muted-foreground">%</span>
            {Math.round(lowMatchRateThreshold * 100) !==
              Math.round(DEFAULT_LOW_MATCH_RATE_THRESHOLD * 100) && (
              <Badge variant="secondary">
                default {Math.round(DEFAULT_LOW_MATCH_RATE_THRESHOLD * 100)}%
              </Badge>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={resetDefaults}>
            <RotateCcwIcon className="size-3.5" />
            Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const themes: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <SunIcon className="size-5" /> },
    { id: 'dark', label: 'Dark', icon: <MoonIcon className="size-5" /> },
    { id: 'system', label: 'System', icon: <MonitorIcon className="size-5" /> },
  ];

  if (!mounted) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how the app looks on this device
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-6 transition-all hover:bg-muted/50',
                theme === t.id
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border'
              )}
            >
              {t.icon}
              <span className="text-sm font-medium">{t.label}</span>
              {theme === t.id && <CheckIcon className="size-4 text-primary" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Settings Page ───────────────────────────────────────────────────────

export function SettingsPageClient() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState<TabId>(
    tabs.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'profile'
  );

  const tabContent: Record<TabId, React.ReactNode> = {
    profile: <ProfileTab />,
    data: <DataTab />,
    alerts: <AlertsTab />,
    appearance: <AppearanceTab />,
  };

  return (
    <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Left nav (desktop) */}
      <nav className="hidden w-52 shrink-0 flex-col gap-1 lg:flex">
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

      {/* Mobile tab bar */}
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

      {/* Content — full width */}
      <div className="min-w-0 flex-1">{tabContent[activeTab]}</div>
    </div>
  );
}
