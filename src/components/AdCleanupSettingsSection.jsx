import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CLEANUP_SETTINGS_LIMITS,
  DEFAULT_CLEANUP_SETTINGS,
  validateCleanupSettings,
} from '../../api/_lib/cleanupSettingsValidation.js';

function formatAuditTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function summarizeChangeDiff(prev, next) {
  if (!next || typeof next !== 'object') return [];
  const items = [];
  if (prev && typeof prev === 'object') {
    if (prev.enabled !== next.enabled) {
      items.push(`پاکسازی خودکار: ${prev.enabled ? 'فعال' : 'غیرفعال'} ← ${next.enabled ? 'فعال' : 'غیرفعال'}`);
    }
    if (prev.inactivityDays !== next.inactivityDays) {
      items.push(`بی‌فعالیتی: ${prev.inactivityDays ?? '—'} ← ${next.inactivityDays} روز`);
    }
    if (prev.warningDays !== next.warningDays) {
      items.push(`هشدار: ${prev.warningDays ?? '—'} ← ${next.warningDays} روز`);
    }
    if (prev.softDeleteRetentionDays !== next.softDeleteRetentionDays) {
      items.push(`نگهداری حذف‌شده: ${prev.softDeleteRetentionDays ?? '—'} ← ${next.softDeleteRetentionDays} روز`);
    }
    if (prev.freeBoostCooldownDays !== next.freeBoostCooldownDays) {
      items.push(`فاصله بوست: ${prev.freeBoostCooldownDays ?? '—'} ← ${next.freeBoostCooldownDays} روز`);
    }
  }
  if (items.length === 0) {
    items.push(
      `${next.enabled ? 'فعال' : 'غیرفعال'} | بی‌فعالیتی ${next.inactivityDays} روز | هشدار ${next.warningDays} روز | نگهداری ${next.softDeleteRetentionDays} روز`
    );
  }
  return items;
}

