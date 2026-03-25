// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  encryptedVaultKey: string;
  vaultKeySalt: string;
  vaultKeyIv: string;
  vaultKeyAuthTag: string;
}

// ─── Vault Item ───────────────────────────────────────────────────────────────

export type VaultItemType = 'login' | 'note' | 'card' | 'identity';

// What's stored server-side (encrypted)
export interface VaultItemRaw {
  _id: string;
  userId: string;
  encryptedData: string;
  iv: string;
  authTag: string;
  itemType: VaultItemType;
  isFavorite: boolean;
  folderId?: string;
  urlHash?: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

// Decrypted structure stored in Zustand store
export interface LoginItem {
  type: 'login';
  name: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  totp?: string;
  customFields?: Array<{ label: string; value: string; hidden: boolean }>;
}

export interface NoteItem {
  type: 'note';
  name: string;
  content: string;
}

export interface CardItem {
  type: 'card';
  name: string;
  cardholderName: string;
  number: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  notes?: string;
}

export interface IdentityItem {
  type: 'identity';
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export type VaultItemData = LoginItem | NoteItem | CardItem | IdentityItem;

// Fully decrypted vault item (in-memory only)
export interface VaultItem extends Omit<VaultItemRaw, 'encryptedData' | 'iv' | 'authTag'> {
  data: VaultItemData;
}

// ─── History ──────────────────────────────────────────────────────────────────

export type HistoryAction = 'created' | 'updated' | 'deleted' | 'viewed' | 'password_copied';

export interface HistoryItemRaw {
  _id: string;
  userId: string;
  vaultItemId?: string;
  encryptedData: string;
  iv: string;
  authTag: string;
  action: HistoryAction;
  createdAt: string;
}

export interface HistoryItemData {
  name: string;
  url?: string;
  action: HistoryAction;
}

export interface HistoryItem extends Omit<HistoryItemRaw, 'encryptedData' | 'iv' | 'authTag'> {
  data: HistoryItemData;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface VaultState {
  items: VaultItem[];
  isLoading: boolean;
  isUnlocked: boolean;
  stats: {
    total: number;
    favorites: number;
    byType: Record<VaultItemType, number>;
  };
}

export interface SessionState {
  vaultKey: CryptoKey | null;          // never persisted
  lastActivity: number;
  autoLockMinutes: number;
  isLocked: boolean;
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export interface RegisterFormData {
  email: string;
  masterPassword: string;
  confirmPassword: string;
}

export interface LoginFormData {
  email: string;
  masterPassword: string;
}

export interface VaultItemFormData {
  itemType: VaultItemType;
  name: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  cardholderName?: string;
  cardNumber?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
  content?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  isFavorite?: boolean;
}

// ─── API Responses ─────────────────────────────────────────────────────────────

export interface VaultListResponse {
  items: VaultItemRaw[];
  total: number;
  stats: {
    total: number;
    favorites: number;
    byType: Record<string, number>;
  };
}
