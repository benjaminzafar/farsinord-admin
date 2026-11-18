export const CLEANUP_SETTINGS_LIMITS = {
  inactivityDays: { min: 7, max: 3650, default: 30, labelFa: 'مدت بی‌فعالیتی' },
  warningDays: { min: 1, max: 365, default: 7, labelFa: 'مدت هشدار پیش از حذف' },
  softDeleteRetentionDays: { min: 1, max: 3650, default: 30, labelFa: 'مدت نگهداری آگهی حذف‌شده' },
  freeBoostCooldownDays: { min: 1, max: 90, default: 7, labelFa: 'فاصله بوست رایگان' },
};

export const DEFAULT_CLEANUP_SETTINGS = {
  enabled: true,
  inactivityDays: CLEANUP_SETTINGS_LIMITS.inactivityDays.default,
  warningDays: CLEANUP_SETTINGS_LIMITS.warningDays.default,
  softDeleteRetentionDays: CLEANUP_SETTINGS_LIMITS.softDeleteRetentionDays.default,
  freeBoostCooldownDays: CLEANUP_SETTINGS_LIMITS.freeBoostCooldownDays.default,
  duplicateBlockThresholdSameOwner: 0.72,
  duplicateBlockThresholdOtherOwner: 0.86,
  duplicateReviewThresholdSameOwner: 0.55,
};

/**
 * Convert Persian (۰-۹) and Arabic-Indic (٠-٩) numerals to ASCII digits.
 */
export function normalizeDigits(val) {
  return String(val)
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
}

/**
 * Parse and validate an integer numeric setting strictly (rejects floats, non-numeric strings, negative numbers, and out-of-range values).
 */
export function parseStrictIntegerField(raw, { fieldName, labelFa, min, max }) {
  if (raw === null || raw === undefined || typeof raw === 'boolean' || typeof raw === 'object') {
    return { ok: false, fieldName, error: `${labelFa} باید یک عدد صحیح معتبر باشد.` };
  }

  let parsed;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || !Number.isSafeInteger(raw)) {
      if (Number.isFinite(raw) && raw < 0) {
        return { ok: false, fieldName, error: `${labelFa} نمی‌تواند عدد منفی باشد.` };
      }
      return { ok: false, fieldName, error: `${labelFa} باید یک عدد صحیح (بدون اعشار) باشد.` };
    }
    parsed = raw;
  } else if (typeof raw === 'string') {
    const normalized = normalizeDigits(raw).trim();
    if (!normalized || !/^[+-]?\d+$/.test(normalized)) {
      return { ok: false, fieldName, error: `${labelFa} باید فقط به صورت عدد صحیح وارد شود.` };
    }
    parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed)) {
      return { ok: false, fieldName, error: `${labelFa} خارج از محدوده مجاز عددی است.` };
    }
  } else {
    return { ok: false, fieldName, error: `${labelFa} باید یک عدد صحیح معتبر باشد.` };
  }

  if (parsed < 0) {
    return { ok: false, fieldName, error: `${labelFa} نمی‌تواند عدد منفی باشد.` };
  }

  if (parsed < min) {
    const msg =
      fieldName === 'inactivityDays'
        ? 'مدت بی‌فعالیتی باید حداقل ۷ روز باشد.'
        : `${labelFa} باید حداقل ${min} روز باشد.`;
    return { ok: false, fieldName, error: msg };
  }

  if (parsed > max) {
    return { ok: false, fieldName, error: `${labelFa} نمی‌تواند بیشتر از ${max} روز باشد.` };
  }

  return { ok: true, value: parsed };
}

function sanitizeThreshold(candidate, fallback) {
  const num = Number(candidate);
  if (Number.isFinite(num) && num >= 0.1 && num <= 0.99) {
    return Math.round(num * 100) / 100;
  }
  return fallback;
}

/**
 * Validate ad lifecycle & cleanup settings server-side and client-side with identical rules.
 */
export function validateCleanupSettings(input, previousSettings = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      error: 'فرمت اطلاعات تنظیمات پاکسازی نامعتبر است.',
      fieldErrors: {},
    };
  }

  const fieldErrors = {};

  if (typeof input.enabled !== 'boolean') {
    fieldErrors.enabled = 'وضعیت فعال بودن پاکسازی خودکار باید به‌صورت بولی (روشن/خاموش) ارسال شود.';
  }

  const inactivityRes = parseStrictIntegerField(input.inactivityDays, {
    fieldName: 'inactivityDays',
    ...CLEANUP_SETTINGS_LIMITS.inactivityDays,
  });
  if (!inactivityRes.ok) fieldErrors.inactivityDays = inactivityRes.error;

  const warningRes = parseStrictIntegerField(input.warningDays, {
    fieldName: 'warningDays',
    ...CLEANUP_SETTINGS_LIMITS.warningDays,
  });
  if (!warningRes.ok) fieldErrors.warningDays = warningRes.error;

  const retentionRes = parseStrictIntegerField(input.softDeleteRetentionDays, {
    fieldName: 'softDeleteRetentionDays',
    ...CLEANUP_SETTINGS_LIMITS.softDeleteRetentionDays,
  });
  if (!retentionRes.ok) fieldErrors.softDeleteRetentionDays = retentionRes.error;

  let boostCooldownValue =
    previousSettings && Number.isInteger(previousSettings.freeBoostCooldownDays)
      ? previousSettings.freeBoostCooldownDays
      : CLEANUP_SETTINGS_LIMITS.freeBoostCooldownDays.default;

  if (input.freeBoostCooldownDays !== undefined) {
    const boostRes = parseStrictIntegerField(input.freeBoostCooldownDays, {
      fieldName: 'freeBoostCooldownDays',
      ...CLEANUP_SETTINGS_LIMITS.freeBoostCooldownDays,
    });
    if (!boostRes.ok) {
      fieldErrors.freeBoostCooldownDays = boostRes.error;
    } else {
      boostCooldownValue = boostRes.value;
    }
  }

  const errorKeys = Object.keys(fieldErrors);
  if (errorKeys.length > 0) {
    return {
      ok: false,
      error: fieldErrors[errorKeys[0]],
      fieldErrors,
    };
  }

  const prev = previousSettings && typeof previousSettings === 'object' ? previousSettings : {};

  return {
    ok: true,
    value: {
      enabled: input.enabled,
      inactivityDays: inactivityRes.value,
      warningDays: warningRes.value,
      softDeleteRetentionDays: retentionRes.value,
      freeBoostCooldownDays: boostCooldownValue,
      duplicateBlockThresholdSameOwner: sanitizeThreshold(
        input.duplicateBlockThresholdSameOwner ?? prev.duplicateBlockThresholdSameOwner,
        DEFAULT_CLEANUP_SETTINGS.duplicateBlockThresholdSameOwner
      ),
      duplicateBlockThresholdOtherOwner: sanitizeThreshold(
        input.duplicateBlockThresholdOtherOwner ?? prev.duplicateBlockThresholdOtherOwner,
        DEFAULT_CLEANUP_SETTINGS.duplicateBlockThresholdOtherOwner
      ),
      duplicateReviewThresholdSameOwner: sanitizeThreshold(
        input.duplicateReviewThresholdSameOwner ?? prev.duplicateReviewThresholdSameOwner,
        DEFAULT_CLEANUP_SETTINGS.duplicateReviewThresholdSameOwner
      ),
    },
  };
}
