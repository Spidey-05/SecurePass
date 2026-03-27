'use client';

import { KeyRound, Star, CreditCard, FileText, User, ShieldCheck, Clock, TrendingUp } from 'lucide-react';
import { useVaultStore } from '@/stores/vault.store';
import { useAuthStore } from '@/stores/auth.store';
import { formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const { stats, items } = useVaultStore();
  const { user } = useAuthStore();

  const recentItems = [...items]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const typeIcons = {
    login: KeyRound,
    card: CreditCard,
    note: FileText,
    identity: User,
  } as const;

  const typeColors = {
    login: 'text-brand-400 bg-brand-500/10',
    card: 'text-emerald-400 bg-emerald-500/10',
    note: 'text-amber-400 bg-amber-500/10',
    identity: 'text-violet-400 bg-violet-500/10',
  } as const;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold text-slate-100">
          Good {getTimeOfDay()}, <span className="text-gradient">{user?.email.split('@')[0]}</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">Your vault is encrypted and secure.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total items', value: stats.total, icon: KeyRound, color: 'text-brand-400', bg: 'bg-brand-500/10 border-brand-500/20' },
          { label: 'Favorites', value: stats.favorites, icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Logins', value: stats.byType?.login ?? 0, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Cards', value: stats.byType?.card ?? 0, icon: CreditCard, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`glass-sm p-4 border animate-fade-in ${bg}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 font-medium">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Items */}
        <div className="lg:col-span-2 glass p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" />
              Recently Updated
            </h2>
            <Link href="/vault" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              View all →
            </Link>
          </div>

          {recentItems.length === 0 ? (
            <div className="text-center py-10">
              <KeyRound className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No items yet</p>
              <Link href="/vault" className="text-brand-400 text-sm hover:text-brand-300 mt-1 inline-block">
                Add your first password →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentItems.map((item) => {
                const Icon = typeIcons[item.itemType] ?? KeyRound;
                const colors = typeColors[item.itemType] ?? typeColors.login;
                return (
                  <Link
                    key={item._id}
                    href={`/vault?id=${item._id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-700/40 transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate group-hover:text-brand-300 transition-colors">
                        {item.data.name}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">{item.itemType}</p>
                    </div>
                    <span className="text-xs text-slate-600 shrink-0">
                      {formatRelativeTime(item.updatedAt)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Breakdown */}
        <div className="glass p-6 animate-slide-up">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            Vault Breakdown
          </h2>

          <div className="space-y-4">
            {[
              { type: 'login' as const, label: 'Logins' },
              { type: 'note' as const, label: 'Secure Notes' },
              { type: 'card' as const, label: 'Cards' },
              { type: 'identity' as const, label: 'Identities' },
            ].map(({ type, label }) => {
              const count = stats.byType?.[type] ?? 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const Icon = typeIcons[type];
              const colors = typeColors[type];

              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${colors.split(' ')[0]}`} />
                      <span className="text-xs text-slate-400">{label}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-300">{count}</span>
                  </div>
                  <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${colors.split(' ')[0]?.replace('text', 'bg')}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zero-knowledge badge */}
          <div className="mt-6 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-brand-400" />
              <span className="text-xs font-semibold text-brand-300">Zero-Knowledge</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              All data is AES-256-GCM encrypted in your browser. The server only stores ciphertext.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
