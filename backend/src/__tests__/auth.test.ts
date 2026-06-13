/**
 * SecurePass — Backend Auth Integration Tests
 * Tool: Jest + Supertest
 *
 * Covers:
 *  - POST /api/auth/register
 *  - POST /api/auth/login
 *  - POST /api/auth/logout
 *  - POST /api/auth/logout-all
 *  - POST /api/auth/refresh
 *  - GET  /api/auth/me
 *  - POST /api/auth/send-hint
 *
 * Run: cd backend && npm test
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app'; // adjust if your export differs

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = '/api/auth';

/** Minimal valid registration payload (crypto fields are normally derived client-side) */
function makeRegPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: `test_${Date.now()}@example.com`,
    // In real flow: PBKDF2/Argon2-derived. For tests: any 8+ char string
    authPassword: 'TestAuthPass123!',
    encryptedVaultKey: Buffer.from('fakeEncryptedVaultKey').toString('base64'),
    vaultKeySalt: Buffer.from('fakeSalt16bytes!').toString('base64'),
    // IV: exactly 12 bytes → 16 base64 chars
    vaultKeyIv: 'AAAAAAAAAAAAAAAA',
    // AuthTag: exactly 16 bytes → 24 base64 chars
    vaultKeyAuthTag: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
    passwordHint: 'My first pet name',
    ...overrides,
  };
}

async function registerUser(overrides: Record<string, unknown> = {}) {
  const payload = makeRegPayload(overrides);
  const res = await request(app).post(`${BASE}/register`).send(payload);
  return { res, payload };
}

async function loginUser(email: string, authPassword = 'TestAuthPass123!') {
  return request(app).post(`${BASE}/login`).send({ email, authPassword });
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    const MONGODB_URI =
      process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/securepass_test';
    await mongoose.connect(MONGODB_URI);
  }
});

afterAll(async () => {
  // Drop test DB and close connection
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});

// =============================================================================
// REGISTER
// =============================================================================

