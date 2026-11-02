'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  KeyRoundIcon,
  UsersIcon,
  ScrollTextIcon,
  LogOutIcon,
  ShieldIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOutAdmin } from '@/lib/admin/actions';

const NAV = [
  { href: '/admin/environment', label: 'Environment', icon: KeyRoundIcon },
  { href: '/admin/users', label: 'Users', icon: UsersIcon },
  { href: '/admin/audit', label: 'Audit', icon: ScrollTextIcon },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldIcon className="size-4 text-primary" />
          Admin
        </div>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{email}</span>
        <form action={signOutAdmin}>
          <Button variant="ghost" size="sm" type="submit">
            <LogOutIcon className="size-3.5" />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
