# 🔐 SecurePass — Zero-Knowledge Password Manager    
A production-grade password manager with strict zero-knowledge architecture. Your master password and plaintext vault data **never leave your device**.

---

## 🔥 Recent Architectural Updates

- **Bulletproof Auth Flows:** Replaced soft client-side redirects with hard `window.location` navigations during logout to flawlessly clear the Next.js Middleware cache and React singletons.
- **Silent Auth Bootstrap:** Implemented a root `AuthProvider` to silently validate sessions on cold load, preventing the dashboard from flashing a loading skeleton and incorrectly kicking valid users out.
- **Infinite Loop Protection:** Next.js Middleware now dynamically strips ghost cookies when it detects a `?expired=1` signal from the client, forever stopping the dreaded `/dashboard` ↔ `/login` infinite refresh loop.
- **Improved Security:** Tuned backend `clearCookie` to perfectly match `SameSite` and `Secure` attributes of the initialization config to prevent browsers from refusing to delete stale session cookies.
- **UI & Branding:** Added a crisp SVG `icon.svg` shield vector favicon that App Router detects natively, and wrapped the Register page in `Suspense` for hydration consistency.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  Master Password                                                │
│       │                                                         │
│       ├─► PBKDF2 (100k iter) ──► Auth Password (hex)            │
│       │         └── email as salt                               │
│       │                                                         │
│       └─► PBKDF2 (600k iter) ──► KEK (Key Encryption Key)       │
│                 └── random salt (stored server-side)            │
│                              │                                  │
│                              ▼                                  │
│                    AES-256-GCM decrypt                          │
│                              │                                  │
│                              ▼                                  │
│                    Vault Key (in memory only)                   │
│                              │                                  │
│                    AES-256-GCM encrypt/decrypt                  │
│                              │                                  │
│                    Vault Items (in memory only)                 │
└──────────────────────────────┼──────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVER (Backend)                        │
│                                                                 │
│  Stores ONLY:                                                   │
│  • bcrypt(Auth Password)      ← never the master password       │
│  • Encrypted Vault Key        ← useless without master password │
│  • Encrypted Vault Items      ← useless without vault key       │
│  • JWT tokens (access+refresh)                                  │
│                                                                 │
│  NEVER sees:                                                    │
│  • Master Password                                              │
│  • Vault Key (plaintext)                                        │
│  • Any vault item data (plaintext)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (or local MongoDB)
- Git

### 1. Clone & Install

```bash
git clone https://github.com/yourname/securepass.git
cd securepass

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your values (see variables below)

# Frontend
cd ../frontend
cp .env.example .env.local
```

**Backend `.env` variables:**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=<min-32-char-random-string>
JWT_REFRESH_SECRET=<min-32-char-random-string>
COOKIE_SECRET=<min-32-char-random-string>
FRONTEND_URL=http://localhost:3000
```

**Frontend `.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 3. Run Development

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Visit `http://localhost:3000`

---

## 📁 Project Structure

```
securepass/
├── backend/
│   └── src/
│       ├── app.ts                  # Express entry point
│       ├── config/
│       │   ├── env.ts              # Validated env with Zod
│       │   └── database.ts         # Mongoose connection
│       ├── models/
│       │   ├── User.ts             # User + vault key metadata
│       │   ├── Vault.ts            # Encrypted vault items
│       │   ├── History.ts          # Encrypted history (90d TTL)
│       │   └── RefreshToken.ts     # Token rotation + reuse detection
│       ├── repositories/           # Data access layer (no business logic)
│       ├── services/               # Business logic layer
│       ├── controllers/            # HTTP layer
│       ├── middleware/
│       │   ├── auth.middleware.ts  # JWT auth, Zod validation, error handler
│       │   └── security.middleware.ts  # Helmet, CORS, rate limits
│       ├── routes/
│       │   └── index.ts            # All API routes
│       ├── utils/
│       │   ├── jwt.ts              # Token signing/verification
│       │   ├── errors.ts           # AppError + asyncHandler
│       │   └── logger.ts           # Winston logger
│       └── validators/
│           └── schemas.ts          # Zod schemas
│
├── frontend/
│   └── src/
│       ├── app/                    # Next.js App Router pages
│       │   ├── login/page.tsx
│       │   ├── register/page.tsx
│       │   ├── dashboard/
│       │   │   ├── layout.tsx      # Sidebar + auth guard
│       │   │   └── page.tsx        # Stats dashboard
│       │   ├── vault/page.tsx      # Full CRUD vault
│       │   ├── history/page.tsx
│       │   └── settings/page.tsx
│       ├── lib/
│       │   ├── crypto.ts           # Zero-knowledge crypto (WebCrypto)
│       │   ├── password.ts         # Secure password generator
│       │   ├── api.ts              # Axios + interceptors
│       │   └── utils.ts            # Utilities
│       ├── stores/
│       │   ├── auth.store.ts       # Zustand auth state
│       │   ├── vault.store.ts      # Decrypted vault (memory only)
│       │   └── session.store.ts    # Vault key + auto-lock
│       ├── components/
│       │   └── vault/
│       │       ├── VaultItemModal.tsx
│       │       └── DeleteConfirmModal.tsx
│       └── types/index.ts
│
└── .github/
    └── workflows/ci.yml            # GitHub Actions CI/CD
```

