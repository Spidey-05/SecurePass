import { webcrypto } from 'crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

import {
  generatePassword,
  analyzePasswordStrength,
  generatePassphrase,
  DEFAULT_OPTIONS,
} from '../src/lib/password';

describe('Password Generator', () => {
  describe('generatePassword', () => {
    it('generates password of specified length', () => {
      [12, 16, 20, 32, 64].forEach(len => {
        expect(generatePassword({ length: len })).toHaveLength(len);
      });
    });

    it('includes uppercase when requested', () => {
      const pw = generatePassword({ ...DEFAULT_OPTIONS, lowercase: false, numbers: false, symbols: false });
      expect(/[A-Z]/.test(pw)).toBe(true);
    });

    it('includes numbers when requested', () => {
      const pw = generatePassword({ ...DEFAULT_OPTIONS, uppercase: false, lowercase: false, symbols: false });
      expect(/[0-9]/.test(pw)).toBe(true);
    });

    it('includes symbols when requested', () => {
      const pw = generatePassword({ ...DEFAULT_OPTIONS, uppercase: false, lowercase: false, numbers: false });
      expect(/[!@#$%^&*]/.test(pw)).toBe(true);
    });

    it('excludes ambiguous characters when requested', () => {
      const pw = generatePassword({ ...DEFAULT_OPTIONS, excludeAmbiguous: true, length: 100 });
      expect(/[l1IoO0]/.test(pw)).toBe(false);
    });

    it('throws with no character sets', () => {
      expect(() =>
        generatePassword({ uppercase: false, lowercase: false, numbers: false, symbols: false, length: 16, excludeAmbiguous: false, excludeSimilar: false })
      ).toThrow();
    });

    it('generates unique passwords (no Math.random bias)', () => {
      const passwords = Array.from({ length: 1000 }, () => generatePassword({ length: 12 }));
      const unique = new Set(passwords);
      // With 12-char passwords from 50+ charset, collisions should be essentially impossible
      expect(unique.size).toBe(1000);
    });

    it('each character type appears at least once by guarantee', () => {
      // Run 100 times to verify statistical guarantee
      for (let i = 0; i < 100; i++) {
        const pw = generatePassword({
          length: 16,
          uppercase: true,
          lowercase: true,
          numbers: true,
          symbols: true,
          excludeAmbiguous: false,
          excludeSimilar: false,
        });
        expect(/[A-Z]/.test(pw)).toBe(true);
        expect(/[a-z]/.test(pw)).toBe(true);
        expect(/[0-9]/.test(pw)).toBe(true);
        expect(/[!@#$%^&*]/.test(pw)).toBe(true);
      }
    });
  });

  describe('analyzePasswordStrength', () => {
    it('rates empty string as very-weak', () => {
      expect(analyzePasswordStrength('').level).toBe('very-weak');
    });

    it('rates short simple passwords as very-weak', () => {
      expect(analyzePasswordStrength('abc').level).toBe('very-weak');
    });

    it('rates common passwords lower', () => {
      const s1 = analyzePasswordStrength('password123');
      const s2 = analyzePasswordStrength('Tr0ub4dor&3');
      expect(s2.score).toBeGreaterThan(s1.score);
    });

    it('rates longer passwords higher', () => {
      const short = analyzePasswordStrength('Abc1!');
      const long = analyzePasswordStrength('Abc1!Abc1!Abc1!Abc1!');
      expect(long.score).toBeGreaterThan(short.score);
    });

    it('rates mixed-character passwords as strong', () => {
      const pw = generatePassword({ length: 20, ...DEFAULT_OPTIONS });
      const result = analyzePasswordStrength(pw);
      expect(['strong', 'very-strong']).toContain(result.level);
    });

    it('calculates reasonable entropy for known inputs', () => {
      // All-lowercase, 10 chars = log2(26^10) ≈ 47 bits
      const result = analyzePasswordStrength('abcdefghij');
      expect(result.entropy).toBeGreaterThan(30);
    });

    it('returns timeToCrack estimate', () => {
      const result = analyzePasswordStrength('test');
      expect(typeof result.timeToCrack).toBe('string');
      expect(result.timeToCrack.length).toBeGreaterThan(0);
    });
  });

  describe('generatePassphrase', () => {
    it('generates correct number of words', () => {
      const pp = generatePassphrase(4);
      // 4 words + 1 number = 5 segments
      expect(pp.split('-').length).toBe(5);
    });

    it('uses custom separator', () => {
      const pp = generatePassphrase(3, '_');
      expect(pp.includes('_')).toBe(true);
      expect(pp.includes('-')).toBe(false);
    });

    it('generates unique passphrases', () => {
      const phrases = Array.from({ length: 100 }, () => generatePassphrase(4));
      const unique = new Set(phrases);
      expect(unique.size).toBeGreaterThan(95); // Very unlikely to collide
    });
  });
});
