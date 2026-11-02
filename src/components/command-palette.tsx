'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboardIcon,
  UploadIcon,
  ArrowLeftRightIcon,
  CreditCardIcon,
  ChartAreaIcon,
  TargetIcon,
  SettingsIcon,
  BellIcon,
  LogInIcon,
  UserPlusIcon,
  LifeBuoyIcon,
  SearchIcon,
  MoonIcon,
  SunIcon,
  MonitorIcon,
  GaugeIcon,
  FileTextIcon,
  ShieldIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { recentTransactions } from '@/data/seed';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search pages, transactions, contacts, and more"
    >
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {[
              {
                label: 'Dashboard',
                icon: LayoutDashboardIcon,
                href: '/dashboard',
              },
              {
                label: 'Data Sources',
                icon: UploadIcon,
                href: '/data-sources',
              },
              {
                label: 'Matches',
                icon: ArrowLeftRightIcon,
                href: '/transactions',
              },
              { label: 'Exceptions', icon: CreditCardIcon, href: '/cards' },
              { label: 'Reports', icon: FileTextIcon, href: '/reports' },
              { label: 'Analytics', icon: ChartAreaIcon, href: '/analytics' },
              {
                label: 'AI Assistant',
                icon: TargetIcon,
                href: '/ai-assistant',
              },
              { label: 'AI Usage', icon: GaugeIcon, href: '/ai-usage' },
              { label: 'Settings', icon: SettingsIcon, href: '/settings' },
              {
                label: 'Notifications',
                icon: BellIcon,
                href: '/notifications',
              },
              { label: 'Help & Support', icon: LifeBuoyIcon, href: '/support' },
              { label: 'Admin', icon: ShieldIcon, href: '/admin' },
              { label: 'Sign In', icon: LogInIcon, href: '/sign-in' },
              { label: 'Sign Up', icon: UserPlusIcon, href: '/sign-up' },
            ].map((page) => (
              <CommandItem
                key={page.href}
                onSelect={() => run(() => router.push(page.href))}
              >
                <page.icon className="mr-2 size-4" />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Recent Matches">
            {recentTransactions.slice(0, 5).map((tx) => (
              <CommandItem
                key={tx.id}
                onSelect={() => run(() => router.push('/transactions'))}
              >
                <SearchIcon className="mr-2 size-4" />
                {tx.merchant}
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => run(() => setTheme('light'))}>
              <SunIcon className="mr-2 size-4" />
              Light Mode
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme('dark'))}>
              <MoonIcon className="mr-2 size-4" />
              Dark Mode
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme('system'))}>
              <MonitorIcon className="mr-2 size-4" />
              System Theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
