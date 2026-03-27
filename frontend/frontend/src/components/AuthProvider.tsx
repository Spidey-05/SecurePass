'use client';

import { useEffect } from 'react';
import { bootstrapAuth } from '@/lib/auth-init';
import { useAuthStore } from '@/stores/auth.store';
import { startAutoLockTimer } from '@/stores/session.store';

/**
 * Mounts once at the root layout level.
 * Silently validates the httpOnly refreshToken cookie and restores
 * in-memory auth state so the dashboard guard doesn't redirect users
 * out on every page refresh.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    bootstrapAuth().then(() => {
      // If auth was restored, restart the auto-lock timer
      if (useAuthStore.getState().isAuthenticated) {
        startAutoLockTimer();
      }
    });
  }, []);

  return <>{children}</>;
}
