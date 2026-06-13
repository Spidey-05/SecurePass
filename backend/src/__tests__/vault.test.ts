/**
 * SecurePass — Backend Vault Integration Tests
 * Tool: Jest + Supertest
 *
 * Covers:
 *  - GET    /api/vault          (list with filters/pagination)
 *  - POST   /api/vault          (create item)
 *  - GET    /api/vault/:id      (get single item)
 *  - PATCH  /api/vault/:id      (update item)
 *  - DELETE /api/vault/:id      (delete item)
 *  - POST   /api/vault/check-duplicates
 *
 * Run: cd backend && npm test
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';

const VAULT_BASE = '/api/vault';
const AUTH_BASE = '/api/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Valid AES-256-GCM encrypted payload stub */
function encPayload(overrides: Record<string, unknown> = {}) {
  return {
    encryptedData: Buffer.from('fake-encrypted-payload').toString('base64'),
    iv: 'AAAAAAAAAAAAAAAA',           // 16 chars = 12 bytes base64
    authTag: 'AAAAAAAAAAAAAAAAAAAAAAAAAA', // 24 chars = 16 bytes base64
    itemType: 'login',
    ...overrides,
  };
}

async function createUserAndGetToken(): Promise<{ accessToken: string; email: string }> {
  const email = `vault_user_${Date.now()}@example.com`;
  const regRes = await request(app)
    .post(`${AUTH_BASE}/register`)
    .send({
      email,
      authPassword: 'TestAuthPass123!',
      encryptedVaultKey: Buffer.from('key').toString('base64'),
      vaultKeySalt: Buffer.from('salt').toString('base64'),
      vaultKeyIv: 'AAAAAAAAAAAAAAAA',
      vaultKeyAuthTag: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
  return { accessToken: regRes.body.data.accessToken, email };
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(
      process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/securepass_test'
    );
  }
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});

// =============================================================================
// CREATE VAULT ITEM
// =============================================================================

describe('POST /api/vault', () => {
  let token: string;

  beforeAll(async () => {
    ({ accessToken: token } = await createUserAndGetToken());
  });

  it('TC-VLT-CRT-01 | create login item → 201 with item id', async () => {
    const res = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload({ itemType: 'login' }));

    expect(res.status).toBe(201);
    expect(res.body.data.item._id).toBeDefined();
    expect(res.body.data.item.encryptedData).toBeUndefined(); // raw enc data not returned?
    expect(res.body.data.item.userId).toBeUndefined(); // userId should not leak
  });

  it('TC-VLT-CRT-02 | create note item → 201', async () => {
    const res = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload({ itemType: 'note' }));
    expect(res.status).toBe(201);
    expect(res.body.data.item.itemType).toBe('note');
  });

  it('TC-VLT-CRT-03 | create card item → 201', async () => {
    const res = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload({ itemType: 'card' }));
    expect(res.status).toBe(201);
  });

  it('TC-VLT-CRT-04 | create identity item → 201', async () => {
    const res = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload({ itemType: 'identity' }));
    expect(res.status).toBe(201);
  });

  it('TC-VLT-CRT-05 | missing encryptedData → 400', async () => {
    const { encryptedData: _, ...payload } = encPayload();
    const res = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(res.status).toBe(400);
  });

  it('TC-VLT-CRT-06 | IV wrong length (not 16 chars) → 400', async () => {
    const res = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload({ iv: 'short' }));
    expect(res.status).toBe(400);
  });

  it('TC-VLT-CRT-07 | authTag wrong length (not 24 chars) → 400', async () => {
    const res = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload({ authTag: 'bad' }));
    expect(res.status).toBe(400);
  });

  it('TC-VLT-CRT-08 | invalid itemType → 400', async () => {
    const res = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload({ itemType: 'bankaccount' }));
    expect(res.status).toBe(400);
  });

  it('TC-VLT-CRT-09 | no access token → 401', async () => {
    const res = await request(app).post(VAULT_BASE).send(encPayload());
    expect(res.status).toBe(401);
  });

  it('TC-VLT-CRT-10 | create with urlHash for duplicate detection → stored', async () => {
    const urlHash = 'abc123def456789012345678901234567890123456789012345678901234';
    const res = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload({ urlHash }));
    expect(res.status).toBe(201);
  });
});

// =============================================================================
// LIST VAULT ITEMS
// =============================================================================

