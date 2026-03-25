import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

// ── Create transporter ────────────────────────────────────────────────────────

function createTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

// ── Send password hint email ──────────────────────────────────────────────────

export async function sendPasswordHintEmail(
  to: string,
  hint: string | null
): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    logger.warn('SMTP not configured — skipping hint email');
    return false;
  }

  const subject = 'Your SecurePass Password Hint';

  const html = hint
    ? `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:56px;height:56px;background:#4f46e5;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">🔐</div>
        <h1 style="font-size:22px;font-weight:bold;margin-top:12px;color:#f1f5f9;">SecurePass</h1>
      </div>

      <h2 style="font-size:16px;color:#94a3b8;font-weight:normal;margin-bottom:20px;">Your master password hint:</h2>

      <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="font-size:18px;font-weight:600;color:#a5b4fc;margin:0;letter-spacing:0.5px;">${hint}</p>
      </div>

      <div style="background:#1e293b;border:1px solid #f59e0b44;border-radius:10px;padding:16px;margin-bottom:24px;">
        <p style="color:#fbbf24;font-size:13px;margin:0;">
          ⚠️ <strong>Important:</strong> This is only a hint — not your actual password.
          Your vault can only be decrypted with your master password.
          We never store your password or any key that can decrypt your data.
        </p>
      </div>

      <p style="color:#475569;font-size:12px;text-align:center;">
        If you didn't request this, you can safely ignore this email.
        <br/>SecurePass · Zero-Knowledge Password Manager
      </p>
    </div>
    `
    : `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:56px;height:56px;background:#4f46e5;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">🔐</div>
        <h1 style="font-size:22px;font-weight:bold;margin-top:12px;color:#f1f5f9;">SecurePass</h1>
      </div>

      <h2 style="font-size:16px;color:#94a3b8;margin-bottom:16px;">No hint found</h2>

      <p style="color:#64748b;font-size:14px;line-height:1.6;margin-bottom:20px;">
        This account does not have a password hint set.
      </p>

      <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px;">
        <p style="color:#94a3b8;font-size:13px;margin:0;line-height:1.6;">
          Because SecurePass is zero-knowledge, your master password cannot be recovered.
          If you cannot remember it, you'll need to create a new account.
        </p>
      </div>

      <p style="color:#475569;font-size:12px;text-align:center;margin-top:24px;">
        SecurePass · Zero-Knowledge Password Manager
      </p>
    </div>
    `;

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
    });
    logger.info(`Password hint email sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('Failed to send hint email:', err);
    return false;
  }
}

// ── Verify SMTP connection ────────────────────────────────────────────────────

export async function verifyEmailConfig(): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) return false;
  try {
    await transporter.verify();
    logger.info('✅ SMTP connection verified');
    return true;
  } catch (err) {
    logger.warn('SMTP connection failed:', err);
    return false;
  }
}
