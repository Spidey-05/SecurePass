import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;         // bcrypt hash of master password
  authSalt: string;             // Salt for server-side auth (bcrypt)
  encryptedVaultKey: string;    // AES-256-GCM encrypted vault key (encrypted with derived key)
  vaultKeySalt: string;         // Argon2 salt for deriving the vault encryption key
  vaultKeyIv: string;           // IV used to encrypt the vault key
  vaultKeyAuthTag: string;      // Auth tag from AES-GCM encryption of vault key
  isVerified: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  passwordChangedAt: Date;
  passwordHint?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
      maxlength: 255,
    },
    // bcrypt hash — used for server-side authentication only
    // This is NOT the master password used for encryption
    passwordHash: {
      type: String,
      required: true,
    },
    authSalt: {
      type: String,
      required: true,
    },
    // Zero-knowledge vault key system:
    // Client derives KEK (Key Encryption Key) from master password via Argon2
    // KEK encrypts the randomly generated vault key
    // Server stores ONLY the encrypted vault key — never the plaintext vault key
    encryptedVaultKey: {
      type: String,
      required: true,
    },
    vaultKeySalt: {
      type: String,
      required: true,
    },
    vaultKeyIv: {
      type: String,
      required: true,
    },
    vaultKeyAuthTag: {
      type: String,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false, // never returned by default
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: Date,
    lastLoginIp: String,
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    passwordHint: {
      type: String,
      default: null,
      maxlength: 255,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        // Never expose sensitive fields
        delete (ret as any).passwordHash;
        delete (ret as any).authSalt;
        delete (ret as any).encryptedVaultKey;
        delete (ret as any).vaultKeyIv;
        delete (ret as any).vaultKeyAuthTag;
        delete (ret as any).mfaSecret;
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ lockedUntil: 1 }, { expireAfterSeconds: 0, sparse: true });

// Instance method: check if account is locked
UserSchema.methods.isLocked = function (): boolean {
  if (!this.lockedUntil) return false;
  return new Date() < this.lockedUntil;
};

// Instance method: increment failed attempts
UserSchema.methods.incrementFailedAttempts = async function (): Promise<void> {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5) {
    // Lock for 15 minutes after 5 failed attempts
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  await this.save();
};

// Instance method: reset failed attempts
UserSchema.methods.resetFailedAttempts = async function (): Promise<void> {
  this.failedLoginAttempts = 0;
  this.lockedUntil = undefined;
  await this.save();
};

export const User = mongoose.model<IUser>('User', UserSchema);
