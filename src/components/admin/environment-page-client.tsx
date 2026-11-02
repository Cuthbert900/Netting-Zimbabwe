'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  KeyRoundIcon,
  CheckCircle2Icon,
  CircleIcon,
  Loader2Icon,
  SaveIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { setProviderKey, clearProviderKey } from '@/lib/admin/actions';

export interface ProviderKeyStatus {
  providerId: string;
  label: string;
  configuredInDb: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /** true when no DB row exists but the provider's own env var is set —
   * the app still works (providers.ts falls back to it), this just tells
   * the admin the key isn't actually coming from here. */
  envFallbackConfigured: boolean;
  envKey: string;
}

function ProviderRow({ status }: { status: ProviderKeyStatus }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await setProviderKey(status.providerId, value);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save');
      return;
    }
    setValue('');
  }

  async function handleClear() {
    setClearing(true);
    setError(null);
    const result = await clearProviderKey(status.providerId);
    setClearing(false);
    if (!result.ok) setError(result.error ?? 'Failed to clear');
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <KeyRoundIcon className="size-4 text-primary" />
            {status.label}
          </CardTitle>
          {status.configuredInDb ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <CheckCircle2Icon className="size-3 text-emerald-600 dark:text-emerald-400" />
              Configured
            </Badge>
          ) : status.envFallbackConfigured ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <CircleIcon className="size-3 text-blue-600 dark:text-blue-400" />
              Using env var
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="gap-1 font-normal text-muted-foreground"
            >
              <CircleIcon className="size-3" />
              Not set
            </Badge>
          )}
        </div>
        <CardDescription>
          {status.configuredInDb && status.maskedKey ? (
            <>
              Current: <code className="text-xs">{status.maskedKey}</code>
              {status.updatedAt && (
                <>
                  {' '}
                  — updated{' '}
                  {formatDistanceToNow(new Date(status.updatedAt), {
                    addSuffix: true,
                  })}
                  {status.updatedBy ? ` by ${status.updatedBy}` : ''}
                </>
              )}
            </>
          ) : status.envFallbackConfigured ? (
            <>
              No key stored here — falling back to the{' '}
              <code className="text-xs">{status.envKey}</code> environment
              variable.
            </>
          ) : (
            <>
              Set a key below, or the {status.envKey} environment variable, to
              enable this provider.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder={
              status.configuredInDb
                ? 'Replace with a new key…'
                : 'Paste API key…'
            }
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !value.trim()}
          >
            {saving ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            Save
          </Button>
          {status.configuredInDb && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClear}
              disabled={clearing}
            >
              {clearing ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <Trash2Icon className="size-3.5" />
              )}
              Clear
            </Button>
          )}
        </div>
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function EnvironmentPageClient({
  statuses,
}: {
  statuses: ProviderKeyStatus[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Environment</h1>
        <p className="text-sm text-muted-foreground">
          AI provider API keys. A key set here overrides that provider&apos;s
          environment variable — everything the AI Assistant, AI Summary, and
          Reports narrative call through{' '}
          <code className="text-xs">/api/chat</code> checks here first. Every
          change is written to the audit log.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {statuses.map((s) => (
          <ProviderRow key={s.providerId} status={s} />
        ))}
      </div>
    </div>
  );
}
