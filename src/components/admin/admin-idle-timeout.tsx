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

/** Signs an idle admin out after IDLE_TIMEOUT_MS of no interaction.
 * Mounted once from the protected admin layout, so it covers every
 * /admin/* page. Any activity resets the timer; going idle calls
 * supabase.auth.signOut() (clears the session cookie proxy.ts reads on
 * the next request) and sends the admin back to /admin/login.
 *
 * This is separate from the Supabase JWT's own expiry
 * (GOTRUE_JWT_EXP=3600s, 1 hour) — that's a hard ceiling regardless of
 * activity. This is the "walked away from your desk" case, which the JWT
 * expiry alone doesn't cover since an active session keeps refreshing. */
export function AdminIdleTimeout() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When Supabase isn't configured, there's no signed-in admin session to
    // time out, so bail out inside the effect instead of crashing
    // createClient(). This must stay inside useEffect: an early return
    // before the hook would make it conditional.
    if (!isBrowserSupabaseConfigured()) return;

    const supabase = createClient();
    let cancelled = false;

    function signOutForIdle() {
      supabase.auth.signOut().finally(() => {
        if (cancelled) return;
        router.push('/admin/login?reason=idle');
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
  }, [router]);

  return null;
}
