/**
 * Cryptographically secure password generator using Web Crypto API.
 * Uses crypto.getRandomValues() — NOT Math.random().
 */

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;   // removes l, 1, I, O, 0
  excludeSimilar: boolean;     // removes look-alike chars
}

const CHARSETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  ambiguous: /[l1IoO0]/g,
  similar: /[vV]/g,
};

export const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: true,
  excludeSimilar: false,
};

/**
 * Generates a cryptographically secure random password.
 * Uses rejection sampling to ensure uniform distribution.
 */
export function generatePassword(options: Partial<PasswordOptions> = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Build character pool
  let charset = '';
  const required: string[] = [];

  if (opts.uppercase) {
    let chars = CHARSETS.uppercase;
    if (opts.excludeAmbiguous) chars = chars.replace(CHARSETS.ambiguous, '');
    charset += chars;
    required.push(getRandomChar(chars));
  }
  if (opts.lowercase) {
    let chars = CHARSETS.lowercase;
    if (opts.excludeAmbiguous) chars = chars.replace(CHARSETS.ambiguous, '');
    charset += chars;
    required.push(getRandomChar(chars));
  }
  if (opts.numbers) {
    let chars = CHARSETS.numbers;
    if (opts.excludeAmbiguous) chars = chars.replace(CHARSETS.ambiguous, '');
    charset += chars;
    required.push(getRandomChar(chars));
  }
  if (opts.symbols) {
    const chars = CHARSETS.symbols;
    charset += chars;
    required.push(getRandomChar(chars));
  }

  if (!charset) throw new Error('At least one character type must be selected');
  if (opts.length < required.length) {
    throw new Error(`Password length must be at least ${required.length}`);
  }

  // Fill remaining positions
  const remaining = opts.length - required.length;
  const extra: string[] = [];
  for (let i = 0; i < remaining; i++) {
    extra.push(getRandomChar(charset));
  }

  // Shuffle all characters using Fisher-Yates with crypto random
  const allChars = [...required, ...extra];
  cryptoShuffle(allChars);

  return allChars.join('');
}

/**
 * Gets a uniformly random character from a string using rejection sampling.
 * Avoids modulo bias.
 */
function getRandomChar(charset: string): string {
  if (!charset) throw new Error('Empty charset');
  const maxValid = Math.floor(256 / charset.length) * charset.length;
  const randomByte = new Uint8Array(1);

  let byte: number;
  do {
    crypto.getRandomValues(randomByte);
    byte = randomByte[0]!;
  } while (byte >= maxValid);

  return charset[byte % charset.length]!;
}

/**
 * Fisher-Yates shuffle using crypto.getRandomValues().
 */
function cryptoShuffle<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const j = randomBytes[0]! % (i + 1);
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
}

// ─── Password Strength ─────────────────────────────────────────────────────────

export type StrengthLevel = 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';

export interface PasswordStrength {
  score: number;         // 0-100
  level: StrengthLevel;
  entropy: number;       // bits
  timeToCrack: string;
  feedback: string[];
}

/**
 * Entropy-based password strength analysis.
 * Entropy = log2(charset_size ^ length)
 */
export function analyzePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, level: 'very-weak', entropy: 0, timeToCrack: 'instant', feedback: [] };
  }

  const feedback: string[] = [];

  // Calculate charset size
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

  const entropy = Math.log2(Math.pow(charsetSize, password.length));

  // Deductions for patterns
  let deductions = 0;
  if (/(.)\1{2,}/.test(password)) { deductions += 10; feedback.push('Avoid repeated characters'); }
  if (/^[a-zA-Z]+$/.test(password)) { deductions += 10; feedback.push('Add numbers and symbols'); }
  if (/^[0-9]+$/.test(password)) { deductions += 15; feedback.push('Add letters and symbols'); }
  if (password.length < 12) { deductions += 15; feedback.push('Use at least 12 characters'); }
  if (password.length < 8) { deductions += 20; feedback.push('Use at least 8 characters'); }

  // Common patterns
  if (/^(password|qwerty|123456|letmein|welcome)/i.test(password)) {
    deductions += 30;
    feedback.push('Avoid common passwords');
  }

  const adjustedEntropy = Math.max(0, entropy - deductions);
  const score = Math.min(100, Math.round((adjustedEntropy / 80) * 100));

  let level: StrengthLevel;
  let timeToCrack: string;

  if (entropy < 28) {
    level = 'very-weak';
    timeToCrack = 'less than a second';
  } else if (entropy < 36) {
    level = 'weak';
    timeToCrack = 'a few minutes';
  } else if (entropy < 60) {
    level = 'fair';
    timeToCrack = 'a few hours';
  } else if (entropy < 80) {
    level = 'strong';
    timeToCrack = 'years';
  } else {
    level = 'very-strong';
    timeToCrack = 'centuries';
  }

  if (feedback.length === 0) {
    if (level === 'very-strong') feedback.push('Excellent password!');
    else if (level === 'strong') feedback.push('Strong password');
  }

  return { score, level, entropy: Math.round(entropy), timeToCrack, feedback };
}

// ─── Passphrase Generator ──────────────────────────────────────────────────────

const WORDLIST = [
  'apple', 'brave', 'cloud', 'dance', 'eagle', 'flame', 'giant', 'honey',
  'ivory', 'joker', 'karma', 'lemon', 'mango', 'noble', 'ocean', 'piano',
  'queen', 'river', 'solar', 'tiger', 'ultra', 'vivid', 'watch', 'xenon',
  'yacht', 'zebra', 'amber', 'blaze', 'crisp', 'drift', 'ember', 'frost',
  'glare', 'hazel', 'inlet', 'jewel', 'kneel', 'lunar', 'marsh', 'night',
  'ozone', 'phase', 'quill', 'rainy', 'stone', 'tidal', 'umbra', 'vapor',
  'windy', 'xylem', 'yield', 'zilch', 'acorn', 'brine', 'cedar', 'dunes',
];

export function generatePassphrase(wordCount = 4, separator = '-'): string {
  const words: string[] = [];
  const randomBytes = new Uint32Array(wordCount);
  crypto.getRandomValues(randomBytes);

  for (let i = 0; i < wordCount; i++) {
    words.push(WORDLIST[randomBytes[i]! % WORDLIST.length]!);
  }

  // Add a random number for extra entropy
  const numBytes = new Uint8Array(1);
  crypto.getRandomValues(numBytes);
  words.push(String(numBytes[0]! % 100));

  return words.join(separator);
}
