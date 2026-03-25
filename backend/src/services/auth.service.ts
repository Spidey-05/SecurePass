import bcrypt from 'bcryptjs';
import { userRepository, CreateUserDto } from '../repositories/user.repository';
import { refreshTokenRepository } from '../repositories/refreshToken.repository';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const BCRYPT_ROUNDS = 12;

export interface RegisterDto {
  email: string;
  // Client sends: hash of master password for auth (NOT the master password itself)
  // The actual master password NEVER leaves the client
  authPassword: string;      // bcrypt'd server-side for storage
  // Zero-knowledge encrypted vault key data
  encryptedVaultKey: string;
  vaultKeySalt: string;
  vaultKeyIv: string;
  vaultKeyAuthTag: string;
  passwordHint?: string;
}

export interface LoginDto {
  email: string;
  authPassword: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    encryptedVaultKey: string;
    vaultKeySalt: string;
    vaultKeyIv: string;
    vaultKeyAuthTag: string;
  };
}

class AuthService {
  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await userRepository.existsByEmail(dto.email);
    if (existing) {
      throw AppError.conflict('Email already registered', 'EMAIL_EXISTS');
    }

    // Hash auth password with bcrypt (server-side auth only)
    const authSalt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const passwordHash = await bcrypt.hash(dto.authPassword, authSalt);

    const userData: CreateUserDto = {
      email: dto.email,
      passwordHash,
      authSalt,
      encryptedVaultKey: dto.encryptedVaultKey,
      vaultKeySalt: dto.vaultKeySalt,
      vaultKeyIv: dto.vaultKeyIv,
      vaultKeyAuthTag: dto.vaultKeyAuthTag,
      passwordHint: dto.passwordHint,
    };

    const user = await userRepository.create(userData);

    const { token: refreshToken } = signRefreshToken(user._id.toString(), 'new');
    const { refreshToken: storedToken, family } = await refreshTokenRepository.create({
      userId: user._id.toString(),
      token: refreshToken,
    });

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
    });

    logger.info(`New user registered: ${user.email}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        encryptedVaultKey: user.encryptedVaultKey,
        vaultKeySalt: user.vaultKeySalt,
        vaultKeyIv: user.vaultKeyIv,
        vaultKeyAuthTag: user.vaultKeyAuthTag,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await userRepository.findByEmailForAuth(dto.email);

    // Use consistent error messaging to prevent email enumeration
    const invalidCredError = AppError.unauthorized('Invalid credentials');

    if (!user) {
      // Constant-time comparison even for non-existent users
      await bcrypt.hash('dummy-password-timing-attack-prevention', BCRYPT_ROUNDS);
      throw invalidCredError;
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000 / 60);
      throw AppError.tooManyRequests(
        `Account locked. Try again in ${remaining} minutes.`
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(dto.authPassword, user.passwordHash);
    if (!isValid) {
      await userRepository.incrementFailedAttempts(user._id.toString());
      throw invalidCredError;
    }

    // Reset failed attempts on successful login
    await userRepository.resetFailedAttempts(user._id.toString());

    // Update last login metadata
    await userRepository.update(user._id.toString(), {
      lastLoginAt: new Date(),
      lastLoginIp: dto.ipAddress,
    });

    // Issue tokens
    const { token: refreshToken } = signRefreshToken(user._id.toString(), 'login');
    await refreshTokenRepository.create({
      userId: user._id.toString(),
      token: refreshToken,
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
    });

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
    });

    logger.info(`User logged in: ${user.email} from ${dto.ipAddress}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        encryptedVaultKey: user.encryptedVaultKey,
        vaultKeySalt: user.vaultKeySalt,
        vaultKeyIv: user.vaultKeyIv,
        vaultKeyAuthTag: user.vaultKeyAuthTag,
      },
    };
  }

  async refreshTokens(
    oldRefreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload;
    try {
      payload = verifyRefreshToken(oldRefreshToken);
    } catch {
      throw AppError.unauthorized('Invalid refresh token');
    }

    const tokenHash = hashToken(oldRefreshToken);
    const storedToken = await refreshTokenRepository.findByTokenHash(tokenHash);

    if (!storedToken) {
      // Token reuse detected — revoke entire family
      await refreshTokenRepository.revokeFamily(payload.family);
      logger.warn(`Refresh token reuse detected for user ${payload.sub}`);
      throw AppError.unauthorized('Token reuse detected. Please login again.');
    }

    if (storedToken.isRevoked) {
      throw AppError.unauthorized('Refresh token has been revoked');
    }

    // Issue new tokens (rotation)
    const { token: newRefreshToken } = signRefreshToken(payload.sub, payload.family);

    await refreshTokenRepository.rotate({
      oldToken: oldRefreshToken,
      newToken: newRefreshToken,
      userId: payload.sub,
      family: payload.family,
      userAgent,
      ipAddress,
    });

    const user = await userRepository.findById(payload.sub);
    if (!user) throw AppError.unauthorized('User not found');

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await refreshTokenRepository.revokeByTokenHash(tokenHash);
  }

  async logoutAll(userId: string): Promise<void> {
    await refreshTokenRepository.revokeAllForUser(userId);
  }

  async getVaultKeyData(userId: string): Promise<{
    encryptedVaultKey: string;
    vaultKeySalt: string;
    vaultKeyIv: string;
    vaultKeyAuthTag: string;
  }> {
    const user = await userRepository.findByEmailForAuth(''); // workaround
    const fullUser = await userRepository.findById(userId);
    if (!fullUser) throw AppError.notFound('User not found');

    // We need the encrypted fields — re-fetch with select
    const userWithKeys = await userRepository.findByEmailForAuth(fullUser.email);
    if (!userWithKeys) throw AppError.notFound('User not found');

    return {
      encryptedVaultKey: userWithKeys.encryptedVaultKey,
      vaultKeySalt: userWithKeys.vaultKeySalt,
      vaultKeyIv: userWithKeys.vaultKeyIv,
      vaultKeyAuthTag: userWithKeys.vaultKeyAuthTag,
    };
  }
}

export const authService = new AuthService();
