'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X, Eye, EyeOff, RefreshCw, Copy, Lock, Globe, User, FileText,
  CreditCard, KeyRound, Edit2, Loader2, Zap,
} from 'lucide-react';

import { generatePassword, analyzePasswordStrength } from '@/lib/password';
import { copyToClipboard, cn } from '@/lib/utils';
import type { VaultItem, VaultItemData, VaultItemType } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  mode: 'create' | 'edit' | 'view';
  item: VaultItem | null;
  onSave: (data: VaultItemData) => Promise<void>;
  onEdit: () => void;
  onClose: () => void;
  saving: boolean;
}

const loginSchema = z.object({
  type: z.literal('login'),
  name: z.string().min(1, 'Name is required').max(100),
  username: z.string().max(255).optional().default(''),
  password: z.string().max(512).optional().default(''),
  url: z.string().max(2048).optional().default(''),
  notes: z.string().max(5000).optional().default(''),
});

type LoginForm = z.infer<typeof loginSchema>;

const ITEM_TYPES: Array<{ value: VaultItemType; label: string; icon: React.ElementType }> = [
  { value: 'login', label: 'Login', icon: KeyRound },
  { value: 'note', label: 'Secure Note', icon: FileText },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'identity', label: 'Identity', icon: User },
];

const strengthColor = {
  'very-weak': 'bg-red-500 w-1/5',
  weak: 'bg-orange-500 w-2/5',
  fair: 'bg-amber-500 w-3/5',
  strong: 'bg-emerald-500 w-4/5',
  'very-strong': 'bg-brand-500 w-full',
} as const;

export default function VaultItemModal({ mode, item, onSave, onEdit, onClose, saving }: Props) {
  const [activeType, setActiveType] = useState<VaultItemType>(
    item?.itemType ?? 'login'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPw, setGeneratedPw] = useState('');
  const [pwLength, setPwLength] = useState(20);
  const [showGenerator, setShowGenerator] = useState(false);

  const isReadOnly = mode === 'view';
  const title = mode === 'create' ? 'New item' : mode === 'edit' ? 'Edit item' : item?.data.name ?? 'View item';

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: item?.itemType === 'login' ? {
      type: 'login',
      name: item.data.name,
      username: (item.data as { username?: string }).username ?? '',
      password: (item.data as { password?: string }).password ?? '',
      url: (item.data as { url?: string }).url ?? '',
      notes: (item.data as { notes?: string }).notes ?? '',
    } : { type: 'login' },
  });

  const watchedPw = watch('password') ?? '';
  const pwStrength = analyzePasswordStrength(watchedPw);

  useEffect(() => {
    setGeneratedPw(generatePassword({ length: pwLength }));
  }, [pwLength]);

  const generateNew = () => {
    const pw = generatePassword({ length: pwLength });
    setGeneratedPw(pw);
  };

  const useGenerated = () => {
    setValue('password', generatedPw, { shouldValidate: true });
    setShowGenerator(false);
    setShowPassword(true);
  };

  const onSubmit = async (data: LoginForm) => {
    await onSave(data as VaultItemData);
  };

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text, 30_000);
    toast.success(`${label} copied · clears in 30s`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-brand-400" />
            </div>
            <h2 className="font-semibold text-slate-100 truncate max-w-[250px]">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {isReadOnly && (
              <button onClick={onEdit} className="btn-secondary text-xs">
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button onClick={onClose} className="btn-icon text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Type selector (create only) */}
        {mode === 'create' && (
          <div className="px-6 pt-5">
            <div className="flex gap-2">
              {ITEM_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveType(value)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all border',
                    activeType === value
                      ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                      : 'border-slate-700/50 text-slate-400 hover:bg-surface-700/40 hover:text-slate-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <input type="hidden" {...register('type')} value="login" />

          {/* Name */}
          <div>
            <label className="label">Name</label>
            <input
              {...register('name')}
              placeholder="e.g., GitHub, Gmail, Netflix"
              className={cn('input', errors.name && 'input-error', isReadOnly && 'opacity-70 cursor-default')}
              readOnly={isReadOnly}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          {activeType === 'login' && (
            <>
              {/* Username */}
              <div>
                <label className="label">Username / Email</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    {...register('username')}
                    placeholder="your@email.com"
                    className={cn('input pl-10', isReadOnly && 'opacity-70 cursor-default')}
                    readOnly={isReadOnly}
                  />
                  {isReadOnly && watchedPw && (
                    <button
                      type="button"
                      onClick={() => handleCopy(watch('username') ?? '', 'Username')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon text-slate-500 hover:text-brand-400"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Password</label>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setShowGenerator(!showGenerator)}
                      className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      Generate
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    className={cn('input pl-10 pr-20 font-mono', isReadOnly && 'opacity-70 cursor-default')}
                    readOnly={isReadOnly}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="btn-icon text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(watchedPw, 'Password')}
                      className="btn-icon text-slate-500 hover:text-brand-400"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Strength bar */}
                {watchedPw && !isReadOnly && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-surface-700 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-500', strengthColor[pwStrength.level])} />
                    </div>
                    <span className="text-xs text-slate-500 capitalize">{pwStrength.level.replace('-', ' ')}</span>
                  </div>
                )}

                {/* Generator panel */}
                {showGenerator && !isReadOnly && (
                  <div className="mt-3 p-4 rounded-xl bg-surface-900/60 border border-slate-700/50 space-y-3 animate-slide-down">
                    <div className="font-mono text-sm text-slate-200 bg-surface-950/60 px-3 py-2.5 rounded-lg flex items-center justify-between gap-2">
                      <span className="truncate flex-1">{generatedPw}</span>
                      <button type="button" onClick={generateNew} className="text-slate-500 hover:text-slate-300 shrink-0">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-400">Length: {pwLength}</label>
                      <input
                        type="range" min={8} max={64} value={pwLength}
                        onChange={e => setPwLength(Number(e.target.value))}
                        className="flex-1 accent-brand-500"
                      />
                    </div>
                    <button type="button" onClick={useGenerated} className="btn-primary w-full text-xs h-9">
                      Use this password
                    </button>
                  </div>
                )}
              </div>

              {/* URL */}
              <div>
                <label className="label">Website URL</label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    {...register('url')}
                    placeholder="https://example.com"
                    className={cn('input pl-10', isReadOnly && 'opacity-70 cursor-default')}
                    readOnly={isReadOnly}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  placeholder="Additional notes (encrypted)"
                  className={cn('input resize-none', isReadOnly && 'opacity-70 cursor-default')}
                  readOnly={isReadOnly}
                />
              </div>
            </>
          )}

          {activeType === 'note' && (
            <div>
              <label className="label">Secure content</label>
              <textarea
                rows={8}
                placeholder="Your secure note content (AES-256-GCM encrypted)"
                className="input resize-none"
              />
            </div>
          )}

          {/* Footer */}
          {!isReadOnly && (
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  <><Lock className="w-4 h-4" /> Save encrypted</>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
