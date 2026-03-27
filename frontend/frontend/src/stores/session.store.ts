import { create } from 'zustand';

interface SessionStore {
  vaultKey: CryptoKey | null;        // NEVER persisted to disk/storage
  lastActivity: number;
  autoLockMinutes: number;
  isLocked: boolean;

  setVaultKey: (key: CryptoKey) => void;
  clearVaultKey: () => void;
  updateActivity: () => void;
  lock: () => void;
  unlock: (key: CryptoKey) => void;
  setAutoLockMinutes: (minutes: number) => void;
  checkAutoLock: () => boolean;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  vaultKey: null,
  lastActivity: Date.now(),
  autoLockMinutes: 15,
  isLocked: false,

  setVaultKey: (vaultKey) =>
    set({ vaultKey, isLocked: false, lastActivity: Date.now() }),

  clearVaultKey: () => set({ vaultKey: null }),

  updateActivity: () => set({ lastActivity: Date.now() }),

  lock: () => {
    // Overwrite vault key reference — GC will clean up the CryptoKey
    set({ vaultKey: null, isLocked: true });
  },

  unlock: (vaultKey) =>
    set({ vaultKey, isLocked: false, lastActivity: Date.now() }),

  setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),

  checkAutoLock: (): boolean => {
    const { lastActivity, autoLockMinutes, isLocked } = get();
    if (isLocked || autoLockMinutes === 0) return isLocked;

    const inactiveMs = Date.now() - lastActivity;
    const lockMs = autoLockMinutes * 60 * 1000;

    if (inactiveMs >= lockMs) {
      get().lock();
      return true;
    }
    return false;
  },
}));

// ─── Auto-lock timer ───────────────────────────────────────────────────────────

let lockTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoLockTimer(): void {
  if (lockTimer) clearInterval(lockTimer);
  lockTimer = setInterval(() => {
    useSessionStore.getState().checkAutoLock();
  }, 30_000); // check every 30 seconds
}

export function stopAutoLockTimer(): void {
  if (lockTimer) {
    clearInterval(lockTimer);
    lockTimer = null;
  }
}

// Track user activity
if (typeof window !== 'undefined') {
  const updateActivity = () => useSessionStore.getState().updateActivity();
  ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach((event) => {
    document.addEventListener(event, updateActivity, { passive: true });
  });
}