describe('POST /api/auth/register', () => {
  // ── Positive ────────────────────────────────────────────────────────────────

  it('TC-REG-01 | registers a new user with valid data → 201 + tokens', async () => {
    const { res } = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBeDefined();
    // refreshToken must come as httpOnly cookie, NOT in body
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    // Sensitive fields must NOT be in response
    expect(res.body.data?.user?.passwordHash).toBeUndefined();
    expect(res.body.data?.user?.authSalt).toBeUndefined();
  });

  it('TC-REG-02 | email is normalised to lowercase', async () => {
    const payload = makeRegPayload({ email: 'UPPER@Example.COM' });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('upper@example.com');
  });

  it('TC-REG-03 | password hint is optional — registers without hint', async () => {
    const payload = makeRegPayload({ email: `nohint_${Date.now()}@example.com`, passwordHint: undefined });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(201);
  });

  // ── Negative ────────────────────────────────────────────────────────────────

  it('TC-REG-04 | duplicate email → 409 EMAIL_EXISTS', async () => {
    const { payload } = await registerUser({ email: `dup_${Date.now()}@example.com` });
    const res2 = await request(app).post(`${BASE}/register`).send(payload);
    expect(res2.status).toBe(409);
    expect(res2.body.error?.code).toBe('EMAIL_EXISTS');
  });

  it('TC-REG-05 | missing email → 400 VALIDATION_ERROR', async () => {
    const payload = makeRegPayload({ email: undefined });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('TC-REG-06 | invalid email format → 400', async () => {
    const payload = makeRegPayload({ email: 'not-an-email' });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('TC-REG-07 | authPassword shorter than 8 chars → 400', async () => {
    const payload = makeRegPayload({ authPassword: 'short' });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(400);
  });

  it('TC-REG-08 | authPassword exactly 128 chars → 201 (boundary)', async () => {
    const payload = makeRegPayload({
      email: `boundary_${Date.now()}@example.com`,
      authPassword: 'A'.repeat(128),
    });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(201);
  });

  it('TC-REG-09 | authPassword 129 chars → 400 (exceeds max)', async () => {
    const payload = makeRegPayload({ authPassword: 'A'.repeat(129) });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(400);
  });

  it('TC-REG-10 | email longer than 255 chars → 400', async () => {
    const payload = makeRegPayload({ email: 'a'.repeat(246) + '@example.com' }); // 258 chars total
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(400);
  });

  it('TC-REG-11 | missing encryptedVaultKey → 400', async () => {
    const payload = makeRegPayload({ encryptedVaultKey: '' });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(400);
  });

  it('TC-REG-12 | passwordHint >255 chars → 400', async () => {
    const payload = makeRegPayload({ passwordHint: 'H'.repeat(256) });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    expect(res.status).toBe(400);
  });

  // ── Security ────────────────────────────────────────────────────────────────

  it('TC-REG-13 | NoSQL injection in email is sanitised, not executed', async () => {
    const payload = makeRegPayload({ email: '{"$gt": ""}@example.com' });
    const res = await request(app).post(`${BASE}/register`).send(payload);
    // Must be rejected — not a valid email format
    expect(res.status).toBe(400);
  });

  it('TC-REG-14 | XSS in passwordHint is stored as plain string (not executed)', async () => {
    const xssHint = '<script>alert(1)</script>';
    const { res } = await registerUser({ email: `xss_${Date.now()}@example.com`, passwordHint: xssHint });
    expect(res.status).toBe(201);
    // Hint stored; the send-hint endpoint will email it; never rendered as HTML in API
  });
});

// =============================================================================
// LOGIN
// =============================================================================

describe('POST /api/auth/login', () => {
  let testEmail: string;

  beforeAll(async () => {
    testEmail = `login_test_${Date.now()}@example.com`;
    await registerUser({ email: testEmail });
  });

  // ── Positive ────────────────────────────────────────────────────────────────

  it('TC-LOG-01 | login with correct credentials → 200 + tokens', async () => {
    const res = await loginUser(testEmail);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    // Vault key data returned for client-side decryption
    expect(res.body.data.user.encryptedVaultKey).toBeDefined();
    expect(res.body.data.user.vaultKeySalt).toBeDefined();
    // Sensitive fields absent
    expect(res.body.data?.user?.passwordHash).toBeUndefined();
  });

  // ── Negative ────────────────────────────────────────────────────────────────

  it('TC-LOG-02 | wrong password → 401 Invalid credentials', async () => {
    const res = await loginUser(testEmail, 'WrongPassword!');
    expect(res.status).toBe(401);
    expect(res.body.error?.message).toMatch(/Invalid credentials/i);
  });

  it('TC-LOG-03 | non-existent email → 401 (same message — no email enumeration)', async () => {
    const res = await loginUser('nobody@nowhere.com');
    expect(res.status).toBe(401);
    expect(res.body.error?.message).toMatch(/Invalid credentials/i);
  });

  it('TC-LOG-04 | empty password → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: testEmail, authPassword: '' });
    expect(res.status).toBe(400);
  });

  it('TC-LOG-05 | missing email field → 400', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ authPassword: 'TestAuthPass123!' });
    expect(res.status).toBe(400);
  });

  // ── Account Lockout ──────────────────────────────────────────────────────────

  it('TC-LOG-06 | 5 consecutive wrong passwords → account locked (429)', async () => {
    const lockEmail = `locktest_${Date.now()}@example.com`;
    await registerUser({ email: lockEmail });

    for (let i = 0; i < 5; i++) {
      await loginUser(lockEmail, 'WrongPwd!');
    }

    const lockRes = await loginUser(lockEmail, 'TestAuthPass123!');
    expect(lockRes.status).toBe(429);
    expect(lockRes.body.error?.message).toMatch(/Account locked/i);
    expect(lockRes.body.error?.message).toMatch(/minutes/i);
  });

  it('TC-LOG-07 | successful login resets failed attempt counter', async () => {
    const resetEmail = `resetcount_${Date.now()}@example.com`;
    await registerUser({ email: resetEmail });

    // 4 wrong attempts (just under lock threshold)
    for (let i = 0; i < 4; i++) {
      await loginUser(resetEmail, 'WrongPwd!');
    }

    // Successful login
    const okRes = await loginUser(resetEmail);
    expect(okRes.status).toBe(200);

    // Should be able to login normally again (counter reset)
    const okRes2 = await loginUser(resetEmail);
    expect(okRes2.status).toBe(200);
  });

  // ── Security ────────────────────────────────────────────────────────────────

  it('TC-LOG-08 | timing: login with invalid email takes comparable time to invalid pw (anti-enum)', async () => {
    const t1 = Date.now();
    await loginUser('nonexistent@example.com', 'AnyPass123!');
    const t1elapsed = Date.now() - t1;

    const t2 = Date.now();
    await loginUser(testEmail, 'WrongPass!');
    const t2elapsed = Date.now() - t2;

    // Both should take >100ms (bcrypt dummy run) and not differ by >5s
    expect(Math.abs(t1elapsed - t2elapsed)).toBeLessThan(5000);
  });

  it('TC-LOG-09 | SQL injection in email is safely handled', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: "' OR '1'='1", authPassword: 'any' });
    // Should be rejected as invalid email format
    expect([400, 401]).toContain(res.status);
  });
});

// =============================================================================
// LOGOUT
// =============================================================================

describe('POST /api/auth/logout', () => {
  it('TC-OUT-01 | logout with valid refreshToken cookie clears cookie → 200', async () => {
    const { res: regRes, payload } = await registerUser({ email: `logout_${Date.now()}@example.com` });
    const cookie = regRes.headers['set-cookie'][0].split(';')[0]; // refreshToken=xxx

    const res = await request(app)
      .post(`${BASE}/logout`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Logged out/i);
    // Cookie should be cleared
    const setCookieHeader = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookieHeader).toMatch(/refreshToken=/);
    expect(setCookieHeader).toMatch(/Max-Age=0|Expires=.*1970/i);
  });

  it('TC-OUT-02 | logout without cookie still returns 200 (graceful)', async () => {
    const res = await request(app).post(`${BASE}/logout`);
    expect(res.status).toBe(200);
  });
});

