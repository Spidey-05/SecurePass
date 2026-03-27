'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield, Lock, Eye, EyeOff, RefreshCw, Copy, Check,
  Zap, KeyRound, Database, Globe, ChevronRight,
  ShieldCheck, Cpu, Fingerprint, ArrowRight,
} from 'lucide-react';
import { generatePassword, analyzePasswordStrength } from '@/lib/password';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

function useTypingEffect(words: string[], speed = 80, pause = 1800) {
  const [display, setDisplay] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIdx % words.length]!;
    const timeout = setTimeout(() => {
      if (!deleting) {
        setDisplay(current.slice(0, charIdx + 1));
        if (charIdx + 1 === current.length) {
          setTimeout(() => setDeleting(true), pause);
        } else { setCharIdx(c => c + 1); }
      } else {
        setDisplay(current.slice(0, charIdx - 1));
        if (charIdx - 1 === 0) {
          setDeleting(false);
          setWordIdx(w => w + 1);
          setCharIdx(0);
        } else { setCharIdx(c => c - 1); }
      }
    }, deleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, wordIdx, words, speed, pause]);

  return display;
}

const strengthConfig = {
  'very-weak':   { color: 'bg-red-500',     label: 'Very Weak',   text: 'text-red-400' },
  weak:          { color: 'bg-orange-500',   label: 'Weak',        text: 'text-orange-400' },
  fair:          { color: 'bg-amber-500',    label: 'Fair',        text: 'text-amber-400' },
  strong:        { color: 'bg-emerald-500',  label: 'Strong',      text: 'text-emerald-400' },
  'very-strong': { color: 'bg-brand-500',    label: 'Very Strong', text: 'text-brand-400' },
} as const;

