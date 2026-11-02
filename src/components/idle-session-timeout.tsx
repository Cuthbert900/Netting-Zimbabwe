'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  createClient,
  isBrowserSupabaseConfigured,
} from '@/lib/supabase/browser';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
] as const;

/** General-purpose version of AdminIdleTimeout (src/components/admin/
 * admin-idle-timeout.tsx), for the rest of the platform now that every
 * page requires sign-in, not just /admin. Signs an idle user out after
 * IDLE_TIMEOUT_MS of no interaction and sends them to `redirectTo` with
 * ?reason=idle. Separate from the Supabase JWT's own 1-hour expiry
 * (GOTRUE_JWT_EXP) — that's a hard ceiling regardless of activity, this
 * is the "walked away from your desk" case. */
export function IdleSessionTimeout({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When Supabase isn't configured, proxy.ts doesn't enforce sign-in and
    // there's no session to time out — bail out inside the effect so local
    // dev without auth doesn't crash. This must stay inside useEffect: an
    // early return before the hook would make it conditional.
    if (!isBrowserSupabaseConfigured()) return;

    const supabase = createClient();
    let cancelled = false;

    function signOutForIdle() {
      supabase.auth.signOut().finally(() => {
        if (cancelled) return;
        router.push(`${redirectTo}?reason=idle`);
        router.refresh();
      });
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(signOutForIdle, IDLE_TIMEOUT_MS);
    }

    resetTimer();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, resetTimer, { passive: true });
    }

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, resetTimer);
      }
    };
  }, [router, redirectTo]);

  return null;
}
