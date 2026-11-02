import { redirect } from 'next/navigation';
import { ShieldAlertIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { verifySession, type AppUser } from '@/lib/admin/dal';
import { createAdminClient } from '@/lib/supabase/admin';
import { signOutAdmin } from '@/lib/admin/actions';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export default async function NotAuthorizedPage() {
  if (!isSupabaseConfigured()) {
    redirect('/admin/login');
  }
  const user = await verifySession();
  const admin = createAdminClient();
  const { data: appUser } = await admin
    .from('app_users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<AppUser>();

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <ShieldAlertIcon className="size-8 text-destructive" />
          <p className="font-medium">Not an admin account</p>
          <p className="text-sm text-muted-foreground">
            {user.email} is signed in{appUser ? ` as "${appUser.role}"` : ''},
            but Environment, Users, and Audit need the admin role. Ask an
            existing admin to change it on the Users page.
          </p>
          <form action={signOutAdmin}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
