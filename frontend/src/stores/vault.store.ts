import { create } from 'zustand';
import { VaultItem, VaultItemType, VaultItemRaw, VaultItemData } from '@/types';
import { decryptData } from '@/lib/crypto';

interface VaultStore {
  // Decrypted items (in-memory only)
  items: VaultItem[];
  isLoading: boolean;
  stats: {
    total: number;
    favorites: number;
    byType: Partial<Record<VaultItemType, number>>;
  };

  // Vault key is managed by SessionStore — vault store just holds decrypted data
  setItems: (items: VaultItem[]) => void;
  addItem: (item: VaultItem) => void;
  updateItem: (id: string, item: VaultItem) => void;
  removeItem: (id: string) => void;
  setLoading: (loading: boolean) => void;
  clearVault: () => void;
  computeStats: () => void;
  toggleFavorite: (id: string) => void;
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  items: [],
  isLoading: false,
  stats: { total: 0, favorites: 0, byType: {} },

  setItems: (items) => {
    set({ items });
    get().computeStats();
  },

  addItem: (item) => {
    set((state) => ({ items: [item, ...state.items] }));
    get().computeStats();
  },

  updateItem: (id, updatedItem) => {
    set((state) => ({
      items: state.items.map((item) => (item._id === id ? updatedItem : item)),
    }));
    get().computeStats();
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((item) => item._id !== id) }));
    get().computeStats();
  },

  setLoading: (isLoading) => set({ isLoading }),

  clearVault: () => set({ items: [], stats: { total: 0, favorites: 0, byType: {} } }),

  computeStats: () => {
    const { items } = get();
    const byType: Partial<Record<VaultItemType, number>> = {};
    let favorites = 0;

    for (const item of items) {
      byType[item.itemType] = (byType[item.itemType] ?? 0) + 1;
      if (item.isFavorite) favorites++;
    }

    set({ stats: { total: items.length, favorites, byType } });
  },

  toggleFavorite: (id) => {
    set((state) => ({
      items: state.items.map((item) =>
        item._id === id ? { ...item, isFavorite: !item.isFavorite } : item
      ),
    }));
  },
}));

// ─── Utility: Decrypt Raw Vault Items ─────────────────────────────────────────

export async function decryptVaultItems(
  rawItems: VaultItemRaw[],
  vaultKey: CryptoKey
): Promise<VaultItem[]> {
  const decrypted = await Promise.allSettled(
    rawItems.map(async (raw) => {
      const data = await decryptData<VaultItemData>(
        { encryptedData: raw.encryptedData, iv: raw.iv, authTag: raw.authTag },
        vaultKey
      );
      const { encryptedData: _e, iv: _i, authTag: _a, ...rest } = raw;
      return { ...rest, data } as VaultItem;
    })
  );

  return decrypted
    .filter((r): r is PromiseFulfilledResult<VaultItem> => r.status === 'fulfilled')
    .map((r) => r.value);
}
