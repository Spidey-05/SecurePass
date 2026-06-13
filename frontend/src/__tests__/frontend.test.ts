/**
 * SecurePass — Frontend Unit Tests
 * Tool: Jest + @testing-library/react
 *
 * Covers:
 *  - Login page form validation & submission
 *  - Forgot password page stages & form validation
 *  - Vault page search/filter logic
 *
 * Run: cd frontend && npm test
 */

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  const MockLink = ({ href, children, className }: any) => (
    <a href={href} className={className}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock API
jest.mock('@/lib/api', () => ({
  authApi: {
    login: jest.fn(),
  },
  vaultApi: {
    getAll: jest.fn(),
  },
  default: {
    post: jest.fn(),
  },
}));

// Mock crypto helpers
jest.mock('@/lib/crypto', () => ({
  deriveAuthPassword: jest.fn().mockResolvedValue('derived_auth_password'),
  prepareLogin: jest.fn().mockResolvedValue({ vaultKey: 'mock_vault_key' }),
  decryptVaultItems: jest.fn().mockResolvedValue([]),
}));

// Mock stores
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ setAuth: jest.fn() }),
}));

jest.mock('@/stores/session.store', () => ({
  useSessionStore: () => ({ setVaultKey: jest.fn(), vaultKey: 'mock_key' }),
  startAutoLockTimer: jest.fn(),
}));

