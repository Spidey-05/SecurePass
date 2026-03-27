'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus, Search, Star, KeyRound, CreditCard, FileText, User,
  Copy, Eye, EyeOff, Edit2, Trash2, Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useVaultStore } from '@/stores/vault.store';
import { useSessionStore } from '@/stores/session.store';
import { vaultApi } from '@/lib/api';
import { encryptData, hashUrl } from '@/lib/crypto';
import { cn, copyToClipboard, getDomainFromUrl, getFaviconUrl, truncate } from '@/lib/utils';
import type { VaultItem, VaultItemType, VaultItemRaw } from '@/types';
import VaultItemModal from '@/components/vault/VaultItemModal';
import DeleteConfirmModal from '@/components/vault/DeleteConfirmModal';

const TYPE_ICONS = {
  login: KeyRound,
  card: CreditCard,
  note: FileText,
  identity: User,
} as const;

const TYPE_COLORS = {
  login: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  card: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  note: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  identity: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
} as const;

const FILTER_TYPES: Array<{ value: VaultItemType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'login', label: 'Logins' },
  { value: 'note', label: 'Notes' },
  { value: 'card', label: 'Cards' },
  { value: 'identity', label: 'Identities' },
];

export default function VaultPage() {
  const { items, addItem, updateItem, removeItem, toggleFavorite } = useVaultStore();
  const { vaultKey } = useSessionStore();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<VaultItemType | 'all'>('all');
  const [showFavs, setShowFavs] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('view');
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VaultItem | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const name = item.data.name.toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || name.includes(q) ||
        ('url' in item.data && item.data.url?.includes(q)) ||
        ('username' in item.data && item.data.username?.toLowerCase().includes(q));
      const matchType = filterType === 'all' || item.itemType === filterType;
      const matchFav = !showFavs || item.isFavorite;
      return matchSearch && matchType && matchFav;
    });
  }, [items, search, filterType, showFavs]);

  const openCreate = () => {
    setSelectedItem(null);
    setModalMode('create');
    setShowModal(true);
  };

  const openEdit = (item: VaultItem) => {
    setSelectedItem(item);
    setModalMode('edit');
    setShowModal(true);
  };

  const openView = (item: VaultItem) => {
    setSelectedItem(item);
    setModalMode('view');
    setShowModal(true);
  };

  const handleSave = useCallback(async (formData: VaultItem['data']) => {
    if (!vaultKey) { toast.error('Vault is locked'); return; }
    setSaving(true);
    try {
      const payload = await encryptData(formData, vaultKey);

      let urlHash: string | undefined;
      if ('url' in formData && formData.url) {
        try { urlHash = await hashUrl(formData.url, vaultKey); } catch {}
      }

      if (modalMode === 'create') {
        const histPayload = await encryptData({ name: formData.name, action: 'created' }, vaultKey);
        const { data } = await vaultApi.create({
          ...payload,
          itemType: formData.type,
          urlHash,
          historyEncryptedData: histPayload.encryptedData,
          historyIv: histPayload.iv,
          historyAuthTag: histPayload.authTag,
        });
        const raw = (data as { data: { item: VaultItemRaw } }).data.item;
        const { encryptedData: _e, iv: _i, authTag: _a, ...rest } = raw;
        addItem({ ...rest, data: formData });
        toast.success('Item added to vault');
      } else if (modalMode === 'edit' && selectedItem) {
        const histPayload = await encryptData({ name: formData.name, action: 'updated' }, vaultKey);
        const { data } = await vaultApi.update(selectedItem._id, {
          ...payload,
          urlHash,
          historyEncryptedData: histPayload.encryptedData,
          historyIv: histPayload.iv,
          historyAuthTag: histPayload.authTag,
        });
        const raw = (data as { data: { item: VaultItemRaw } }).data.item;
        const { encryptedData: _e, iv: _i, authTag: _a, ...rest } = raw;
        updateItem(selectedItem._id, { ...rest, data: formData });
        toast.success('Item updated');
      }

      setShowModal(false);
    } catch {
      toast.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  }, [vaultKey, modalMode, selectedItem, addItem, updateItem]);

  const handleDelete = useCallback(async (item: VaultItem) => {
    if (!vaultKey) return;
    try {
      const histPayload = await encryptData({ name: item.data.name, action: 'deleted' }, vaultKey);
      await vaultApi.delete(item._id, {
        historyEncryptedData: histPayload.encryptedData,
        historyIv: histPayload.iv,
        historyAuthTag: histPayload.authTag,
      });
      removeItem(item._id);
      toast.success('Item deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete item');
    }
  }, [vaultKey, removeItem]);

  const handleFavorite = async (item: VaultItem) => {
    try {
      await vaultApi.update(item._id, { isFavorite: !item.isFavorite });
      toggleFavorite(item._id);
    } catch { toast.error('Failed to update favorite'); }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Vault</h1>
          <p className="text-slate-500 text-sm mt-0.5">{items.length} encrypted items</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add item
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search vault…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          {FILTER_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterType(value as VaultItemType | 'all')}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150',
                filterType === value
                  ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700/50'
              )}
            >
              {label}
            </button>
          ))}

          <button
            onClick={() => setShowFavs(!showFavs)}
            className={cn(
              'btn-icon transition-all',
              showFavs ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400'
            )}
            title="Show favorites only"
          >
            <Star className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Items grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <KeyRound className="w-14 h-14 text-slate-700 mb-4" />
          <p className="text-slate-400 font-medium">
            {search ? 'No items match your search' : 'Your vault is empty'}
          </p>
          <p className="text-slate-600 text-sm mt-1">
            {search ? 'Try a different search term' : 'Add your first password to get started'}
          </p>
          {!search && (
            <button onClick={openCreate} className="btn-primary mt-4">
              <Plus className="w-4 h-4" />
              Add first item
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const Icon = TYPE_ICONS[item.itemType] ?? KeyRound;
            const colorClass = TYPE_COLORS[item.itemType] ?? TYPE_COLORS.login;
            const isVisible = visiblePasswords.has(item._id);
            const isLogin = item.itemType === 'login';
            const loginData = isLogin ? (item.data as { username?: string; password?: string; url?: string }) : null;

            return (
              <div
                key={item._id}
                className="vault-card animate-fade-in"
                onClick={() => openView(item)}
              >
                {/* Icon */}
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border', colorClass)}>
                  {isLogin && loginData?.url ? (
                    <img
                      src={getFaviconUrl(loginData.url)}
                      alt=""
                      className="w-5 h-5 rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Icon className="w-4.5 h-4.5" />
                  )}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate group-hover:text-brand-300 transition-colors">
                    {item.data.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isLogin && loginData?.username && (
                      <p className="text-xs text-slate-500 truncate">{loginData.username}</p>
                    )}
                    {isLogin && loginData?.url && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 min-w-0">
                        <Globe className="w-3 h-3 shrink-0" />
                        <span className="truncate">{getDomainFromUrl(loginData.url)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Password preview */}
                {isLogin && loginData?.password && (
                  <div
                    className="font-mono text-xs text-slate-400 bg-surface-900/60 px-2.5 py-1 rounded-lg min-w-[100px] text-center"
                    onClick={e => e.stopPropagation()}
                  >
                    {isVisible ? truncate(loginData.password, 16) : '••••••••••••'}
                  </div>
                )}

                {/* Actions */}
                <div
                  className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  {isLogin && loginData?.password && (
                    <>
                      <button
                        className="btn-icon text-slate-400 hover:text-slate-200"
                        onClick={() => togglePasswordVisibility(item._id)}
                        title="Toggle visibility"
                      >
                        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        className="btn-icon text-slate-400 hover:text-brand-300"
                        onClick={() => {
                          copyToClipboard(loginData.password!, 30_000);
                          toast.success('Password copied · clears in 30s');
                        }}
                        title="Copy password"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    className="btn-icon text-slate-400 hover:text-amber-400"
                    onClick={() => handleFavorite(item)}
                    title="Toggle favorite"
                  >
                    <Star className={cn('w-4 h-4', item.isFavorite && 'fill-amber-400 text-amber-400')} />
                  </button>
                  <button
                    className="btn-icon text-slate-400 hover:text-slate-200"
                    onClick={() => openEdit(item)}
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="btn-icon text-slate-400 hover:text-red-400"
                    onClick={() => setDeleteTarget(item)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <VaultItemModal
          mode={modalMode}
          item={selectedItem}
          onSave={handleSave}
          onEdit={() => setModalMode('edit')}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          itemName={deleteTarget.data.name}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
