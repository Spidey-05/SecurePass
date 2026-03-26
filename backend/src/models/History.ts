import mongoose, { Document, Schema } from 'mongoose';

// Stores encrypted history of password changes
// All sensitive data is encrypted client-side before storage
export interface IHistoryItem extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  vaultItemId?: mongoose.Types.ObjectId; // null if item was deleted

  // Encrypted payload — decrypted structure: { name, password, url, action }
  encryptedData: string;
  iv: string;
  authTag: string;

  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'password_copied';
  createdAt: Date;
}

const HistoryItemSchema = new Schema<IHistoryItem>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vaultItemId: {
      type: Schema.Types.ObjectId,
      ref: 'VaultItem',
      default: null,
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
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted', 'viewed', 'password_copied'],
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Keep history for 90 days automatically via TTL index
HistoryItemSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
HistoryItemSchema.index({ userId: 1, createdAt: -1 });

export const HistoryItem = mongoose.model<IHistoryItem>('HistoryItem', HistoryItemSchema);