function AdCleanupSettingsForm({ settings, saving, onSave }) {
  const [enabled, setEnabled] = useState(() => settings?.enabled !== false);
  const [inactivityDays, setInactivityDays] = useState(() =>
    String(settings?.inactivityDays ?? DEFAULT_CLEANUP_SETTINGS.inactivityDays)
  );
  const [warningDays, setWarningDays] = useState(() =>
    String(settings?.warningDays ?? DEFAULT_CLEANUP_SETTINGS.warningDays)
  );
  const [softDeleteRetentionDays, setSoftDeleteRetentionDays] = useState(() =>
    String(settings?.softDeleteRetentionDays ?? DEFAULT_CLEANUP_SETTINGS.softDeleteRetentionDays)
  );
  const [freeBoostCooldownDays, setFreeBoostCooldownDays] = useState(() =>
    String(settings?.freeBoostCooldownDays ?? DEFAULT_CLEANUP_SETTINGS.freeBoostCooldownDays)
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const clearFieldFeedback = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (formError) setFormError('');
    if (formSuccess) setFormSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const candidate = {
      enabled: Boolean(enabled),
      inactivityDays,
      warningDays,
      softDeleteRetentionDays,
      freeBoostCooldownDays,
      duplicateBlockThresholdSameOwner: settings?.duplicateBlockThresholdSameOwner,
      duplicateBlockThresholdOtherOwner: settings?.duplicateBlockThresholdOtherOwner,
      duplicateReviewThresholdSameOwner: settings?.duplicateReviewThresholdSameOwner,
    };

    const validation = validateCleanupSettings(candidate, settings);
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors || {});
      setFormError(validation.error || 'مقادیر واردشده معتبر نیستند.');
      return;
    }

    setFieldErrors({});
    const res = await onSave(validation.value);
    if (res && !res.ok) {
      setFieldErrors(res.fieldErrors || {});
      setFormError(res.error || 'خطا در ذخیره تنظیمات پاکسازی.');
      return;
    }

    setFormSuccess('تنظیمات پاکسازی آگهی‌ها در دیتابیس ذخیره و در سابقه تغییرات ثبت شد.');
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/80 space-y-5 shadow-2xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-stone-100">
        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
            <SlidersHorizontal size={17} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
              تنظیمات پاکسازی آگهی‌ها
            </h3>
            <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
              تعیین پویای مدت بی‌فعالیتی، مهلت هشدار و نگهداری حذف موقت؛ کار زمان‌بندی‌شده در هر اجرا آخرین مقادیر دیتابیس را بدون نیاز به استقرار مجدد می‌خواند.
            </p>
          </div>
        </div>

        {/* Toggle switch for automatic cleanup enabled */}
        <div className="flex items-center justify-between sm:justify-end gap-3 p-2.5 sm:px-3.5 sm:py-2 rounded-xl bg-stone-50 border border-stone-200/80 shrink-0">
          <div className="text-right">
            <span className="text-xs font-extrabold text-stone-800 block leading-tight">
              پاکسازی خودکار
            </span>
            <span
              className={`text-[10.5px] font-bold ${
                enabled ? 'text-emerald-700' : 'text-stone-500'
              }`}
            >
              {enabled ? 'روشن (خودکار ماهانه)' : 'خاموش (متوقف)'}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="فعال بودن پاکسازی خودکار"
            onClick={() => {
              setEnabled((prev) => !prev);
              clearFieldFeedback('enabled');
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900/20 ${
              enabled ? 'bg-emerald-600' : 'bg-stone-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
                enabled ? '-translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Protection policy guarantee notice */}
      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3 flex items-start gap-2.5 text-xs text-emerald-950">
        <ShieldCheck size={17} className="text-emerald-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11.5px] font-medium">
          <strong className="font-extrabold">محافظت خودکار:</strong> آگهی‌های ویژه پولی (VIP)، آگهی‌های درگیر پرداخت باز یا اختلاف مالی، گزارش‌های بررسی‌نشده و آگهی‌های در حال بررسی مدیریتی یا تایید ضدتکرار تحت هیچ شرایطی حذف نمی‌شوند.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2"
        >
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{formError}</span>
        </div>
      )}

      {formSuccess && (
        <div
          role="status"
          className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2"
        >
          <CheckCircle size={16} className="shrink-0 text-emerald-600" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Numeric fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Field 1: Inactivity Duration */}
        <div className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/50 space-y-2">
          <label
            htmlFor="cleanup-inactivity-days"
            className="block text-xs font-extrabold text-stone-800"
          >
            مدت بی‌فعالیتی (روز)
          </label>
          <input
            id="cleanup-inactivity-days"
            type="number"
            inputMode="numeric"
            dir="ltr"
            step={1}
            min={CLEANUP_SETTINGS_LIMITS.inactivityDays.min}
            max={CLEANUP_SETTINGS_LIMITS.inactivityDays.max}
            value={inactivityDays}
            onChange={(e) => {
              setInactivityDays(e.target.value);
              clearFieldFeedback('inactivityDays');
            }}
            className={`w-full h-10 rounded-xl border bg-white px-3 text-sm font-mono font-bold text-stone-900 focus:outline-none transition-colors ${
              fieldErrors.inactivityDays
                ? 'border-rose-400 focus:border-rose-500'
                : 'border-stone-300 focus:border-slate-900'
            }`}
          />
          <div className="flex flex-wrap gap-1">
            {[30, 60, 90, 180].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setInactivityDays(String(preset));
                  clearFieldFeedback('inactivityDays');
                }}
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-colors cursor-pointer tabular-nums ${
                  String(inactivityDays).trim() === String(preset)
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {preset} روز
              </button>
            ))}
          </div>
          {fieldErrors.inactivityDays ? (
            <p className="text-[11px] font-bold text-rose-600">{fieldErrors.inactivityDays}</p>
          ) : (
            <p className="text-[10.5px] text-stone-500 leading-snug">
              پیش‌فرض ۳۰ روز؛ حداقل مجاز ۷ روز (مثلاً ۳۰، ۶۰ یا بیشتر).
            </p>
          )}
        </div>

        {/* Field 2: Warning Period Before Deletion */}
        <div className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/50 space-y-2">
          <label
            htmlFor="cleanup-warning-days"
            className="block text-xs font-extrabold text-stone-800"
          >
            مدت هشدار پیش از حذف (روز)
          </label>
          <input
            id="cleanup-warning-days"
            type="number"
            inputMode="numeric"
            dir="ltr"
            step={1}
            min={CLEANUP_SETTINGS_LIMITS.warningDays.min}
            max={CLEANUP_SETTINGS_LIMITS.warningDays.max}
            value={warningDays}
            onChange={(e) => {
              setWarningDays(e.target.value);
              clearFieldFeedback('warningDays');
            }}
            className={`w-full h-10 rounded-xl border bg-white px-3 text-sm font-mono font-bold text-stone-900 focus:outline-none transition-colors ${
              fieldErrors.warningDays
                ? 'border-rose-400 focus:border-rose-500'
                : 'border-stone-300 focus:border-slate-900'
            }`}
          />
          {fieldErrors.warningDays ? (
            <p className="text-[11px] font-bold text-rose-600">{fieldErrors.warningDays}</p>
          ) : (
            <p className="text-[10.5px] text-stone-500 leading-snug">
              پیش‌فرض ۷ روز مهلت پس از ارسال هشدار به صاحب آگهی.
            </p>
          )}
        </div>

        {/* Field 3: Soft Delete Retention Period */}
        <div className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/50 space-y-2">
          <label
            htmlFor="cleanup-retention-days"
            className="block text-xs font-extrabold text-stone-800"
          >
            نگهداری آگهی حذف‌شده پیش از حذف دائمی (روز)
          </label>
          <input
            id="cleanup-retention-days"
            type="number"
            inputMode="numeric"
            dir="ltr"
            step={1}
            min={CLEANUP_SETTINGS_LIMITS.softDeleteRetentionDays.min}
            max={CLEANUP_SETTINGS_LIMITS.softDeleteRetentionDays.max}
            value={softDeleteRetentionDays}
            onChange={(e) => {
              setSoftDeleteRetentionDays(e.target.value);
              clearFieldFeedback('softDeleteRetentionDays');
            }}
            className={`w-full h-10 rounded-xl border bg-white px-3 text-sm font-mono font-bold text-stone-900 focus:outline-none transition-colors ${
              fieldErrors.softDeleteRetentionDays
                ? 'border-rose-400 focus:border-rose-500'
                : 'border-stone-300 focus:border-slate-900'
            }`}
          />
          {fieldErrors.softDeleteRetentionDays ? (
            <p className="text-[11px] font-bold text-rose-600">
              {fieldErrors.softDeleteRetentionDays}
            </p>
          ) : (
            <p className="text-[10.5px] text-stone-500 leading-snug">
              مدت نگهداری پس از حذف نرم پیش از پاکسازی کامل فایل‌ها و رکورد.
            </p>
          )}
        </div>

        {/* Field 4: Free Boost Cooldown */}
        <div className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/50 space-y-2">
          <label
            htmlFor="cleanup-boost-days"
            className="block text-xs font-extrabold text-stone-800"
          >
            فاصله بوست رایگان (روز)
          </label>
          <input
            id="cleanup-boost-days"
            type="number"
            inputMode="numeric"
            dir="ltr"
            step={1}
            min={CLEANUP_SETTINGS_LIMITS.freeBoostCooldownDays.min}
            max={CLEANUP_SETTINGS_LIMITS.freeBoostCooldownDays.max}
            value={freeBoostCooldownDays}
            onChange={(e) => {
              setFreeBoostCooldownDays(e.target.value);
              clearFieldFeedback('freeBoostCooldownDays');
            }}
            className={`w-full h-10 rounded-xl border bg-white px-3 text-sm font-mono font-bold text-stone-900 focus:outline-none transition-colors ${
              fieldErrors.freeBoostCooldownDays
                ? 'border-rose-400 focus:border-rose-500'
                : 'border-stone-300 focus:border-slate-900'
            }`}
          />
          {fieldErrors.freeBoostCooldownDays ? (
            <p className="text-[11px] font-bold text-rose-600">
              {fieldErrors.freeBoostCooldownDays}
            </p>
          ) : (
            <p className="text-[10.5px] text-stone-500 leading-snug">
              پیش‌فرض ۷ روز فاصله برای هر آگهی فعال و عادی.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-100">
        <span className="text-[11px] text-stone-500">
          تمامی مقادیر سمت سرور اعتبارسنجی شده و با نام ادمین و زمان تغییر در دیتابیس ثبت می‌شوند.
        </span>
        <button
          type="submit"
          disabled={saving}
          className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all shrink-0"
        >
          <Save size={15} className={saving ? 'animate-pulse' : ''} />
          <span>{saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات پاکسازی'}</span>
        </button>
      </div>
    </form>
  );
}

export default function AdCleanupSettingsSection({
  settings,
  summary = {
    warnedAds: 0,
    softDeletedAds: 0,
    permanentlyDeletedAds: 0,
    protectedVipAds: 0,
    protectedTotalAds: 0,
  },
  settingsAudit = [],
  loading = false,
  saving = false,
  onSave,
  onRefresh,
  onRunCleanup,
  cleanupRunning = false,
  lastCleanupResult = null,
}) {
  const settingsSignature = [
    settings?.enabled !== false ? '1' : '0',
    settings?.inactivityDays ?? 30,
    settings?.warningDays ?? 7,
    settings?.softDeleteRetentionDays ?? 30,
    settings?.freeBoostCooldownDays ?? 7,
  ].join(':');

  const safeSummary = {
    warnedAds: Number(summary?.warnedAds || 0),
    softDeletedAds: Number(summary?.softDeletedAds || 0),
    permanentlyDeletedAds: Number(summary?.permanentlyDeletedAds || 0),
    protectedVipAds: Number(summary?.protectedVipAds || 0),
    protectedTotalAds: Number(summary?.protectedTotalAds ?? summary?.protectedVipAds ?? 0),
  };

  return (
    <div className="space-y-4 w-full">
      {/* 1. Cleanup Activity Summary */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/80 space-y-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h4 className="text-sm font-extrabold text-stone-900">خلاصه فعالیت پاکسازی آگهی‌ها</h4>
            <p className="text-xs text-stone-500 mt-0.5">
              وضعیت لحظه‌ای آگهی‌های هشدار گرفته، حذف نرم‌شده، حذف دائمی‌شده و موارد محافظت‌شده در دیتابیس
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                type="button"
                disabled={loading}
                onClick={onRefresh}
                className="h-9 px-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-bold text-stone-700 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
                <span>بروزرسانی آمار</span>
              </button>
            )}
            {onRunCleanup && (
              <>
                <button
                  type="button"
                  disabled={cleanupRunning}
                  onClick={() => onRunCleanup(true)}
                  className="h-9 px-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-bold text-stone-700 cursor-pointer disabled:opacity-50"
                >
                  شبیه‌سازی (Dry-Run)
                </button>
                <button
                  type="button"
                  disabled={cleanupRunning}
                  onClick={() => onRunCleanup(false)}
                  className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {cleanupRunning ? 'در حال اجرا...' : 'اجرای پاکسازی اکنون'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-900 block">آگهی‌های هشدار گرفته</span>
              <span className="text-2xl font-black text-amber-700 tabular-nums mt-1 block">
                {safeSummary.warnedAds}
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Bell size={18} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-900 block">آگهی‌های حذف نرم‌شده</span>
              <span className="text-2xl font-black text-rose-700 tabular-nums mt-1 block">
                {safeSummary.softDeletedAds}
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/90 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-700 block">آگهی‌های حذف دائمی‌شده</span>
              <span className="text-2xl font-black text-stone-900 tabular-nums mt-1 block">
                {safeSummary.permanentlyDeletedAds}
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-stone-200/70 text-stone-700 flex items-center justify-center shrink-0">
              <Trash2 size={18} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-900 block">آگهی‌های محافظت‌شده</span>
              <span className="text-2xl font-black text-emerald-700 tabular-nums mt-1 block">
                {safeSummary.protectedTotalAds}
              </span>
              <span className="text-[10px] font-semibold text-emerald-800/80 tabular-nums">
                شامل {safeSummary.protectedVipAds} آگهی ویژه VIP
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
          </div>
        </div>

        {lastCleanupResult && (
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex flex-wrap items-center gap-3 tabular-nums">
            <span className="font-black">
              نتیجه آخرین اجرا ({lastCleanupResult.dry_run ? 'شبیه‌سازی' : 'واقعی'}):
            </span>
            <span>هشدار ارسال‌شده: <strong>{lastCleanupResult.warned_count || 0}</strong></span>
            <span>حذف نرم: <strong>{lastCleanupResult.soft_deleted_count || 0}</strong></span>
            <span>حذف دائمی: <strong>{lastCleanupResult.permanently_deleted_count || 0}</strong></span>
            <span>محافظت‌شده (رد شد): <strong>{lastCleanupResult.skipped_protected_count || 0}</strong></span>
          </div>
        )}
      </div>

      {/* 2. Settings Form (re-keyed on DB settings signature to keep local state synced without useEffect) */}
      <AdCleanupSettingsForm
        key={settingsSignature}
        settings={settings}
        saving={saving}
        onSave={onSave}
      />

      {/* 3. Settings Change Audit History */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/80 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-extrabold text-stone-900">تاریخچه تغییرات تنظیمات پاکسازی</h4>
            <p className="text-xs text-stone-500 mt-0.5">
              ثبت خودکار نام ادمین، زمان تغییر و مقادیر قبلی و جدید برای ممیزی امنیتی
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-[11px] font-bold tabular-nums shrink-0">
            {settingsAudit.length} ثبت اخیر
          </span>
        </div>

        {settingsAudit.length === 0 ? (
          <div className="p-6 rounded-xl bg-stone-50 border border-stone-200/70 text-center text-xs text-stone-500">
            هنوز تغییری در تنظیمات پاکسازی ثبت نشده است. اولین تغییر با نام ادمین و زمان دقیق ذخیره خواهد شد.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-[11px] text-stone-500">
                    <th className="py-2.5 px-2.5">ادمین تغییر‌دهنده</th>
                    <th className="py-2.5 px-2.5">زمان ثبت</th>
                    <th className="py-2.5 px-2.5">خلاصه تغییرات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {settingsAudit.map((entry) => {
                    const diffs = summarizeChangeDiff(entry.previous_settings, entry.new_settings);
                    return (
                      <tr key={entry.id} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-2.5 align-top">
                          <span className="font-bold text-stone-900 block">{entry.admin_name || 'ادمین'}</span>
                          <span className="text-[10.5px] font-mono text-stone-500" dir="ltr">
                            {entry.admin_email}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 align-top whitespace-nowrap">
                          <span className="font-semibold text-stone-800 block">
                            {formatAuditTimestamp(entry.changed_at)}
                          </span>
                          <span className="text-[10px] font-mono text-stone-400" dir="ltr">
                            {entry.changed_at ? new Date(entry.changed_at).toLocaleString('sv-SE') : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {diffs.map((line, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 text-[11px] font-medium tabular-nums"
                              >
                                {line}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden space-y-2.5">
              {settingsAudit.map((entry) => {
                const diffs = summarizeChangeDiff(entry.previous_settings, entry.new_settings);
                return (
                  <div
                    key={entry.id}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-stone-900 block">{entry.admin_name || 'ادمین'}</span>
                        <span className="text-[10.5px] font-mono text-stone-500" dir="ltr">
                          {entry.admin_email}
                        </span>
                      </div>
                      <span className="text-[10.5px] font-semibold text-stone-600 text-left">
                        {formatAuditTimestamp(entry.changed_at)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {diffs.map((line, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 text-stone-800 text-[10.5px] font-medium tabular-nums"
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
