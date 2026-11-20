import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { validateCleanupSettings, DEFAULT_CLEANUP_SETTINGS } from './_lib/cleanupSettingsValidation.js';
import { notifyIndexNow, getIndexNowKey } from './_lib/indexNow.js';
import {
  DUMMY_SCRYPT_CREDENTIALS,
  SecretVaultDecryptionError,
  deleteVaultSecret,
  deriveJwtBaseKey,
  getAdminJwtSigningContext,
  getMasterIkm,
  getVaultSecret,
  hashAdminPassword,
  invalidateSecretVaultCache,
  isVaultTableMissingError,
  listVaultSecretsStatus,
  resolveCloudflareDeployConfig,
  resolveR2VaultConfig,
  resolveStripeSecretKey,
  rewrapAllVaultSecrets,
  rotateAdminJwtPepper,
  safeTimingEqual,
  saveVaultSecret,
  sha256Hex,
  verifyAdminPassword,
} from './_lib/secretVault.js';

const CANONICAL_ORIGIN = (process.env.SITE_CANONICAL_URL || 'https://www.linksho.eu').replace(/\/+$/, '');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const HAS_SERVICE_ROLE = Boolean(SERVICE_ROLE_KEY);
// Fail closed on server: never silently downgrade admin client to anon key in production
const supabaseKey = SERVICE_ROLE_KEY || 'missing-service-role-key';

const ADMIN_FETCH_TIMEOUT_MS = 8000;
function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
});

const PAGE_SIZE = 15;
export const MAX_BRANDING_BYTES = 1048576; // Strict 1 MB limit per branding/hero image
const EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString('hex');

function getFallbackJwtKey() {
  const raw = String(
    process.env.ADMIN_JWT_SECRET ||
      getMasterIkm() ||
      (process.env.VERCEL_ENV === 'production' ? '' : EPHEMERAL_DEV_SECRET)
  ).trim();
  if (!raw) return null;
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(raw, 'utf8'),
      'linksho:v1:jwt-salt:bezbnymjcnmazdonfzky',
      'linksho:v1:admin-jwt-base',
      32
    )
  );
}

const ADMIN_AD_COLUMNS =
  'id, reference_number, title, title_fa, category, country, city, area, price, price_type, description, contact_name, contact_phone, contact_whatsapp, contact_telegram, contact_email, contact_website, images, is_featured, status, views_count, created_at, updated_at, last_boosted_at, last_meaningful_activity_at, sort_timestamp, next_free_boost_at, boost_count, duplicate_detection_status, duplicate_score, duplicate_of_ad_id, cleanup_warning_sent_at, scheduled_deletion_at, deleted_at, promotion_expires_at, is_disputed';

const STRICT_AD_OBJECT_KEY_RE = /^ads\/\d+-[a-f0-9]{16}\.(jpg|png|webp|avif)$/i;

function getTrustedClientIp(req) {
  const realIp = req?.headers?.['x-real-ip'];
  if (realIp) return String(realIp).trim();
  const vercelFwd = req?.headers?.['x-vercel-forwarded-for'];
  if (vercelFwd) return String(vercelFwd).split(',').pop().trim();
  const fwd = req?.headers?.['x-forwarded-for'];
  if (fwd) return String(fwd).split(',').pop().trim();
  return 'unknown';
}

const adminLoginRateMap = new Map();
function checkAdminLoginRateLimit(req) {
  const ip = getTrustedClientIp(req);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 10;
  const entry = adminLoginRateMap.get(ip);
  if (!entry || now - entry.start > windowMs) {
    adminLoginRateMap.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count += 1;
  return true;
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://www.linksho.eu,https://linksho.eu,https://admin.linksho.eu,https://farsinord-admin.vercel.app,https://swedpersiska.vercel.app,https://farsinord.vercel.app,https://farsinord-frontend.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const BRANDING_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function createR2PresignedPutUrl({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucketName,
  objectKey,
  contentType,
  contentLength,
  cacheControl,
  expiresSeconds = 300,
}) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${bucketName}/${objectKey.split('/').map(encodeRfc3986).join('/')}`;

  const headerPairs = [
    ['content-type', contentType],
    ['host', host],
  ];
  const parsedLen = Number(contentLength);
  if (Number.isInteger(parsedLen) && parsedLen > 0) {
    headerPairs.push(['content-length', String(parsedLen)]);
  }
  if (cacheControl) {
    headerPairs.push(['cache-control', String(cacheControl)]);
  }
  headerPairs.sort((a, b) => a[0].localeCompare(b[0]));

  const signedHeaders = headerPairs.map(([k]) => k).join(';');
  const canonicalHeaders = headerPairs.map(([k, v]) => `${k}:${v}\n`).join('');

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  };

  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`)
    .join('&');

  const canonicalRequest = ['PUT', canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');
  const hash = crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hash].join('\n');

  const hmac = (k, d) => crypto.createHmac('sha256', k).update(d, 'utf8').digest();
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

const ADMIN_R2_CACHE_TTL_MS = 60 * 1000;
let cachedAdminR2Config = null;
let cachedAdminR2At = 0;

async function resolveAdminR2Config({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && cachedAdminR2Config && now - cachedAdminR2At < ADMIN_R2_CACHE_TTL_MS) {
    return cachedAdminR2Config;
  }
  try {
    const resolved = await resolveR2VaultConfig(supabase, { fresh });
    if (!resolved?.configured) return null;
    cachedAdminR2Config = resolved;
    cachedAdminR2At = now;
    return resolved;
  } catch (err) {
    console.warn('[admin] resolveAdminR2Config caught error:', err?.message);
    return null;
  }
}

async function deleteR2ObjectsForAdAdmin(imageUrls = [], excludeAdId = null) {
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  if (urls.length === 0) return { deletedKeys: [], failedKeys: [] };
  const r2 = await resolveAdminR2Config();
  if (!r2) return { deletedKeys: [], failedKeys: [] };

  const deletedKeys = [];
  const failedKeys = [];
  const base = r2.publicUrl;

  await Promise.all(
    urls.map(async (url) => {
      if (!String(url).startsWith(`${base}/`)) return;
      const rawRel = String(url).slice(base.length + 1).split('?')[0].split('#')[0];
      let objectKey = '';
      try {
        objectKey = decodeURIComponent(rawRel);
      } catch {
        return;
      }
      if (!objectKey || objectKey.includes('..') || objectKey.includes('\\') || !STRICT_AD_OBJECT_KEY_RE.test(objectKey)) return;

      const canonicalUrl = `${base}/${objectKey}`;
      if (excludeAdId) {
        try {
          const urlsToCheck = canonicalUrl === url ? [canonicalUrl] : [canonicalUrl, url];
          const refChecks = await Promise.all(
            urlsToCheck.map((checkUrl) =>
              supabase
                .from('swedpersiska_ads')
                .select('id', { count: 'exact', head: true })
                .neq('id', excludeAdId)
                .contains('images', [checkUrl])
            )
          );
          if (refChecks.some((r) => (r?.count || 0) > 0)) return;
        } catch {
          return;
        }
      }

      try {
        const host = `${r2.accountId}.r2.cloudflarestorage.com`;
        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.slice(0, 8);
        const scope = `${dateStamp}/auto/s3/aws4_request`;
        const uri = `/${r2.bucketName}/${objectKey.split('/').map(encodeRfc3986).join('/')}`;
        const emptyHash = crypto.createHash('sha256').update('').digest('hex');
        const headersStr = `host:${host}\nx-amz-content-sha256:${emptyHash}\nx-amz-date:${amzDate}\n`;
        const signed = 'host;x-amz-content-sha256;x-amz-date';
        const canonicalReq = ['DELETE', uri, '', headersStr, signed, emptyHash].join('\n');
        const strToSign = ['AWS4-HMAC-SHA256', amzDate, scope, crypto.createHash('sha256').update(canonicalReq).digest('hex')].join('\n');
        const hmac = (k, d) => crypto.createHmac('sha256', k).update(d, 'utf8').digest();
        const kSigning = hmac(hmac(hmac(hmac(`AWS4${r2.secretAccessKey}`, dateStamp), 'auto'), 's3'), 'aws4_request');
        const sig = crypto.createHmac('sha256', kSigning).update(strToSign, 'utf8').digest('hex');
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const resp = await fetch(`https://${host}${uri}`, {
            method: 'DELETE',
            signal: ctrl.signal,
            headers: {
              'x-amz-date': amzDate,
              'x-amz-content-sha256': emptyHash,
              Authorization: `AWS4-HMAC-SHA256 Credential=${r2.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${sig}`,
            },
          });
          if (resp.ok || resp.status === 204 || resp.status === 404) deletedKeys.push(objectKey);
          else failedKeys.push(objectKey);
        } finally {
          clearTimeout(timer);
        }
      } catch {
        failedKeys.push(objectKey);
      }
    })
  );
  return { deletedKeys, failedKeys };
}

async function attachAdminPins(ads = []) {
  if (!HAS_SERVICE_ROLE || !Array.isArray(ads) || ads.length === 0) return ads;
  const ids = ads.map((a) => a.id).filter(Boolean);
  if (ids.length === 0) return ads;
  try {
    const { data: creds } = await supabase
      .from('ad_credentials')
      .select('ad_id, pin_code')
      .in('ad_id', ids);
    const pinMap = new Map((creds || []).map((c) => [c.ad_id, c.pin_code]));
    return ads.map((a) => ({
      ...a,
      pin_code: pinMap.get(a.id) || (a.pin_code && a.pin_code !== 'PROTECTED' ? a.pin_code : ''),
    }));
  } catch {
    return ads;
  }
}

function safeEqual(a, b) {
  return safeTimingEqual(a, b);
}

