import { authApi } from '@/lib/api';
import { getAccessToken, setBootstrapping } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

let initialized = false;

/**
 * Called once on initial page load (via AuthProvider).
 * Hits GET /api/auth/me to validate the httpOnly refreshToken cookie
 * and re-hydrate the in-memory auth store.
 *
 * Flow on cold load:
 *   1. authApi.getMe() is called with no Authorization header (token is null)
 *   2. Backend returns 401
 *   3. The axios response interceptor silently calls POST /auth/refresh
 *      (succeeds because the httpOnly cookie is present)
 *   4. Interceptor retries getMe with the new accessToken
 *   5. We receive the user object and mark auth as complete
 *
 * If the cookie is missing/expired, the refresh fails, the interceptor
 * redirects to /login, and we call clearAuth() to settle isLoading.
 */
export async function bootstrapAuth(): Promise<void> {
  // Only run once per JS session (survives React Strict Mode double-invoke)
  if (initialized) return;
  initialized = true;

  const { setAuth, clearAuth, isAuthenticated } = useAuthStore.getState();

  // Already hydrated — user just logged in on this render cycle
  if (isAuthenticated) return;

  setBootstrapping(true);
  try {
    const { data } = await authApi.getMe();
    const { user } = data.data;
    // By the time getMe resolves, the interceptor has already placed a fresh
    // accessToken in memory via setAccessToken(). We just read it back.
    const token = getAccessToken() ?? '';
    setAuth(user, token);
  } catch {
    // Cookie missing/expired — clear residual state so guards can act
    clearAuth();
  } finally {
    setBootstrapping(false);
  }
}

/** Reset the init gate (used after logout so next login re-runs bootstrap) */
export function resetAuthInit(): void {
  initialized = false;
}
