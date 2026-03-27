'use client';

import { useState } from 'react';
import {
  Lock, Clock, Download, Upload, Shield, Trash2,
  ChevronRight, AlertTriangle, Loader2, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useSessionStore } from '@/stores/session.store';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useVaultStore } from '@/stores/vault.store';
import { encryptData, decryptData } from '@/lib/crypto';

const AUTO_LOCK_OPTIONS = [
  { label: 'Never', value: 0 },
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
];

export default function SettingsPage() {
  const router = useRouter();
  const { autoLockMinutes, setAutoLockMinutes, vaultKey, lock } = useSessionStore();
  const { items, clearVault } = useVaultStore();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Export encrypted backup ──────────────────────────────────────────────────
  const handleExport = async () => {
    if (!vaultKey) { toast.error('Vault is locked'); return; }
    setExporting(true);
    try {
      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        items: items.map((i: any) => ({ id: i._id, itemType: i.itemType, data: i.data })),
      };
      const encrypted = await encryptData(backupData, vaultKey);

      const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `securepass-backup-${new Date().toISOString().split('T')[0]}.enc.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Encrypted backup downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ── Import encrypted backup ──────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vaultKey) return;
    setImporting(true);
    try {
      const text = await file.text();
      const encrypted = JSON.parse(text);
      const backup = await decryptData<{ version: number; items: unknown[] }>(encrypted, vaultKey);
      toast.success(`Backup contains ${backup.items.length} items — import via API coming soon`);
    } catch {
      toast.error('Invalid or corrupted backup file. Wrong vault key?');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleLockNow = () => {
    lock();
    clearVault();
    router.replace('/login');
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your vault preferences</p>
      </div>

      <div className="space-y-4">
        {/* Auto-lock */}
        <section className="glass p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-brand-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100">Auto-lock</h2>
              <p className="text-xs text-slate-500">Lock vault after inactivity</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {AUTO_LOCK_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => { setAutoLockMinutes(value); toast.success(`Auto-lock set to ${label.toLowerCase()}`); }}
                className={cn(
                  'py-2.5 rounded-xl text-sm font-medium transition-all border',
                  autoLockMinutes === value
                    ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                    : 'border-slate-700/50 text-slate-400 hover:bg-surface-700/40 hover:text-slate-300'
                )}
              >
                {autoLockMinutes === value && <Check className="w-3 h-3 inline mr-1 text-brand-400" />}
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Vault actions */}
        <section className="glass p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100">Vault backup</h2>
              <p className="text-xs text-slate-500">Export and import your encrypted vault</p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-700/50 hover:bg-surface-700/40 hover:border-slate-600/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                {exporting ? <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" /> : <Download className="w-4 h-4 text-emerald-400" />}
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-200">Export encrypted backup</p>
                  <p className="text-xs text-slate-500">{items.length} items · encrypted with your vault key</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </button>

            <label className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-700/50 hover:bg-surface-700/40 hover:border-slate-600/50 transition-all group cursor-pointer">
              <div className="flex items-center gap-3">
                {importing ? <Loader2 className="w-4 h-4 text-brand-400 animate-spin" /> : <Upload className="w-4 h-4 text-brand-400" />}
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-200">Import backup</p>
                  <p className="text-xs text-slate-500">Restore from an encrypted backup file</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </section>

        {/* Lock now */}
        <section className="glass p-6">
          <button
            onClick={handleLockNow}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-700/50 hover:bg-surface-700/40 hover:border-slate-600/50 transition-all group"
          >
            <Lock className="w-4 h-4 text-amber-400" />
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-slate-200">Lock vault now</p>
              <p className="text-xs text-slate-500">Clears the vault key from memory</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </button>
        </section>

        {/* Danger zone */}
        <section className="glass p-6 border-red-500/20">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100">Danger zone</h2>
              <p className="text-xs text-slate-500">Irreversible actions</p>
            </div>
          </div>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-red-300">Delete account</p>
                <p className="text-xs text-slate-500">Permanently deletes your account and all vault data</p>
              </div>
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 animate-fade-in">
              <p className="text-red-300 text-sm font-medium mb-1">Are you absolutely sure?</p>
              <p className="text-slate-400 text-xs mb-4">
                This will permanently delete your account and all encrypted data. There is no recovery.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1 text-xs">
                  Cancel
                </button>
                <button className="flex-1 btn text-xs bg-red-600 hover:bg-red-500 text-white">
                  Delete everything
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