export function createAdminToken(email, { signingKey = null, pepperVersion = 0, tokenVersion = 1 } = {}) {
  const key = signingKey || getFallbackJwtKey();
  if (!key) throw new Error('Missing JWT signing key');
  const cleanEmail = String(email || '').trim().toLowerCase();
  const displayName = cleanEmail.split('@')[0] || 'admin';
  const payload = Buffer.from(
    JSON.stringify({
      sub: cleanEmail,
      name: displayName,
      role: 'admin',
      pv: Number(pepperVersion || 0),
      ver: Number(tokenVersion || 1),
      iat: Date.now(),
      exp: Date.now() + 12 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token, { signingKey = null, expectedPepperVersion = null } = {}) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, sig] = parts;
  const key = signingKey || getFallbackJwtKey();
  if (!key) return null;
  const expectedSig = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  if (!safeEqual(sig, expectedSig)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded || decoded.role !== 'admin' || !decoded.exp || decoded.exp < Date.now()) return null;
    if (expectedPepperVersion !== null && Number(decoded.pv ?? 0) !== Number(expectedPepperVersion)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

async function createAdminTokenWithVault(email, { tokenVersion = 1 } = {}) {
  try {
    const ctx = await getAdminJwtSigningContext(supabase, {
      ensurePepper: HAS_SERVICE_ROLE,
      adminEmail: email,
    });
    if (ctx && ctx.signingKey) {
      return createAdminToken(email, {
        signingKey: ctx.signingKey,
        pepperVersion: ctx.pepperVersion,
        tokenVersion,
      });
    }
  } catch (err) {
    console.warn('[admin] createAdminTokenWithVault primary path warning:', err?.message || err);
  }

  // Cryptographic fallback: derive signing key directly from ADMIN_JWT_SECRET or getMasterIkm()
  const baseIkm = String(process.env.ADMIN_JWT_SECRET || getMasterIkm() || 'linksho-admin-jwt-fallback-ikm').trim();
  const signingKey = deriveJwtBaseKey(baseIkm);
  return createAdminToken(email, {
    signingKey,
    pepperVersion: 0,
    tokenVersion,
  });
}

let cachedAdminVerMap = new Map(); // email -> { tokenVersion, isActive, expiresAt }
const ADMIN_VER_CACHE_TTL_MS = 15_000;

function invalidateAdminVersionCache(email = null) {
  if (email) cachedAdminVerMap.delete(String(email).trim().toLowerCase());
  else cachedAdminVerMap.clear();
}

async function verifyAdminTokenWithVault(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let unverified = null;
  try {
    unverified = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  let ctx = await getAdminJwtSigningContext(supabase).catch(() => ({ signingKey: null, pepperVersion: 0, hasDbPepper: false }));
  let decoded = null;
  if (ctx && ctx.signingKey) {
    decoded = verifyAdminToken(token, {
      signingKey: ctx.signingKey,
      expectedPepperVersion: ctx.hasDbPepper ? ctx.pepperVersion : null,
    });
  }

  // Self-healing refresh if pepper version rotated on another isolate
  if (!decoded && unverified && Number(unverified.pv ?? 0) !== Number(ctx?.pepperVersion ?? 0)) {
    ctx = await getAdminJwtSigningContext(supabase, { fresh: true }).catch(() => ({ signingKey: null, pepperVersion: 0, hasDbPepper: false }));
    if (ctx && ctx.signingKey) {
      decoded = verifyAdminToken(token, {
        signingKey: ctx.signingKey,
        expectedPepperVersion: ctx.hasDbPepper ? ctx.pepperVersion : null,
      });
    }
  }

  // Also verify against base fallback key if issued under fallback
  if (!decoded) {
    const baseIkm = String(process.env.ADMIN_JWT_SECRET || getMasterIkm() || 'linksho-admin-jwt-fallback-ikm').trim();
    const fallbackKey = deriveJwtBaseKey(baseIkm);
    decoded = verifyAdminToken(token, {
      signingKey: fallbackKey,
      expectedPepperVersion: 0,
    });
  }

  if (!decoded) return null;

  // Verify token_version against admin_credentials if DB admin account exists
  const sub = String(decoded.sub || '').trim().toLowerCase();
  if (sub && HAS_SERVICE_ROLE) {
    const now = Date.now();
    let verEntry = cachedAdminVerMap.get(sub);
    if (!verEntry || now >= verEntry.expiresAt || Number(decoded.ver || 1) !== Number(verEntry.tokenVersion)) {
      const { data: credRow, error: credErr } = await supabase
        .from('admin_credentials')
        .select('token_version, is_active')
        .eq('email', sub)
        .maybeSingle();
      if (!credErr && credRow) {
        verEntry = {
          tokenVersion: Number(credRow.token_version || 1),
          isActive: credRow.is_active !== false,
          expiresAt: now + ADMIN_VER_CACHE_TTL_MS,
        };
        cachedAdminVerMap.set(sub, verEntry);
      } else if (!credErr && !credRow) {
        verEntry = { tokenVersion: null, isActive: true, expiresAt: now + ADMIN_VER_CACHE_TTL_MS };
        cachedAdminVerMap.set(sub, verEntry);
      }
    }
    if (verEntry && verEntry.tokenVersion !== null) {
      if (!verEntry.isActive || Number(decoded.ver || 1) !== Number(verEntry.tokenVersion)) {
        return null;
      }
    }
  }

  return decoded;
}

function resolveAdminIdentity(adminSession) {
  const email = String(adminSession?.sub || '').trim().toLowerCase() || 'admin@linksho.eu';
  const name = String(adminSession?.name || email.split('@')[0] || 'مدیر سیستم').trim();
  return { email, name };
}

async function saveAndAuditCleanupSettings(rawValue, adminSession) {
  const preCheck = validateCleanupSettings(rawValue, null);
  if (!preCheck.ok) {
    return {
      status: 400,
      body: { ok: false, error: preCheck.error, fieldErrors: preCheck.fieldErrors },
    };
  }

  const { data: existingRow } = await supabase
    .from('swedpersiska_settings')
    .select('value')
    .eq('key', 'ad_lifecycle_settings')
    .maybeSingle();

  const prevSettings =
    existingRow?.value && typeof existingRow.value === 'object'
      ? existingRow.value
      : null;

  const finalCheck = validateCleanupSettings(rawValue, prevSettings);
  if (!finalCheck.ok) {
    return {
      status: 400,
      body: { ok: false, error: finalCheck.error, fieldErrors: finalCheck.fieldErrors },
    };
  }

  const nowIso = new Date().toISOString();
  const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
    key: 'ad_lifecycle_settings',
    value: finalCheck.value,
    updated_at: nowIso,
  });
  if (upsertErr) throw upsertErr;

  const identity = resolveAdminIdentity(adminSession);
  const { data: auditEntry, error: auditErr } = await supabase
    .from('ad_cleanup_settings_audit')
    .insert({
      admin_email: identity.email,
      admin_name: identity.name,
      previous_settings: prevSettings,
      new_settings: finalCheck.value,
      changed_at: nowIso,
    })
    .select('*')
    .single();
  if (auditErr) throw auditErr;

  return {
    status: 200,
    body: {
      ok: true,
      settings: finalCheck.value,
      auditEntry,
    },
  };
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const isDevLocalhost = process.env.VERCEL_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
  if (origin && (ALLOWED_ORIGINS.includes(origin) || isDevLocalhost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}))
      : {};
    const action = body.action || (req.query && req.query.action);

    // 0. Public Safe Auth Bootstrap Endpoint (GET ?action=auth_bootstrap)
    //    Returns ONLY safe login-screen state (Turnstile siteKey, branding, initial setup status).
    if (action === 'auth_bootstrap') {
      const envAdminConfigured = Boolean(
        String(process.env.ADMIN_EMAIL || '').trim() && String(process.env.ADMIN_PASSWORD || '').trim()
      );
      let vaultTableMissing = false;
      let dbAdminCount = 0;
      let hasActiveBootstrapToken = false;
      let bootstrapPurpose = null;
      let turnstile = null;
      let branding = null;

      if (HAS_SERVICE_ROLE) {
        const [credRes, bootRes, settingsRes] = await Promise.all([
          supabase.from('admin_credentials').select('email', { count: 'exact', head: true }).eq('is_active', true),
          supabase
            .from('admin_bootstrap_tokens')
            .select('purpose, expires_at, used_at, failed_attempts')
            .eq('singleton_id', 1)
            .maybeSingle(),
          supabase
            .from('swedpersiska_settings')
            .select('key, value')
            .in('key', ['turnstile_settings', 'site_branding']),
        ]);

        if (credRes.error && isVaultTableMissingError(credRes.error)) {
          vaultTableMissing = true;
        } else if (!credRes.error) {
          dbAdminCount = Number(credRes.count || 0);
        }

        if (!bootRes.error && bootRes.data) {
          const b = bootRes.data;
          const notUsed = !b.used_at;
          const notExpired = b.expires_at && Date.parse(b.expires_at) > Date.now();
          const underLimit = Number(b.failed_attempts || 0) < 5;
          if (notUsed && notExpired && underLimit) {
            hasActiveBootstrapToken = true;
            bootstrapPurpose = b.purpose;
          }
        }

        for (const row of settingsRes.data || []) {
          if (row.key === 'turnstile_settings' && row.value && typeof row.value === 'object') {
            turnstile = {
              enabled: row.value.enabled !== false,
              mode: row.value.mode === 'live' ? 'live' : 'test',
              siteKey: String(row.value.siteKey || '').replace(/[\s\u200B-\u200D\uFEFF]/g, ''),
              protectAdminLogin: row.value.protectAdminLogin !== false,
            };
          } else if (row.key === 'site_branding' && row.value && typeof row.value === 'object') {
            const rawName = String(row.value.siteName || '').trim();
            branding = {
              siteName: rawName || 'لینک شو',
              logoUrl: String(row.value.logoUrl || '').trim(),
            };
          }
        }
      }

      const needsInitialSetup = HAS_SERVICE_ROLE && !vaultTableMissing && dbAdminCount === 0 && !envAdminConfigured;
      return res.status(200).json({
        ok: true,
        hasServiceRole: HAS_SERVICE_ROLE,
        vaultReady: HAS_SERVICE_ROLE && !vaultTableMissing,
        vaultTableMissing,
        needsInitialSetup,
        hasActiveBootstrapToken,
        bootstrapPurpose,
        turnstile,
        branding,
      });
    }

    // 0b. Out-of-Band Single-Use Initial Admin Setup / Emergency Password Reset
    //     Requires the 192-bit CSPRNG code printed ONLY in Supabase SQL Editor.
    if (req.method === 'POST' && action === 'bootstrap_setup') {
      if (!checkAdminLoginRateLimit(req)) {
        return res.status(429).json({ ok: false, error: 'تعداد تلاش‌ها بیش از حد مجاز است. لطفاً ۱۵ دقیقه بعد تلاش کنید.' });
      }
      if (!HAS_SERVICE_ROLE) {
        return res.status(503).json({
          ok: false,
          error: 'متغیر SUPABASE_SERVICE_ROLE_KEY روی سرور مدیریت تنظیم نشده است.',
        });
      }

      const setupCode = String(body.setupCode || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!setupCode || setupCode.length < 16) {
        return res.status(400).json({ ok: false, error: 'کد راه‌اندازی یک‌بارمصرف را دقیقاً از خروجی SQL Editor کپی و وارد کنید.' });
      }
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) {
        return res.status(400).json({ ok: false, error: 'فرمت ایمیل مدیریت معتبر نیست.' });
      }
      if (password.length < 10) {
        return res.status(400).json({ ok: false, error: 'رمز عبور مدیر باید حداقل ۱۰ کاراکتر باشد.' });
      }

      const { data: bootRow, error: bootErr } = await supabase
        .from('admin_bootstrap_tokens')
        .select('token_hash, purpose, failed_attempts, expires_at, used_at')
        .eq('singleton_id', 1)
        .maybeSingle();

      if (bootErr) {
        if (isVaultTableMissingError(bootErr)) {
          return res.status(503).json({
            ok: false,
            error: 'جدول‌های خزانه امنیتی هنوز در Supabase ساخته نشده‌اند. ابتدا فایل SQL مهاجرت را اجرا کنید.',
          });
        }
        throw bootErr;
      }

      if (!bootRow || bootRow.used_at || !bootRow.expires_at || Date.parse(bootRow.expires_at) <= Date.now()) {
        return res.status(403).json({
          ok: false,
          error: 'کد راه‌اندازی منقضی یا قبلاً استفاده شده است. فایل SQL را مجدداً در Supabase اجرا کنید تا کد جدید صادر شود.',
        });
      }

      if (Number(bootRow.failed_attempts || 0) >= 5) {
        return res.status(403).json({
          ok: false,
          error: 'کد راه‌اندازی به دلیل ۵ تلاش ناموفق باطل شد. لطفاً کد جدید در Supabase تولید کنید.',
        });
      }

      const providedHash = sha256Hex(setupCode);
      if (!safeEqual(providedHash, bootRow.token_hash)) {
        const nextFails = Number(bootRow.failed_attempts || 0) + 1;
        await supabase
          .from('admin_bootstrap_tokens')
          .update({
            failed_attempts: nextFails,
            used_at: nextFails >= 5 ? new Date().toISOString() : null,
          })
          .eq('singleton_id', 1);
        return res.status(401).json({
          ok: false,
          error: `کد راه‌اندازی اشتباه است (${Math.max(0, 5 - nextFails)} تلاش باقی‌مانده).`,
        });
      }

      // If purpose is initial_setup, enforce strictly that zero active DB admins exist
      const { count: existingAdmins } = await supabase
        .from('admin_credentials')
        .select('email', { count: 'exact', head: true })
        .eq('is_active', true);

      if (bootRow.purpose === 'initial_setup' && Number(existingAdmins || 0) > 0) {
        await supabase.from('admin_bootstrap_tokens').update({ used_at: new Date().toISOString() }).eq('singleton_id', 1);
        return res.status(403).json({ ok: false, error: 'حساب مدیر قبلاً راه‌اندازی شده است.' });
      }

      // Atomically claim & burn the single-use bootstrap token FIRST
      const nowIso = new Date().toISOString();
      const { data: claimed, error: claimErr } = await supabase
        .from('admin_bootstrap_tokens')
        .update({ used_at: nowIso })
        .eq('singleton_id', 1)
        .is('used_at', null)
        .select('singleton_id')
        .maybeSingle();

      if (claimErr || !claimed) {
        return res.status(409).json({ ok: false, error: 'این کد قبلاً مصرف شده است.' });
      }

      const hashed = hashAdminPassword(password);
      const { data: existingEmailRow } = await supabase
        .from('admin_credentials')
        .select('token_version')
        .eq('email', email)
        .maybeSingle();

      const nextVer = existingEmailRow?.token_version ? Number(existingEmailRow.token_version) + 1 : 1;

      const { error: upsertCredErr } = await supabase.from('admin_credentials').upsert(
        {
          email,
          display_name: email.split('@')[0] || 'Admin',
          password_hash: hashed.password_hash,
          password_salt: hashed.password_salt,
          hash_algorithm: hashed.hash_algorithm,
          token_version: nextVer,
          is_active: true,
          failed_attempts: 0,
          locked_until: null,
          last_login_at: nowIso,
          updated_by: email,
        },
        { onConflict: 'email' }
      );
      if (upsertCredErr) throw upsertCredErr;

      // Rotate JWT pepper on password_reset so any prior stolen session dies immediately
      if (bootRow.purpose === 'password_reset') {
        await rotateAdminJwtPepper(supabase, email);
      }
      invalidateAdminVersionCache();

      const token = await createAdminTokenWithVault(email, { tokenVersion: nextVer });
      return res.status(200).json({ ok: true, token, email });
    }

    // 1. Admin Login Endpoint (Unauthenticated -> Issues HKDF + Pepper Signed Token)
    if (req.method === 'POST' && action === 'login') {
      if (!checkAdminLoginRateLimit(req)) {
        return res.status(429).json({ ok: false, error: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر دوباره امتحان کنید.' });
      }
      if (!HAS_SERVICE_ROLE && process.env.VERCEL_ENV === 'production') {
        return res.status(503).json({
          ok: false,
          error: 'تنها متغیر ضروری سرور یعنی SUPABASE_SERVICE_ROLE_KEY در Vercel تنظیم نشده است.',
        });
      }

      // Enforce fail-closed server-side Turnstile verification when live mode is active
      let tsCfg = null;
      if (HAS_SERVICE_ROLE) {
        try {
          const { data: tsRow } = await supabase
            .from('swedpersiska_settings')
            .select('value')
            .eq('key', 'turnstile_settings')
            .maybeSingle();
          tsCfg = tsRow?.value || null;
        } catch {}
      }

      const requireTurnstile = Boolean(
        tsCfg && tsCfg.enabled !== false && tsCfg.protectAdminLogin !== false && tsCfg.mode === 'live'
      );

      if (requireTurnstile) {
        let turnstileSecret = '';
        try {
          const tsSecRes = await getVaultSecret(supabase, 'turnstile_secret_key');
          turnstileSecret = String(tsSecRes?.value || '').trim();
        } catch (err) {
          console.error('[admin] turnstile vault error:', err?.message);
          return res.status(503).json({ ok: false, error: 'خطا در رمزگشایی کلید کپچا از خزانه امنیتی.' });
        }
        if (!turnstileSecret) {
          return res.status(503).json({
            ok: false,
            error: 'کپچای کلودفلر در حالت Live فعال است اما Secret Key آن تنظیم نشده است.',
          });
        }

        const cleanTs = String(body.turnstileToken || '').trim();
        if (!cleanTs) {
          return res.status(403).json({ ok: false, error: 'تایید امنیتی کپچا برای ورود مدیر الزامی است.' });
        }
        const tsCtrl = new AbortController();
        const tsTimer = setTimeout(() => tsCtrl.abort(), 6000);
        try {
          const verifyBody = new URLSearchParams({
            secret: turnstileSecret,
            response: cleanTs,
            remoteip: getTrustedClientIp(req),
          });
          const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: verifyBody,
            signal: tsCtrl.signal,
          });
          const tsJson = await tsRes.json().catch(() => ({}));
          if (!tsRes.ok || !tsJson.success) {
            return res.status(403).json({ ok: false, error: 'تایید امنیتی کپچا نامعتبر است. لطفاً مجدداً امتحان کنید.' });
          }
        } catch {
          return res.status(503).json({ ok: false, error: 'خطا در بررسی امنیتی کپچا. لطفاً لحظاتی بعد دوباره تلاش کنید.' });
        } finally {
          clearTimeout(tsTimer);
        }
      }

      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      // Check DB-stored scrypt admin credentials first (zero Vercel env vars required!)
      let dbAdminsExist = false;
      let matchedDbAdmin = null;

      if (HAS_SERVICE_ROLE) {
        const { data: credRows, error: credErr } = await supabase
          .from('admin_credentials')
          .select('email, password_hash, password_salt, token_version, is_active, failed_attempts, locked_until')
          .eq('is_active', true);

        if (!credErr && Array.isArray(credRows) && credRows.length > 0) {
          dbAdminsExist = true;
          matchedDbAdmin = credRows.find((r) => safeEqual(email, String(r.email || '').toLowerCase())) || null;
        }
      }

      if (dbAdminsExist) {
        if (matchedDbAdmin?.locked_until && Date.parse(matchedDbAdmin.locked_until) > Date.now()) {
          const minsLeft = Math.max(1, Math.ceil((Date.parse(matchedDbAdmin.locked_until) - Date.now()) / 60000));
          return res.status(429).json({
            ok: false,
            error: `حساب به دلیل تلاش‌های ناموفق متعدد قفل شده است. لطفاً ${minsLeft} دقیقه دیگر امتحان کنید.`,
          });
        }

        // Always execute scrypt (even for unknown email) to prevent timing-based email enumeration
        const passOk = matchedDbAdmin
          ? verifyAdminPassword(password, matchedDbAdmin.password_hash, matchedDbAdmin.password_salt)
          : verifyAdminPassword(password, DUMMY_SCRYPT_CREDENTIALS.password_hash, DUMMY_SCRYPT_CREDENTIALS.password_salt) && false;

        if (!matchedDbAdmin || !passOk) {
          if (matchedDbAdmin) {
            const nextFails = Number(matchedDbAdmin.failed_attempts || 0) + 1;
            const lockedUntil = nextFails >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
            await supabase
              .from('admin_credentials')
              .update({ failed_attempts: nextFails, locked_until: lockedUntil })
              .eq('email', matchedDbAdmin.email);
          }
          return res.status(401).json({ ok: false, error: 'ایمیل یا رمز عبور اشتباه است.' });
        }

        await supabase
          .from('admin_credentials')
          .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
          .eq('email', matchedDbAdmin.email);

        const token = await createAdminTokenWithVault(matchedDbAdmin.email, {
          tokenVersion: Number(matchedDbAdmin.token_version || 1),
        });
        return res.status(200).json({ ok: true, token, email: matchedDbAdmin.email, authSource: 'db' });
      }

      // Legacy fallback: Vercel env ADMIN_EMAIL & ADMIN_PASSWORD (allows smooth migration into DB)
      const validEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
      const validPass = String(process.env.ADMIN_PASSWORD || '').trim();
      if (!validEmail || !validPass) {
        return res.status(503).json({
          ok: false,
          needsInitialSetup: true,
          error: 'حساب مدیر هنوز در دیتابیس راه‌اندازی نشده است. فایل SQL خزانه را در Supabase اجرا کرده و کد راه‌اندازی یک‌بارمصرف را وارد کنید.',
        });
      }

      const allowedEmails = validEmail.split(',').map((e) => e.trim()).filter(Boolean);
      const isEmailValid = allowedEmails.some((addr) => safeEqual(email, addr));
      const isPassValid = safeEqual(password.trim(), validPass);

      if (!isEmailValid || !isPassValid) {
        return res.status(401).json({ ok: false, error: 'ایمیل یا رمز عبور اشتباه است.' });
      }

      const token = await createAdminTokenWithVault(email, { tokenVersion: 1 });
      return res.status(200).json({ ok: true, token, email, authSource: 'env' });
    }

    // 2. Verify Admin Bearer Token for all protected actions
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : (body.token || '');
    const adminSession = await verifyAdminTokenWithVault(bearerToken);

    if (!adminSession) {
      return res.status(401).json({ ok: false, error: 'نشست مدیریتی منقضی شده یا نامعتبر است. لطفاً مجدداً وارد شوید.' });
    }
    if (adminSession.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'فقط مدیر سیستم به این بخش دسترسی دارد.' });
    }

    // 3. Protected Admin Actions
    if (action === 'overview') {
      const [firstPageRes, statsRpcRes, settingsRes, dupCountRes, openReportsRes] = await Promise.all([
        supabase
          .from('swedpersiska_ads')
          .select(ADMIN_AD_COLUMNS)
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('is_featured', { ascending: false })
          .order('sort_timestamp', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        HAS_SERVICE_ROLE
          ? supabase.rpc('get_admin_overview_stats')
          : Promise.resolve({ data: null, error: null }),
        supabase.from('swedpersiska_settings').select('*'),
        HAS_SERVICE_ROLE
          ? supabase.from('ad_duplicate_reviews').select('id', { count: 'exact', head: true }).eq('resolution', 'pending')
          : Promise.resolve({ count: 0 }),
        HAS_SERVICE_ROLE
          ? supabase.from('ad_reports').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(100)
          : Promise.resolve({ data: [] }),
      ]);

      let counts;
      let countryStats;
      let categoryCounts;
      let monthBuckets;

      if (!statsRpcRes?.error && statsRpcRes?.data?.counts) {
        const rpcData = statsRpcRes.data;
        counts = {
          ...rpcData.counts,
          pendingDuplicateReviews: rpcData.counts.pendingDuplicateReviews ?? dupCountRes.count ?? 0,
        };
        countryStats = rpcData.countryStats || {};
        categoryCounts = rpcData.categoryCounts || {};
        monthBuckets = rpcData.monthBuckets || {};
      } else {
        const { data: metaRows } = await supabase
          .from('swedpersiska_ads')
          .select('category, country, status, is_featured, promotion_expires_at, cleanup_warning_sent_at, deleted_at, views_count, created_at');

        countryStats = {
          se: { total: 0, active: 0, vip: 0, views: 0 },
          no: { total: 0, active: 0, vip: 0, views: 0 },
          dk: { total: 0, active: 0, vip: 0, views: 0 },
          fi: { total: 0, active: 0, vip: 0, views: 0 },
          de: { total: 0, active: 0, vip: 0, views: 0 },
          at: { total: 0, active: 0, vip: 0, views: 0 },
          nl: { total: 0, active: 0, vip: 0, views: 0 },
          fr: { total: 0, active: 0, vip: 0, views: 0 },
        };
        categoryCounts = {};
        monthBuckets = {};
        let totalCount = 0;
        let activeCount = 0;
        let pendingCount = 0;
        let vipCount = 0;
        let softDeletedCount = 0;
        let warnedCount = 0;
        let totalViews = 0;
        const nowMs = Date.now();

        (metaRows || []).forEach((row) => {
          if (row.deleted_at || row.status === 'deleted') {
            softDeletedCount++;
            return;
          }
          totalCount++;
          const c = row.country || 'se';
          if (!countryStats[c]) countryStats[c] = { total: 0, active: 0, vip: 0, views: 0 };
          countryStats[c].total++;
          if (row.status === 'active') {
            activeCount++;
            countryStats[c].active++;
          } else if (row.status === 'pending') {
            pendingCount++;
          }
          if (row.cleanup_warning_sent_at) {
            warnedCount++;
          }
          const isVipActive = Boolean(row.is_featured && (!row.promotion_expires_at || Date.parse(row.promotion_expires_at) > nowMs));
          if (isVipActive) {
            vipCount++;
            countryStats[c].vip++;
          }
          countryStats[c].views += row.views_count || 1;
          totalViews += row.views_count || 1;
          if (row.category) {
            categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
          }
          if (row.created_at) {
            const ym = String(row.created_at).slice(0, 7);
            if (/^\d{4}-\d{2}$/.test(ym)) {
              if (!monthBuckets[ym]) monthBuckets[ym] = { total: 0, vip: 0 };
              monthBuckets[ym].total++;
              if (isVipActive) monthBuckets[ym].vip++;
            }
          }
        });

        counts = {
          total: totalCount,
          active: activeCount,
          pending: pendingCount,
          vip: vipCount,
          softDeleted: softDeletedCount,
          warnedAds: warnedCount,
          pendingDuplicateReviews: dupCountRes.count || 0,
          totalViews,
        };
      }

      const firstPageAds = await attachAdminPins(firstPageRes.data || []);

      const [vaultStatus, dbAdminsRes] = await Promise.all([
        listVaultSecretsStatus(supabase),
        HAS_SERVICE_ROLE
          ? supabase.from('admin_credentials').select('email, last_login_at, updated_at, token_version').eq('is_active', true)
          : Promise.resolve({ data: null, error: null }),
      ]);

      const settingsList = settingsRes.data || [];
      const stripeRowObj = settingsList.find((x) => x.key === 'stripe_settings')?.value || {};
      const activeStripeMode = stripeRowObj.mode === 'live' ? 'live' : 'test';
      const activeStripeSecretMeta =
        vaultStatus.secrets[activeStripeMode === 'live' ? 'stripe_secret_key_live' : 'stripe_secret_key_test'];
      const activeWebhookMeta =
        vaultStatus.secrets[activeStripeMode === 'live' ? 'stripe_webhook_secret_live' : 'stripe_webhook_secret_test'];
      const liveStripeMeta = vaultStatus.secrets.stripe_secret_key_live;
      const testStripeMeta = vaultStatus.secrets.stripe_secret_key_test;

      const stripeKeyMode = activeStripeSecretMeta?.configured
        ? activeStripeMode
        : liveStripeMeta?.configured
          ? 'live'
          : testStripeMeta?.configured
            ? 'test'
            : 'none';

      const r2RowObj = settingsList.find((x) => x.key === 'r2_settings')?.value || {};
      const cfRowObj = settingsList.find((x) => x.key === 'cloudflare_deploy_settings')?.value || {};
      const legacyPlaintextSources = [];
      if (r2RowObj.accessKeyId || r2RowObj.secretAccessKey) legacyPlaintextSources.push('r2_settings');
      if (cfRowObj.apiToken) legacyPlaintextSources.push('cloudflare_deploy_settings');

      const dbAdmins = !dbAdminsRes?.error && Array.isArray(dbAdminsRes?.data) ? dbAdminsRes.data : [];
      const currentAdminIdentity = resolveAdminIdentity(adminSession);

      return res.status(200).json({
        ok: true,
        hasServiceRole: HAS_SERVICE_ROLE,
        vaultStatus,
        adminAuthInfo: {
          email: currentAdminIdentity.email,
          source: dbAdmins.length > 0 ? 'db' : 'env',
          dbAdminCount: dbAdmins.length,
          envAdminConfigured: Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
          hasLegacyPlaintextSecrets: legacyPlaintextSources.length > 0,
          legacyPlaintextSources,
        },
        serverEnvStatus: {
          hasServiceRole: HAS_SERVICE_ROLE,
          hasStripeSecretKey: Boolean(activeStripeSecretMeta?.configured || liveStripeMeta?.configured || testStripeMeta?.configured),
          stripeKeyMode,
          stripeSecretSource: activeStripeSecretMeta?.source || 'none',
          hasStripeWebhookSecret: Boolean(activeWebhookMeta?.configured),
          stripeWebhookSource: activeWebhookMeta?.source || 'none',
        },
        counts,
        openReports: openReportsRes.data || [],
        countryStats,
        categoryCounts,
        monthBuckets,
        recentActiveAds: firstPageAds.slice(0, 5),
        initialActiveAds: firstPageAds,
        settings: settingsList.map((item) => {
          if (item.key === 'cloudflare_deploy_settings' && item.value && typeof item.value === 'object') {
            return {
              ...item,
              value: {
                accountId: item.value.accountId || '',
                deployUrl: item.value.deployUrl || 'https://linksho-seller.vercel.app/api/cloudflare/deploy',
                hasToken: Boolean(vaultStatus.secrets.cloudflare_api_token?.configured || item.value.apiToken),
              }
            };
          }
          if (item.key === 'r2_settings' && item.value && typeof item.value === 'object') {
            return {
              ...item,
              value: {
                enabled: Boolean(item.value.enabled),
                accountId: item.value.accountId || '',
                bucketName: item.value.bucketName || '',
                publicUrl: item.value.publicUrl || '',
                hasCredentials: Boolean(
                  (vaultStatus.secrets.r2_access_key_id?.configured && vaultStatus.secrets.r2_secret_access_key?.configured) ||
                    (item.value.accessKeyId && item.value.secretAccessKey)
                ),
                accessKeyId: '',
                secretAccessKey: ''
              }
            };
          }
          return item;
        })
      });
    }

    // 3b. Encrypted Secret Vault Management Actions
    if (action === 'save_secret') {
      const { secretKey, value } = body;
      const { email: adminEmail } = resolveAdminIdentity(adminSession);
      const saved = await saveVaultSecret(supabase, String(secretKey || '').trim(), value, adminEmail);
      if (!saved.ok) {
        return res.status(saved.status || 400).json({ ok: false, error: saved.error });
      }
      if (secretKey === 'r2_access_key_id' || secretKey === 'r2_secret_access_key') {
        cachedAdminR2Config = null;
        cachedAdminR2At = 0;
      }
      const vaultStatus = await listVaultSecretsStatus(supabase);
      return res.status(200).json({ ok: true, secret: saved.secret, vaultStatus });
    }

    if (action === 'delete_secret') {
      const { secretKey } = body;
      const { email: adminEmail } = resolveAdminIdentity(adminSession);
      const deleted = await deleteVaultSecret(supabase, String(secretKey || '').trim(), adminEmail);
      if (!deleted.ok) {
        return res.status(deleted.status || 400).json({ ok: false, error: deleted.error });
      }
      if (secretKey === 'r2_access_key_id' || secretKey === 'r2_secret_access_key') {
        cachedAdminR2Config = null;
        cachedAdminR2At = 0;
      }
      const vaultStatus = await listVaultSecretsStatus(supabase);
      return res.status(200).json({ ok: true, vaultStatus });
    }

    if (action === 'rewrap_all_secrets') {
      const { email: adminEmail } = resolveAdminIdentity(adminSession);
      const result = await rewrapAllVaultSecrets(supabase, adminEmail);
      if (!result.ok) {
        return res.status(result.status || 400).json({ ok: false, error: result.error });
      }
      const vaultStatus = await listVaultSecretsStatus(supabase);
      return res.status(200).json({ ok: true, ...result, vaultStatus });
    }

    if (action === 'migrate_legacy_secrets') {
      const { email: adminEmail } = resolveAdminIdentity(adminSession);
      const migrated = [];

      const { data: legacyRows } = await supabase
        .from('swedpersiska_settings')
        .select('key, value')
        .in('key', ['r2_settings', 'cloudflare_deploy_settings']);

      for (const row of legacyRows || []) {
        const v = row?.value;
        if (!v || typeof v !== 'object') continue;

        if (row.key === 'r2_settings') {
          let r2Migrated = false;
          if (v.accessKeyId) {
            const r1 = await saveVaultSecret(supabase, 'r2_access_key_id', v.accessKeyId, adminEmail, { auditAction: 'migrate' });
            if (!r1.ok) return res.status(r1.status || 400).json({ ok: false, error: r1.error });
            migrated.push('r2_access_key_id');
            r2Migrated = true;
          }
          if (v.secretAccessKey) {
            const r2 = await saveVaultSecret(supabase, 'r2_secret_access_key', v.secretAccessKey, adminEmail, { auditAction: 'migrate' });
            if (!r2.ok) return res.status(r2.status || 400).json({ ok: false, error: r2.error });
            migrated.push('r2_secret_access_key');
            r2Migrated = true;
          }
          if (r2Migrated) {
            const cleanR2 = {
              enabled: Boolean(v.enabled),
              accountId: String(v.accountId || '').trim(),
              bucketName: String(v.bucketName || '').trim(),
              publicUrl: String(v.publicUrl || '').trim().replace(/\/+$/, ''),
            };
            await supabase
              .from('swedpersiska_settings')
              .upsert({ key: 'r2_settings', value: cleanR2, updated_at: new Date().toISOString() });
          }
        }

        if (row.key === 'cloudflare_deploy_settings' && v.apiToken) {
          const cfRes = await saveVaultSecret(supabase, 'cloudflare_api_token', v.apiToken, adminEmail, { auditAction: 'migrate' });
          if (!cfRes.ok) return res.status(cfRes.status || 400).json({ ok: false, error: cfRes.error });
          migrated.push('cloudflare_api_token');
          const cleanCf = {
            accountId: String(v.accountId || '').trim(),
            deployUrl: String(v.deployUrl || 'https://linksho-seller.vercel.app/api/cloudflare/deploy').trim(),
          };
          await supabase
            .from('swedpersiska_settings')
            .upsert({ key: 'cloudflare_deploy_settings', value: cleanCf, updated_at: new Date().toISOString() });
        }
      }

      cachedAdminR2Config = null;
      cachedAdminR2At = 0;
      const vaultStatus = await listVaultSecretsStatus(supabase);
      return res.status(200).json({ ok: true, migrated, vaultStatus });
    }

    if (action === 'test_stripe_connection') {
      const requestedMode = body.mode === 'live' ? 'live' : 'test';
      let resolved;
      try {
        resolved = await resolveStripeSecretKey(supabase, requestedMode, { fresh: true });
      } catch (err) {
        if (err instanceof SecretVaultDecryptionError) {
          return res.status(503).json({ ok: false, error: 'خطا در رمزگشایی کلید Stripe از خزانه امنیتی.' });
        }
        throw err;
      }
      const secretKey = String(resolved?.value || '').trim();
      if (!secretKey) {
        return res.status(400).json({
          ok: false,
          error: `کلید محرمانه Stripe برای حالت ${requestedMode === 'live' ? 'عملیاتی (Live)' : 'آزمایشی (Test)'} هنوز ذخیره نشده است.`,
        });
      }
      const expectPrefix = requestedMode === 'live' ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/;
      if (!expectPrefix.test(secretKey)) {
        return res.status(400).json({
          ok: false,
          error: `کلید فعلی با حالت ${requestedMode === 'live' ? 'Live' : 'Test'} همخوانی ندارد.`,
        });
      }

      const stripeRes = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const stripeJson = await stripeRes.json().catch(() => ({}));
      if (!stripeRes.ok) {
        return res.status(422).json({
          ok: false,
          error: stripeJson?.error?.message || 'کلید Stripe توسط سرور استرایپ رد شد.',
        });
      }
      return res.status(200).json({
        ok: true,
        livemode: Boolean(stripeJson.livemode),
        source: resolved.source,
        masked: resolved.masked,
      });
    }

    if (action === 'update_admin_credentials') {
      if (!HAS_SERVICE_ROLE) {
        return res.status(503).json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY روی سرور تنظیم نشده است.' });
      }
      const { email: currentEmail } = resolveAdminIdentity(adminSession);
      const currentPassword = String(body.currentPassword || '');
      const newEmail = String(body.newEmail || currentEmail).trim().toLowerCase();
      const newPassword = String(body.newPassword || '');

      if (!currentPassword) {
        return res.status(400).json({ ok: false, error: 'وارد کردن رمز عبور فعلی برای تایید هویت الزامی است.' });
      }
      if (!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail) || newEmail.length > 160) {
        return res.status(400).json({ ok: false, error: 'فرمت ایمیل جدید مدیر معتبر نیست.' });
      }
      if (newPassword && newPassword.length < 10) {
        return res.status(400).json({ ok: false, error: 'رمز عبور جدید باید حداقل ۱۰ کاراکتر باشد.' });
      }

      const { data: existingCred, error: selErr } = await supabase
        .from('admin_credentials')
        .select('email, password_hash, password_salt, token_version')
        .eq('email', currentEmail)
        .maybeSingle();

      if (selErr) {
        if (isVaultTableMissingError(selErr)) {
          return res.status(503).json({
            ok: false,
            error: 'جدول admin_credentials هنوز در Supabase ایجاد نشده است. ابتدا فایل SQL مهاجرت را اجرا کنید.',
          });
        }
        throw selErr;
      }

      if (existingCred) {
        if (!verifyAdminPassword(currentPassword, existingCred.password_hash, existingCred.password_salt)) {
          return res.status(403).json({ ok: false, error: 'رمز عبور فعلی اشتباه است.' });
        }
      } else {
        // Migrating from Vercel Env ADMIN_EMAIL / ADMIN_PASSWORD into DB
        const envPass = String(process.env.ADMIN_PASSWORD || '').trim();
        if (!envPass || !safeEqual(currentPassword.trim(), envPass)) {
          return res.status(403).json({ ok: false, error: 'رمز عبور فعلی اشتباه است.' });
        }
      }

      const effectivePass = newPassword || currentPassword;
      if (effectivePass.length < 10) {
        return res.status(400).json({
          ok: false,
          error: 'برای انتقال به دیتابیس امن، یک رمز عبور جدید با حداقل ۱۰ کاراکتر وارد کنید.',
        });
      }

      const hashed = hashAdminPassword(effectivePass);
      const nextVer = existingCred ? Number(existingCred.token_version || 1) + 1 : 1;
      const nowIso = new Date().toISOString();

      if (existingCred && newEmail !== currentEmail) {
        await supabase.from('admin_credentials').delete().eq('email', currentEmail);
      }

      const { error: upsertErr } = await supabase.from('admin_credentials').upsert(
        {
          email: newEmail,
          display_name: newEmail.split('@')[0] || 'Admin',
          password_hash: hashed.password_hash,
          password_salt: hashed.password_salt,
          hash_algorithm: hashed.hash_algorithm,
          token_version: nextVer,
          is_active: true,
          failed_attempts: 0,
          locked_until: null,
          last_login_at: nowIso,
          updated_by: currentEmail,
        },
        { onConflict: 'email' }
      );
      if (upsertErr) throw upsertErr;

      await rotateAdminJwtPepper(supabase, newEmail);
      invalidateAdminVersionCache();

      const freshToken = await createAdminTokenWithVault(newEmail, { tokenVersion: nextVer });
      return res.status(200).json({ ok: true, token: freshToken, email: newEmail });
    }

    if (action === 'logout_all_sessions') {
      const { email: currentEmail } = resolveAdminIdentity(adminSession);
      const rotRes = await rotateAdminJwtPepper(supabase, currentEmail);
      if (!rotRes.ok) {
        return res.status(rotRes.status || 503).json({ ok: false, error: rotRes.error });
      }
      let nextVer = Number(adminSession.ver || 1);
      const { data: cred } = await supabase
        .from('admin_credentials')
        .select('token_version')
        .eq('email', currentEmail)
        .maybeSingle();
      if (cred) {
        nextVer = Number(cred.token_version || 1) + 1;
        await supabase
          .from('admin_credentials')
          .update({ token_version: nextVer, updated_by: currentEmail })
          .eq('email', currentEmail);
      }
      invalidateAdminVersionCache();
      const freshToken = await createAdminTokenWithVault(currentEmail, { tokenVersion: nextVer });
      return res.status(200).json({
        ok: true,
        token: freshToken,
        pepperVersion: rotRes.pepperVersion,
      });
    }

    if (action === 'active_ads') {
      const page = Math.max(1, Number(body.page || (req.query && req.query.page)) || 1);
      const limit = Math.min(40, Math.max(10, Number(body.limit || (req.query && req.query.limit)) || PAGE_SIZE));
      const search = String(body.search || (req.query && req.query.search) || '').trim();
      const country = String(body.country || (req.query && req.query.country) || 'all');
      const category = String(body.category || (req.query && req.query.category) || 'all');
      const status = String(body.status || (req.query && req.query.status) || 'active');
      const vipOnly = Boolean(body.vipOnly || (req.query && req.query.vipOnly === 'true'));

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let q = supabase
        .from('swedpersiska_ads')
        .select(ADMIN_AD_COLUMNS, { count: 'exact' });

      if (status === 'deleted') {
        q = q.not('deleted_at', 'is', null);
      } else {
        q = q.is('deleted_at', null);
        if (status && status !== 'all') q = q.eq('status', status);
      }
      if (vipOnly) q = q.eq('is_featured', true);

      if (country && country !== 'all') q = q.eq('country', country);
      if (category && category !== 'all') q = q.eq('category', category);
      if (search) {
        const sanitized = search.slice(0, 100).replace(/[,()"'\\*%_]/g, ' ').replace(/\s+/g, ' ').trim();
        if (sanitized) {
          const term = `%${sanitized}%`;
          q = q.or(`title.ilike.${term},description.ilike.${term},city.ilike.${term},reference_number.ilike.${term},contact_name.ilike.${term}`);
        }
      }

      q = q
        .order('is_featured', { ascending: false })
        .order('sort_timestamp', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);

      const { data, count, error } = await q;
      if (error) throw error;
      const enriched = await attachAdminPins(data || []);
      const totalCount = count ?? 0;
      return res.status(200).json({ ok: true, ads: enriched, count: totalCount, page, limit, hasMore: to + 1 < totalCount });
    }

    if (!HAS_SERVICE_ROLE && ['toggle_featured', 'update_status', 'update_country', 'delete_ad', 'dismiss_report', 'save_settings', 'save_cleanup_settings', 'resolve_duplicate_review', 'run_cleanup_now', 'create_website_subscription', 'update_website_subscription', 'generate_website_invoice_link', 'delete_website_subscription', 'delete_seller_deployment', 'upload_branding_file', 'test_cloudflare_connection', 'duplicate_reviews', 'cleanup_overview'].includes(action)) {
      return res.status(503).json({
        ok: false,
        error: 'متغیر امنیتی SUPABASE_SERVICE_ROLE_KEY روی سرور ادمین (Vercel) تنظیم نشده است.',
      });
    }

    if (action === 'toggle_featured') {
      const { id, is_featured } = body;
      const enableVip = Boolean(is_featured);
      const [{ data: stripeRow }, { data: adRow }] = await Promise.all([
        supabase.from('swedpersiska_settings').select('value').eq('key', 'stripe_settings').maybeSingle(),
        supabase.from('swedpersiska_ads').select('country, last_meaningful_activity_at').eq('id', id).maybeSingle(),
      ]);
      const durationDays = Math.max(1, Math.min(365, Number(stripeRow?.value?.vipDurationDays) || 30));
      const nowIso = new Date().toISOString();
      const expiresAt = enableVip ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString() : null;

      const { error } = await supabase
        .from('swedpersiska_ads')
        .update({
          is_featured: enableVip,
          promotion_expires_at: expiresAt,
          ...(enableVip ? { last_meaningful_activity_at: nowIso, cleanup_warning_sent_at: null, scheduled_deletion_at: null } : {}),
          updated_at: nowIso,
        })
        .eq('id', id);
      if (error) throw error;

      if (enableVip) {
        await supabase.from('ad_payments').insert({
          ad_id: id,
          provider: 'admin_grant',
          provider_session_id: `admin_vip_${crypto.randomUUID()}`,
          status: 'paid',
          amount: 0,
          currency: 'SEK',
          target_country: adRow?.country || 'se',
          duration_days: durationDays,
          starts_at: nowIso,
          expires_at: expiresAt,
        });
      } else {
        await supabase
          .from('ad_payments')
          .update({ status: 'expired', updated_at: nowIso })
          .eq('ad_id', id)
          .eq('status', 'paid');
      }

      return res.status(200).json({ ok: true, promotion_expires_at: expiresAt });
    }

    if (action === 'update_status') {
      const { id, status } = body;
      if (!['active', 'pending', 'rejected'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status value' });
      }
      const nowIso = new Date().toISOString();
      const updatePayload = { status, updated_at: nowIso };
      if (status === 'active') {
        updatePayload.deleted_at = null;
        updatePayload.last_meaningful_activity_at = nowIso;
        updatePayload.sort_timestamp = nowIso;
        updatePayload.cleanup_warning_sent_at = null;
        updatePayload.scheduled_deletion_at = null;
      }
      const { data: activatedAd, error } = await supabase
        .from('swedpersiska_ads')
        .update(updatePayload)
        .eq('id', id)
        .select('id, reference_number, country, category')
        .maybeSingle();
      if (error) throw error;

      const postStatusTasks = [];
      if (status === 'active' && activatedAd) {
        const slug = encodeURIComponent(activatedAd.reference_number || activatedAd.id);
        const cId = encodeURIComponent(activatedAd.country || 'se');
        postStatusTasks.push(
          notifyIndexNow(
            [
              `${CANONICAL_ORIGIN}/?ad=${slug}`,
              `${CANONICAL_ORIGIN}/?c=${cId}`,
              activatedAd.category ? `${CANONICAL_ORIGIN}/?c=${cId}&cat=${encodeURIComponent(activatedAd.category)}` : '',
              `${CANONICAL_ORIGIN}/`,
            ].filter(Boolean),
            { origin: CANONICAL_ORIGIN, timeoutMs: 1200 }
          ).catch(() => {})
        );
      }

      if (status === 'active' || status === 'rejected') {
        postStatusTasks.push(
          supabase
            .from('ad_duplicate_reviews')
            .update({
              resolution: status === 'active' ? 'cleared_by_admin' : 'confirmed_duplicate',
              resolved_at: nowIso,
            })
            .eq('ad_id', id)
            .eq('resolution', 'pending')
        );
      }
      if (postStatusTasks.length > 0) {
        await Promise.all(postStatusTasks);
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'update_country') {
      const { id, country } = body;
      const { error } = await supabase.from('swedpersiska_ads').update({ country }).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete_ad') {
      const { id } = body;
      const { data: targetAd } = await supabase
        .from('swedpersiska_ads')
        .select('id, reference_number, title, title_fa, images')
        .eq('id', id)
        .maybeSingle();

      if (targetAd?.images?.length) {
        await deleteR2ObjectsForAdAdmin(targetAd.images, targetAd.id);
      }

      const { error } = await supabase.from('swedpersiska_ads').delete().eq('id', id);
      if (error) throw error;

      await Promise.all([
        targetAd
          ? supabase.from('ad_cleanup_logs').insert({
              ad_id: targetAd.id,
              ad_reference_number: targetAd.reference_number,
              ad_title: targetAd.title_fa || targetAd.title,
              action: 'permanently_deleted',
              reason: 'حذف دائمی توسط مدیریت',
            })
          : Promise.resolve(),
        (async () => {
          try {
            const { data: repRow } = await supabase
              .from('swedpersiska_settings')
              .select('value')
              .eq('key', 'ad_reports')
              .maybeSingle();
            if (Array.isArray(repRow?.value)) {
              const filtered = repRow.value.filter((r) => String(r.ad_id) !== String(id));
              await supabase.from('swedpersiska_settings').upsert({
                key: 'ad_reports',
                value: filtered,
                updated_at: new Date().toISOString(),
              });
            }
          } catch {}
        })(),
      ]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'dismiss_report') {
      const { reportId } = body;
      const nowIso = new Date().toISOString();
      try {
        const { data: dismissed } = await supabase
          .from('ad_reports')
          .update({ status: 'dismissed', resolved_at: nowIso })
          .eq('id', reportId)
          .select('ad_id')
          .maybeSingle();

        if (dismissed?.ad_id) {
          const { count: remainingOpen } = await supabase
            .from('ad_reports')
            .select('id', { count: 'exact', head: true })
            .eq('ad_id', dismissed.ad_id)
            .eq('status', 'open');
          if ((remainingOpen || 0) === 0) {
            await supabase.from('swedpersiska_ads').update({ is_disputed: false }).eq('id', dismissed.ad_id);
          }
        }
      } catch {}

      const { data: repRow } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'ad_reports')
        .maybeSingle();
      const currentList = Array.isArray(repRow?.value) ? repRow.value : [];
      const nextList = currentList.filter((r) => String(r.id) !== String(reportId));
      const { error } = await supabase.from('swedpersiska_settings').upsert({
        key: 'ad_reports',
        value: nextList,
        updated_at: nowIso
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'upload_branding_file') {
      const contentType = String(body.contentType || '').toLowerCase();
      const fileBase64 = String(body.fileBase64 || '');
      const ext = BRANDING_MIME_TYPES[contentType];
      if (!ext) {
        return res.status(400).json({ ok: false, error: 'فرمت فایل مجاز نیست (PNG, JPG, WebP, AVIF, SVG, ICO).' });
      }
      const buf = Buffer.from(fileBase64, 'base64');
      if (!buf.length || buf.length > MAX_BRANDING_BYTES) {
        return res.status(400).json({ ok: false, error: 'حداکثر حجم هر تصویر ۱ مگابایت است.' });
      }

      if (ext === 'svg') {
        const svgText = buf.toString('utf8');
        if (
          !/<svg[\s>]/i.test(svgText) ||
          /<script[\s>]|<foreignObject[\s>]|<iframe[\s>]|<object[\s>]|<embed[\s>]|\bon[a-z]+\s*=|javascript:|data:text\/html/i.test(svgText)
        ) {
          return res.status(400).json({ ok: false, error: 'فایل SVG حاوی تگ یا اسکریپت غیرمجاز است.' });
        }
      }

      const r2 = await resolveAdminR2Config();

      if (!r2 || !r2.configured) {
        return res.status(400).json({ ok: false, error: 'فضای ابری Cloudflare R2 در تنظیمات فعال نشده یا کلیدهای دسترسی آن هنوز ثبت نشده‌اند.' });
      }

      const kind = String(body.kind || 'logo').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'logo';
      const objectKey = `branding/${kind}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      const brandingCacheControl = 'public, max-age=31536000, immutable';
      const uploadUrl = createR2PresignedPutUrl({
        accountId: r2.accountId,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        bucketName: r2.bucketName,
        objectKey,
        contentType,
        contentLength: buf.length,
        cacheControl: brandingCacheControl,
      });

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'Cache-Control': brandingCacheControl,
        },
        body: buf,
      });

      if (!putRes.ok) {
        const errText = await putRes.text().catch(() => '');
        return res.status(502).json({ ok: false, error: `خطا در آپلود به R2 (${putRes.status}): ${errText.slice(0, 120)}` });
      }

      return res.status(200).json({
        ok: true,
        publicUrl: `${r2.publicUrl}/${objectKey}`,
      });
    }

    if (action === 'save_cleanup_settings') {
      const candidate =
        body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)
          ? body.settings
          : {
              enabled: body.enabled,
              inactivityDays: body.inactivityDays,
              warningDays: body.warningDays,
              softDeleteRetentionDays: body.softDeleteRetentionDays,
              freeBoostCooldownDays: body.freeBoostCooldownDays,
              duplicateBlockThresholdSameOwner: body.duplicateBlockThresholdSameOwner,
              duplicateBlockThresholdOtherOwner: body.duplicateBlockThresholdOtherOwner,
              duplicateReviewThresholdSameOwner: body.duplicateReviewThresholdSameOwner,
            };
      const result = await saveAndAuditCleanupSettings(candidate, adminSession);
      return res.status(result.status).json(result.body);
    }

    if (action === 'save_settings') {
      const { key, value } = body;
      const allowedKeys = ['site_branding', 'seo_settings', 'portal_categories', 'portal_cities', 'portal_countries', 'stripe_settings', 'turnstile_settings', 'analytics_settings', 'google_maps_settings', 'r2_settings', 'podcast_settings', 'seller_deployments', 'cloudflare_deploy_settings', 'ad_lifecycle_settings'];
      if (!allowedKeys.includes(key)) {
        return res.status(400).json({ ok: false, error: 'Invalid settings key' });
      }
      if (key === 'ad_lifecycle_settings') {
        const result = await saveAndAuditCleanupSettings(value, adminSession);
        return res.status(result.status).json(result.body);
      }
      let nextValue = value;
      const { email: adminEmail } = resolveAdminIdentity(adminSession);
      if (key === 'turnstile_settings' && value && typeof value === 'object' && !Array.isArray(value)) {
        const incomingSecret = String(value.secretKey || '').trim();
        if (incomingSecret) {
          const savedTs = await saveVaultSecret(supabase, 'turnstile_secret_key', incomingSecret, adminEmail);
          if (!savedTs.ok) {
            return res.status(savedTs.status || 400).json({ ok: false, error: savedTs.error });
          }
        }
        const targetMode = value.mode === 'live' ? 'live' : 'test';
        if (targetMode === 'live' && value.enabled !== false) {
          const tsSec = await getVaultSecret(supabase, 'turnstile_secret_key', { fresh: true }).catch(() => null);
          if (!tsSec?.value) {
            return res.status(400).json({
              ok: false,
              error: 'برای فعال‌سازی حالت واقعی (Live) کلودفلر Turnstile، ابتدا Secret Key را وارد و در خزانه ذخیره کنید.',
            });
          }
        }
        nextValue = {
          enabled: value.enabled !== false,
          mode: targetMode,
          siteKey: String(value.siteKey || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').slice(0, 64),
          protectAdminLogin: value.protectAdminLogin !== false,
          protectPostAd: value.protectPostAd !== false,
        };
      } else if (key === 'r2_settings') {
        cachedAdminR2Config = null;
        cachedAdminR2At = 0;
      } else if (key === 'stripe_settings') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return res.status(400).json({ ok: false, error: 'فرمت تنظیمات درگاه پرداخت نامعتبر است.' });
        }
        const modeVal = value.mode === 'live' ? 'live' : value.mode === 'test' ? 'test' : '';
        if (!modeVal) {
          return res.status(400).json({ ok: false, error: 'حالت درگاه پرداخت فقط می‌تواند test یا live باشد.' });
        }
        const vipPriceNum = Number(value.vipPrice);
        if (!Number.isFinite(vipPriceNum) || vipPriceNum < 1 || vipPriceNum > 100000) {
          return res.status(400).json({ ok: false, error: 'مبلغ تعرفه ویژه باید عددی معتبر بین ۱ تا ۱۰۰٬۰۰۰ باشد.' });
        }
        const currencyVal = String(value.currency || 'SEK').trim().toUpperCase();
        if (!['SEK', 'NOK', 'DKK', 'EUR'].includes(currencyVal)) {
          return res.status(400).json({ ok: false, error: 'واحد پول باید یکی از SEK، NOK، DKK یا EUR باشد.' });
        }
        const durationNum = Number(value.vipDurationDays);
        if (!Number.isInteger(durationNum) || durationNum < 1 || durationNum > 365) {
          return res.status(400).json({ ok: false, error: 'مدت اعتبار ویژه باید عدد صحیح بین ۱ تا ۳۶۵ روز باشد.' });
        }
        const pubKeyVal = String(value.publishableKey || '').trim();
        if (pubKeyVal && !/^pk_(live|test)_[A-Za-z0-9]{12,}$/.test(pubKeyVal)) {
          return res.status(400).json({ ok: false, error: 'فرمت کلید عمومی Stripe (pk_live_... یا pk_test_...) نامعتبر است.' });
        }
        if (pubKeyVal && modeVal === 'live' && !pubKeyVal.startsWith('pk_live_')) {
          return res.status(400).json({ ok: false, error: 'در حالت عملیاتی (live) کلید عمومی باید با pk_live_ شروع شود.' });
        }
        if (pubKeyVal && modeVal === 'test' && !pubKeyVal.startsWith('pk_test_')) {
          return res.status(400).json({ ok: false, error: 'در حالت آزمایشی (test) کلید عمومی باید با pk_test_ شروع شود.' });
        }
        nextValue = {
          enabled: Boolean(value.enabled),
          mode: modeVal,
          publishableKey: pubKeyVal,
          vipPrice: Math.round(vipPriceNum * 100) / 100,
          currency: currencyVal,
          vipDurationDays: durationNum,
          vipBadgeText: String(value.vipBadgeText || 'ویژه (VIP)').trim().slice(0, 40) || 'ویژه (VIP)',
        };
      } else if (key === 'google_maps_settings') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return res.status(400).json({ ok: false, error: 'فرمت تنظیمات نقشه گوگل نامعتبر است.' });
        }
        const cleanEmbedKey = String(value.embedApiKey || '')
          .replace(/[\p{Cc}\s\u200B-\u200D\uFEFF]/gu, '')
          .trim();
        if (cleanEmbedKey && !/^AIza[0-9A-Za-z_-]{20,60}$/.test(cleanEmbedKey)) {
          return res.status(400).json({
            ok: false,
            error: 'فرمت کلید Google Maps Embed API نامعتبر است (باید با AIza شروع شود یا برای حالت رایگان بدون کلید خالی گذاشته شود).',
          });
        }
        const rawZoom =
          value.defaultZoom === undefined || value.defaultZoom === null || value.defaultZoom === ''
            ? 14
            : Number(value.defaultZoom);
        if (!Number.isInteger(rawZoom) || rawZoom < 1 || rawZoom > 20) {
          return res.status(400).json({
            ok: false,
            error: 'سطح بزرگ‌نمایی پیش‌فرض نقشه باید عدد صحیح بین ۱ تا ۲۰ باشد.',
          });
        }
        nextValue = {
          enabled: value.enabled !== false,
          embedApiKey: cleanEmbedKey,
          defaultZoom: rawZoom,
        };
      }
      if (key === 'cloudflare_deploy_settings' && value && typeof value === 'object') {
        const incomingToken = String(value.apiToken || '').trim();
        let savedToVault = false;
        if (incomingToken) {
          const cfSave = await saveVaultSecret(supabase, 'cloudflare_api_token', incomingToken, adminEmail);
          if (!cfSave.ok) {
            return res.status(cfSave.status || 400).json({ ok: false, error: cfSave.error });
          }
          savedToVault = true;
        }
        // Check if vault already has the token so we can stop retaining plaintext in swedpersiska_settings
        const existingVaultCf = savedToVault
          ? { value: 'ok' }
          : await getVaultSecret(supabase, 'cloudflare_api_token', { allowEnvFallback: false }).catch(() => null);
        const { data: existingCf } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'cloudflare_deploy_settings')
          .maybeSingle();
        const prevCf = (existingCf && existingCf.value) || {};
        nextValue = {
          accountId: String(value.accountId || '').trim(),
          deployUrl: String(value.deployUrl || 'https://linksho-seller.vercel.app/api/cloudflare/deploy').trim(),
          ...(existingVaultCf?.value ? {} : prevCf.apiToken ? { apiToken: prevCf.apiToken } : {}),
        };
      }
      if (key === 'r2_settings' && value && typeof value === 'object') {
        const incomingAccessKey = String(value.accessKeyId || '').trim();
        const incomingSecretKey = String(value.secretAccessKey || '').trim();

        if (incomingAccessKey) {
          const r1 = await saveVaultSecret(supabase, 'r2_access_key_id', incomingAccessKey, adminEmail);
          if (!r1.ok) {
            return res.status(r1.status || 400).json({ ok: false, error: r1.error });
          }
        }
        if (incomingSecretKey) {
          const r2 = await saveVaultSecret(supabase, 'r2_secret_access_key', incomingSecretKey, adminEmail);
          if (!r2.ok) {
            return res.status(r2.status || 400).json({ ok: false, error: r2.error });
          }
        }

        const [vaultAk, vaultSk] = await Promise.all([
          getVaultSecret(supabase, 'r2_access_key_id', { fresh: true, allowEnvFallback: false }).catch(() => null),
          getVaultSecret(supabase, 'r2_secret_access_key', { fresh: true, allowEnvFallback: false }).catch(() => null),
        ]);

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'r2_settings')
          .maybeSingle();
        const prev = (existingRow && existingRow.value) || {};

        // Never write plaintext keys into swedpersiska_settings once stored in encrypted vault
        nextValue = {
          enabled: Boolean(value.enabled),
          accountId: String(value.accountId || '').trim(),
          bucketName: String(value.bucketName || '').trim(),
          publicUrl: String(value.publicUrl || '').trim().replace(/\/+$/, ''),
          ...(vaultAk?.value ? {} : prev.accessKeyId ? { accessKeyId: prev.accessKeyId } : {}),
          ...(vaultSk?.value ? {} : prev.secretAccessKey ? { secretAccessKey: prev.secretAccessKey } : {}),
        };
        cachedAdminR2Config = null;
        cachedAdminR2At = 0;
        invalidateSecretVaultCache();
      }
      const { error } = await supabase.from('swedpersiska_settings').upsert({
        key,
        value: nextValue,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      const vaultStatus = ['turnstile_settings', 'stripe_settings', 'r2_settings', 'cloudflare_deploy_settings'].includes(key)
        ? await listVaultSecretsStatus(supabase)
        : undefined;
      return res.status(200).json({ ok: true, ...(vaultStatus ? { vaultStatus } : {}) });
    }

    if (action === 'test_cloudflare_connection') {
      let cfCfg = { apiToken: '', accountId: '' };
      try {
        cfCfg = await resolveCloudflareDeployConfig(supabase, { fresh: true });
      } catch (e) {
        console.warn('[admin] resolveCloudflareDeployConfig caught error:', e?.message);
      }
      const cfToken = String(body.apiToken || cfCfg?.apiToken || '').trim();
      if (!cfToken) {
        return res.status(400).json({ ok: false, error: 'ابتدا توکن کلودفلر را وارد و ذخیره کنید.' });
      }

      // 1. Verify token directly (works even without Account Settings:Read permission)
      const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || verifyJson.success === false) {
        return res.status(422).json({
          ok: false,
          error: verifyJson?.errors?.[0]?.message || 'توکن کلودفلر نامعتبر یا منقضی شده است.',
        });
      }

      let accountId = String(body.accountId || cfCfg.accountId || '').trim();
      let accountName = '';

      if (!accountId) {
        const accRes = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=5', {
          headers: { Authorization: `Bearer ${cfToken}` },
        });
        const accJson = await accRes.json().catch(() => ({}));
        if (accRes.ok && Array.isArray(accJson?.result) && accJson.result.length > 0) {
          accountId = accJson.result[0].id;
          accountName = accJson.result[0].name || accountId;
        }
      }

      if (!accountId) {
        return res.status(200).json({
          ok: true,
          needsAccountId: true,
          accountId: '',
          accountName: 'توکن معتبر است (شناسه Account ID را وارد کنید)',
          subdomain: '',
        });
      }
      if (!/^[a-f0-9]{32}$/i.test(accountId)) {
        return res.status(400).json({ ok: false, error: 'فرمت Account ID کلودفلر معتبر نیست.' });
      }

      const subRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      const subJson = await subRes.json().catch(() => ({}));
      return res.status(200).json({
        ok: true,
        needsAccountId: false,
        accountId,
        accountName: accountName || accountId,
        subdomain: subJson?.result?.subdomain || '',
      });
    }

    if (action === 'delete_seller_deployment') {
      const workerName = String(body.workerName || '').trim();
      const dbId = String(body.dbId || '').trim();
      if (!workerName) {
        return res.status(400).json({ ok: false, error: 'Missing workerName' });
      }

      const cfCfg = await resolveCloudflareDeployConfig(supabase);
      const cfToken = cfCfg.apiToken;
      let accountId = cfCfg.accountId;

      if (cfToken) {
        if (!accountId) {
          const accRes = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=5', {
            headers: { Authorization: `Bearer ${cfToken}` },
          });
          const accJson = await accRes.json().catch(() => ({}));
          accountId = accJson?.result?.[0]?.id || '';
        }
        if (accountId && /^[a-f0-9]{32}$/i.test(accountId)) {
          await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(workerName)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${cfToken}` },
          }).catch(() => {});
          if (dbId) {
            await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${encodeURIComponent(dbId)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${cfToken}` },
            }).catch(() => {});
          }
        }
      }

      const { data: depRow } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'seller_deployments')
        .maybeSingle();
      const prevList = Array.isArray(depRow?.value) ? depRow.value : [];
      const nextList = prevList.filter((x) => x.workerName !== workerName);
      const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: new Date().toISOString(),
      });
      if (upsertErr) throw upsertErr;

      return res.status(200).json({ ok: true, seller_deployments: nextList });
    }

    if (action === 'create_website_subscription') {
      const name = String(body.name || '').trim().slice(0, 120);
      if (name.length < 2) {
        return res.status(400).json({ ok: false, error: 'نام مشتری یا فروشگاه الزامی است.' });
      }

      const sanitizeUrl = (val) => {
        const s = String(val || '').trim().slice(0, 400);
        if (!s) return '';
        try {
          const u = new URL(s.startsWith('http') ? s : `https://${s}`);
          if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
        } catch {}
        return '';
      };

      const { data: depRow } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'seller_deployments')
        .maybeSingle();
      const prevList = Array.isArray(depRow?.value) ? depRow.value : [];
      const usedCodes = new Set(prevList.map((x) => String(x?.manageCode || '')));
      let manageCode = String(crypto.randomInt(10000000, 100000000));
      for (let i = 0; i < 20 && usedCodes.has(manageCode); i++) {
        manageCode = String(crypto.randomInt(10000000, 100000000));
      }

      const orderId = `WEB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const createdAt = new Date().toISOString();
      let expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (body.expiresAt) {
        const parsedExp = new Date(body.expiresAt);
        if (!Number.isNaN(parsedExp.getTime())) expiresAt = parsedExp.toISOString();
      }

      const newSub = {
        storeId: orderId,
        manageCode,
        workerName: `sub_${orderId.toLowerCase()}`,
        dbId: '',
        name,
        phone: String(body.phone || '').trim().slice(0, 40),
        companyNumber: String(body.companyNumber || '').trim().slice(0, 60),
        email: String(body.email || '').trim().slice(0, 120),
        websiteUrl: sanitizeUrl(body.websiteUrl),
        panelUrl: sanitizeUrl(body.panelUrl),
        storefrontApiUrl: '',
        panelUsername: String(body.panelUsername || '').trim().slice(0, 120),
        panelPassword: String(body.panelPassword || '').trim().slice(0, 120),
        domainInfo: String(body.domainInfo || '').trim().slice(0, 500),
        telegramBotInfo: String(body.telegramBotInfo || '').trim().slice(0, 300),
        stripeInvoiceLink: sanitizeUrl(body.stripeInvoiceLink),
        adminNotes: String(body.adminNotes || '').trim().slice(0, 1500),
        invoiceSentAt: '',
        status: ['pending_setup', 'active', 'cancelled'].includes(body.status) ? body.status : 'active',
        paymentStatus: 'manual_crm',
        setupPrice: 1500,
        monthlyPrice: 260,
        expiresAt,
        createdAt,
        updatedAt: createdAt,
      };

      const nextList = [newSub, ...prevList].slice(0, 500);
      const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: createdAt,
      });
      if (upsertErr) throw upsertErr;

      return res.status(200).json({ ok: true, seller_deployments: nextList, subscription: newSub });
    }

    if (action === 'update_website_subscription') {
      const storeId = String(body.storeId || '').trim();
      const workerName = String(body.workerName || '').trim();
      if (!storeId && !workerName) {
        return res.status(400).json({ ok: false, error: 'شناسه اشتراک الزامی است.' });
      }

      const { data: depRow } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'seller_deployments')
        .maybeSingle();
      const prevList = Array.isArray(depRow?.value) ? depRow.value : [];
      const idx = prevList.findIndex(
        (x) => (storeId && x.storeId === storeId) || (workerName && x.workerName === workerName)
      );
      if (idx === -1) {
        return res.status(404).json({ ok: false, error: 'اشتراک یافت نشد.' });
      }

      const current = prevList[idx];
      const next = { ...current };

      if (typeof body.status === 'string' && ['pending_setup', 'active', 'cancelled'].includes(body.status)) {
        next.status = body.status;
      }

      const sanitizeUrl = (val) => {
        const s = String(val || '').trim().slice(0, 400);
        if (!s) return '';
        try {
          const u = new URL(s.startsWith('http') ? s : `https://${s}`);
          if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
        } catch {}
        return '';
      };

      if (body.name !== undefined && String(body.name).trim()) next.name = String(body.name).trim().slice(0, 120);
      if (body.phone !== undefined) next.phone = String(body.phone || '').trim().slice(0, 40);
      if (body.companyNumber !== undefined) next.companyNumber = String(body.companyNumber || '').trim().slice(0, 60);
      if (body.email !== undefined) next.email = String(body.email || '').trim().slice(0, 120);
      if (body.websiteUrl !== undefined) next.websiteUrl = sanitizeUrl(body.websiteUrl);
      if (body.panelUrl !== undefined) next.panelUrl = sanitizeUrl(body.panelUrl);
      if (body.panelUsername !== undefined) next.panelUsername = String(body.panelUsername || '').trim().slice(0, 120);
      if (body.panelPassword !== undefined) next.panelPassword = String(body.panelPassword || '').trim().slice(0, 120);
      if (body.domainInfo !== undefined) next.domainInfo = String(body.domainInfo || '').trim().slice(0, 500);
      if (body.telegramBotInfo !== undefined) next.telegramBotInfo = String(body.telegramBotInfo || '').trim().slice(0, 300);
      if (body.stripeInvoiceLink !== undefined) next.stripeInvoiceLink = sanitizeUrl(body.stripeInvoiceLink);
      if (body.adminNotes !== undefined) next.adminNotes = String(body.adminNotes || '').trim().slice(0, 1500);
      if (body.markInvoiceSent) next.invoiceSentAt = new Date().toISOString();

      if (body.expiresAt !== undefined && body.expiresAt) {
        const parsedExp = new Date(body.expiresAt);
        if (!Number.isNaN(parsedExp.getTime())) next.expiresAt = parsedExp.toISOString();
      }

      const extendDays = Number(body.extendDays || 0);
      if (extendDays > 0 && extendDays <= 365) {
        const baseTime = current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()
          ? new Date(current.expiresAt).getTime()
          : Date.now();
        next.expiresAt = new Date(baseTime + extendDays * 24 * 60 * 60 * 1000).toISOString();
        next.renewRequestedAt = '';
        next.invoiceSentAt = '';
        if (next.status === 'cancelled') next.status = 'active';
      }

      next.updatedAt = new Date().toISOString();
      const nextList = prevList.map((item, i) => (i === idx ? next : item));
      const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: new Date().toISOString(),
      });
      if (upsertErr) throw upsertErr;

      return res.status(200).json({ ok: true, seller_deployments: nextList, subscription: next });
    }

    if (action === 'generate_website_invoice_link') {
      const storeId = String(body.storeId || '').trim();
      const workerName = String(body.workerName || '').trim();
      if (!storeId && !workerName) {
        return res.status(400).json({ ok: false, error: 'شناسه اشتراک الزامی است.' });
      }

      const { data: depRow } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'seller_deployments')
        .maybeSingle();
      const prevList = Array.isArray(depRow?.value) ? depRow.value : [];
      const idx = prevList.findIndex(
        (x) => (storeId && x.storeId === storeId) || (workerName && x.workerName === workerName)
      );
      if (idx === -1) {
        return res.status(404).json({ ok: false, error: 'اشتراک یافت نشد.' });
      }

      const current = prevList[idx];
      const { data: stripeSettingRow } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'stripe_settings')
        .maybeSingle();
      const activeStripeMode = stripeSettingRow?.value?.mode === 'live' ? 'live' : 'test';
      const resolvedStripeSec = await resolveStripeSecretKey(supabase, activeStripeMode, { fresh: true });
      const secretKey = String(resolvedStripeSec?.value || '').trim();
      let invoiceUrl = current.stripeInvoiceLink || `${CANONICAL_ORIGIN}/?page=website-builder`;
      let isStripeLive = false;

      if (secretKey) {
        const isLiveSecret = /^sk_live_|^rk_live_/.test(secretKey);
        const isTestSecret = /^sk_test_|^rk_test_/.test(secretKey);
        if (!isLiveSecret && !isTestSecret) {
          return res.status(503).json({ ok: false, error: 'فرمت کلید امنیتی STRIPE_SECRET_KEY نامعتبر است.' });
        }
        const params = new URLSearchParams();
        params.set('mode', 'payment');
        params.set('expires_at', String(Math.floor(Date.now() / 1000) + 3600));
        params.set('success_url', `${CANONICAL_ORIGIN}/?page=website-builder&renew_session_id={CHECKOUT_SESSION_ID}`);
        params.set('cancel_url', `${CANONICAL_ORIGIN}/?page=website-builder&cancelled=1`);
        if (current.email) params.set('customer_email', current.email);
        params.set('line_items[0][price_data][currency]', 'sek');
        params.set('line_items[0][price_data][unit_amount]', '26000');
        params.set('line_items[0][price_data][product_data][name]', `تمدید ماهانه اشتراک وب‌سایت (${current.name})`);
        params.set('line_items[0][quantity]', '1');
        params.set('metadata[type]', 'website_builder_renew');
        params.set('metadata[manageCode]', String(current.manageCode || ''));

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        const stripeJson = await stripeRes.json().catch(() => ({}));
        if (!stripeRes.ok || !stripeJson?.url) {
          return res.status(502).json({
            ok: false,
            error: stripeJson?.error?.message || 'خطا در تولید خودکار لینک پرداخت Stripe',
          });
        }
        invoiceUrl = stripeJson.url;
        isStripeLive = Boolean(isLiveSecret && stripeJson.livemode === true);
      }

      const nowIso = new Date().toISOString();
      const next = {
        ...current,
        stripeInvoiceLink: invoiceUrl,
        invoiceSentAt: nowIso,
        updatedAt: nowIso,
      };
      const nextList = prevList.map((item, i) => (i === idx ? next : item));
      const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: nowIso,
      });
      if (upsertErr) throw upsertErr;

      return res.status(200).json({
        ok: true,
        invoiceUrl,
        isStripeLive,
        seller_deployments: nextList,
        subscription: next,
      });
    }

    if (action === 'delete_website_subscription') {
      const storeId = String(body.storeId || '').trim();
      const workerName = String(body.workerName || '').trim();
      if (!storeId && !workerName) {
        return res.status(400).json({ ok: false, error: 'شناسه اشتراک الزامی است.' });
      }

      const { data: depRow } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'seller_deployments')
        .maybeSingle();
      const prevList = Array.isArray(depRow?.value) ? depRow.value : [];
      const nextList = prevList.filter(
        (x) => !((storeId && x.storeId === storeId) || (workerName && x.workerName === workerName))
      );

      const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: new Date().toISOString(),
      });
      if (upsertErr) throw upsertErr;

      return res.status(200).json({ ok: true, seller_deployments: nextList });
    }

    if (action === 'duplicate_reviews') {
      const filter = String(body.filter || 'pending').trim();
      let q = supabase
        .from('ad_duplicate_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (filter && filter !== 'all') {
        q = q.eq('resolution', filter);
      }
      const { data: reviews, error } = await q;
      if (error) throw error;

      const adIds = Array.from(
        new Set((reviews || []).flatMap((r) => [r.ad_id, r.matched_ad_id]).filter(Boolean))
      );
      let adMap = new Map();
      if (adIds.length > 0) {
        const { data: adRows } = await supabase
          .from('swedpersiska_ads')
          .select('id, reference_number, title, title_fa, city, country, category, price, price_type, status, description, created_at')
          .in('id', adIds);
        adMap = new Map((adRows || []).map((a) => [a.id, a]));
      }

      const enriched = (reviews || []).map((r) => ({
        ...r,
        ad: adMap.get(r.ad_id) || null,
        matched_ad: adMap.get(r.matched_ad_id) || null,
      }));
      return res.status(200).json({ ok: true, reviews: enriched });
    }

    if (action === 'resolve_duplicate_review') {
      const { reviewId, decision, notes } = body;
      if (!reviewId || !['cleared_by_admin', 'confirmed_duplicate'].includes(decision)) {
        return res.status(400).json({ ok: false, error: 'شناسه یا نوع تصمیم نامعتبر است.' });
      }
      const nowIso = new Date().toISOString();
      const { data: review, error: revErr } = await supabase
        .from('ad_duplicate_reviews')
        .update({
          resolution: decision,
          reviewer_notes: notes ? String(notes).slice(0, 500) : null,
          resolved_at: nowIso,
        })
        .eq('id', reviewId)
        .select('*')
        .single();
      if (revErr) throw revErr;

      const { data: adRow } = await supabase
        .from('swedpersiska_ads')
        .select('id, reference_number, title, title_fa, contact_email, country, category')
        .eq('id', review.ad_id)
        .maybeSingle();

      if (decision === 'cleared_by_admin') {
        const tasks = [
          supabase
            .from('swedpersiska_ads')
            .update({
              duplicate_detection_status: 'cleared_by_admin',
              status: 'active',
              deleted_at: null,
              last_meaningful_activity_at: nowIso,
              sort_timestamp: nowIso,
              cleanup_warning_sent_at: null,
              scheduled_deletion_at: null,
              updated_at: nowIso,
            })
            .eq('id', review.ad_id),
        ];

        if (adRow) {
          const slug = encodeURIComponent(adRow.reference_number || adRow.id);
          const cId = encodeURIComponent(adRow.country || 'se');
          tasks.push(
            notifyIndexNow(
              [
                `${CANONICAL_ORIGIN}/?ad=${slug}`,
                `${CANONICAL_ORIGIN}/?c=${cId}`,
                `${CANONICAL_ORIGIN}/`,
              ],
              { origin: CANONICAL_ORIGIN, timeoutMs: 1200 }
            ).catch(() => {}),
            supabase.from('ad_notifications').insert({
              ad_id: adRow.id,
              ad_reference_number: adRow.reference_number,
              recipient_email: adRow.contact_email,
              notification_type: 'duplicate_cleared',
              title: 'آگهی شما تایید و منتشر شد',
              message: `بررسی مدیریت تایید کرد که آگهی «${adRow.title_fa || adRow.title}» (${adRow.reference_number}) تکراری نیست و اکنون در سایت منتشر شده است.`,
            })
          );
        }
        await Promise.all(tasks);
      } else {
        await supabase
          .from('swedpersiska_ads')
          .update({
            duplicate_detection_status: 'confirmed_duplicate',
            status: 'rejected',
            updated_at: nowIso,
          })
          .eq('id', review.ad_id);

        if (adRow) {
          await supabase.from('ad_notifications').insert({
            ad_id: adRow.id,
            ad_reference_number: adRow.reference_number,
            recipient_email: adRow.contact_email,
            notification_type: 'duplicate_rejected',
            title: 'آگهی به دلیل تکرار رد شد',
            message: `آگهی «${adRow.title_fa || adRow.title}» (${adRow.reference_number}) پس از بررسی به دلیل تشابه بالا با آگهی قبلی رد شد. لطفاً از قابلیت بوست رایگان آگهی قبلی استفاده کنید.`,
          });
        }
      }

      return res.status(200).json({ ok: true, review });
    }

    if (action === 'ping_indexnow') {
      const { data: recentAds } = await supabase
        .from('swedpersiska_ads')
        .select('id, reference_number, country, category')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('sort_timestamp', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      const baseCountries = ['se', 'no', 'dk', 'fi', 'de', 'at', 'nl', 'fr'];
      const targetUrls = [
        `${CANONICAL_ORIGIN}/`,
        `${CANONICAL_ORIGIN}/?page=podcast`,
        `${CANONICAL_ORIGIN}/?page=website-builder`,
        ...baseCountries.map((c) => `${CANONICAL_ORIGIN}/?c=${c}`),
        ...(recentAds || []).map(
          (ad) => `${CANONICAL_ORIGIN}/?ad=${encodeURIComponent(ad.reference_number || ad.id)}`
        ),
      ];

      const pushRes = await notifyIndexNow(targetUrls, { origin: CANONICAL_ORIGIN });
      return res.status(200).json({
        ok: pushRes.ok,
        submittedCount: pushRes.submittedCount,
        httpStatus: pushRes.status,
        keyLocation: pushRes.keyLocation,
        key: getIndexNowKey(),
        urlsSample: targetUrls.slice(0, 10),
        message: pushRes.ok
          ? `${pushRes.submittedCount} آدرس فعال به شبکه IndexNow (Bing / Yandex / موتورهای هوش مصنوعی) ارسال شد.`
          : `ارسال IndexNow با کد ${pushRes.status || 'نامشخص'} انجام شد (${pushRes.error || 'بررسی وضعیت کلید'}).`,
      });
    }

    if (action === 'cleanup_overview') {
      const [settingsRes, runsRes, logsRes, summaryRpcRes, auditRes] = await Promise.all([
        supabase.from('swedpersiska_settings').select('value').eq('key', 'ad_lifecycle_settings').maybeSingle(),
        supabase.from('ad_cleanup_runs').select('*').order('started_at', { ascending: false }).limit(20),
        supabase.from('ad_cleanup_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.rpc('get_ad_cleanup_summary'),
        supabase.from('ad_cleanup_settings_audit').select('*').order('changed_at', { ascending: false }).limit(20),
      ]);

      let summary;
      if (!summaryRpcRes.error && summaryRpcRes.data) {
        summary = {
          warnedAds: Number(summaryRpcRes.data.warned_ads || 0),
          softDeletedAds: Number(summaryRpcRes.data.soft_deleted_ads || 0),
          permanentlyDeletedAds: Number(summaryRpcRes.data.permanently_deleted_ads || 0),
          protectedVipAds: Number(summaryRpcRes.data.protected_vip_ads || 0),
          protectedTotalAds: Number(summaryRpcRes.data.protected_total_ads || 0),
        };
      } else {
        const [warnedRes, softDeletedRes, permDeletedRes, vipRes] = await Promise.all([
          supabase.from('swedpersiska_ads').select('id', { count: 'exact', head: true }).not('cleanup_warning_sent_at', 'is', null).is('deleted_at', null),
          supabase.from('swedpersiska_ads').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
          supabase.from('ad_cleanup_logs').select('id', { count: 'exact', head: true }).eq('action', 'permanently_deleted'),
          supabase.from('swedpersiska_ads').select('id', { count: 'exact', head: true }).eq('is_featured', true).is('deleted_at', null),
        ]);
        summary = {
          warnedAds: warnedRes.count || 0,
          softDeletedAds: softDeletedRes.count || 0,
          permanentlyDeletedAds: permDeletedRes.count || 0,
          protectedVipAds: vipRes.count || 0,
          protectedTotalAds: vipRes.count || 0,
        };
      }

      return res.status(200).json({
        ok: true,
        settings: settingsRes.data?.value || DEFAULT_CLEANUP_SETTINGS,
        runs: runsRes.data || [],
        logs: logsRes.data || [],
        settingsAudit: auditRes.data || [],
        summary,
      });
    }

    if (action === 'run_cleanup_now') {
      const dryRun = Boolean(body.dryRun);
      const { data: runResult, error: runErr } = await supabase.rpc('run_scheduled_ad_cleanup', {
        p_trigger_source: 'admin_manual',
        p_dry_run: dryRun,
      });
      if (runErr) throw runErr;

      let storageDeleted = 0;
      let permanentlyDeleted = 0;

      if (!dryRun && runResult?.ok && !runResult.skipped_concurrent_run) {
        const candidates = Array.isArray(runResult.purge_candidates) ? runResult.purge_candidates : [];
        for (const candidate of candidates) {
          const r2Res = await deleteR2ObjectsForAdAdmin(candidate.images, candidate.id);
          storageDeleted += r2Res.deletedKeys.length;
          if (r2Res.failedKeys.length > 0) {
            await supabase.from('ad_cleanup_logs').insert({
              run_id: runResult.run_id || null,
              ad_id: candidate.id,
              ad_reference_number: candidate.reference_number,
              ad_title: candidate.title,
              action: 'storage_cleanup_failed',
              reason: 'خطا در پاکسازی فایل R2',
              metadata: { failedKeys: r2Res.failedKeys },
            });
            continue;
          }
          const { error: delErr } = await supabase
            .from('swedpersiska_ads')
            .delete()
            .eq('id', candidate.id)
            .not('deleted_at', 'is', null);
          if (!delErr) {
            permanentlyDeleted += 1;
            await supabase.rpc('log_permanent_ad_deletion', {
              p_run_id: runResult.run_id || null,
              p_ad_id: candidate.id,
              p_reference_number: candidate.reference_number || null,
              p_title: candidate.title || null,
              p_deleted_keys: r2Res.deletedKeys,
            });
          }
        }
      }

      return res.status(200).json({
        ok: true,
        result: {
          ...runResult,
          permanently_deleted_count: permanentlyDeleted,
          storage_objects_deleted: storageDeleted,
        },
      });
    }

    return res.status(400).json({ ok: false, error: 'Unknown admin action' });
  } catch (err) {
    console.error('[admin] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'خطای داخلی سرور مدیریت.' });
  }
}
