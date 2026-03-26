import mongoose from 'mongoose';
import { HistoryItem, IHistoryItem } from '../models/History';

export interface CreateHistoryDto {
  userId: string;
  vaultItemId?: string;
  encryptedData: string;
  iv: string;
  authTag: string;
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'password_copied';
}

class HistoryRepository {
  async create(data: CreateHistoryDto): Promise<IHistoryItem> {
    return HistoryItem.create(data);
  }

  async findByUser(
    userId: string,
    options: { page?: number; limit?: number; action?: string } = {}
  ): Promise<{ items: IHistoryItem[]; total: number }> {
    const { page = 1, limit = 50, action } = options;
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };
    if (action) query['action'] = action;

    const [items, total] = await Promise.all([
      HistoryItem.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      HistoryItem.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async deleteByUser(userId: string): Promise<number> {
    const result = await HistoryItem.deleteMany({
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();
    return result.deletedCount;
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await HistoryItem.findOneAndDelete({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();
    return result !== null;
  }
}

export const historyRepository = new HistoryRepository();
