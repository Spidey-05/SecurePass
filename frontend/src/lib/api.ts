import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:5000/api';

// ─── Create Instance ───────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,          // include cookies (refresh token)
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ─── Token Management ──────────────────────────────────────────────────────────

let accessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
// Set to true during the silent auth bootstrap so the interceptor doesn't
// trigger a hard window.location redirect when the user just has no session.
let isBootstrapping = false;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setBootstrapping(value: boolean): void {
  isBootstrapping = value;
}

function onRefreshed(token: string): void {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void): void {
  refreshSubscribers.push(cb);
}

// ─── Request Interceptor ───────────────────────────────────────────────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor — Auto Token Refresh ────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Avoid retry loops for auth endpoints
    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Queue this request until token refresh completes
        return new Promise((resolve) => {
          addRefreshSubscriber((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post<{
          success: boolean;
          data: { accessToken: string };
        }>('/auth/refresh');

        const newToken = data.data.accessToken;
        setAccessToken(newToken);
        onRefreshed(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed — clear state and redirect to login
        setAccessToken(null);
        refreshSubscribers = [];
        // Only hard-redirect if we are NOT in the silent bootstrap phase.
        if (typeof window !== 'undefined' && !isBootstrapping) {
          window.location.href = '/login?expired=1';
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Typed API Methods ─────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const authApi = {
  register: (data: {
    email: string;
    authPassword: string;
    encryptedVaultKey: string;
    vaultKeySalt: string;
    vaultKeyIv: string;
    vaultKeyAuthTag: string;
    passwordHint?: string;
  }) => api.post<ApiResponse<{
    accessToken: string;
    user: {
      id: string;
      email: string;
      encryptedVaultKey: string;
      vaultKeySalt: string;
      vaultKeyIv: string;
      vaultKeyAuthTag: string;
    };
  }>>('/auth/register', data),

  login: (data: { email: string; authPassword: string }) =>
    api.post<ApiResponse<{
      accessToken: string;
      user: {
        id: string;
        email: string;
        encryptedVaultKey: string;
        vaultKeySalt: string;
        vaultKeyIv: string;
        vaultKeyAuthTag: string;
      };
    }>>('/auth/login', data),

  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  getMe: () => api.get<ApiResponse<{
    user: {
      id: string;
      email: string;
      encryptedVaultKey: string;
      vaultKeySalt: string;
      vaultKeyIv: string;
      vaultKeyAuthTag: string;
    };
  }>>('/auth/me'),
};

export const vaultApi = {
  getAll: (params?: {
    itemType?: string;
    isFavorite?: boolean;
    page?: number;
    limit?: number;
  }) => api.get('/vault', { params }),

  getOne: (id: string) => api.get(`/vault/${id}`),

  create: (data: object) => api.post('/vault', data),

  update: (id: string, data: object) => api.patch(`/vault/${id}`, data),

  delete: (id: string, data?: object) => api.delete(`/vault/${id}`, { data }),

  checkDuplicates: (urlHash: string) =>
    api.post('/vault/check-duplicates', { urlHash }),
};

export const historyApi = {
  getAll: (params?: { action?: string; page?: number; limit?: number }) =>
    api.get('/history', { params }),

  create: (data: object) => api.post('/history', data),

  clear: () => api.delete('/history'),

  delete: (id: string) => api.delete(`/history/${id}`),
};

export default api;
