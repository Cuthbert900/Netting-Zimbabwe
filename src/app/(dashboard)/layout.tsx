import { AppSidebar } from '@/components/app-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { DynamicBreadcrumb } from '@/components/dynamic-breadcrumb';
import { ThemeToggle } from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { AiUsageProvider } from '@/lib/ai-usage-context';
import { AlertSettingsProvider } from '@/lib/alert-settings-context';
import { DataSourcesProvider } from '@/lib/data-sources-context';
import { DuplicateOverridesProvider } from '@/lib/duplicate-overrides-context';
import { NotificationStateProvider } from '@/lib/notification-state-context';
import { ReconciliationProvider } from '@/lib/reconciliation-context';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { IdleSessionTimeout } from '@/components/idle-session-timeout';

// The signed-in user's email is read fresh per request (proxy.ts is what
// actually enforces "must be signed in" — this just displays who it is),
// so this can't be statically rendered/cached across visitors.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts already redirected anyone without a session before this
  // layout ever renders, so `user` here is expected to be non-null — this
  // fallback is just for the not-configured-yet / local-dev-without-auth
  // case rather than a real auth gate (that's proxy.ts's job).
  let email = 'signed-in-user@unknown';
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) email = user.email;
  }

  return (
    <DataSourcesProvider>
      <DuplicateOverridesProvider>
        <AlertSettingsProvider>
          <AiUsageProvider>
            <NotificationStateProvider>
              <ReconciliationProvider>
                <SidebarProvider>
                  <IdleSessionTimeout redirectTo="/sign-in" />
                  <AppSidebar user={{ email, displayName: null }} />
                  <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2">
                      <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                          orientation="vertical"
                          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                        />
                        <DynamicBreadcrumb />
                      </div>
                      <div className="ml-auto flex items-center gap-2 pr-4">
                        <kbd className="pointer-events-none hidden h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                          <span className="text-xs">⌘</span>K
                        </kbd>
                        <ThemeToggle />
                      </div>
                    </header>
                    <CommandPalette />
                    <main className="flex flex-1 flex-col">{children}</main>
                  </SidebarInset>
                </SidebarProvider>
              </ReconciliationProvider>
            </NotificationStateProvider>
          </AiUsageProvider>
        </AlertSettingsProvider>
      </DuplicateOverridesProvider>
    </DataSourcesProvider>
  );
}
