import mongoose from 'mongoose';
import { VaultItem, IVaultItem } from '../models/Vault';

export interface CreateVaultItemDto {
  userId: string;
  encryptedData: string;
  iv: string;
  authTag: string;
  itemType: 'login' | 'note' | 'card' | 'identity';
  isFavorite?: boolean;
  folderId?: string;
  urlHash?: string;
}

export interface UpdateVaultItemDto {
  encryptedData?: string;
  iv?: string;
  authTag?: string;
  isFavorite?: boolean;
  folderId?: string;
  urlHash?: string;
  lastAccessedAt?: Date;
}

export interface VaultQueryOptions {
  itemType?: 'login' | 'note' | 'card' | 'identity';
  isFavorite?: boolean;
  folderId?: string;
  page?: number;
  limit?: number;
}

class VaultRepository {
  async create(data: CreateVaultItemDto): Promise<IVaultItem> {
    const item = new VaultItem(data);
    return item.save();
  }

  async findById(id: string, userId: string): Promise<IVaultItem | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    return VaultItem.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();
  }

  async findAllByUser(userId: string, options: VaultQueryOptions = {}): Promise<{
    items: IVaultItem[];
    total: number;
  }> {
    const { itemType, isFavorite, folderId, page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (itemType) query['itemType'] = itemType;
    if (isFavorite !== undefined) query['isFavorite'] = isFavorite;
    if (folderId) query['folderId'] = folderId;

    const [items, total] = await Promise.all([
      VaultItem.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      VaultItem.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    userId: string,
    data: UpdateVaultItemDto
  ): Promise<IVaultItem | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    return VaultItem.findOneAndUpdate(
      { _id: id, userId: new mongoose.Types.ObjectId(userId) },
      { $set: data },
      { new: true, runValidators: true }
    ).exec();
  }

  async delete(id: string, userId: string): Promise<boolean> {
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await VaultItem.findOneAndDelete({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();
    return result !== null;
  }

  async deleteAllByUser(userId: string): Promise<number> {
    const result = await VaultItem.deleteMany({
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();
    return result.deletedCount;
  }

  async findByUrlHash(urlHash: string, userId: string): Promise<IVaultItem[]> {
    return VaultItem.find({
      urlHash,
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();
  }

  async countByUser(userId: string): Promise<number> {
    return VaultItem.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();
  }
}

export const vaultRepository = new VaultRepository();
