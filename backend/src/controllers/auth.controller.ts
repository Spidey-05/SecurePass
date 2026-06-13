import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../utils/errors';
import { refreshTokenCookieOptions } from '../middleware/security.middleware';
import { userRepository } from '../repositories/user.repository';
import { sendPasswordHintEmail, isSmtpConfigured } from '../utils/email';
import { logger } from '../utils/logger';

function sendTokens(
  res: Response,
  data: { accessToken: string; refreshToken: string; user: object }
): void {
  res.cookie('refreshToken', data.refreshToken, refreshTokenCookieOptions);
  res.json({
    success: true,
    data: { accessToken: data.accessToken, user: data.user },
  });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201);
  sendTokens(res, result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login({
    ...req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  sendTokens(res, result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies as { refreshToken: string };
  const result = await authService.refreshTokens(
    refreshToken,
    req.headers['user-agent'],
    req.ip
  );
  res.cookie('refreshToken', result.refreshToken, refreshTokenCookieOptions);
  res.json({ success: true, data: { accessToken: result.accessToken } });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies as { refreshToken?: string };
  if (refreshToken) await authService.logout(refreshToken);
  res.clearCookie('refreshToken', { ...refreshTokenCookieOptions, maxAge: undefined });
  res.json({ success: true, message: 'Logged out successfully' });
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await authService.logoutAll(req.user!.id);
  res.clearCookie('refreshToken', { ...refreshTokenCookieOptions, maxAge: undefined });
  res.json({ success: true, message: 'Logged out of all devices' });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const vaultKeyData = await authService.getVaultKeyData(req.user!.id);
  res.json({
    success: true,
    data: {
      user: { id: req.user!.id, email: req.user!.email, ...vaultKeyData },
    },
  });
});

export const sendHint = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    res.status(400).json({ success: false, error: { message: 'Email is required' } });
    return;
  }

  // Generic response — never reveal whether the email exists
  const genericOk = {
    success: true,
    message: 'If this account exists and has a hint, an email has been sent.',
  };

  if (!isSmtpConfigured() && process.env['NODE_ENV'] === 'production') {
    res.status(500).json({ success: false, error: { message: 'SMTP email delivery is not configured on this server.' } });
    return;
  }

  try {
    const user = await userRepository.findByEmail(email.toLowerCase().trim());

    if (!user) {
      await new Promise(resolve => setTimeout(resolve, 300));
      res.json(genericOk);
      return;
    }

    const emailSent = await sendPasswordHintEmail(user.email, user.passwordHint ?? null);

    // In development without SMTP, return hint directly so it's testable
    if (emailSent !== true && process.env['NODE_ENV'] !== 'production') {
      res.json({
        success: true,
        devMode: true,
        hint: user.passwordHint ?? '(no hint set for this account)',
        message: 'SMTP not configured — showing hint in dev mode only.',
      });
      return;
    }

    if (emailSent !== true) {
      res.status(500).json({ success: false, error: { message: `SMTP Error: ${emailSent}` } });
      return;
    }

    res.json(genericOk);
  } catch (err) {
    logger.error('sendHint error:', err);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});
