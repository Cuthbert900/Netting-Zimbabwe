import { Suspense } from 'react';
import { AlertTriangleIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AdminLoginForm } from '@/components/admin/login-form';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertTriangleIcon className="size-8 text-amber-600 dark:text-amber-400" />
            <p className="font-medium">Admin backend not configured yet</p>
            <p className="text-sm text-muted-foreground">
              This deployment doesn&apos;t have NEXT_PUBLIC_SUPABASE_URL /
              NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY set. See{' '}
              <code className="text-xs">terraform/README.md</code> to stand up
              the self-hosted Supabase instance this depends on.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
