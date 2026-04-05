'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle, KeyRound, ArrowLeft,
  Mail, Loader2, CheckCircle2, Info, Eye, EyeOff, Server,
} from 'lucide-react';
import axios from 'axios';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});
type FormData = z.infer<typeof schema>;

type Stage = 'form' | 'sent' | 'devHint';

// Render free tier can take up to 60s to wake up; we show a message after 4s
const SLOW_THRESHOLD_MS = 4000;
const HINT_TIMEOUT_MS = 30000;

export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>('form');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [devHint, setDevHint] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const doSendHint = async (email: string) => {
    const { data } = await api.post<{
      success: boolean;
      message: string;
      devMode?: boolean;
      hint?: string;
    }>('/auth/send-hint', { email }, { timeout: HINT_TIMEOUT_MS });
    return data;
  };

  const onSubmit = async (form: FormData) => {
    setIsLoading(true);
    setIsWaking(false);
    setErrorMsg('');

    // Show a friendly 'waking server' message if the request takes >4s
    const wakingTimer = setTimeout(() => setIsWaking(true), SLOW_THRESHOLD_MS);

    const attempt = async () => {
      try {
        const data = await doSendHint(form.email);
        setSubmittedEmail(form.email);
        if (data.devMode && data.hint !== undefined) {
          setDevHint(data.hint);
          setStage('devHint');
        } else {
          setStage('sent');
        }
        return true;
      } catch (err) {
        // Retry once on timeout (backend cold-start)
        if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
          return false;
        }
        throw err;
      }
    };

    try {
      const ok = await attempt();
      if (!ok) {
        // One silent retry
        await doSendHint(form.email).then((data) => {
          setSubmittedEmail(form.email);
          if (data.devMode && data.hint !== undefined) {
            setDevHint(data.hint);
            setStage('devHint');
          } else {
            setStage('sent');
          }
        });
      }
    } catch {
      setErrorMsg('Server is unavailable. Please try again in a moment.');
    } finally {
      clearTimeout(wakingTimer);
      setIsWaking(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] bg-brand-600/6 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Back link */}
        <Link
          href="/login"
          className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-6 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600/20 border border-amber-500/30 mb-4">
            <KeyRound className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Forgot Master Password?</h1>
          <p className="text-slate-500 text-sm mt-1">We&apos;ll help you recover access</p>
        </div>

        <div className="glass p-8 shadow-2xl shadow-black/50">

          {/* ── Zero-knowledge warning (always visible) ──────────────────────── */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-amber-300 font-semibold text-sm mb-1">Zero-Knowledge Limitation</p>
              <p className="text-amber-300/70 text-xs leading-relaxed">
                Because SecurePass uses zero-knowledge encryption,{' '}
                <strong className="text-amber-300">your master password cannot be reset or recovered</strong>.
                The server never stores your password or any key that could decrypt your vault.
              </p>
            </div>
          </div>

          {/* ── Stage: Form ───────────────────────────────────────────────────── */}
          {stage === 'form' && (
            <>
              <div className="mb-6">
                <p className="text-slate-200 text-sm font-medium mb-1">Retrieve your password hint</p>
                <p className="text-slate-500 text-xs mb-5 leading-relaxed">
                  If you set a hint when you registered, we&apos;ll email it to you.
                  The hint is stored in plaintext — never use your actual password as a hint.
                </p>

                {errorMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-4">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <p className="text-red-400 text-xs">
                      {errorMsg.includes('404') ? 'Account not found. Please check the email.' : 'Something went wrong. Please try again later.'}
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                  <div>
                    <label className="label">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        {...register('email')}
                        type="email"
                        placeholder="your@email.com"
                        autoComplete="email"
                        className={cn('input pl-10', errors.email && 'input-error')}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                    )}
                  </div>
                  <button type="submit" disabled={isLoading} className="btn-primary w-full h-11">
                    {isLoading ? (
                      isWaking ? (
                        <><Server className="w-4 h-4 animate-pulse" /> Waking server up…</>
                      ) : (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                      )
                    ) : (
                      <><Mail className="w-4 h-4" /> Send hint to my email</>
                    )}
                  </button>
                </form>
              </div>

              {/* Options */}
              <div className="border-t border-slate-700/50 pt-5 space-y-2">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">
                  Other options
                </p>
                {[
                  { icon: '💡', title: 'Try password variations', desc: 'Different capitalizations, numbers at the end, or symbols you commonly add.' },
                  { icon: '💾', title: 'Check your backups', desc: 'If you exported an encrypted backup (.enc.json), you need the original master password to restore it.' },
                  { icon: '🗑️', title: 'Delete and start fresh', desc: 'Delete your account and create a new one. All encrypted vault data will be permanently lost.' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex gap-3 p-3 rounded-xl bg-surface-800/40 border border-slate-700/30">
                    <span className="text-base shrink-0 mt-0.5">{icon}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Stage: Email sent ─────────────────────────────────────────────── */}
          {stage === 'sent' && (
            <div className="text-center py-2 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-slate-100 font-semibold text-lg mb-2">Check your inbox</p>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                If <span className="text-slate-200 font-medium">{submittedEmail}</span> has an
                account with a hint set, you&apos;ll receive an email shortly.
              </p>
              <div className="p-3 rounded-xl bg-surface-800/40 border border-slate-700/30 text-left mb-6">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Didn&apos;t receive it? Check spam, or make sure SMTP is configured in your
                  backend <code className="bg-surface-900 px-1 rounded text-brand-300">.env</code>.
                </p>
              </div>
              <Link href="/login" className="btn-primary w-full flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </div>
          )}

          {/* ── Stage: Dev mode — hint shown directly ─────────────────────────── */}
          {stage === 'devHint' && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 mb-5">
                <Info className="w-4 h-4 text-brand-400 shrink-0" />
                <p className="text-brand-300 text-xs">
                  <strong>Development mode</strong> — SMTP not configured. Hint shown here instead of email.
                </p>
              </div>

              <p className="text-slate-400 text-sm mb-3">
                Hint for <span className="text-slate-200 font-medium">{submittedEmail}</span>:
              </p>

              <div className="relative bg-surface-900/80 rounded-xl p-4 border border-slate-700/50 mb-6">
                <p className={cn(
                  'text-slate-100 font-medium text-base pr-8 min-h-[24px]',
                  !showHint && devHint && devHint !== '(no hint set for this account)' && 'blur-sm select-none'
                )}>
                  {devHint ?? '(no hint set)'}
                </p>
                {devHint && devHint !== '(no hint set for this account)' && (
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showHint ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-5">
                <p className="text-amber-300/80 text-xs leading-relaxed">
                  To enable real email delivery, add SMTP settings to your backend{' '}
                  <code className="bg-surface-900 px-1 rounded text-amber-300">.env</code> and restart.
                </p>
              </div>

              <Link href="/login" className="btn-primary w-full flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          🔐 Zero-knowledge means only you can decrypt your vault
        </p>
      </div>
    </div>
  );
}
