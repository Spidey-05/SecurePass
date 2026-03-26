import { vaultRepository, CreateVaultItemDto, UpdateVaultItemDto, VaultQueryOptions } from '../repositories/vault.repository';
import { historyRepository } from '../repositories/history.repository';
import { IVaultItem } from '../models/Vault';
import { AppError } from '../utils/errors';

export interface CreateVaultDto {
  encryptedData: string;
  iv: string;
  authTag: string;
  itemType?: 'login' | 'note' | 'card' | 'identity';
  isFavorite?: boolean;
  folderId?: string;
  urlHash?: string;
  // For history tracking (encrypted)
  historyEncryptedData?: string;
  historyIv?: string;
  historyAuthTag?: string;
}

export interface UpdateVaultDto {
  encryptedData?: string;
  iv?: string;
  authTag?: string;
  isFavorite?: boolean;
  folderId?: string;
  urlHash?: string;
  historyEncryptedData?: string;
  historyIv?: string;
  historyAuthTag?: string;
}

class VaultService {
  async create(userId: string, dto: CreateVaultDto): Promise<IVaultItem> {
    const itemData: CreateVaultItemDto = {
      userId,
      encryptedData: dto.encryptedData,
      iv: dto.iv,
      authTag: dto.authTag,
      itemType: dto.itemType ?? 'login',
      isFavorite: dto.isFavorite ?? false,
      folderId: dto.folderId,
      urlHash: dto.urlHash,
    };

    const item = await vaultRepository.create(itemData);

    // Log encrypted history
    if (dto.historyEncryptedData && dto.historyIv && dto.historyAuthTag) {
      await historyRepository.create({
        userId,
        vaultItemId: item._id.toString(),
        encryptedData: dto.historyEncryptedData,
        iv: dto.historyIv,
        authTag: dto.historyAuthTag,
        action: 'created',
      }).catch(() => { /* non-critical */ });
    }

    return item;
  }

  async getAll(userId: string, options: VaultQueryOptions = {}): Promise<{
    items: IVaultItem[];
    total: number;
    stats: { total: number; favorites: number; byType: Record<string, number> };
  }> {
    const { items, total } = await vaultRepository.findAllByUser(userId, options);

    // Stats only calculated without filter for dashboard
    const allItems = options.itemType || options.isFavorite !== undefined
      ? await vaultRepository.findAllByUser(userId, { limit: 1000 })
      : { items, total };

    const stats = {
      total: allItems.total,
      favorites: allItems.items.filter(i => i.isFavorite).length,
      byType: allItems.items.reduce<Record<string, number>>((acc, item) => {
        acc[item.itemType] = (acc[item.itemType] ?? 0) + 1;
        return acc;
      }, {}),
    };

    return { items, total, stats };
  }

  async getOne(userId: string, itemId: string): Promise<IVaultItem> {
    const item = await vaultRepository.findById(itemId, userId);
    if (!item) throw AppError.notFound('Vault item not found');

    // Update last accessed time (non-blocking)
    vaultRepository.update(itemId, userId, { lastAccessedAt: new Date() }).catch(() => {});

    return item;
  }

  async update(userId: string, itemId: string, dto: UpdateVaultDto): Promise<IVaultItem> {
    const existing = await vaultRepository.findById(itemId, userId);
    if (!existing) throw AppError.notFound('Vault item not found');

    const updateData: UpdateVaultItemDto = {};
    if (dto.encryptedData) updateData.encryptedData = dto.encryptedData;
    if (dto.iv) updateData.iv = dto.iv;
    if (dto.authTag) updateData.authTag = dto.authTag;
    if (dto.isFavorite !== undefined) updateData.isFavorite = dto.isFavorite;
    if (dto.folderId !== undefined) updateData.folderId = dto.folderId;
    if (dto.urlHash !== undefined) updateData.urlHash = dto.urlHash;

    const updated = await vaultRepository.update(itemId, userId, updateData);
    if (!updated) throw AppError.internal('Failed to update vault item');

    // Log history
    if (dto.historyEncryptedData && dto.historyIv && dto.historyAuthTag) {
      await historyRepository.create({
        userId,
        vaultItemId: itemId,
        encryptedData: dto.historyEncryptedData,
        iv: dto.historyIv,
        authTag: dto.historyAuthTag,
        action: 'updated',
      }).catch(() => {});
    }

    return updated;
  }

  async delete(userId: string, itemId: string, historyData?: {
    encryptedData: string;
    iv: string;
    authTag: string;
  }): Promise<void> {
    const existing = await vaultRepository.findById(itemId, userId);
    if (!existing) throw AppError.notFound('Vault item not found');

    await vaultRepository.delete(itemId, userId);

    if (historyData) {
      await historyRepository.create({
        userId,
        encryptedData: historyData.encryptedData,
        iv: historyData.iv,
        authTag: historyData.authTag,
        action: 'deleted',
      }).catch(() => {});
    }
  }

  async checkDuplicates(userId: string, urlHash: string): Promise<IVaultItem[]> {
    return vaultRepository.findByUrlHash(urlHash, userId);
  }
}

export const vaultService = new VaultService();
