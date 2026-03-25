import { Request, Response } from 'express';
import { historyRepository } from '../repositories/history.repository';
import { asyncHandler } from '../utils/errors';

export const createEntry = asyncHandler(async (req: Request, res: Response) => {
  const { encryptedData, iv, authTag, vaultItemId, action } = req.body as {
    encryptedData: string;
    iv: string;
    authTag: string;
    vaultItemId?: string;
    action: 'created' | 'updated' | 'deleted' | 'viewed' | 'password_copied';
  };

  const entry = await historyRepository.create({
    userId: req.user!.id,
    vaultItemId,
    encryptedData,
    iv,
    authTag,
    action,
  });

  res.status(201).json({ success: true, data: { entry } });
});

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const { action, page, limit } = req.query as Record<string, string>;

  const result = await historyRepository.findByUser(req.user!.id, {
    action,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 50,
  });

  res.json({ success: true, data: result });
});

export const clearHistory = asyncHandler(async (req: Request, res: Response) => {
  const count = await historyRepository.deleteByUser(req.user!.id);
  res.json({ success: true, message: `Cleared ${count} history entries` });
});

export const deleteEntry = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await historyRepository.deleteById(req.params['id']!, req.user!.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { message: 'History entry not found' } });
    return;
  }
  res.json({ success: true, message: 'History entry deleted' });
});
