'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, Shield, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { authApi, vaultApi } from '@/lib/api';
import { deriveAuthPassword, prepareLogin } from '@/lib/crypto';
import { useAuthStore } from '@/stores/auth.store';
import { useSessionStore, startAutoLockTimer } from '@/stores/session.store';
import { useVaultStore, decryptVaultItems } from '@/stores/vault.store';
import { cn } from '@/lib/utils';
import type { VaultListResponse } from '@/types';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  masterPassword: z.string().min(1, 'Master password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { setAuth } = useAuthStore();
  const { setVaultKey } = useSessionStore();
  const { setItems, setLoading: setVaultLoading } = useVaultStore();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (form: LoginForm) => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      // Step 1: Derive auth password from master password + email
      // deriveAuthPassword(masterPassword, email) — master password FIRST
      const authPassword = await deriveAuthPassword(form.masterPassword, form.email);

      // Step 2: Send auth password to server (NOT the master password)
      const { data: authData } = await authApi.login({
        email: form.email,
        authPassword,
      });

      const { accessToken, user } = authData.data;

      // Step 3: Now derive KEK and decrypt vault key using the server's stored salt
      const { vaultKey } = await prepareLogin(form.email, form.masterPassword, {
        encryptedVaultKey: user.encryptedVaultKey,
        vaultKeySalt: user.vaultKeySalt,
        vaultKeyIv: user.vaultKeyIv,
        vaultKeyAuthTag: user.vaultKeyAuthTag,
      });

      // Step 4: Store auth state (access token in memory)
      setAuth(user, accessToken);

      // Step 5: Store vault key in memory only — never persisted
      setVaultKey(vaultKey);

      // Step 6: Load and decrypt all vault items
      setVaultLoading(true);
      try {
        const { data: vaultData } = await vaultApi.getAll();
        const raw = (vaultData as { data: VaultListResponse }).data;
        const decrypted = await decryptVaultItems(raw.items, vaultKey);
        setItems(decrypted);
      } finally {
        setVaultLoading(false);
      }

      // Step 7: Start auto-lock inactivity timer
      startAutoLockTimer();

      toast.success('Welcome back!');

      // Redirect immediately — auth state is fully settled at this point.
      // No setTimeout needed; the dashboard guard already waits 500ms before
      // triggering any redirect, so this is always safe.
      router.replace(redirectTo);
    } catch (err: unknown) {
      const serverMsg = (err as {
        response?: { data?: { error?: { message?: string } } };
      })?.response?.data?.error?.message;

      setErrorMsg(serverMsg ?? 'Login failed. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 mb-4">
            <Shield className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">SecurePass</h1>
          <p className="text-slate-500 text-sm mt-1">Zero-knowledge password manager</p>
        </div>

        {/* Card */}
        <div className="glass p-8 shadow-2xl shadow-black/50">
          <h2 className="text-xl font-semibold text-slate-100 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-6">
            Your data is encrypted end-to-end. Only you can read it.
          </p>

          {errorMsg && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-400 text-sm">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={cn('input pl-10', errors.email && 'input-error')}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Master Password */}
            <div>
              <label className="label">Master password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  {...register('masterPassword')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your master password"
                  autoComplete="current-password"
                  className={cn('input pl-10 pr-10', errors.masterPassword && 'input-error')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.masterPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.masterPassword.message}</p>
              )}
              <div className="flex justify-end mt-1.5">
                <Link
                  href="/forgot-password"
                  className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
                >
                  Forgot master password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Decrypting vault…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Unlock Vault
                </>
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
              Create one
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          🔐 Your master password never leaves your device
        </p>
      </div>
    </div>
  );
}