import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GitCompareIcon } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4 text-center">
      <div className="bg-brand-gradient flex size-16 items-center justify-center rounded-2xl text-white">
        <GitCompareIcon className="size-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tabular-nums">404</h1>
        <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      </div>
      <Button render={<Link href="/dashboard" />}>Back to Dashboard</Button>
    </div>
  );
}
