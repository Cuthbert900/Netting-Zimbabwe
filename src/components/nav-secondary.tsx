'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useAppNotifications,
  type DisplayNotification,
} from '@/lib/use-app-notifications';
import {
  UploadIcon,
  AlertTriangleIcon,
  CopyIcon,
  ActivityIcon,
  XIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationType } from '@/lib/notifications';

const iconMap: Record<NotificationType, React.ReactNode> = {
  upload: <UploadIcon className="size-3.5" />,
  exception: <AlertTriangleIcon className="size-3.5" />,
  duplicate: <CopyIcon className="size-3.5" />,
  system: <ActivityIcon className="size-3.5" />,
};

const typeColor: Record<NotificationType, string> = {
  upload: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  exception: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  duplicate:
    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  system:
    'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
};

function NotificationItem({
  notification,
  onOpen,
  onDismiss,
}: {
  notification: DisplayNotification;
  onOpen: () => void;
  onDismiss: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      href={notification.href}
      onClick={onOpen}
      className={cn(
        'group flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/50',
        !notification.read && 'bg-muted/50'
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
          typeColor[notification.type]
        )}
      >
        {iconMap[notification.type]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-xs',
              !notification.read ? 'font-semibold' : 'font-medium'
            )}
          >
            {notification.title}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {!notification.read && (
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-500" />
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="rounded p-0.5 text-muted-foreground/50 opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
              title="Dismiss"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {notification.description}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/60">
          {formatDistanceToNow(new Date(notification.timestamp), {
            addSuffix: true,
          })}
        </p>
      </div>
    </Link>
  );
}

function NotificationDropdown({ icon }: { icon: React.ReactNode }) {
  const { notifications, unreadCount, markSeen, markAllRead, dismiss } =
    useAppNotifications();
  const latest = notifications.slice(0, 6);

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) markAllRead();
      }}
    >
      <PopoverTrigger
        render={<SidebarMenuButton size="sm" className="relative" />}
      >
        {icon}
        <span className="flex-1">Notifications</span>
        {unreadCount > 0 && (
          <span className="flex size-4.5 items-center justify-center rounded-full bg-brand-magenta text-[10px] font-semibold leading-none text-brand-magenta-foreground tabular-nums">
            {unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-80 p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {latest.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nothing to review right now — you&apos;re all caught up.
            </p>
          ) : (
            latest.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onOpen={() => markSeen(n.id)}
                onDismiss={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dismiss(n.id);
                }}
              />
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Link
            href="/notifications"
            className="flex items-center justify-center rounded-md py-1.5 text-xs font-medium text-primary hover:bg-muted transition-colors"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: React.ReactNode;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname();
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem
              key={item.title}
              data-active={pathname === item.url}
            >
              {item.title === 'Notifications' ? (
                <NotificationDropdown icon={item.icon} />
              ) : (
                <SidebarMenuButton
                  size="sm"
                  render={<Link href={item.url} />}
                  isActive={pathname === item.url}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
