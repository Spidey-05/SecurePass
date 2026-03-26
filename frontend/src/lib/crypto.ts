/**
 * SecurePass Zero-Knowledge Encryption Module
 *
 * Architecture:
 * 1. User's master password never leaves the browser.
 * 2. Argon2 (WASM) or PBKDF2 (WebCrypto fallback) derives two keys:
 *    - KEK (Key Encryption Key): used to encrypt/decrypt the vault key
 *    - Auth key: hashed server-side with bcrypt for auth only
 * 3. The vault key (random 256-bit) encrypts/decrypts vault items.
 * 4. Server stores only: encrypted vault key + encrypted vault items.
 *
 * All crypto uses the Web Crypto API (FIPS 140-2 compliant in modern browsers).
 */

// ─── Constants ─────────────────────────────────────────────────────────────────

const AES_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;       // 96-bit IV for GCM
const SALT_LENGTH = 32;     // 256-bit salt
const PBKDF2_ITERATIONS = 600_000;  // NIST recommended minimum for 2023
const AUTH_ITERATIONS = 100_000;    // Separate derivation for auth password

// ─── Utility Helpers ───────────────────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return bufferToBase64(salt.buffer);
}

function generateIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

// ─── Key Derivation (PBKDF2 via WebCrypto) ────────────────────────────────────

async function importPasswordKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Derives the Key Encryption Key (KEK) from the master password.
 * This key is used to encrypt/decrypt the vault key — never sent to the server.
 */
export async function deriveKEK(
  masterPassword: string,
  salt: string
): Promise<CryptoKey> {
  const passwordKey = await importPasswordKey(masterPassword);
  const saltBuffer = base64ToBuffer(salt);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: AES_ALGORITHM, length: KEY_LENGTH },
    false,          // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives the auth password sent to the server for bcrypt hashing.
 * Completely separate derivation from the KEK — different salt + iterations.
 * This ensures the server auth password cannot be used to derive the KEK.
 */