---

## 🔐 Security Architecture

### Zero-Knowledge Model

| What the server stores | What the server can access |
|------------------------|---------------------------|
| bcrypt(derived_auth_password) | ❌ Master password |
| AES-GCM encrypted vault key | ❌ Vault key |
| AES-GCM encrypted vault items | ❌ Any plaintext item |
| JWT refresh token hashes | ❌ Vault key |
| Argon2/PBKDF2 salt | ❌ Master password |

### Key Derivation Chain

```
Master Password + Email
        │
        ├── PBKDF2 (SHA-256, 100k iterations, email-derived salt)
        │         └── Auth Password (hex) ──► bcrypt ──► stored
        │
        └── PBKDF2 (SHA-256, 600k iterations, random 256-bit salt)
                  └── KEK (Key Encryption Key, non-extractable)
                            │
                            └── AES-256-GCM decrypt
                                      │
                                      └── Vault Key (random 256-bit)
                                                │
                                                └── AES-256-GCM encrypt/decrypt
                                                          │
                                                          └── Vault Items
```

### Security Controls

| Layer | Control |
|-------|---------|
| Transport | HTTPS enforced, HSTS with preload |
| Headers | Helmet (CSP, X-Frame-Options, etc.) |
| Auth | JWT (HS256) + HTTP-only cookies, token rotation |
| Rate limiting | Global (100/15min), Auth (10/15min), Strict (5/min) |
| Input validation | Zod schemas on all endpoints |
| Database | MongoDB injection prevention (mongo-sanitize) |
| Brute force | Account lockout after 5 failed attempts (15min) |
| Token security | Refresh token family rotation + reuse detection |
| Vault key | In-memory only, never serialized |
| Clipboard | Auto-clear after 30 seconds |
| Auto-lock | Configurable inactivity timeout |

---

## 🌐 API Reference

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register with encrypted vault key |
| `POST` | `/api/auth/login` | Login (returns access token) |
| `POST` | `/api/auth/refresh` | Refresh access token (HTTP-only cookie) |
| `POST` | `/api/auth/logout` | Logout (revoke refresh token) |
| `POST` | `/api/auth/logout-all` | Logout all devices |
| `GET`  | `/api/auth/me` | Get user + encrypted vault key data |

### Vault

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/vault` | List all vault items (encrypted) |
| `POST`   | `/api/vault` | Create vault item |
| `GET`    | `/api/vault/:id` | Get single item |
| `PATCH`  | `/api/vault/:id` | Update item |
| `DELETE` | `/api/vault/:id` | Delete item |
| `POST`   | `/api/vault/check-duplicates` | Check for duplicate URL hash |

### History

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/history` | Get history (encrypted, 90d TTL) |
| `POST`   | `/api/history` | Add history entry |
| `DELETE` | `/api/history` | Clear all history |
| `DELETE` | `/api/history/:id` | Delete single entry |

---

## 🚢 Deployment

### Backend (Render)

1. Create new Web Service on Render
2. Connect GitHub repo, set root directory to `backend`
3. Build command: `npm install && npm run build`
4. Start command: `node dist/app.js`
5. Add all environment variables from `.env.example`

### Frontend (Vercel)

1. Import project on Vercel
2. Set root directory to `frontend`
3. Add `NEXT_PUBLIC_API_URL=https://your-backend.render.com/api`
4. Deploy

### MongoDB Atlas

1. Create cluster (M0 free tier works for dev)
2. Create database user
3. Whitelist IPs (or 0.0.0.0/0 for development)
4. Copy connection string to `MONGODB_URI`

---

## 🧪 Testing

```bash
# Frontend tests (crypto + password generator)
cd frontend && npm test

# Backend tests
cd backend && npm test

# With coverage
npm run test:coverage
```

---

## 🔧 Environment Variables Reference

### Backend (required)

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` | Min 32 chars, random |
| `JWT_REFRESH_SECRET` | Min 32 chars, random |
| `COOKIE_SECRET` | Min 32 chars, random |
| `FRONTEND_URL` | Allowed CORS origin |

### Frontend (required)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| State | Zustand |
| Crypto | Web Crypto API (AES-256-GCM, PBKDF2) |
| HTTP | Axios with interceptors |
| Backend | Node.js, Express.js, TypeScript |
| Database | MongoDB + Mongoose |
| Auth | JWT (HS256), bcrypt |
| Validation | Zod |
| Security | Helmet, CORS, rate-limit, mongo-sanitize |
| CI/CD | GitHub Actions |
| Frontend deploy | Vercel |
| Backend deploy | Render |

---

## ⚠️ Security Notice

This software handles sensitive credentials. Before production:

- [ ] Generate cryptographically random secrets for JWT and cookies
- [ ] Enable MongoDB Atlas IP allowlist
- [ ] Set up Sentry for error monitoring
- [ ] Configure HTTPS on your domain
- [ ] Review and harden CSP headers
- [ ] Run `npm audit` and resolve high/critical findings
- [ ] Enable MongoDB Atlas encryption at rest
- [ ] Set up automated backups

---

## 📄 License

MIT
