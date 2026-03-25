import { RefreshToken, IRefreshToken } from '../models/RefreshToken';
import { hashToken, parseExpiryToDate } from '../utils/jwt';
import { env } from '../config/env';
import crypto from 'crypto';

class RefreshTokenRepository {
  async create(data: {
    userId: string;
    token: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ refreshToken: IRefreshToken; family: string }> {
    const family = crypto.randomUUID();
    const tokenHash = hashToken(data.token);
    const expiresAt = parseExpiryToDate(env.JWT_REFRESH_EXPIRY);

    const refreshToken = await RefreshToken.create({
      userId: data.userId,
      tokenHash,
      family,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      expiresAt,
    });

    return { refreshToken, family };
  }

  async findByTokenHash(tokenHash: string): Promise<IRefreshToken | null> {
    return RefreshToken.findOne({ tokenHash, isRevoked: false }).exec();
  }

  async findByFamily(family: string): Promise<IRefreshToken[]> {
    return RefreshToken.find({ family }).exec();
  }

  // Token rotation: revoke old token, create new one with same family
  async rotate(data: {
    oldToken: string;
    newToken: string;
    userId: string;
    family: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<IRefreshToken> {
    // Revoke the old token
    await RefreshToken.updateOne(
      { tokenHash: hashToken(data.oldToken) },
      { $set: { isRevoked: true } }
    ).exec();

    // Issue new token in the same family
    const newTokenHash = hashToken(data.newToken);
    const expiresAt = parseExpiryToDate(env.JWT_REFRESH_EXPIRY);

    return RefreshToken.create({
      userId: data.userId,
      tokenHash: newTokenHash,
      family: data.family,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      expiresAt,
    });
  }

  // Revoke all tokens in a family (reuse detection)
  async revokeFamily(family: string): Promise<void> {
    await RefreshToken.updateMany(
      { family },
      { $set: { isRevoked: true } }
    ).exec();
  }

  // Revoke all tokens for a user (logout all devices)
  async revokeAllForUser(userId: string): Promise<void> {
    await RefreshToken.updateMany(
      { userId },
      { $set: { isRevoked: true } }
    ).exec();
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await RefreshToken.updateOne(
      { tokenHash },
      { $set: { isRevoked: true } }
    ).exec();
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
