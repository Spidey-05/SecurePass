'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, EyeOff, Lock, Mail, Shield, Loader2,
  AlertCircle, CheckCircle2, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { authApi } from '@/lib/api';
import { prepareRegistration } from '@/lib/crypto';
import { analyzePasswordStrength, type StrengthLevel } from '@/lib/password';
import { useAuthStore } from '@/stores/auth.store';
import { useSessionStore, startAutoLockTimer } from '@/stores/session.store';
import { cn } from '@/lib/utils';

const registerSchema = z
  .object({
    email: z.string().email("Enter a valid email").max(255).refine(e => e.includes("@") && e.split("@")[1]?.includes("."), "Enter a valid email with a real domain"),
    masterPassword: z
      .string()
      .min(12, 'Master password must be at least 12 characters')
      .max(128),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    passwordHint: z.string().max(255).optional(),
  })
  .refine((d) => d.masterPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => {
    // Prevent using actual password as hint
    if (d.passwordHint && d.masterPassword) {
      return !d.passwordHint.toLowerCase().includes(d.masterPassword.toLowerCase());
    }
    return true;
  }, {
    message: 'Hint must not contain your actual password',
    path: ['passwordHint'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const strengthColors: Record<StrengthLevel, string> = {
  'very-weak': 'bg-red-500',
  weak: 'bg-orange-500',
  fair: 'bg-amber-500',
  strong: 'bg-emerald-500',
  'very-strong': 'bg-brand-500',
};

const strengthWidths: Record<StrengthLevel, string> = {
  'very-weak': 'w-1/5',
  weak: 'w-2/5',
  fair: 'w-3/5',
  strong: 'w-4/5',
  'very-strong': 'w-full',
};

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [passwordValue, setPasswordValue] = useState('');

  const { setAuth } = useAuthStore();
  const { setVaultKey } = useSessionStore();

  const strength = analyzePasswordStrength(passwordValue);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (form: RegisterForm) => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      // All crypto happens here — master password never sent to server
      const cryptoResult = await prepareRegistration(form.email, form.masterPassword);

      const { data: authData } = await authApi.register({
        email: form.email,
        authPassword: cryptoResult.authPassword,
        encryptedVaultKey: cryptoResult.encryptedVaultKey,
        vaultKeySalt: cryptoResult.vaultKeySalt,
        vaultKeyIv: cryptoResult.vaultKeyIv,
        vaultKeyAuthTag: cryptoResult.vaultKeyAuthTag,
        passwordHint: form.passwordHint || undefined,
      });

      const { accessToken, user } = authData.data;

      setAuth(user, accessToken);
      setVaultKey(cryptoResult.vaultKey);
      startAutoLockTimer();

      toast.success('Vault created! Welcome to SecurePass.');
      router.push('/dashboard');
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: { message?: string; code?: string } } } })?.response?.data?.error;
      let msg = errData?.message ?? 'Registration failed. Please try again.';
      if (errData?.code === 'EMAIL_EXISTS' || msg.toLowerCase().includes('already registered')) {
        msg = 'This email is already registered. Sign in instead, or use a different email.';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 mb-4">
            <Shield className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">SecurePass</h1>
          <p className="text-slate-500 text-sm mt-1">Create your encrypted vault</p>
        </div>

        <div className="glass p-8 shadow-2xl shadow-black/50">
          <h2 className="text-xl font-semibold text-slate-100 mb-1">Create account</h2>
          <p className="text-slate-500 text-sm mb-6">
            Choose a strong master password — it cannot be recovered.
          </p>

          {errorMsg && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-400 text-sm">{errorMsg}</p>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-5">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-300/80 text-xs leading-relaxed">
              Your master password encrypts your vault locally. We cannot recover it if lost.
              Store it somewhere safe.
            </p>
          </div>

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
                  {...register('masterPassword', {
                    onChange: (e) => setPasswordValue(e.target.value),
                  })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 12 characters"
                  autoComplete="new-password"
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

              {/* Strength meter */}
              {passwordValue && (
                <div className="mt-2 space-y-1.5 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          strengthColors[strength.level],
                          strengthWidths[strength.level]
                        )}
                      />
                    </div>
                    <span className="text-xs text-slate-400 capitalize w-20 text-right">
                      {strength.level.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs">
                    ~{strength.entropy} bits entropy · cracks in {strength.timeToCrack}
                  </p>
                  {strength.feedback.map((f, i) => (
                    <p key={i} className="text-amber-400/80 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {f}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label">Confirm master password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className={cn('input pl-10 pr-10', errors.confirmPassword && 'input-error')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Password Hint (optional) */}
            <div>
              <label className="label">
                Password hint
                <span className="text-slate-600 font-normal ml-1">(optional)</span>
              </label>
              <input
                {...register('passwordHint')}
                type="text"
                placeholder="A clue to help you remember — never your actual password"
                className={cn('input', errors.passwordHint && 'input-error')}
                autoComplete="off"
              />
              {errors.passwordHint ? (
                <p className="text-red-400 text-xs mt-1">{errors.passwordHint.message}</p>
              ) : (
                <p className="text-slate-600 text-xs mt-1">
                  Stored in plaintext. If you forget your password, we&apos;ll email this hint to you.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full mt-2 h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating encrypted vault…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Create Vault
                </>
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
              Sign in
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
