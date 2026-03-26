'use client';

import { useEffect, useState } from 'react';
import { History, Trash2, Clock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { historyApi } from '@/lib/api';
import { decryptData } from '@/lib/crypto';
import { useSessionStore } from '@/stores/session.store';
import { formatRelativeTime, cn } from '@/lib/utils';
import type { HistoryItemRaw, HistoryItemData } from '@/types';

interface DecryptedHistory {
  _id: string;
  action: string;
  data: HistoryItemData;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  created: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  updated: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  deleted: 'text-red-400 bg-red-500/10 border-red-500/20',
  viewed: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  password_copied: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

export default function HistoryPage() {
  const { vaultKey } = useSessionStore();
  const [entries, setEntries] = useState<DecryptedHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!vaultKey) return;
    loadHistory();
  }, [vaultKey]);

  const loadHistory = async () => {
    if (!vaultKey) return;
    setIsLoading(true);
    try {
      const { data } = await historyApi.getAll({ limit: 100 });
      const raw = (data as { data: { items: HistoryItemRaw[] } }).data.items;

      const decrypted = await Promise.allSettled(
        raw.map(async (h) => {
          const histData = await decryptData<HistoryItemData>(
            { encryptedData: h.encryptedData, iv: h.iv, authTag: h.authTag },
            vaultKey
          );
          return {
            _id: h._id,
            action: h.action,
            data: histData,
            createdAt: h.createdAt,
          } as DecryptedHistory;
        })
      );

      setEntries(
        decrypted
          .filter((r): r is PromiseFulfilledResult<DecryptedHistory> => r.status === 'fulfilled')
          .map(r => r.value)
      );
    } catch {
      toast.error('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    setClearing(true);
    try {
      await historyApi.clear();
      setEntries([]);
      toast.success('History cleared');
    } catch {
      toast.error('Failed to clear history');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">History</h1>
          <p className="text-slate-500 text-sm mt-0.5">Encrypted activity log · auto-expires in 90 days</p>
        </div>
        {entries.length > 0 && (
          <button onClick={clearHistory} disabled={clearing} className="btn-danger">
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Clear all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <History className="w-14 h-14 text-slate-700 mb-4" />
          <p className="text-slate-400 font-medium">No history yet</p>
          <p className="text-slate-600 text-sm mt-1">Vault activity will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const colorClass = ACTION_COLORS[entry.action] ?? ACTION_COLORS['viewed'];
            return (
              <div key={entry._id} className="glass-sm px-4 py-3 flex items-center gap-4 animate-fade-in">
                <div className="w-2 h-2 rounded-full bg-current shrink-0" style={{ color: colorClass.split(' ')[0]?.replace('text-', '') }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{entry.data?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {entry.data?.url && <span className="mr-2">{entry.data.url}</span>}
                  </p>
                </div>
                <span className={cn('badge capitalize', colorClass)}>
                  {entry.action.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-1 text-xs text-slate-600 shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(entry.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
