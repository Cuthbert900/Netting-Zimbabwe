'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  GitCompareIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  CheckIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from '@/components/ui/input-group';
// Renamed from the usual `dynamic` import — this file needs to export its
// own route-segment `dynamic = "force-dynamic"` below (same pattern as
// /admin/login), which would otherwise collide with this identifier.
import nextDynamicImport from 'next/dynamic';
import { createClient } from '@/lib/supabase/browser';

const GlobeDemo = nextDynamicImport(() => import('@/components/globe-demo'), {
  ssr: false,
});

// This page reads useSearchParams() (for ?next= and ?reason=idle) — not
// statically prerenderable without a Suspense boundary. force-dynamic
// sidesteps that the same way /admin/login/page.tsx does.
export const dynamic = 'force-dynamic';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';
  const idleTimedOut = searchParams.get('reason') === 'idle';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      setIsSuccess(true);
      router.push(next);
      router.refresh();
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  }

  return (
    <motion.div
      className="w-full max-w-sm"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Logo (mobile) */}
      <motion.div
        className="mb-8 flex flex-col items-center lg:hidden"
        variants={itemVariants}
      >
        <div className="bg-brand-gradient flex size-10 items-center justify-center rounded-xl text-white">
          <GitCompareIcon className="size-5" />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div className="text-center" variants={itemVariants}>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in with your Liquid Intelligent Technologies account
        </p>
      </motion.div>

      {/* SSO button — Azure AD / Entra ID SSO isn't wired up yet (see
          terraform/README.md); disabled rather than silently doing
          nothing when clicked. */}
      <motion.div className="mt-8" variants={itemVariants}>
        <Button
          variant="outline"
          size="lg"
          className="w-full gap-2"
          disabled
          title="Coming soon"
        >
          <Image
            src="/logos/microsoft-com.png"
            alt="Microsoft"
            width={16}
            height={16}
            className="size-4"
          />
          <span className="text-sm">
            Continue with Microsoft 365 (coming soon)
          </span>
        </Button>
      </motion.div>

      {/* Divider */}
      <motion.div
        className="relative my-6 flex items-center"
        variants={itemVariants}
      >
        <div className="flex-1 border-t border-border" />
        <span className="mx-3 text-xs text-muted-foreground">
          or sign in with email
        </span>
        <div className="flex-1 border-t border-border" />
      </motion.div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {idleTimedOut && !error && (
          <motion.div
            variants={itemVariants}
            className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
          >
            You were signed out after 15 minutes of inactivity. Sign in again to
            continue.
          </motion.div>
        )}
        {error && (
          <motion.div
            variants={itemVariants}
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}
        <motion.div variants={itemVariants}>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <MailIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </InputGroup>
        </motion.div>

        <motion.div variants={itemVariants}>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Link
              href="#"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <LockIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOffIcon className="size-3.5 text-muted-foreground" />
                ) : (
                  <EyeIcon className="size-3.5 text-muted-foreground" />
                )}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </motion.div>

        <motion.div variants={itemVariants} className="pt-1">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isLoading || isSuccess}
          >
            {isLoading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckIcon className="size-4" />
                <span>Success!</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Footer */}
      <motion.p
        className="mt-6 text-center text-sm text-muted-foreground"
        variants={itemVariants}
      >
        Don't have an account?{' '}
        <Link
          href="/sign-up"
          className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
        >
          Sign up
        </Link>
      </motion.p>

      {/* Secured badge */}
      <motion.div
        className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60"
        variants={itemVariants}
      >
        <ShieldCheckIcon className="size-3.5" />
        <span>256-bit SSL encrypted</span>
      </motion.div>

      {/* Cassava AI attribution */}
      <motion.div
        className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/50"
        variants={itemVariants}
      >
        <img
          src="/logos/cassava-mark.png"
          alt="Cassava AI"
          className="size-3 opacity-70"
        />
        <span>Built by Cassava AI</span>
      </motion.div>
    </motion.div>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-svh">
      {/* Left panel - Globe */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-zinc-950 lg:flex">
        {/* Logo */}
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

        {/* Globe */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <GlobeDemo />
        </div>

        {/* Quote overlay — pinned to bottom */}
        <div className="relative z-20 mt-auto p-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <blockquote className="text-sm leading-relaxed text-white/80">
              &ldquo;AI-powered matching turns days of manual Netting
              reconciliation into minutes of exception review.&rdquo;
            </blockquote>
            <p className="mt-3 text-xs text-white/50">
              &mdash; Treasury & Billing, Liquid Intelligent Technologies
            </p>
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <Suspense fallback={<div>Loading...</div>}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
