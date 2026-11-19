import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Trash2, Save, RefreshCw, AlertCircle, Lock } from 'lucide-react';

function formatShortDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fa-IR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function SecretKeyField({
  secretKeyName,
  label,
  hint = '',
  placeholder = '',
  value = '',
  onChange,
  status = null,
  saving = false,
  deleting = false,
  onSaveSecret,
  onDeleteSecret,
  canGenerate = false,
  isNonSecretText = false,
  validationError = '',
  highlight = false,
}) {
  const [showDraft, setShowDraft] = useState(false);

  const source = status?.source || 'none';
  const vaultConfigured = Boolean(status?.vaultConfigured);
  const envConfigured = Boolean(status?.envConfigured);
  const masked = status?.masked || '';
  const updatedAt = status?.updatedAt || null;

  const handleGenerate = () => {
    try {
      const bytes = new Uint8Array(24);
      window.crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      onChange?.(`lsk_${hex}`);
      setShowDraft(true);
    } catch {}
  };

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
        highlight
          ? 'bg-blue-50/40 border-blue-200/80'
          : 'bg-stone-50/70 border-stone-200/80'
      }`}
    >
      {/* Header Row: Label + Security Status Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Lock size={13} className="text-stone-500 shrink-0" />
            <label className="text-xs font-bold text-zinc-900">{label}</label>
            <code className="text-[10px] font-mono text-stone-400 hidden sm:inline" dir="ltr">
              {secretKeyName}
            </code>
          </div>
          {hint && <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{hint}</p>}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {source === 'vault' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <ShieldCheck size={12} className="shrink-0" />
              <span>رمزنگاری‌شده در دیتابیس</span>
            </span>
          )}
          {source === 'env' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
              <span>فعال از Vercel Env</span>
            </span>
          )}
          {source === 'none' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
              <span>تنظیم نشده</span>
            </span>
          )}
          {masked && (
            <code
              className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 font-mono text-[11px] text-zinc-800"
              dir="ltr"
              title="ماسک امنیتی کلید ذخیره‌شده (مقدار اصلی هرگز به مرورگر ارسال نمی‌شود)"
            >
              {masked}
            </code>
          )}
        </div>
      </div>

      {/* Input + Inline Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            type={isNonSecretText || showDraft ? 'text' : 'password'}
            dir="ltr"
            autoComplete="new-password"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={
              masked
                ? `${masked} — برای حفظ کلید فعلی خالی بگذارید`
                : placeholder || 'کلید را اینجا وارد کنید...'
            }
            className="w-full h-10 rounded-xl bg-white border border-stone-200/90 ps-3.5 pe-10 text-xs text-zinc-900 font-mono focus:border-blue-500 focus:outline-none transition-all shadow-2xs"
          />
          {!isNonSecretText && (
            <button
              type="button"
              onClick={() => setShowDraft((prev) => !prev)}
              className="absolute end-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-stone-400 hover:text-zinc-800 hover:bg-stone-100 flex items-center justify-center cursor-pointer"
              title={showDraft ? 'مخفی کردن متن تایپ‌شده' : 'نمایش متن تایپ‌شده'}
              aria-label={showDraft ? 'مخفی کردن' : 'نمایش'}
            >
              {showDraft ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canGenerate && (
            <button
              type="button"
              onClick={handleGenerate}
              className="h-10 px-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              title="تولید کلید تصادفی امن ۱۹۲ بیتی"
            >
              <RefreshCw size={13} />
              <span>تولید امن</span>
            </button>
          )}

          {onSaveSecret && (
            <button
              type="button"
              disabled={saving || !String(value || '').trim() || Boolean(validationError)}
              onClick={() => onSaveSecret(secretKeyName, value)}
              className="h-10 px-3.5 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-45 disabled:cursor-not-allowed text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Save size={13} />
              <span>{saving ? 'ذخیره...' : 'ذخیره کلید'}</span>
            </button>
          )}

          {vaultConfigured && onDeleteSecret && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => onDeleteSecret(secretKeyName, label)}
              className="h-10 w-10 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 flex items-center justify-center cursor-pointer transition-colors"
              title="حذف کلید از خزانه دیتابیس"
              aria-label="حذف کلید"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Live Validation Error */}
      {validationError && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700">
          <AlertCircle size={13} className="shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Footer Metadata: Last Updated + Vercel Env Cleanup Hint */}
      {(updatedAt || (vaultConfigured && envConfigured)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-stone-500">
          {updatedAt ? (
            <span>آخرین بروزرسانی خزانه: {formatShortDate(updatedAt)}</span>
          ) : (
            <span />
          )}
          {vaultConfigured && envConfigured && (
            <span className="text-emerald-700 font-semibold">
              اولویت با خزانه دیتابیس است؛ می‌توانید متغیر قدیمی را از Vercel حذف کنید.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
