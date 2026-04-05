'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, KeyRound, History, Settings,
  LogOut, Lock, Shield, ChevronRight, Wrench, Menu, X,
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
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { isLocked, lock } = useSessionStore();
  const { stats, clearVault } = useVaultStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Guard: redirect to login if not authenticated (wait for bootstrap to finish)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const timer = setTimeout(() => {
        if (!useAuthStore.getState().isAuthenticated) {
          router.replace('/login?expired=1');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAuthenticated, isLoading, router]);

  // Guard: redirect to login if vault auto-locked
  useEffect(() => {
    if (!isLoading && isLocked) {
      router.replace('/login?expired=1');
    }
  }, [isLocked, isLoading, router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore — still clear client state
    }
    stopAutoLockTimer();
    resetAuthInit();
    clearVault();
    window.location.href = '/';
  };

  const handleLock = () => {
    lock();
    resetAuthInit();
    clearVault();
  };

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

  if (!isAuthenticated) return null;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-100 text-sm">SecurePass</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
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
    </>
  );

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-64 w-[400px] h-[400px] bg-brand-600/5 rounded-full blur-3xl" />
      </div>

      {/* ── Desktop Sidebar ───────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 shrink-0 h-screen sticky top-0 flex-col border-r border-slate-800/60 bg-surface-900/80 backdrop-blur-sm">
        <SidebarContent />
      </aside>

      {/* ── Mobile: Header Bar ────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-surface-900/95 backdrop-blur-sm border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-brand-400" />
          </div>
          <span className="font-bold text-slate-100 text-sm">SecurePass</span>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="btn-icon text-slate-400"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Mobile: Drawer Overlay ────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={() => setSidebarOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Drawer */}
          <aside
            className="relative w-72 max-w-[85vw] h-full flex flex-col bg-surface-900 border-r border-slate-800/60 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 btn-icon text-slate-400"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto pt-14 lg:pt-0 pb-16 lg:pb-0">
        {children}
      </main>

      {/* ── Mobile: Bottom Navigation ─────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-16 bg-surface-900/95 backdrop-blur-sm border-t border-slate-800/60 px-2">
        {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-0',
                active ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