describe('GET /api/vault', () => {
  let token: string;

  beforeAll(async () => {
    ({ accessToken: token } = await createUserAndGetToken());
    // Seed a few items
    for (const itemType of ['login', 'note', 'card']) {
      await request(app)
        .post(VAULT_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send(encPayload({ itemType }));
    }
  });

  it('TC-VLT-GET-01 | list all items → 200 with array', async () => {
    const res = await request(app)
      .get(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
  });

  it('TC-VLT-GET-02 | filter by itemType=note → only notes returned', async () => {
    const res = await request(app)
      .get(`${VAULT_BASE}?itemType=note`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.every((i: any) => i.itemType === 'note')).toBe(true);
  });

  it('TC-VLT-GET-03 | filter by isFavorite=true → only favorites', async () => {
    const res = await request(app)
      .get(`${VAULT_BASE}?isFavorite=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.every((i: any) => i.isFavorite === true)).toBe(true);
  });

  it('TC-VLT-GET-04 | pagination: page=1&limit=2 → max 2 items', async () => {
    const res = await request(app)
      .get(`${VAULT_BASE}?page=1&limit=2`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeLessThanOrEqual(2);
  });

  it('TC-VLT-GET-05 | limit=201 (> max 200) → 400', async () => {
    const res = await request(app)
      .get(`${VAULT_BASE}?limit=201`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('TC-VLT-GET-06 | no auth → 401', async () => {
    const res = await request(app).get(VAULT_BASE);
    expect(res.status).toBe(401);
  });

  it('TC-VLT-GET-07 | user can only see their own items (data isolation)', async () => {
    const { accessToken: otherToken } = await createUserAndGetToken();
    const res = await request(app)
      .get(VAULT_BASE)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    // New user — should have 0 items
    expect(res.body.data.items.length).toBe(0);
  });
});

// =============================================================================
// GET SINGLE VAULT ITEM
// =============================================================================

describe('GET /api/vault/:id', () => {
  let token: string;
  let itemId: string;

  beforeAll(async () => {
    ({ accessToken: token } = await createUserAndGetToken());
    const create = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload());
    itemId = create.body.data.item._id;
  });

  it('TC-VLT-ONE-01 | get own item by id → 200', async () => {
    const res = await request(app)
      .get(`${VAULT_BASE}/${itemId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.item._id).toBe(itemId);
  });

  it('TC-VLT-ONE-02 | non-existent id → 404', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`${VAULT_BASE}/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('TC-VLT-ONE-03 | another user cannot access this item → 403 or 404', async () => {
    const { accessToken: otherToken } = await createUserAndGetToken();
    const res = await request(app)
      .get(`${VAULT_BASE}/${itemId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect([403, 404]).toContain(res.status);
  });

  it('TC-VLT-ONE-04 | malformed ObjectId → 400 or 404', async () => {
    const res = await request(app)
      .get(`${VAULT_BASE}/not-an-id`)
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });
});

// =============================================================================
// UPDATE VAULT ITEM
// =============================================================================

describe('PATCH /api/vault/:id', () => {
  let token: string;
  let itemId: string;

  beforeAll(async () => {
    ({ accessToken: token } = await createUserAndGetToken());
    const create = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload());
    itemId = create.body.data.item._id;
  });

  it('TC-VLT-UPD-01 | update isFavorite=true → 200', async () => {
    const res = await request(app)
      .patch(`${VAULT_BASE}/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isFavorite: true });
    expect(res.status).toBe(200);
    expect(res.body.data.item.isFavorite).toBe(true);
  });

  it('TC-VLT-UPD-02 | update all 3 enc fields together → 200', async () => {
    const res = await request(app)
      .patch(`${VAULT_BASE}/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        encryptedData: Buffer.from('new-data').toString('base64'),
        iv: 'BBBBBBBBBBBBBBBB',
        authTag: 'BBBBBBBBBBBBBBBBBBBBBBBB',
      });
    expect(res.status).toBe(200);
  });

  it('TC-VLT-UPD-03 | update only encryptedData without iv/authTag → 400', async () => {
    const res = await request(app)
      .patch(`${VAULT_BASE}/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ encryptedData: 'something' });
    expect(res.status).toBe(400);
  });

  it('TC-VLT-UPD-04 | another user cannot update this item → 403 or 404', async () => {
    const { accessToken: otherToken } = await createUserAndGetToken();
    const res = await request(app)
      .patch(`${VAULT_BASE}/${itemId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ isFavorite: false });
    expect([403, 404]).toContain(res.status);
  });
});

// =============================================================================
// DELETE VAULT ITEM
// =============================================================================

describe('DELETE /api/vault/:id', () => {
  let token: string;

  beforeAll(async () => {
    ({ accessToken: token } = await createUserAndGetToken());
  });

  it('TC-VLT-DEL-01 | delete own item → 200, item gone from list', async () => {
    const create = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload());
    const id = create.body.data.item._id;

    const del = await request(app)
      .delete(`${VAULT_BASE}/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const get = await request(app)
      .get(`${VAULT_BASE}/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
  });

  it('TC-VLT-DEL-02 | delete non-existent id → 404', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .delete(`${VAULT_BASE}/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('TC-VLT-DEL-03 | cannot delete another users item → 403 or 404', async () => {
    const { accessToken: ownerToken } = await createUserAndGetToken();
    const create = await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(encPayload());
    const id = create.body.data.item._id;

    const { accessToken: attackerToken } = await createUserAndGetToken();
    const del = await request(app)
      .delete(`${VAULT_BASE}/${id}`)
      .set('Authorization', `Bearer ${attackerToken}`);
    expect([403, 404]).toContain(del.status);
  });
});

// =============================================================================
// CHECK DUPLICATES
// =============================================================================

describe('POST /api/vault/check-duplicates', () => {
  let token: string;

  beforeAll(async () => {
    ({ accessToken: token } = await createUserAndGetToken());
    // Seed item with urlHash
    const urlHash = 'dedup0000000000000000000000000000000000000000000000000000001';
    await request(app)
      .post(VAULT_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send(encPayload({ urlHash }));
  });

  it('TC-VLT-DUP-01 | existing urlHash → duplicate found', async () => {
    const urlHash = 'dedup0000000000000000000000000000000000000000000000000000001';
    const res = await request(app)
      .post(`${VAULT_BASE}/check-duplicates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ urlHash });
    expect(res.status).toBe(200);
    expect(res.body.data.isDuplicate).toBe(true);
  });

  it('TC-VLT-DUP-02 | non-existing urlHash → no duplicate', async () => {
    const res = await request(app)
      .post(`${VAULT_BASE}/check-duplicates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ urlHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    expect(res.status).toBe(200);
    expect(res.body.data.isDuplicate).toBe(false);
  });

  it('TC-VLT-DUP-03 | missing urlHash → 400', async () => {
    const res = await request(app)
      .post(`${VAULT_BASE}/check-duplicates`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('TC-VLT-DUP-04 | no auth → 401', async () => {
    const res = await request(app)
      .post(`${VAULT_BASE}/check-duplicates`)
      .send({ urlHash: 'something' });
    expect(res.status).toBe(401);
  });
});
