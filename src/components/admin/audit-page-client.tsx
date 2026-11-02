'use client';

import { formatDistanceToNow } from 'date-fns';
import { ScrollTextIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface AuditRow {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  target: string | null;
  details: Record<string, unknown> | null;
}

const ACTION_LABELS: Record<string, string> = {
  'provider_key.set': 'Set provider key',
  'provider_key.cleared': 'Cleared provider key',
  'user.created': 'Created user',
  'user.role_changed': 'Changed role',
  'user.removed': 'Removed user',
  'admin.signed_out': 'Signed out',
};

export function AuditPageClient({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit</h1>
        <p className="text-sm text-muted-foreground">
          Every admin action — key changes, user/role changes, sign-ins and
          sign-outs — append-only, newest first. This covers the admin surface,
          not ordinary app usage: uploading extracts and reviewing exceptions
          stay anonymous per browser until every user, not just admins, signs in
          through Entra ID.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ScrollTextIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">No admin actions yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              This fills in as soon as a key is set, a user is added, or a role
              changes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">
              {rows.length} recorded action{rows.length === 1 ? '' : 's'}
            </CardTitle>
            <CardDescription>
              Showing up to the 200 most recent.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(row.occurred_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.actor_name || row.actor_email || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ACTION_LABELS[row.action] ?? row.action}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.target ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
