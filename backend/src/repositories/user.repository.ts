import mongoose from 'mongoose';
import { User, IUser } from '../models/User';

export interface CreateUserDto {
  email: string;
  passwordHash: string;
  authSalt: string;
  encryptedVaultKey: string;
  vaultKeySalt: string;
  vaultKeyIv: string;
  vaultKeyAuthTag: string;
  passwordHint?: string;
}

export interface UpdateUserDto {
  passwordHash?: string;
  encryptedVaultKey?: string;
  vaultKeySalt?: string;
  vaultKeyIv?: string;
  vaultKeyAuthTag?: string;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  passwordChangedAt?: Date;
  isVerified?: boolean;
}

class UserRepository {
  async create(data: CreateUserDto): Promise<IUser> {
    const user = new User(data);
    return user.save();
  }

  async findById(id: string): Promise<IUser | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    return User.findById(id).exec();
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  // Returns sensitive fields needed for auth (excluded by default)
  async findByEmailForAuth(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash +authSalt +encryptedVaultKey +vaultKeySalt +vaultKeyIv +vaultKeyAuthTag')
      .exec();
  }

  async update(id: string, data: UpdateUserDto): Promise<IUser | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    return User.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).exec();
  }

  async delete(id: string): Promise<boolean> {
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await User.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return User.exists({ email: email.toLowerCase().trim() }).then(Boolean);
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

    await User.findByIdAndUpdate(id, [
      {
        $set: {
          failedLoginAttempts: { $add: ['$failedLoginAttempts', 1] },
          lockedUntil: {
            $cond: {
              if: { $gte: [{ $add: ['$failedLoginAttempts', 1] }, MAX_ATTEMPTS] },
              then: new Date(Date.now() + LOCKOUT_DURATION_MS),
              else: '$lockedUntil',
            },
          },
        },
      },
    ]).exec();
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await User.findByIdAndUpdate(id, {
      $set: { failedLoginAttempts: 0, lockedUntil: null },
    }).exec();
  }
}

export const userRepository = new UserRepository();
