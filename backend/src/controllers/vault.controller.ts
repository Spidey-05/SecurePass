import { Request, Response } from 'express';
import { vaultService } from '../services/vault.service';
import { asyncHandler } from '../utils/errors';

export const createItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await vaultService.create(req.user!.id, req.body);
  res.status(201).json({ success: true, data: { item } });
});

export const getAllItems = asyncHandler(async (req: Request, res: Response) => {
  const { itemType, isFavorite, folderId, page, limit } = req.query as Record<string, string>;
  const result = await vaultService.getAll(req.user!.id, {
    itemType: itemType as 'login' | 'note' | 'card' | 'identity' | undefined,
    isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
    folderId,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ success: true, data: result });
});

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await vaultService.getOne(req.user!.id, req.params['id']!);
  res.json({ success: true, data: { item } });
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await vaultService.update(req.user!.id, req.params['id']!, req.body);
  res.json({ success: true, data: { item } });
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  await vaultService.delete(req.user!.id, req.params['id']!, req.body);
  res.json({ success: true, message: 'Vault item deleted' });
});

export const checkDuplicates = asyncHandler(async (req: Request, res: Response) => {
  const { urlHash } = req.body as { urlHash: string };
  const duplicates = await vaultService.checkDuplicates(req.user!.id, urlHash);
  res.json({ success: true, data: { duplicates, count: duplicates.length } });
});
