import { z } from 'zod';

// ─── Auth Validators ───────────────────────────────────────────────────────────

export const sendHintSchema = z.object({
  body: z.object({
    email: z.string().email('Valid email required').max(255).toLowerCase().trim(),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email address')
      .max(255)
      .toLowerCase()
      .trim(),
    authPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128),
    encryptedVaultKey: z.string().min(1, 'Encrypted vault key is required'),
    vaultKeySalt: z.string().min(1, 'Vault key salt is required'),
    vaultKeyIv: z.string().min(1, 'Vault key IV is required'),
    vaultKeyAuthTag: z.string().min(1, 'Vault key auth tag is required'),
    passwordHint: z.string().max(255).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().max(255).toLowerCase().trim(),
    authPassword: z.string().min(1).max(128),
  }),
});

export const refreshSchema = z.object({
  cookies: z.object({
    refreshToken: z.string().min(1, 'Refresh token required'),
  }),
});

// ─── Vault Validators ──────────────────────────────────────────────────────────

const encryptedPayloadSchema = z.object({
  encryptedData: z.string().min(1, 'Encrypted data is required'),
  iv: z.string().length(16, 'IV must be 16 chars (12 bytes base64)'),
  authTag: z.string().length(24, 'Auth tag must be 24 chars (16 bytes base64)'),
});

export const createVaultItemSchema = z.object({
  body: encryptedPayloadSchema.extend({
    itemType: z.enum(['login', 'note', 'card', 'identity']).default('login'),
    isFavorite: z.boolean().default(false),
    folderId: z.string().max(100).optional(),
    urlHash: z.string().max(64).optional(),
    historyEncryptedData: z.string().optional(),
    historyIv: z.string().optional(),
    historyAuthTag: z.string().optional(),
  }),
});

export const updateVaultItemSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      encryptedData: z.string().optional(),
      iv: z.string().length(16).optional(),
      authTag: z.string().length(24).optional(),
      isFavorite: z.boolean().optional(),
      folderId: z.string().max(100).optional().nullable(),
      urlHash: z.string().max(64).optional().nullable(),
      historyEncryptedData: z.string().optional(),
      historyIv: z.string().optional(),
      historyAuthTag: z.string().optional(),
    })
    .refine(
      (data) => {
        // If any encrypted field is provided, all three must be
        const encFields = [data.encryptedData, data.iv, data.authTag];
        const provided = encFields.filter(Boolean).length;
        return provided === 0 || provided === 3;
      },
      {
        message: 'If updating encrypted data, encryptedData, iv, and authTag are all required',
      }
    ),
});

export const deleteVaultItemSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    historyEncryptedData: z.string().optional(),
    historyIv: z.string().optional(),
    historyAuthTag: z.string().optional(),
  }).optional(),
});

export const vaultQuerySchema = z.object({
  query: z.object({
    itemType: z.enum(['login', 'note', 'card', 'identity']).optional(),
    isFavorite: z
      .string()
      .transform((v) => v === 'true')
      .optional(),
    folderId: z.string().optional(),
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(200)).optional(),
  }),
});

export const duplicateCheckSchema = z.object({
  body: z.object({
    urlHash: z.string().min(1, 'URL hash is required'),
  }),
});

// ─── History Validators ────────────────────────────────────────────────────────

export const createHistorySchema = z.object({
  body: encryptedPayloadSchema.extend({
    vaultItemId: z.string().optional(),
    action: z.enum(['created', 'updated', 'deleted', 'viewed', 'password_copied']),
  }),
});

export const historyQuerySchema = z.object({
  query: z.object({
    action: z
      .enum(['created', 'updated', 'deleted', 'viewed', 'password_copied'])
      .optional(),
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type CreateVaultItemInput = z.infer<typeof createVaultItemSchema>['body'];
export type UpdateVaultItemInput = z.infer<typeof updateVaultItemSchema>['body'];
