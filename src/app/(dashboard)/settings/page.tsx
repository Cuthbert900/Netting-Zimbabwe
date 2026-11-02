import { PageHeader } from '@/components/page-header';
import { Suspense } from 'react';
import { SettingsPageClient } from '@/components/settings/settings-page-client';

export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PageHeader
        title="Settings"
        description="Profile, privacy, alert thresholds and appearance."
      />
      <Suspense>
        <SettingsPageClient />
      </Suspense>
    </div>
  );
}
