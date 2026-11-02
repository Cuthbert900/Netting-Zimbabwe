'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { GitCompareIcon, ShieldCheckIcon, UserPlusIcon } from 'lucide-react';
import dynamic from 'next/dynamic';

const GlobeDemo = dynamic(() => import('@/components/globe-demo'), {
  ssr: false,
});

// This used to be a fully self-serve sign-up form (name/email/password,
// no backend call at all — it just faked a loading spinner and a
// "success" state). The platform now requires every user to sign in
// (proxy.ts gates the whole app), and there's deliberately no
// self-service account creation to go with that — same model as
// /admin/login: an existing admin creates your account (see
// docker/create-admin.sh / the Users admin page), not you. Left as a
// real, reachable page (rather than just deleting it) since /sign-in's
// footer still links here, and a signed-out visitor who lands on it
// directly should see an honest explanation instead of a broken link.
export default function SignUpPage() {
  return (
    <div className="flex min-h-svh">
      {/* Left panel - Globe */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-zinc-950 lg:flex">
        <Link
          href="/dashboard"
          className="relative z-20 flex items-center gap-2.5 p-8"
        >
          <div className="bg-brand-gradient flex size-8 items-center justify-center rounded-lg text-white">
            <GitCompareIcon className="size-4" />
          </div>
          <span className="text-sm font-semibold text-white">
            Netting Reconciliation
          </span>
        </Link>

        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <GlobeDemo />
        </div>

        <div className="relative z-20 mt-auto p-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <blockquote className="text-sm leading-relaxed text-white/80">
              &ldquo;Every extract, one source of truth — AI reconciled, human
              approved.&rdquo;
            </blockquote>
            <p className="mt-3 text-xs text-white/50">
              &mdash; Treasury &amp; Billing, Liquid Intelligent Technologies
            </p>
          </div>
        </div>
      </div>

      {/* Right panel - message */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <motion.div
          className="w-full max-w-sm text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6 flex flex-col items-center lg:hidden">
            <div className="bg-brand-gradient flex size-10 items-center justify-center rounded-xl text-white">
              <GitCompareIcon className="size-5" />
            </div>
          </div>

          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <UserPlusIcon className="size-5 text-muted-foreground" />
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            No self-service sign-up
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            There&apos;s no open registration for this workspace. Ask an
            existing admin to create your account — they can do that from the
            Users page, or via the project&apos;s{' '}
            <code className="text-xs">create-admin.sh</code> tooling.
          </p>

          <Link
            href="/sign-in"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to sign in
          </Link>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
            <ShieldCheckIcon className="size-3.5" />
            <span>256-bit SSL encrypted</span>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/50">
            <img
              src="/logos/cassava-mark.png"
              alt="Cassava AI"
              className="size-3 opacity-70"
            />
            <span>Built by Cassava AI</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
