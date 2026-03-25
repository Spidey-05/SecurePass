import mongoose, { Document, Schema } from 'mongoose';

// ZERO-KNOWLEDGE: All fields except metadata are AES-256-GCM encrypted
// The server never sees plaintext passwords, usernames, URLs, or notes
export interface IVaultItem extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Encrypted payload (AES-256-GCM)
  // Decrypted structure: { name, username, password, url, notes, customFields }
  encryptedData: string;   // base64 ciphertext
  iv: string;              // base64 IV (12 bytes for GCM)
  authTag: string;         // base64 auth tag (16 bytes)

  // Metadata (not encrypted — used for search/display hints only)
  // IMPORTANT: Do NOT store sensitive info here
  itemType: 'login' | 'note' | 'card' | 'identity';
  isFavorite: boolean;
  folderId?: string;

  // For duplicate detection (HMAC of URL — not reversible without key)
  urlHash?: string;

  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
}

const VaultItemSchema = new Schema<IVaultItem>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    encryptedData: {
      type: String,
      required: true,
    },
    iv: {
      type: String,
      required: true,
    },
    authTag: {
      type: String,
      required: true,
    },
    itemType: {
      type: String,
      enum: ['login', 'note', 'card', 'identity'],
      default: 'login',
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    folderId: {
      type: String,
      default: null,
    },
    urlHash: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for efficient per-user queries
VaultItemSchema.index({ userId: 1, itemType: 1 });
VaultItemSchema.index({ userId: 1, isFavorite: 1 });
VaultItemSchema.index({ userId: 1, updatedAt: -1 });

export const VaultItem = mongoose.model<IVaultItem>('VaultItem', VaultItemSchema);
