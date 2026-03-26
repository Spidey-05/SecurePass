/**
 * Tests for the zero-knowledge crypto module.
 * Uses Node.js WebCrypto (available since Node 18).
 */

// Polyfill WebCrypto for Jest environment
import { webcrypto } from 'crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

import {
  generateSalt,
  deriveKEK,
  deriveAuthPassword,
  generateVaultKey,
  encryptVaultKey,
  decryptVaultKey,
  encryptData,
  decryptData,
  prepareRegistration,
  prepareLogin,
} from '../src/lib/crypto';

describe('Crypto Module — Zero-Knowledge Architecture', () => {
  // ── generateSalt ────────────────────────────────────────────────────────────
  describe('generateSalt', () => {
    it('returns a non-empty base64 string', () => {
      const salt = generateSalt();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(0);
    });

    it('generates unique salts on each call', () => {
      const salts = Array.from({ length: 100 }, generateSalt);
      const unique = new Set(salts);
      expect(unique.size).toBe(100);
    });
  });

  // ── deriveKEK ───────────────────────────────────────────────────────────────
  describe('deriveKEK', () => {
    it('derives a CryptoKey from password and salt', async () => {
      const salt = generateSalt();
      const kek = await deriveKEK('my-master-password', salt);
      expect(kek).toBeDefined();
      expect(kek.type).toBe('secret');
      expect(kek.algorithm.name).toBe('AES-GCM');
      expect(kek.extractable).toBe(false); // non-extractable for security
    });

    it('produces different keys for different salts', async () => {
      const pw = 'same-password';
      const kek1 = await deriveKEK(pw, generateSalt());
      const kek2 = await deriveKEK(pw, generateSalt());
      // Can't compare CryptoKey directly — verify they encrypt differently
      const data = new TextEncoder().encode('test');
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const enc1 = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek1, data);
      const enc2 = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek2, data);
      expect(Buffer.from(enc1).toString('hex')).not.toBe(Buffer.from(enc2).toString('hex'));
    });

    it('produces identical key for same password+salt (deterministic)', async () => {
      const pw = 'deterministic-pw';
      const salt = generateSalt();
      // Verify both keys encrypt/decrypt the same data
      const kek1 = await deriveKEK(pw, salt);
      const kek2 = await deriveKEK(pw, salt);
      const vaultKey = await generateVaultKey();
      const { encryptedVaultKey, iv, authTag } = await encryptVaultKey(vaultKey, kek1);
      // kek2 should be able to decrypt what kek1 encrypted
      await expect(decryptVaultKey(encryptedVaultKey, iv, authTag, kek2)).resolves.toBeDefined();
    });
  });

  // ── deriveAuthPassword ──────────────────────────────────────────────────────
  describe('deriveAuthPassword', () => {
    it('returns a hex string', async () => {
      const auth = await deriveAuthPassword('password', 'user@example.com');
      expect(auth).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is different from the master password', async () => {
      const master = 'my-master-password-123';
      const auth = await deriveAuthPassword(master, 'user@example.com');
      expect(auth).not.toBe(master);
    });

    it('differs per email (domain separation)', async () => {
      const pw = 'same-password';
      const a1 = await deriveAuthPassword(pw, 'user1@example.com');
      const a2 = await deriveAuthPassword(pw, 'user2@example.com');
      expect(a1).not.toBe(a2);
    });

    it('is deterministic for same inputs', async () => {
      const a1 = await deriveAuthPassword('pw', 'user@test.com');
      const a2 = await deriveAuthPassword('pw', 'user@test.com');
      expect(a1).toBe(a2);
    });
  });

  // ── Vault Key ───────────────────────────────────────────────────────────────
  describe('generateVaultKey', () => {
    it('generates an AES-GCM key', async () => {
      const key = await generateVaultKey();
      expect(key.algorithm.name).toBe('AES-GCM');
      expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
      expect(key.extractable).toBe(true); // needed to encrypt it
    });
  });

  describe('encryptVaultKey / decryptVaultKey', () => {
    it('round-trips successfully', async () => {
      const salt = generateSalt();
      const kek = await deriveKEK('master-password', salt);
      const vaultKey = await generateVaultKey();

      const { encryptedVaultKey, iv, authTag } = await encryptVaultKey(vaultKey, kek);
      expect(encryptedVaultKey).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(authTag).toBeTruthy();

      const decryptedKey = await decryptVaultKey(encryptedVaultKey, iv, authTag, kek);
      expect(decryptedKey).toBeDefined();
      expect(decryptedKey.algorithm.name).toBe('AES-GCM');
    });

    it('fails with wrong KEK', async () => {
      const salt = generateSalt();
      const kek = await deriveKEK('correct-password', salt);
      const wrongKek = await deriveKEK('wrong-password', generateSalt());
      const vaultKey = await generateVaultKey();

      const { encryptedVaultKey, iv, authTag } = await encryptVaultKey(vaultKey, kek);

      await expect(
        decryptVaultKey(encryptedVaultKey, iv, authTag, wrongKek)
      ).rejects.toBeDefined();
    });
  });

  // ── Data Encryption ─────────────────────────────────────────────────────────
  describe('encryptData / decryptData', () => {
    it('round-trips arbitrary objects', async () => {
      const vaultKey = await generateVaultKey();
      const original = {
        type: 'login',
        name: 'GitHub',
        username: 'alice',
        password: 'super-secret-hunter2',
        url: 'https://github.com',
      };

      const encrypted = await encryptData(original, vaultKey);
      expect(encrypted.encryptedData).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();
      expect(encrypted.encryptedData).not.toContain('super-secret');

      const decrypted = await decryptData<typeof original>(encrypted, vaultKey);
      expect(decrypted).toEqual(original);
    });

    it('uses unique IVs per encryption', async () => {
      const vaultKey = await generateVaultKey();
      const data = { test: 'value' };
      const e1 = await encryptData(data, vaultKey);
      const e2 = await encryptData(data, vaultKey);
      expect(e1.iv).not.toBe(e2.iv);
      expect(e1.encryptedData).not.toBe(e2.encryptedData);
    });

    it('fails authentication with tampered ciphertext', async () => {
      const vaultKey = await generateVaultKey();
      const encrypted = await encryptData({ name: 'test' }, vaultKey);

      // Tamper with ciphertext
      const tampered = {
        ...encrypted,
        encryptedData: encrypted.encryptedData.slice(0, -4) + 'XXXX',
      };

      await expect(decryptData(tampered, vaultKey)).rejects.toBeDefined();
    });

    it('fails with wrong vault key', async () => {
      const key1 = await generateVaultKey();
      const key2 = await generateVaultKey();
      const encrypted = await encryptData({ secret: 'value' }, key1);
      await expect(decryptData(encrypted, key2)).rejects.toBeDefined();
    });
  });

  // ── Full Registration Flow ──────────────────────────────────────────────────
  describe('prepareRegistration', () => {
    it('produces all required fields', async () => {
      const result = await prepareRegistration('user@example.com', 'my-master-password-123');
      expect(result.authPassword).toBeTruthy();
      expect(result.encryptedVaultKey).toBeTruthy();
      expect(result.vaultKeySalt).toBeTruthy();
      expect(result.vaultKeyIv).toBeTruthy();
      expect(result.vaultKeyAuthTag).toBeTruthy();
      expect(result.vaultKey).toBeDefined();
      expect(result.kek).toBeDefined();
    });

    it('authPassword is not the master password', async () => {
      const master = 'my-master-password-123';
      const result = await prepareRegistration('user@example.com', master);
      expect(result.authPassword).not.toBe(master);
      expect(result.authPassword).not.toContain(master);
    });
  });

  // ── Full Login Flow ─────────────────────────────────────────────────────────
  describe('prepareLogin', () => {
    it('recovers vault key from registration data', async () => {
      const email = 'test@example.com';
      const master = 'correct-master-password!';

      const regResult = await prepareRegistration(email, master);

      const loginResult = await prepareLogin(email, master, {
        encryptedVaultKey: regResult.encryptedVaultKey,
        vaultKeySalt: regResult.vaultKeySalt,
        vaultKeyIv: regResult.vaultKeyIv,
        vaultKeyAuthTag: regResult.vaultKeyAuthTag,
      });

      // The vault key should decrypt the same data
      const original = { name: 'TestItem', password: 'test123' };
      const encrypted = await encryptData(original, regResult.vaultKey);
      const decrypted = await decryptData(encrypted, loginResult.vaultKey);
      expect(decrypted).toEqual(original);
    });

    it('fails with wrong master password', async () => {
      const email = 'test@example.com';
      const regResult = await prepareRegistration(email, 'correct-password');

      await expect(
        prepareLogin(email, 'wrong-password', {
          encryptedVaultKey: regResult.encryptedVaultKey,
          vaultKeySalt: regResult.vaultKeySalt,
          vaultKeyIv: regResult.vaultKeyIv,
          vaultKeyAuthTag: regResult.vaultKeyAuthTag,
        })
      ).rejects.toBeDefined();
    });
  });
});
