import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;        // userId
  email: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  family: string;     // for rotation detection
  jti: string;        // unique token ID
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as any,
    algorithm: 'HS256',
    issuer: env.APP_NAME,
    audience: 'web',
  });
}

export function signRefreshToken(
  userId: string,
  family: string
): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: userId, family, jti },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRY as any,
      algorithm: 'HS256',
      issuer: env.APP_NAME,
      audience: 'web',
    }
  );
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: env.APP_NAME,
    audience: 'web',
  }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer: env.APP_NAME,
    audience: 'web',
  }) as RefreshTokenPayload;
}

// Hash the refresh token for safe storage
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Parse expiry string like "7d" into a Date
export function parseExpiryToDate(expiry: string): Date {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);
  const ms: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + value * (ms[unit] ?? 1000));
}