export default function LandingPage() {
  const router = useRouter();
  const typed = useTypingEffect([
    'unbreakable passwords.',
    'zero-knowledge security.',
    'your digital fortress.',
    'encrypted by design.',
  ]);

  const { isAuthenticated, isLoading } = useAuthStore();

  // Redirect logged-in users straight to the dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // Prefetch auth + dashboard pages so navigation is instant
  useEffect(() => {
    router.prefetch('/login');
    router.prefetch('/register');
    router.prefetch('/dashboard');
  }, [router]);

  const [password, setPassword] = useState('');
  const [pwLength, setPwLength] = useState(16);
  const [options, setOptions] = useState({ uppercase: true, lowercase: true, numbers: true, symbols: true });
  const [copied, setCopied] = useState(false);
  const [showPw, setShowPw] = useState(true);
  const [activeTab, setActiveTab] = useState<'generator' | 'checker'>('generator');
  const [checkInput, setCheckInput] = useState('');
  const [showCheck, setShowCheck] = useState(false);

  const strength = analyzePasswordStrength(password);
  const checkStrength = analyzePasswordStrength(checkInput);
  const sCfg = strengthConfig[strength.level];
  const cCfg = strengthConfig[checkStrength.level];

  const generate = useCallback(() => {
    try {
      setPassword(generatePassword({
        length: pwLength,
        ...options,
        excludeAmbiguous: true,
        excludeSimilar: false,
      }));
      setCopied(false);
    } catch { setPassword('Enable at least one type'); }
  }, [pwLength, options]);

  useEffect(() => { generate(); }, [generate]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const features = [
    { icon: Lock,        title: 'Zero-Knowledge Encryption', desc: 'AES-256-GCM in your browser. Master password never leaves your device.' },
    { icon: Cpu,         title: 'Cryptographic Generator',   desc: 'Web Crypto API — not Math.random(). Rejection-sampled for true randomness.' },
    { icon: Database,    title: 'Secure Vault',              desc: 'Logins, cards, notes, identities — all encrypted client-side.' },
    { icon: Globe,       title: 'Access Anywhere',           desc: 'Encrypted vault syncs across devices. Only you hold the key.' },
    { icon: ShieldCheck, title: 'Breach Analysis',           desc: 'Entropy-based strength tells you exactly how long cracking takes.' },
    { icon: Fingerprint, title: 'Auto-Lock',                 desc: 'Vault key lives in memory only. Clears on inactivity and logout.' },
  ];

  const strengthLevels = ['very-weak','weak','fair','strong','very-strong'] as const;

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-brand-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-violet-600/6 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-emerald-600/5 rounded-full blur-[80px]" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(#6366f1 1px,transparent 1px),linear-gradient(90deg,#6366f1 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600/30 border border-brand-500/40 flex items-center justify-center">
            <Shield className="w-4 h-4 text-brand-400" />
          </div>
          <span className="font-bold text-slate-100 tracking-tight">SecurePass</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-400 hover:text-slate-200 transition-colors px-4 py-2">Login</Link>
          <Link href="/register" className="btn-primary text-sm px-5 py-2">
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-16 pb-24 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-medium mb-8 animate-fade-in">
          <Zap className="w-3 h-3" />
          Privacy-focused password security
        </div>
        <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6 animate-slide-up">
          Your passwords,{' '}
          <span className="block text-gradient">
            {typed}
            <span className="animate-pulse ml-0.5 opacity-70">|</span>
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up">
          Generate unbreakable passwords, check their strength, and store them in an encrypted vault. No tracking, no compromise.
        </p>
        <div className="flex items-center justify-center gap-4 animate-slide-up">
          <Link href="/register" className="btn-primary px-8 py-3.5 text-base shadow-lg shadow-brand-900/40">
            Start Securing <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/login" className="btn-secondary px-8 py-3.5 text-base">Sign In</Link>
        </div>
        <div className="flex items-center justify-center gap-6 mt-10 text-xs text-slate-600 animate-fade-in flex-wrap">
          {['AES-256-GCM Encrypted', 'Zero-Knowledge', 'Open Architecture', 'No Tracking'].map(b => (
            <div key={b} className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-brand-500" />{b}
            </div>
          ))}
        </div>
      </section>

      {/* Live Demo */}
      <section className="relative z-10 px-6 pb-24 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Try it <span className="text-brand-400">now</span></h2>
          <p className="text-slate-500 text-sm">No account needed — generate passwords or check strength instantly.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-surface-900/60 rounded-xl border border-slate-800/60 mb-6 backdrop-blur-sm">
          {([['generator', KeyRound, 'Generator'], ['checker', ShieldCheck, 'Strength Checker']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                activeTab === id ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40' : 'text-slate-400 hover:text-slate-200'
              )}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Generator */}
        {activeTab === 'generator' && (
          <div className="glass p-6 space-y-5 animate-scale-in">
            <div className="relative bg-surface-950/80 rounded-xl p-4 border border-slate-700/50">
              <p className="font-mono text-lg text-slate-100 break-all pr-8 min-h-[32px] tracking-wider">
                {showPw ? password : '•'.repeat(password.length)}
              </p>
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Strength</span>
                <span className={cn('text-xs font-semibold', sCfg.text)}>{sCfg.label}</span>
              </div>
              <div className="flex gap-1.5">
                {strengthLevels.map((lvl, i) => (
                  <div key={lvl} className={cn('flex-1 h-1.5 rounded-full transition-all duration-500',
                    i <= strengthLevels.indexOf(strength.level) ? sCfg.color : 'bg-surface-700')} />
                ))}
              </div>
              <div className="flex gap-4 text-xs text-slate-600">
                <span>⚡ Entropy: <span className="text-slate-400">{strength.entropy} bits</span></span>
                <span>⏱ Cracks in: <span className="text-slate-400">{strength.timeToCrack}</span></span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleCopy}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all',
                  copied ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-slate-700/50 text-slate-300 hover:bg-surface-700/50')}>
                {copied ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
              </button>
              <button onClick={generate} className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 text-sm">
                <RefreshCw className="w-4 h-4" />Generate
              </button>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-700/40">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Length</span>
                <span className="text-sm font-mono font-bold text-brand-400">{pwLength}</span>
              </div>
              <input type="range" min={8} max={64} value={pwLength}
                onChange={e => setPwLength(Number(e.target.value))}
                className="w-full accent-brand-500 cursor-pointer" />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'uppercase', label: 'Uppercase (A-Z)' },
                  { key: 'lowercase', label: 'Lowercase (a-z)' },
                  { key: 'numbers',   label: 'Numbers (0-9)' },
                  { key: 'symbols',   label: 'Symbols (!@#)' },
                ].map(({ key, label }) => (
                  <button key={key}
                    onClick={() => setOptions(o => ({ ...o, [key]: !o[key as keyof typeof o] }))}
                    className={cn('flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium border transition-all',
                      options[key as keyof typeof options]
                        ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                        : 'border-slate-700/50 text-slate-500 hover:border-slate-600/50')}>
                    {label}
                    <div className={cn('w-8 h-4 rounded-full transition-all relative', options[key as keyof typeof options] ? 'bg-brand-500' : 'bg-surface-700')}>
                      <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', options[key as keyof typeof options] ? 'left-4' : 'left-0.5')} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-center text-xs text-slate-500 pt-1 border-t border-slate-700/40">
              <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium">Sign up</Link>
              {' '}to save passwords to your encrypted vault.
            </p>
          </div>
        )}

        {/* Strength Checker */}
        {activeTab === 'checker' && (
          <div className="glass p-6 space-y-5 animate-scale-in">
            <div className="relative">
              <label className="label">Enter any password to analyze</label>
              <input type={showCheck ? 'text' : 'password'} value={checkInput}
                onChange={e => setCheckInput(e.target.value)}
                placeholder="Type or paste a password…"
                className="input font-mono pr-10" />
              <button onClick={() => setShowCheck(!showCheck)}
                className="absolute right-3 bottom-3 text-slate-500 hover:text-slate-300">
                {showCheck ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {checkInput ? (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-5">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#1e293b" strokeWidth="8" />
                      <circle cx="40" cy="40" r="32" fill="none"
                        stroke={checkStrength.level === 'very-strong' ? '#6366f1' : checkStrength.level === 'strong' ? '#10b981' : checkStrength.level === 'fair' ? '#f59e0b' : '#ef4444'}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 32}`}
                        strokeDashoffset={`${2 * Math.PI * 32 * (1 - checkStrength.score / 100)}`}
                        className="transition-all duration-700" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-black font-mono">{checkStrength.score}</span>
                    </div>
                  </div>
                  <div>
                    <p className={cn('text-lg font-bold capitalize', cCfg.text)}>{checkStrength.level.replace('-', ' ')}</p>
                    <p className="text-xs text-slate-500 mt-1">{checkStrength.entropy} bits entropy</p>
                    <p className="text-xs text-slate-500">Cracks in: <span className="text-slate-300">{checkStrength.timeToCrack}</span></p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {strengthLevels.map((lvl, i) => (
                    <div key={lvl} className={cn('flex-1 h-2 rounded-full transition-all duration-500',
                      i <= strengthLevels.indexOf(checkStrength.level) ? cCfg.color : 'bg-surface-700')} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Uppercase',  has: /[A-Z]/.test(checkInput) },
                    { label: 'Lowercase',  has: /[a-z]/.test(checkInput) },
                    { label: 'Numbers',    has: /[0-9]/.test(checkInput) },
                    { label: 'Symbols',    has: /[^a-zA-Z0-9]/.test(checkInput) },
                    { label: '12+ chars',  has: checkInput.length >= 12 },
                    { label: 'No repeats', has: !(/(.)\1{2,}/.test(checkInput)) },
                  ].map(({ label, has }) => (
                    <div key={label} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border',
                      has ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400')}>
                      <span>{has ? '✓' : '✗'}</span>{label}
                    </div>
                  ))}
                </div>
                {checkStrength.feedback.map((f, i) => (
                  <p key={i} className="text-xs text-amber-400/80 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0 inline-block" />{f}
                  </p>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Enter a password to see detailed analysis</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 pb-24 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-100 mb-3">Built for <span className="text-gradient">real security</span></h2>
          <p className="text-slate-500 max-w-xl mx-auto text-sm">Every architectural decision made with zero-knowledge principles.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="glass-sm p-5 hover:bg-surface-700/30 transition-all duration-200 group animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <Icon className="w-5 h-5 text-brand-400" />
              </div>
              <h3 className="font-semibold text-slate-200 mb-2 text-sm">{title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 pb-24 max-w-2xl mx-auto text-center">
        <div className="glass p-10 border-brand-500/20">
          <div className="w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center mx-auto mb-5">
            <Shield className="w-7 h-7 text-brand-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-3">Ready to secure your vault?</h2>
          <p className="text-slate-500 text-sm mb-7">Create your encrypted vault in seconds. Your master password never leaves your device.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/register" className="btn-primary px-8 py-3">Create Free Vault <ChevronRight className="w-4 h-4" /></Link>
            <Link href="/login" className="btn-secondary px-8 py-3">Sign In</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 py-6 px-6 text-center">
        <p className="text-slate-600 text-xs">SecurePass · Zero-Knowledge Password Manager · Your data, your keys, your control.</p>
      </footer>
    </div>
  );
}
