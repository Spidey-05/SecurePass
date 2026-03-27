'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw, Copy, Check, Eye, EyeOff,
    Zap, ShieldCheck, KeyRound, Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    generatePassword,
    generatePassphrase,
    analyzePasswordStrength,
} from '@/lib/password';
import { cn } from '@/lib/utils';

const strengthConfig = {
    'very-weak': { color: 'bg-red-500', label: 'Very Weak', text: 'text-red-400', ring: '#ef4444' },
    weak: { color: 'bg-orange-500', label: 'Weak', text: 'text-orange-400', ring: '#f97316' },
    fair: { color: 'bg-amber-500', label: 'Fair', text: 'text-amber-400', ring: '#f59e0b' },
    strong: { color: 'bg-emerald-500', label: 'Strong', text: 'text-emerald-400', ring: '#10b981' },
    'very-strong': { color: 'bg-brand-500', label: 'Very Strong', text: 'text-brand-400', ring: '#6366f1' },
} as const;

const strengthLevels = ['very-weak', 'weak', 'fair', 'strong', 'very-strong'] as const;

export default function ToolsPage() {
    const [activeTab, setActiveTab] = useState<'generator' | 'checker' | 'passphrase'>('generator');

    // ── Generator state ──────────────────────────────────────────────────────────
    const [password, setPassword] = useState('');
    const [pwLength, setPwLength] = useState(20);
    const [options, setOptions] = useState({
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        excludeAmbiguous: true,
    });
    const [showPw, setShowPw] = useState(true);
    const [copiedPw, setCopiedPw] = useState(false);

    // ── Passphrase state ─────────────────────────────────────────────────────────
    const [passphrase, setPassphrase] = useState('');
    const [ppWordCount, setPpWordCount] = useState(4);
    const [ppSeparator, setPpSeparator] = useState('-');
    const [copiedPp, setCopiedPp] = useState(false);

    // ── Checker state ────────────────────────────────────────────────────────────
    const [checkInput, setCheckInput] = useState('');
    const [showCheck, setShowCheck] = useState(false);

    const pwStrength = analyzePasswordStrength(password);
    const checkStrength = analyzePasswordStrength(checkInput);
    const sCfg = strengthConfig[pwStrength.level];
    const cCfg = strengthConfig[checkStrength.level];

    const generate = useCallback(() => {
        try {
            setPassword(generatePassword({ length: pwLength, ...options, excludeSimilar: false }));
            setCopiedPw(false);
        } catch {
            toast.error('Enable at least one character type');
        }
    }, [pwLength, options]);

    const generatePp = useCallback(() => {
        setPassphrase(generatePassphrase(ppWordCount, ppSeparator));
        setCopiedPp(false);
    }, [ppWordCount, ppSeparator]);

    useEffect(() => { generate(); }, [generate]);
    useEffect(() => { generatePp(); }, [generatePp]);

    const copyText = async (text: string, setCopied: (v: boolean) => void, label: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        // Auto-clear clipboard after 30 seconds
        setTimeout(async () => {
            try {
                const current = await navigator.clipboard.readText();
                if (current === text) await navigator.clipboard.writeText('');
            } catch { }
        }, 30_000);
        toast.success(`${label} copied · auto-clears in 30s`);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-100">Security Tools</h1>
                <p className="text-slate-500 text-sm mt-0.5">
                    Cryptographically secure password generator &amp; strength analyzer
                </p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-2 p-1 bg-surface-900/60 rounded-xl border border-slate-800/60 mb-8 w-fit">
                {([
                    ['generator', KeyRound, 'Generator'],
                    ['passphrase', Hash, 'Passphrase'],
                    ['checker', ShieldCheck, 'Strength Checker'],
                ] as const).map(([id, Icon, label]) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                            activeTab === id
                                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40'
                                : 'text-slate-400 hover:text-slate-200'
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* ── Generator ───────────────────────────────────────────────────────── */}
                {activeTab === 'generator' && (
                    <>
                        {/* Left: Generated password */}
                        <div className="lg:col-span-3 glass p-6 space-y-5">
                            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-brand-400" />
                                Password Generator
                            </h2>

                            {/* Display */}
                            <div className="relative bg-surface-950/80 rounded-xl p-5 border border-slate-700/50 group">
                                <p className={cn(
                                    'font-mono text-xl text-slate-100 break-all pr-10 min-h-[36px] tracking-wider leading-relaxed',
                                    !showPw && 'blur-sm select-none'
                                )}>
                                    {password}
                                </p>
                                <button
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Strength */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Strength</span>
                                    <span className={cn('font-semibold', sCfg.text)}>{sCfg.label}</span>
                                </div>
                                <div className="flex gap-1.5">
                                    {strengthLevels.map((lvl, i) => (
                                        <div
                                            key={lvl}
                                            className={cn(
                                                'flex-1 h-2 rounded-full transition-all duration-500',
                                                i <= strengthLevels.indexOf(pwStrength.level) ? sCfg.color : 'bg-surface-700'
                                            )}
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-5 text-xs text-slate-600">
                                    <span>⚡ <span className="text-slate-400">{pwStrength.entropy} bits</span></span>
                                    <span>⏱ <span className="text-slate-400">{pwStrength.timeToCrack}</span></span>
                                    <span>📏 <span className="text-slate-400">{password.length} chars</span></span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => copyText(password, setCopiedPw, 'Password')}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all',
                                        copiedPw
                                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                            : 'border-slate-700/50 text-slate-300 hover:bg-surface-700/50'
                                    )}
                                >
                                    {copiedPw ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
                                </button>
                                <button onClick={generate} className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 text-sm">
                                    <RefreshCw className="w-4 h-4" />
                                    Regenerate
                                </button>
                            </div>

                            <p className="text-xs text-slate-600 text-center">
                                Clipboard auto-clears after 30 seconds
                            </p>
                        </div>

                        {/* Right: Options */}
                        <div className="lg:col-span-2 glass p-6 space-y-5">
                            <h2 className="font-semibold text-slate-200 text-sm">Options</h2>

                            {/* Length */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm text-slate-400">Length</span>
                                    <span className="font-mono font-bold text-brand-400 text-lg">{pwLength}</span>
                                </div>
                                <input
                                    type="range" min={8} max={64} value={pwLength}
                                    onChange={e => setPwLength(Number(e.target.value))}
                                    className="w-full accent-brand-500 cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-slate-600 mt-1">
                                    <span>8</span><span>64</span>
                                </div>
                            </div>

                            {/* Character types */}
                            <div className="space-y-2">
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Character types</p>
                                {[
                                    { key: 'uppercase', label: 'Uppercase', example: 'A–Z' },
                                    { key: 'lowercase', label: 'Lowercase', example: 'a–z' },
                                    { key: 'numbers', label: 'Numbers', example: '0–9' },
                                    { key: 'symbols', label: 'Symbols', example: '!@#$' },
                                ].map(({ key, label, example }) => (
                                    <button
                                        key={key}
                                        onClick={() => setOptions(o => ({ ...o, [key]: !o[key as keyof typeof o] }))}
                                        className={cn(
                                            'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-all',
                                            options[key as keyof typeof options]
                                                ? 'bg-brand-600/20 border-brand-500/40 text-brand-200'
                                                : 'border-slate-700/50 text-slate-500 hover:border-slate-600/50'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                'w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all',
                                                options[key as keyof typeof options] ? 'bg-brand-500 border-brand-500' : 'border-slate-600'
                                            )}>
                                                {options[key as keyof typeof options] && <Check className="w-2.5 h-2.5 text-white" />}
                                            </div>
                                            {label}
                                        </div>
                                        <span className="font-mono text-xs opacity-50">{example}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Exclude ambiguous */}
                            <button
                                onClick={() => setOptions(o => ({ ...o, excludeAmbiguous: !o.excludeAmbiguous }))}
                                className={cn(
                                    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-all',
                                    options.excludeAmbiguous
                                        ? 'bg-violet-600/20 border-violet-500/40 text-violet-200'
                                        : 'border-slate-700/50 text-slate-500 hover:border-slate-600/50'
                                )}
                            >
                                <span>Exclude ambiguous</span>
                                <span className="font-mono text-xs opacity-50">l,1,I,O,0</span>
                            </button>
                        </div>
                    </>
                )}

                {/* ── Passphrase ───────────────────────────────────────────────────────── */}
                {activeTab === 'passphrase' && (
                    <div className="lg:col-span-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="glass p-6 space-y-5">
                            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
                                <Hash className="w-4 h-4 text-brand-400" />
                                Passphrase Generator
                            </h2>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Passphrases are easier to remember than random passwords while still being highly secure. Each word is chosen using cryptographically secure randomness.
                            </p>

                            <div className="relative bg-surface-950/80 rounded-xl p-5 border border-slate-700/50">
                                <p className="font-mono text-lg text-brand-300 break-all min-h-[32px]">
                                    {passphrase}
                                </p>
                            </div>

                            {/* Strength of passphrase */}
                            {passphrase && (
                                <div className="space-y-1.5">
                                    {(() => {
                                        const s = analyzePasswordStrength(passphrase);
                                        const cfg = strengthConfig[s.level];
                                        return (
                                            <>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">Strength</span>
                                                    <span className={cn('font-semibold', cfg.text)}>{cfg.label}</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    {strengthLevels.map((lvl, i) => (
                                                        <div key={lvl} className={cn('flex-1 h-1.5 rounded-full transition-all', i <= strengthLevels.indexOf(s.level) ? cfg.color : 'bg-surface-700')} />
                                                    ))}
                                                </div>
                                                <p className="text-xs text-slate-600">⚡ {s.entropy} bits · Cracks in {s.timeToCrack}</p>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => copyText(passphrase, setCopiedPp, 'Passphrase')}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all',
                                        copiedPp ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-slate-700/50 text-slate-300 hover:bg-surface-700/50'
                                    )}
                                >
                                    {copiedPp ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
                                </button>
                                <button onClick={generatePp} className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 text-sm">
                                    <RefreshCw className="w-4 h-4" />New phrase
                                </button>
                            </div>
                        </div>

                        <div className="glass p-6 space-y-5">
                            <h2 className="font-semibold text-slate-200 text-sm">Options</h2>

                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm text-slate-400">Word count</span>
                                    <span className="font-mono font-bold text-brand-400 text-lg">{ppWordCount}</span>
                                </div>
                                <input
                                    type="range" min={3} max={8} value={ppWordCount}
                                    onChange={e => setPpWordCount(Number(e.target.value))}
                                    className="w-full accent-brand-500 cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-slate-600 mt-1">
                                    <span>3 words</span><span>8 words</span>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-slate-400 mb-3">Separator</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {['-', '_', '.', ' '].map(sep => (
                                        <button
                                            key={sep}
                                            onClick={() => setPpSeparator(sep)}
                                            className={cn(
                                                'py-2.5 rounded-xl font-mono text-sm border transition-all',
                                                ppSeparator === sep
                                                    ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                                                    : 'border-slate-700/50 text-slate-400 hover:bg-surface-700/40'
                                            )}
                                        >
                                            {sep === ' ' ? '·' : sep}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    <span className="text-brand-300 font-medium">Tip:</span> Use passphrases for master passwords and things you need to type often. They're strong and memorable.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Strength Checker ─────────────────────────────────────────────────── */}
                {activeTab === 'checker' && (
                    <div className="lg:col-span-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Input */}
                        <div className="glass p-6 space-y-5">
                            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-brand-400" />
                                Password Strength Analyzer
                            </h2>
                            <p className="text-xs text-slate-500">
                                Analyze any password with entropy-based scoring. The password never leaves your browser.
                            </p>

                            <div className="relative">
                                <input
                                    type={showCheck ? 'text' : 'password'}
                                    value={checkInput}
                                    onChange={e => setCheckInput(e.target.value)}
                                    placeholder="Type or paste a password…"
                                    className="input font-mono pr-10 text-lg"
                                    autoComplete="off"
                                />
                                <button
                                    onClick={() => setShowCheck(!showCheck)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    {showCheck ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            {checkInput && (
                                <div className="space-y-4 animate-fade-in">
                                    {/* Score ring */}
                                    <div className="flex items-center gap-5">
                                        <div className="relative w-24 h-24 shrink-0">
                                            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                                                <circle cx="48" cy="48" r="40" fill="none" stroke="#1e293b" strokeWidth="8" />
                                                <circle
                                                    cx="48" cy="48" r="40" fill="none"
                                                    stroke={cCfg.ring}
                                                    strokeWidth="8"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${2 * Math.PI * 40}`}
                                                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - checkStrength.score / 100)}`}
                                                    className="transition-all duration-700"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-2xl font-black font-mono text-slate-100">{checkStrength.score}</span>
                                                <span className="text-xs text-slate-500">/100</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className={cn('text-xl font-bold capitalize', cCfg.text)}>
                                                {checkStrength.level.replace('-', ' ')}
                                            </p>
                                            <p className="text-sm text-slate-400">{checkStrength.entropy} bits entropy</p>
                                            <p className="text-sm text-slate-500">
                                                Cracks in: <span className="text-slate-300 font-medium">{checkStrength.timeToCrack}</span>
                                            </p>
                                            <p className="text-sm text-slate-500">
                                                Length: <span className="text-slate-300 font-medium">{checkInput.length} chars</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Strength bars */}
                                    <div className="flex gap-1.5">
                                        {strengthLevels.map((lvl, i) => (
                                            <div key={lvl} className={cn(
                                                'flex-1 h-2 rounded-full transition-all duration-500',
                                                i <= strengthLevels.indexOf(checkStrength.level) ? cCfg.color : 'bg-surface-700'
                                            )} />
                                        ))}
                                    </div>

                                    {/* Feedback */}
                                    {checkStrength.feedback.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                            <span className="text-amber-300/80">{f}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!checkInput && (
                                <div className="text-center py-8">
                                    <ShieldCheck className="w-14 h-14 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm">Type a password above to analyze it</p>
                                </div>
                            )}
                        </div>

                        {/* Criteria */}
                        <div className="glass p-6 space-y-4">
                            <h2 className="font-semibold text-slate-200 text-sm">Criteria Breakdown</h2>

                            <div className="space-y-2">
                                {[
                                    { label: 'Uppercase letters', has: /[A-Z]/.test(checkInput), tip: 'Add A–Z' },
                                    { label: 'Lowercase letters', has: /[a-z]/.test(checkInput), tip: 'Add a–z' },
                                    { label: 'Numbers', has: /[0-9]/.test(checkInput), tip: 'Add 0–9' },
                                    { label: 'Special symbols', has: /[^a-zA-Z0-9]/.test(checkInput), tip: 'Add !@#$' },
                                    { label: '12+ characters', has: checkInput.length >= 12, tip: 'Use ≥12 chars' },
                                    { label: '16+ characters', has: checkInput.length >= 16, tip: 'Use ≥16 chars' },
                                    { label: 'No repeated chars', has: checkInput.length > 0 && !(/(.)\1{2,}/.test(checkInput)), tip: 'Avoid aaa/111' },
                                    { label: 'Not a common word', has: checkInput.length > 0 && !(/^(password|qwerty|123456|letmein|admin)/i.test(checkInput)), tip: 'Avoid common words' },
                                ].map(({ label, has, tip }) => (
                                    <div
                                        key={label}
                                        className={cn(
                                            'flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
                                            !checkInput ? 'border-slate-700/30 text-slate-600' :
                                                has ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
                                                    'bg-red-500/8 border-red-500/15 text-red-400'
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-base">{!checkInput ? '○' : has ? '✓' : '✗'}</span>
                                            <span className="text-sm">{label}</span>
                                        </div>
                                        {!has && checkInput && (
                                            <span className="text-xs opacity-60">{tip}</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Entropy scale */}
                            <div className="pt-2 border-t border-slate-700/40">
                                <p className="text-xs text-slate-500 font-medium mb-3">Entropy guide</p>
                                <div className="space-y-1.5 text-xs">
                                    {[
                                        { range: '< 28 bits', label: 'Very Weak', color: 'text-red-400' },
                                        { range: '28–36 bits', label: 'Weak', color: 'text-orange-400' },
                                        { range: '36–60 bits', label: 'Fair', color: 'text-amber-400' },
                                        { range: '60–80 bits', label: 'Strong', color: 'text-emerald-400' },
                                        { range: '80+ bits', label: 'Very Strong', color: 'text-brand-400' },
                                    ].map(({ range, label, color }) => (
                                        <div key={range} className="flex justify-between">
                                            <span className="text-slate-600 font-mono">{range}</span>
                                            <span className={color}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