export async function deriveAuthPassword(
  masterPassword: string,
  email: string
): Promise<string> {
  const encoder = new TextEncoder();

  // Auth salt is deterministic from email (for login — no salt storage needed)
  const authSaltData = encoder.encode(`securepass-auth-v1:${email.toLowerCase()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', authSaltData);
  const authSalt = new Uint8Array(hashBuffer);

  const passwordKey = await importPasswordKey(masterPassword);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: authSalt,
      iterations: AUTH_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  return bufferToHex(derivedBits);
}

// ─── Vault Key Management ──────────────────────────────────────────────────────

/**
 * Generates a random 256-bit vault key.
 * This key encrypts all vault items — never stored in plaintext.
 */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: AES_ALGORITHM, length: KEY_LENGTH },
    true,     // must be extractable to encrypt it with KEK
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedVaultKey {
  encryptedVaultKey: string;   // base64 ciphertext
  vaultKeySalt: string;        // base64 salt used for KEK derivation
  vaultKeyIv: string;          // base64 IV used to encrypt the vault key
  vaultKeyAuthTag: string;     // base64 auth tag from AES-GCM
}

/**
 * Encrypts the vault key with the KEK (derived from master password).
 * Called once during registration. Result is stored server-side.
 */
export async function encryptVaultKey(
  vaultKey: CryptoKey,
  kek: CryptoKey
): Promise<{ encryptedVaultKey: string; iv: string; authTag: string }> {
  const rawVaultKey = await crypto.subtle.exportKey('raw', vaultKey);
  const iv = generateIv();

  const encrypted = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    kek,
    rawVaultKey
  );

  // AES-GCM output is ciphertext + 16-byte auth tag concatenated
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, -16);
  const authTag = encryptedBytes.slice(-16);

  return {
    encryptedVaultKey: bufferToBase64(ciphertext.buffer),
    iv: bufferToBase64(iv.buffer),
    authTag: bufferToBase64(authTag.buffer),
  };
}

/**
 * Decrypts the vault key using the KEK.
 * Called on every login to restore the vault key into memory only.
 */
export async function decryptVaultKey(
  encryptedVaultKey: string,
  iv: string,
  authTag: string,
  kek: CryptoKey
): Promise<CryptoKey> {
  const ciphertext = new Uint8Array(base64ToBuffer(encryptedVaultKey));
  const authTagBytes = new Uint8Array(base64ToBuffer(authTag));
  const ivBytes = new Uint8Array(base64ToBuffer(iv));

  // Reconstruct AES-GCM ciphertext+authTag format
  const combined = new Uint8Array(ciphertext.length + authTagBytes.length);
  combined.set(ciphertext);
  combined.set(authTagBytes, ciphertext.length);

  const rawKey = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: ivBytes },
    kek,
    combined.buffer
  );

  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: AES_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Vault Item Encryption ─────────────────────────────────────────────────────

export interface EncryptedPayload {
  encryptedData: string;   // base64
  iv: string;              // base64
  authTag: string;         // base64
}

/**
 * Encrypts any serializable object with the vault key.
 * Used for vault items, history entries, etc.
 */
export async function encryptData(
  data: unknown,
  vaultKey: CryptoKey
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = generateIv();

  const encrypted = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    vaultKey,
    plaintext
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, -16);
  const authTag = encryptedBytes.slice(-16);

  return {
    encryptedData: bufferToBase64(ciphertext.buffer),
    iv: bufferToBase64(iv.buffer),
    authTag: bufferToBase64(authTag.buffer),
  };
}

/**
 * Decrypts an encrypted payload back to its original object.
 */
export async function decryptData<T = unknown>(
  payload: EncryptedPayload,
  vaultKey: CryptoKey
): Promise<T> {
  const ciphertext = new Uint8Array(base64ToBuffer(payload.encryptedData));
  const authTagBytes = new Uint8Array(base64ToBuffer(payload.authTag));
  const ivBytes = new Uint8Array(base64ToBuffer(payload.iv));

  const combined = new Uint8Array(ciphertext.length + authTagBytes.length);
  combined.set(ciphertext);
  combined.set(authTagBytes, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: ivBytes },
    vaultKey,
    combined.buffer
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted)) as T;
}

// ─── URL Hash for Duplicate Detection ─────────────────────────────────────────

/**
 * Creates a SHA-256 HMAC of the URL using the vault key for duplicate detection.
 * Not reversible without the vault key.
 */
export async function hashUrl(url: string, vaultKey: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', vaultKey);
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  // Normalize URL for consistent hashing
  const normalized = new URL(url).hostname.toLowerCase();
  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(normalized));

  return bufferToBase64(signature);
}

// ─── Full Registration Flow ────────────────────────────────────────────────────

export interface RegistrationCryptoResult {
  authPassword: string;
  encryptedVaultKey: string;
  vaultKeySalt: string;
  vaultKeyIv: string;
  vaultKeyAuthTag: string;
  vaultKey: CryptoKey;     // kept in memory only — never leaves the browser
  kek: CryptoKey;          // kept in memory only
}

export async function prepareRegistration(
  email: string,
  masterPassword: string
): Promise<RegistrationCryptoResult> {
  // 1. Derive auth password for server-side bcrypt
  const authPassword = await deriveAuthPassword(masterPassword, email);

  // 2. Generate random salt for KEK
  const vaultKeySalt = generateSalt();

  // 3. Derive KEK from master password
  const kek = await deriveKEK(masterPassword, vaultKeySalt);

  // 4. Generate random vault key
  const vaultKey = await generateVaultKey();

  // 5. Encrypt vault key with KEK
  const { encryptedVaultKey, iv: vaultKeyIv, authTag: vaultKeyAuthTag } =
    await encryptVaultKey(vaultKey, kek);

  return {
    authPassword,
    encryptedVaultKey,
    vaultKeySalt,
    vaultKeyIv,
    vaultKeyAuthTag,
    vaultKey,
    kek,
  };
}

// ─── Full Login Flow ───────────────────────────────────────────────────────────

export interface LoginCryptoResult {
  authPassword: string;
  vaultKey: CryptoKey;    // decrypted from server data, kept in memory only
  kek: CryptoKey;
}

export async function prepareLogin(
  email: string,
  masterPassword: string,
  serverData: {
    encryptedVaultKey: string;
    vaultKeySalt: string;
    vaultKeyIv: string;
    vaultKeyAuthTag: string;
  }
): Promise<LoginCryptoResult> {
  // 1. Derive auth password
  const authPassword = await deriveAuthPassword(masterPassword, email);

  // 2. Derive KEK using the stored salt
  const kek = await deriveKEK(masterPassword, serverData.vaultKeySalt);

  // 3. Decrypt vault key
  const vaultKey = await decryptVaultKey(
    serverData.encryptedVaultKey,
    serverData.vaultKeyIv,
    serverData.vaultKeyAuthTag,
    kek
  );

  return { authPassword, vaultKey, kek };
}