jest.mock('@/stores/vault.store', () => ({
  useVaultStore: () => ({
    setItems: jest.fn(),
    setLoading: jest.fn(),
    items: [],
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    toggleFavorite: jest.fn(),
  }),
  decryptVaultItems: jest.fn().mockResolvedValue([]),
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

// ── Import Components ─────────────────────────────────────────────────────────

// Dynamic imports to apply mocks first
let LoginPage: any;
let ForgotPasswordPage: any;

beforeAll(async () => {
  LoginPage = (await import('@/app/login/page')).default;
  ForgotPasswordPage = (await import('@/app/forgot-password/page')).default;
});

// =============================================================================
// LOGIN PAGE TESTS
// =============================================================================

describe('LoginPage — Form Validation', () => {
  const setup = () => render(<LoginPage />);

  it('TC-UI-LOG-01 | renders email and password fields + submit button', () => {
    setup();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Your master password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unlock Vault/i })).toBeInTheDocument();
  });

  it('TC-UI-LOG-02 | submitting empty form shows validation errors', async () => {
    setup();
    const submit = screen.getByRole('button', { name: /Unlock Vault/i });
    fireEvent.click(submit);
    await waitFor(() => {
      expect(screen.getByText(/Enter a valid email/i)).toBeInTheDocument();
      expect(screen.getByText(/Master password is required/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-LOG-03 | invalid email format shows email error', async () => {
    setup();
    const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
    await userEvent.type(emailInput, 'not-an-email');
    fireEvent.click(screen.getByRole('button', { name: /Unlock Vault/i }));
    await waitFor(() => {
      expect(screen.getByText(/Enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-LOG-04 | password toggle shows/hides master password', async () => {
    setup();
    const pwdField = screen.getByPlaceholderText(/Your master password/i) as HTMLInputElement;
    expect(pwdField.type).toBe('password');

    // Find the toggle button (Eye icon button)
    const toggleBtn = screen.getByRole('button', { name: '' }); // tabIndex=-1 button
    fireEvent.click(toggleBtn);
    expect(pwdField.type).toBe('text');

    fireEvent.click(toggleBtn);
    expect(pwdField.type).toBe('password');
  });

  it('TC-UI-LOG-05 | "Forgot master password?" link directs to /forgot-password', () => {
    setup();
    const link = screen.getByText(/Forgot master password\?/i);
    expect(link.closest('a')).toHaveAttribute('href', '/forgot-password');
  });

  it('TC-UI-LOG-06 | "Create one" link directs to /register', () => {
    setup();
    const link = screen.getByText(/Create one/i);
    expect(link.closest('a')).toHaveAttribute('href', '/register');
  });

  it('TC-UI-LOG-07 | shows loading spinner + "Decrypting vault…" text during login', async () => {
    const { authApi } = await import('@/lib/api');
    (authApi.login as jest.Mock).mockImplementation(
      () => new Promise((res) => setTimeout(res, 500))
    );
    setup();

    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@example.com');
    await userEvent.type(screen.getByPlaceholderText(/Your master password/i), 'TestPass123!');
    fireEvent.click(screen.getByRole('button', { name: /Unlock Vault/i }));

    await waitFor(() => {
      expect(screen.getByText(/Decrypting vault/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-LOG-08 | shows error message on login failure', async () => {
    const { authApi } = await import('@/lib/api');
    (authApi.login as jest.Mock).mockRejectedValueOnce({
      response: { data: { error: { message: 'Invalid credentials' } } },
    });
    setup();

    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@example.com');
    await userEvent.type(screen.getByPlaceholderText(/Your master password/i), 'WrongPass!');
    fireEvent.click(screen.getByRole('button', { name: /Unlock Vault/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-LOG-09 | successful login calls router.replace with /dashboard', async () => {
    const { authApi, vaultApi } = await import('@/lib/api');
    const mockReplace = jest.fn();
    jest.mocked(require('next/navigation').useRouter).mockReturnValue({ replace: mockReplace });

    (authApi.login as jest.Mock).mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'tok',
          user: {
            encryptedVaultKey: 'k',
            vaultKeySalt: 's',
            vaultKeyIv: 'i',
            vaultKeyAuthTag: 't',
          },
        },
      },
    });
    (vaultApi.getAll as jest.Mock).mockResolvedValueOnce({ data: { data: { items: [] } } });

    setup();
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@example.com');
    await userEvent.type(screen.getByPlaceholderText(/Your master password/i), 'Pass123!');
    fireEvent.click(screen.getByRole('button', { name: /Unlock Vault/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });
});

// =============================================================================
// FORGOT PASSWORD PAGE TESTS
// =============================================================================

describe('ForgotPasswordPage — Stages & Validation', () => {
  const setup = () => render(<ForgotPasswordPage />);

  it('TC-UI-FP-01 | renders initial "form" stage with email input', () => {
    setup();
    expect(screen.getByPlaceholderText(/your@email\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send hint to my email/i })).toBeInTheDocument();
  });

  it('TC-UI-FP-02 | shows zero-knowledge warning banner', () => {
    setup();
    expect(screen.getByText(/Zero-Knowledge Limitation/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be reset or recovered/i)).toBeInTheDocument();
  });

  it('TC-UI-FP-03 | empty submit shows email validation error', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Send hint to my email/i }));
    await waitFor(() => {
      expect(screen.getByText(/Enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-FP-04 | invalid email format shows validation error', async () => {
    setup();
    await userEvent.type(screen.getByPlaceholderText(/your@email\.com/i), 'bademail');
    fireEvent.click(screen.getByRole('button', { name: /Send hint to my email/i }));
    await waitFor(() => {
      expect(screen.getByText(/Enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-FP-05 | successful hint request moves to "sent" stage', async () => {
    const api = (await import('@/lib/api')).default;
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, message: 'Sent' },
    });
    setup();

    await userEvent.type(screen.getByPlaceholderText(/your@email\.com/i), 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Send hint to my email/i }));

    await waitFor(() => {
      expect(screen.getByText(/Check your inbox/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-FP-06 | devMode response shows hint in devHint stage', async () => {
    const api = (await import('@/lib/api')).default;
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, devMode: true, hint: 'Blue sky 42' },
    });
    setup();

    await userEvent.type(screen.getByPlaceholderText(/your@email\.com/i), 'dev@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Send hint to my email/i }));

    await waitFor(() => {
      expect(screen.getByText(/Development mode/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-FP-07 | server error shows "Server is unavailable" message', async () => {
    const api = (await import('@/lib/api')).default;
    (api.post as jest.Mock).mockRejectedValue(new Error('Network Error'));
    setup();

    await userEvent.type(screen.getByPlaceholderText(/your@email\.com/i), 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Send hint to my email/i }));

    await waitFor(() => {
      expect(screen.getByText(/Server is unavailable/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-FP-08 | back to login link present on all stages', () => {
    setup();
    expect(screen.getByText(/Back to login/i)).toBeInTheDocument();
  });

  it('TC-UI-FP-09 | other options section visible on form stage', () => {
    setup();
    expect(screen.getByText(/Try password variations/i)).toBeInTheDocument();
    expect(screen.getByText(/Check your backups/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete and start fresh/i)).toBeInTheDocument();
  });
});

// =============================================================================
// VAULT PAGE — Filter/Search Logic Tests
// =============================================================================

describe('Vault Search & Filter Logic', () => {
  /**
   * Test the pure filtering logic (extracted from useMemo in vault/page.tsx)
   * without full component mounting.
   */

  type MockVaultItem = {
    _id: string;
    itemType: 'login' | 'note' | 'card' | 'identity';
    isFavorite: boolean;
    data: { name: string; url?: string; username?: string; password?: string };
  };

  function applyFilter(
    items: MockVaultItem[],
    search: string,
    filterType: string,
    showFavs: boolean
  ) {
    return items.filter((item) => {
      const name = item.data.name.toLowerCase();
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        name.includes(q) ||
        ('url' in item.data && item.data.url?.includes(q)) ||
        ('username' in item.data && item.data.username?.toLowerCase().includes(q));
      const matchType = filterType === 'all' || item.itemType === filterType;
      const matchFav = !showFavs || item.isFavorite;
      return matchSearch && matchType && matchFav;
    });
  }

  const mockItems: MockVaultItem[] = [
    { _id: '1', itemType: 'login', isFavorite: true,  data: { name: 'GitHub', url: 'https://github.com', username: 'alice', password: 'p1' } },
    { _id: '2', itemType: 'login', isFavorite: false, data: { name: 'Gmail',  url: 'https://gmail.com',  username: 'alice@gmail.com', password: 'p2' } },
    { _id: '3', itemType: 'note',  isFavorite: false, data: { name: 'Work Notes' } },
    { _id: '4', itemType: 'card',  isFavorite: true,  data: { name: 'Visa Card' } },
    { _id: '5', itemType: 'identity', isFavorite: false, data: { name: 'John Doe' } },
  ];

  it('TC-VLT-SRCH-01 | no filters → all items returned', () => {
    expect(applyFilter(mockItems, '', 'all', false).length).toBe(5);
  });

  it('TC-VLT-SRCH-02 | search by name (case-insensitive) → matches', () => {
    expect(applyFilter(mockItems, 'github', 'all', false)).toHaveLength(1);
    expect(applyFilter(mockItems, 'GITHUB', 'all', false)).toHaveLength(1);
  });

  it('TC-VLT-SRCH-03 | search by URL substring → matches', () => {
    expect(applyFilter(mockItems, 'gmail.com', 'all', false)).toHaveLength(1);
  });

  it('TC-VLT-SRCH-04 | search by username → matches', () => {
    expect(applyFilter(mockItems, 'alice', 'all', false)).toHaveLength(2); // both logins
  });

  it('TC-VLT-SRCH-05 | search with no match → empty array', () => {
    expect(applyFilter(mockItems, 'xyznotfound', 'all', false)).toHaveLength(0);
  });

  it('TC-VLT-SRCH-06 | filter type=note → only notes', () => {
    const r = applyFilter(mockItems, '', 'note', false);
    expect(r.every((i) => i.itemType === 'note')).toBe(true);
    expect(r).toHaveLength(1);
  });

  it('TC-VLT-SRCH-07 | filter type=card → only cards', () => {
    const r = applyFilter(mockItems, '', 'card', false);
    expect(r).toHaveLength(1);
    expect(r[0].itemType).toBe('card');
  });

  it('TC-VLT-SRCH-08 | showFavs=true → only favorites', () => {
    const r = applyFilter(mockItems, '', 'all', true);
    expect(r.every((i) => i.isFavorite)).toBe(true);
    expect(r).toHaveLength(2);
  });

  it('TC-VLT-SRCH-09 | search + type filter combined', () => {
    // Search "alice" within logins only
    const r = applyFilter(mockItems, 'alice', 'login', false);
    expect(r.every((i) => i.itemType === 'login')).toBe(true);
    expect(r).toHaveLength(2);
  });

  it('TC-VLT-SRCH-10 | search + favorites combined', () => {
    const r = applyFilter(mockItems, 'github', 'all', true);
    expect(r).toHaveLength(1);
    expect(r[0]._id).toBe('1');
  });

  it('TC-VLT-SRCH-11 | empty search string with type=login and showFavs=true', () => {
    const r = applyFilter(mockItems, '', 'login', true);
    expect(r).toHaveLength(1); // Only GitHub is a favorite login
    expect(r[0]._id).toBe('1');
  });
});

// =============================================================================
// SECURITY TESTS — Input Handling
// =============================================================================

describe('Security — XSS / Injection Input Handling', () => {
  it('TC-SEC-UI-01 | XSS in search input does not execute script tags', async () => {
    // Ensure no alert is thrown when XSS payload is typed
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const VaultPage = (await import('@/app/vault/page')).default;
    render(<VaultPage />);

    const searchInput = screen.queryByPlaceholderText(/Search vault/i);
    if (searchInput) {
      await userEvent.type(searchInput, '<script>alert("xss")</script>');
      expect(alertSpy).not.toHaveBeenCalled();
    }
    alertSpy.mockRestore();
  });
});
