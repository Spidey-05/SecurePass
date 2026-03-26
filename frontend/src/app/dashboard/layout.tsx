'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, KeyRound, History, Settings,
  LogOut, Lock, Shield, ChevronRight, Wrench,
} from 'lucide-react';

import { useAuthStore } from '@/stores/auth.store';
import { useSessionStore, stopAutoLockTimer } from '@/stores/session.store';
import { useVaultStore } from '@/stores/vault.store';
import { authApi } from '@/lib/api';
import { resetAuthInit } from '@/lib/auth-init';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vault', label: 'Vault', icon: KeyRound },
  { href: '/tools', label: 'Tools', icon: Wrench },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { isLocked, lock } = useSessionStore();
  const { stats, clearVault } = useVaultStore();

  // Guard: redirect to login if not authenticated (wait for bootstrap to finish)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.replace('/login?expired=1');
    }
  }, [isAuthenticated, isLoading]);

  // Guard: redirect to login if vault auto-locked
  useEffect(() => {
    if (!isLoading && isLocked) {
      window.location.replace('/login?expired=1');
    }
  }, [isLocked, isLoading]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors — still clear client state
    }
    stopAutoLockTimer();
    resetAuthInit();
    clearVault();
    // We intentionally skip clearAuth() to prevent the global useEffect guard 
    // from racing us to /login. The hard navigation destroys the state anyway.
    window.location.href = '/';
  };

  const handleLock = () => {
    lock();
    resetAuthInit();
    clearVault();
    // The useEffect guard will catch isLocked=true and redirect to /login
  };

  // Show skeleton only while bootstrapping — never get stuck here
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand-400 animate-pulse" />
          </div>
          <p className="text-slate-500 text-sm">Loading vault…</p>
        </div>
      </div>
    );
  }

  // Auth resolved but not authenticated — redirect will fire via useEffect above
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-64 w-[400px] h-[400px] bg-brand-600/5 rounded-full blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-slate-800/60 bg-surface-900/80 backdrop-blur-sm">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <p className="font-bold text-slate-100 text-sm">SecurePass</p>
              <p className="text-xs text-slate-500 truncate max-w-[130px]">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Stats pill */}
        <div className="px-4 pt-4">
          <div className="glass-sm px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">Vault items</span>
            <span className="text-xs font-mono font-semibold text-brand-400">{stats.total}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(active ? 'nav-item-active' : 'nav-item')}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 text-brand-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-slate-800/60 space-y-1">
          <button onClick={handleLock} className="nav-item w-full">
            <Lock className="w-4 h-4 shrink-0" />
            Lock vault
          </button>
          <button onClick={handleLogout} className="nav-item w-full text-red-400/80 hover:text-red-400 hover:bg-red-500/10">
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
