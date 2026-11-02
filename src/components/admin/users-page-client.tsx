'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  UserPlusIcon,
  Loader2Icon,
  Trash2Icon,
  ShieldIcon,
  UserIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createAppUser, updateUserRole, removeUser } from '@/lib/admin/actions';
import type { AppUser } from '@/lib/admin/dal';

function NewUserForm() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createAppUser(email, password, displayName, role);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create the account');
      return;
    }
    setEmail('');
    setDisplayName('');
    setPassword('');
    setRole('user');
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserPlusIcon className="size-4 text-primary" />
          Add a user
        </CardTitle>
        <CardDescription>
          No self-service sign-up — every account is created here by an admin.
          The password below is the person&apos;s initial password; there&apos;s
          no email sending configured yet, so share it with them directly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="new-user-email">
              Email
            </label>
            <Input
              id="new-user-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="new-user-name">
              Display name
            </label>
            <Input
              id="new-user-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="new-user-password">
              Initial password
            </label>
            <Input
              id="new-user-password"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <Select
              value={role}
              onValueChange={(v) => v && setRole(v as 'admin' | 'user')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="sm:col-span-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <Loader2Icon className="size-3.5 animate-spin" />}
              Create account
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({ user, isSelf }: { user: AppUser; isSelf: boolean }) {
  const [role, setRole] = useState(user.role);
  const [savingRole, setSavingRole] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(next: 'admin' | 'user') {
    setRole(next);
    setSavingRole(true);
    setError(null);
    const result = await updateUserRole(user.id, next);
    setSavingRole(false);
    if (!result.ok) {
      setRole(user.role);
      setError(result.error ?? 'Failed to update role');
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    const result = await removeUser(user.id);
    setRemoving(false);
    if (!result.ok) setError(result.error ?? 'Failed to remove');
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{user.display_name || user.email}</div>
        <div className="text-xs text-muted-foreground">{user.email}</div>
      </TableCell>
      <TableCell>
        <Select
          value={role}
          onValueChange={(v) => v && handleRoleChange(v as 'admin' | 'user')}
          disabled={savingRole || isSelf}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="user">
              <UserIcon className="size-3.5" /> User
            </SelectItem>
            <SelectItem value="admin">
              <ShieldIcon className="size-3.5" /> Admin
            </SelectItem>
          </SelectContent>
        </Select>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
        {user.created_by ? ` by ${user.created_by}` : ''}
      </TableCell>
      <TableCell className="text-right">
        {isSelf ? (
          <Badge variant="secondary" className="font-normal">
            You
          </Badge>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <Trash2Icon className="size-3.5" />
            )}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function UsersPageClient({
  users,
  currentUserId,
}: {
  users: AppUser[];
  currentUserId: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          The admin roster — until Entra ID SSO covers every user, this is a
          manually managed list, not a live directory. Every add, role change,
          and removal is written to the audit log.
        </p>
      </div>

      <NewUserForm />

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">
            {users.length} account{users.length === 1 ? '' : 's'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