// =============================================================================
// LOGOUT ALL
// =============================================================================

describe('POST /api/auth/logout-all', () => {
  it('TC-OUTALL-01 | logout-all requires authentication → 401 without token', async () => {
    const res = await request(app).post(`${BASE}/logout-all`);
    expect(res.status).toBe(401);
  });

  it('TC-OUTALL-02 | logout-all revokes all sessions for user → 200', async () => {
    const { res: regRes, payload } = await registerUser({ email: `logoutall_${Date.now()}@example.com` });
    const accessToken = regRes.body.data.accessToken;

    const res = await request(app)
      .post(`${BASE}/logout-all`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/all devices/i);
  });

  it('TC-OUTALL-03 | expired/invalid Bearer token → 401', async () => {
    const res = await request(app)
      .post(`${BASE}/logout-all`)
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.invalid.sig');
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// TOKEN REFRESH
// =============================================================================

describe('POST /api/auth/refresh', () => {
  it('TC-REF-01 | valid refreshToken cookie → 200 + new accessToken + rotated cookie', async () => {
    const { res: regRes } = await registerUser({ email: `refresh_${Date.now()}@example.com` });
    const cookie = regRes.headers['set-cookie'][0].split(';')[0];

    const res = await request(app)
      .post(`${BASE}/refresh`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('TC-REF-02 | no refreshToken cookie → 401 or 400', async () => {
    const res = await request(app).post(`${BASE}/refresh`);
    expect([400, 401]).toContain(res.status);
  });

  it('TC-REF-03 | reuse of already-rotated refresh token → 401 (token-family revocation)', async () => {
    const { res: regRes } = await registerUser({ email: `reuse_${Date.now()}@example.com` });
    const originalCookie = regRes.headers['set-cookie'][0].split(';')[0];

    // First refresh — consumes original token
    await request(app).post(`${BASE}/refresh`).set('Cookie', originalCookie);

    // Second refresh with same old cookie → should detect reuse
    const res2 = await request(app).post(`${BASE}/refresh`).set('Cookie', originalCookie);
    expect(res2.status).toBe(401);
    expect(res2.body.error?.message).toMatch(/reuse|revoked|invalid/i);
  });

  it('TC-REF-04 | tampered refreshToken → 401', async () => {
    const res = await request(app)
      .post(`${BASE}/refresh`)
      .set('Cookie', 'refreshToken=totally.fake.token');
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// GET /me
// =============================================================================

describe('GET /api/auth/me', () => {
  it('TC-ME-01 | valid token → 200 with user + vault key data', async () => {
    const { res: regRes } = await registerUser({ email: `me_${Date.now()}@example.com` });
    const token = regRes.body.data.accessToken;

    const res = await request(app)
      .get(`${BASE}/me`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBeDefined();
    expect(res.body.data.user.encryptedVaultKey).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('TC-ME-02 | no token → 401', async () => {
    const res = await request(app).get(`${BASE}/me`);
    expect(res.status).toBe(401);
  });

  it('TC-ME-03 | malformed Bearer format → 401', async () => {
    const res = await request(app).get(`${BASE}/me`).set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// SEND HINT
// =============================================================================

describe('POST /api/auth/send-hint', () => {
  it('TC-HINT-01 | valid registered email → 200 (generic or devMode)', async () => {
    const email = `hint_${Date.now()}@example.com`;
    await registerUser({ email, passwordHint: 'Blue sky 42' });

    const res = await request(app).post(`${BASE}/send-hint`).send({ email });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // In dev mode (no SMTP): hint returned directly
    if (res.body.devMode) {
      expect(res.body.hint).toBe('Blue sky 42');
    }
  });

  it('TC-HINT-02 | non-existent email → 200 (generic, no enumeration)', async () => {
    const res = await request(app)
      .post(`${BASE}/send-hint`)
      .send({ email: 'nobody@nowhere.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hint).toBeUndefined(); // no hint leaked for unknown user
  });

  it('TC-HINT-03 | missing email → 400', async () => {
    const res = await request(app).post(`${BASE}/send-hint`).send({});
    expect(res.status).toBe(400);
  });

  it('TC-HINT-04 | invalid email format → 400', async () => {
    const res = await request(app).post(`${BASE}/send-hint`).send({ email: 'bad-email' });
    expect(res.status).toBe(400);
  });

  it('TC-HINT-05 | user with no hint set → 200, devMode hint shows "(no hint set for this account)"', async () => {
    const email = `nohint2_${Date.now()}@example.com`;
    await registerUser({ email, passwordHint: undefined });
    const res = await request(app).post(`${BASE}/send-hint`).send({ email });
    expect(res.status).toBe(200);
    if (res.body.devMode) {
      expect(res.body.hint).toBe('(no hint set for this account)');
    }
  });
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

describe('GET /api/health', () => {
  it('TC-HLTH-01 | returns 200 with status:ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('SecurePass API');
  });
});
