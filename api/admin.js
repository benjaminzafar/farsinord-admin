import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { validateCleanupSettings, DEFAULT_CLEANUP_SETTINGS } from './_lib/cleanupSettingsValidation.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const HAS_SERVICE_ROLE = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemJueW1qY25tYXpkb25memt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTM1NjksImV4cCI6MjExMDI2OTU2OX0.ylsHBAZ1zo1z_aKpHx7hgl-yZu2yt2puFNhR8jBm6S4';

const supabase = createClient(supabaseUrl, supabaseKey);

const PAGE_SIZE = 10;
const FALLBACK_SECRET_SEED = `${supabaseKey}:${process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'Sam@13321332'}:linksho-admin-v1`;
const DETERMINISTIC_FALLBACK_SECRET = crypto.createHash('sha256').update(FALLBACK_SECRET_SEED, 'utf8').digest('hex');
const TOKEN_SECRET = process.env.ADMIN_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || DETERMINISTIC_FALLBACK_SECRET;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://www.linksho.eu,https://linksho.eu,https://admin.linksho.eu,https://farsinord-admin.vercel.app,https://swedpersiska.vercel.app,https://farsinord.vercel.app,https://farsinord-frontend.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const BRANDING_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function createR2PresignedPutUrl({ accountId, accessKeyId, secretAccessKey, bucketName, objectKey, contentType, expiresSeconds = 300 }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${bucketName}/${objectKey.split('/').map(encodeRfc3986).join('/')}`;

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'content-type;host',
  };

  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const canonicalRequest = ['PUT', canonicalUri, canonicalQuery, canonicalHeaders, 'content-type;host', 'UNSIGNED-PAYLOAD'].join('\n');
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

async function resolveAdminR2Config() {
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  ) {
    return {
      enabled: true,
      accountId: process.env.R2_ACCOUNT_ID.trim(),
      accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
      bucketName: process.env.R2_BUCKET_NAME.trim(),
      publicUrl: process.env.R2_PUBLIC_URL.trim().replace(/\/+$/, ''),
    };
  }
  const { data } = await supabase.from('swedpersiska_settings').select('value').eq('key', 'r2_settings').maybeSingle();
  const v = data?.value;
  if (!v?.enabled || !v.accountId || !v.accessKeyId || !v.secretAccessKey || !v.bucketName || !v.publicUrl) return null;
  return { ...v, publicUrl: String(v.publicUrl).trim().replace(/\/+$/, '') };
}

async function deleteR2ObjectsForAdAdmin(imageUrls = [], excludeAdId = null) {
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  if (urls.length === 0) return { deletedKeys: [], failedKeys: [] };
  const r2 = await resolveAdminR2Config();
  if (!r2) return { deletedKeys: [], failedKeys: [] };

  const deletedKeys = [];
  const failedKeys = [];
  const base = r2.publicUrl;

  for (const url of urls) {
    if (!String(url).startsWith(`${base}/`)) continue;
    const objectKey = decodeURIComponent(String(url).slice(base.length + 1).split('?')[0]);
    if (!objectKey || objectKey.includes('..')) continue;

    if (excludeAdId) {
      try {
        const { count } = await supabase
          .from('swedpersiska_ads')
          .select('id', { count: 'exact', head: true })
          .neq('id', excludeAdId)
          .contains('images', [url]);
        if ((count || 0) > 0) continue;
      } catch {}
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
      const resp = await fetch(`https://${host}${uri}`, {
        method: 'DELETE',
        headers: {
          'x-amz-date': amzDate,
          'x-amz-content-sha256': emptyHash,
          Authorization: `AWS4-HMAC-SHA256 Credential=${r2.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${sig}`,
        },
      });
      if (resp.ok || resp.status === 204 || resp.status === 404) deletedKeys.push(objectKey);
      else failedKeys.push(objectKey);
    } catch {
      failedKeys.push(objectKey);
    }
  }
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
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createAdminToken(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const displayName = cleanEmail.split('@')[0] || 'admin';
  const payload = Buffer.from(
    JSON.stringify({
      sub: cleanEmail,
      name: displayName,
      role: 'admin',
      exp: Date.now() + 24 * 60 * 60 * 1000
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (!safeEqual(sig, expectedSig)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded || decoded.role !== 'admin' || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
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
  if (origin && (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
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

    // 1. Admin Login Endpoint (Unauthenticated -> Issues Signed Token)
    if (req.method === 'POST' && action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();

      const validEmail = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'swedpersiska@gmail.com').toLowerCase().trim();
      const validPass = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'Sam@13321332';

      const allowedEmails = [validEmail, 'swedpersiska@gmail.com', 'admin@linksho.com', 'admin@swedpersiska.se'];
      const isEmailValid = allowedEmails.some((addr) => safeEqual(email, addr));
      const isPassValid = safeEqual(password, validPass);

      if (!isEmailValid || !isPassValid) {
        return res.status(401).json({ ok: false, error: 'ایمیل یا رمز عبور اشتباه است.' });
      }

      const token = createAdminToken(email);
      return res.status(200).json({ ok: true, token, email });
    }

    // 2. Verify Admin Bearer Token for all protected actions
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : (body.token || '');
    const adminSession = verifyAdminToken(bearerToken);

    if (!adminSession) {
      return res.status(401).json({ ok: false, error: 'نشست مدیریتی منقضی شده یا نامعتبر است. لطفاً مجدداً وارد شوید.' });
    }
    if (adminSession.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'فقط مدیر سیستم به این بخش دسترسی دارد.' });
    }

    // 3. Protected Admin Actions
    if (action === 'overview') {
      const [firstPageRes, metaRes, settingsRes, dupCountRes, openReportsRes] = await Promise.all([
        supabase
          .from('swedpersiska_ads')
          .select('*')
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('is_featured', { ascending: false })
          .order('sort_timestamp', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        supabase.from('swedpersiska_ads').select('category, country, status, is_featured, promotion_expires_at, cleanup_warning_sent_at, deleted_at, views_count, created_at'),
        supabase.from('swedpersiska_settings').select('*'),
        HAS_SERVICE_ROLE
          ? supabase.from('ad_duplicate_reviews').select('id', { count: 'exact', head: true }).eq('resolution', 'pending')
          : Promise.resolve({ count: 0 }),
        HAS_SERVICE_ROLE
          ? supabase.from('ad_reports').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(100)
          : Promise.resolve({ data: [] }),
      ]);

      const countryStats = {
        se: { total: 0, active: 0, vip: 0, views: 0 },
        no: { total: 0, active: 0, vip: 0, views: 0 },
        dk: { total: 0, active: 0, vip: 0, views: 0 },
        fi: { total: 0, active: 0, vip: 0, views: 0 },
        de: { total: 0, active: 0, vip: 0, views: 0 },
        at: { total: 0, active: 0, vip: 0, views: 0 },
        nl: { total: 0, active: 0, vip: 0, views: 0 },
        fr: { total: 0, active: 0, vip: 0, views: 0 }
      };
      const categoryCounts = {};
      const monthBuckets = {};
      let totalCount = 0;
      let activeCount = 0;
      let pendingCount = 0;
      let vipCount = 0;
      let softDeletedCount = 0;
      let warnedCount = 0;
      let totalViews = 0;
      const nowMs = Date.now();

      (metaRes.data || []).forEach((row) => {
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

      const firstPageAds = await attachAdminPins(firstPageRes.data || []);

      return res.status(200).json({
        ok: true,
        hasServiceRole: HAS_SERVICE_ROLE,
        counts: {
          total: totalCount,
          active: activeCount,
          pending: pendingCount,
          vip: vipCount,
          softDeleted: softDeletedCount,
          warnedAds: warnedCount,
          pendingDuplicateReviews: dupCountRes.count || 0,
          totalViews
        },
        openReports: openReportsRes.data || [],
        countryStats,
        categoryCounts,
        monthBuckets,
        recentActiveAds: firstPageAds.slice(0, 5),
        initialActiveAds: firstPageAds,
        settings: (settingsRes.data || []).map((item) => {
          if (item.key === 'cloudflare_deploy_settings' && item.value && typeof item.value === 'object') {
            return {
              ...item,
              value: {
                accountId: item.value.accountId || '',
                deployUrl: item.value.deployUrl || 'https://linksho-seller.vercel.app/api/cloudflare/deploy',
                hasToken: Boolean(item.value.apiToken),
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
                hasCredentials: Boolean(item.value.accessKeyId && item.value.secretAccessKey),
                accessKeyId: '',
                secretAccessKey: ''
              }
            };
          }
          return item;
        })
      });
    }

    if (action === 'active_ads') {
      const page = Math.max(1, Number(body.page || (req.query && req.query.page)) || 1);
      const search = String(body.search || (req.query && req.query.search) || '').trim();
      const country = String(body.country || (req.query && req.query.country) || 'all');
      const category = String(body.category || (req.query && req.query.category) || 'all');
      const status = String(body.status || (req.query && req.query.status) || 'active');
      const vipOnly = Boolean(body.vipOnly || (req.query && req.query.vipOnly === 'true'));

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from('swedpersiska_ads')
        .select('*', { count: 'exact' });

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
        const sanitized = search.replace(/[,()]/g, ' ').trim();
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
      return res.status(200).json({ ok: true, ads: enriched, count: count ?? 0, page });
    }

    if (!HAS_SERVICE_ROLE && ['toggle_featured', 'update_status', 'update_country', 'delete_ad', 'dismiss_report', 'save_settings', 'save_cleanup_settings', 'resolve_duplicate_review', 'run_cleanup_now'].includes(action)) {
      return res.status(503).json({
        ok: false,
        error: 'متغیر امنیتی SUPABASE_SERVICE_ROLE_KEY روی سرور ادمین (Vercel) تنظیم نشده است.',
      });
    }

    if (action === 'toggle_featured') {
      const { id, is_featured } = body;
      const enableVip = Boolean(is_featured);
      const { data: stripeRow } = await supabase.from('swedpersiska_settings').select('value').eq('key', 'stripe_settings').maybeSingle();
      const durationDays = Math.max(1, Math.min(365, Number(stripeRow?.value?.vipDurationDays) || 30));
      const nowIso = new Date().toISOString();
      const expiresAt = enableVip ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString() : null;

      const { data: adRow } = await supabase.from('swedpersiska_ads').select('country, last_meaningful_activity_at').eq('id', id).maybeSingle();
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
      const { error } = await supabase.from('swedpersiska_ads').update(updatePayload).eq('id', id);
      if (error) throw error;

      if (status === 'active' || status === 'rejected') {
        await supabase
          .from('ad_duplicate_reviews')
          .update({
            resolution: status === 'active' ? 'cleared_by_admin' : 'confirmed_duplicate',
            resolved_at: nowIso,
          })
          .eq('ad_id', id)
          .eq('resolution', 'pending');
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

      if (targetAd) {
        await supabase.from('ad_cleanup_logs').insert({
          ad_id: targetAd.id,
          ad_reference_number: targetAd.reference_number,
          ad_title: targetAd.title_fa || targetAd.title,
          action: 'permanently_deleted',
          reason: 'حذف دائمی توسط مدیریت',
        });
      }

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
            updated_at: new Date().toISOString()
          });
        }
      } catch {}
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
        return res.status(400).json({ ok: false, error: 'فرمت فایل مجاز نیست (PNG, JPG, WebP, SVG, ICO).' });
      }
      const buf = Buffer.from(fileBase64, 'base64');
      if (!buf.length || buf.length > 5242880) {
        return res.status(400).json({ ok: false, error: 'حداکثر حجم فایل تصویر ۵ مگابایت است.' });
      }

      let r2 = null;
      if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL) {
        r2 = {
          enabled: true,
          accountId: process.env.R2_ACCOUNT_ID.trim(),
          accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
          bucketName: process.env.R2_BUCKET_NAME.trim(),
          publicUrl: process.env.R2_PUBLIC_URL.trim().replace(/\/+$/, ''),
        };
      } else {
        const { data: r2Row } = await supabase.from('swedpersiska_settings').select('value').eq('key', 'r2_settings').maybeSingle();
        if (r2Row?.value?.enabled && r2Row.value.accountId && r2Row.value.accessKeyId && r2Row.value.secretAccessKey && r2Row.value.bucketName && r2Row.value.publicUrl) {
          r2 = {
            ...r2Row.value,
            publicUrl: String(r2Row.value.publicUrl).trim().replace(/\/+$/, ''),
          };
        }
      }

      if (!r2) {
        return res.status(400).json({ ok: false, error: 'فضای ابری Cloudflare R2 در تنظیمات فعال نشده است.' });
      }

      const kind = String(body.kind || 'logo').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'logo';
      const objectKey = `branding/${kind}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      const uploadUrl = createR2PresignedPutUrl({
        accountId: r2.accountId,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        bucketName: r2.bucketName,
        objectKey,
        contentType,
      });

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
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
      const allowedKeys = ['site_branding', 'seo_settings', 'portal_categories', 'portal_cities', 'portal_countries', 'stripe_settings', 'turnstile_settings', 'analytics_settings', 'r2_settings', 'podcast_settings', 'seller_deployments', 'cloudflare_deploy_settings', 'ad_lifecycle_settings'];
      if (!allowedKeys.includes(key)) {
        return res.status(400).json({ ok: false, error: 'Invalid settings key' });
      }
      if (key === 'ad_lifecycle_settings') {
        const result = await saveAndAuditCleanupSettings(value, adminSession);
        return res.status(result.status).json(result.body);
      }
      let nextValue = value;
      if (key === 'cloudflare_deploy_settings' && value && typeof value === 'object') {
        const { data: existingCf } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'cloudflare_deploy_settings')
          .maybeSingle();
        const prevCf = (existingCf && existingCf.value) || {};
        nextValue = {
          accountId: String(value.accountId || '').trim(),
          deployUrl: String(value.deployUrl || 'https://linksho-seller.vercel.app/api/cloudflare/deploy').trim(),
          apiToken: (value.apiToken && String(value.apiToken).trim()) || prevCf.apiToken || '',
        };
      }
      if (key === 'r2_settings' && value && typeof value === 'object') {
        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'r2_settings')
          .maybeSingle();
        const prev = (existingRow && existingRow.value) || {};
        nextValue = {
          enabled: Boolean(value.enabled),
          accountId: String(value.accountId || '').trim(),
          bucketName: String(value.bucketName || '').trim(),
          publicUrl: String(value.publicUrl || '').trim().replace(/\/+$/, ''),
          accessKeyId: String(value.accessKeyId || '').trim() || prev.accessKeyId || '',
          secretAccessKey: String(value.secretAccessKey || '').trim() || prev.secretAccessKey || ''
        };
      }
      const { error } = await supabase.from('swedpersiska_settings').upsert({
        key,
        value: nextValue,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'test_cloudflare_connection') {
      const { data: cfRow } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'cloudflare_deploy_settings')
        .maybeSingle();
      const cfCfg = (cfRow && cfRow.value) || {};
      const cfToken = String(body.apiToken || cfCfg.apiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();
      if (!cfToken) {
        return res.status(400).json({ ok: false, error: 'ابتدا توکن کلودفلر را وارد و ذخیره کنید.' });
      }

      // 1. Verify token directly (works even without Account Settings:Read permission)
      const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || verifyJson.success === false) {
        return res.status(401).json({
          ok: false,
          error: verifyJson?.errors?.[0]?.message || 'توکن کلودفلر نامعتبر یا منقضی شده است.',
        });
      }

      let accountId = String(body.accountId || cfCfg.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
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

      const { data: cfRow } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'cloudflare_deploy_settings')
        .maybeSingle();
      const cfCfg = (cfRow && cfRow.value) || {};
      const cfToken = String(cfCfg.apiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();
      let accountId = String(cfCfg.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();

      if (cfToken) {
        if (!accountId) {
          const accRes = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=5', {
            headers: { Authorization: `Bearer ${cfToken}` },
          });
          const accJson = await accRes.json().catch(() => ({}));
          accountId = accJson?.result?.[0]?.id || '';
        }
        if (accountId) {
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
      await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: new Date().toISOString(),
      });

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
      await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: createdAt,
      });

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
      await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: new Date().toISOString(),
      });

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
      const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
      let invoiceUrl = current.stripeInvoiceLink || 'https://swedpersiska.vercel.app/?page=website-builder';
      let isStripeLive = false;

      if (secretKey) {
        const params = new URLSearchParams();
        params.set('mode', 'payment');
        params.set('success_url', 'https://swedpersiska.vercel.app/?page=website-builder&renew_session_id={CHECKOUT_SESSION_ID}');
        params.set('cancel_url', 'https://swedpersiska.vercel.app/?page=website-builder&cancelled=1');
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
        isStripeLive = true;
      }

      const nowIso = new Date().toISOString();
      const next = {
        ...current,
        stripeInvoiceLink: invoiceUrl,
        invoiceSentAt: nowIso,
        updatedAt: nowIso,
      };
      const nextList = prevList.map((item, i) => (i === idx ? next : item));
      await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: nowIso,
      });

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

      await supabase.from('swedpersiska_settings').upsert({
        key: 'seller_deployments',
        value: nextList,
        updated_at: new Date().toISOString(),
      });

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
        .select('id, reference_number, title, title_fa, contact_email')
        .eq('id', review.ad_id)
        .maybeSingle();

      if (decision === 'cleared_by_admin') {
        await supabase
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
          .eq('id', review.ad_id);

        if (adRow) {
          await supabase.from('ad_notifications').insert({
            ad_id: adRow.id,
            ad_reference_number: adRow.reference_number,
            recipient_email: adRow.contact_email,
            notification_type: 'duplicate_cleared',
            title: 'آگهی شما تایید و منتشر شد',
            message: `بررسی مدیریت تایید کرد که آگهی «${adRow.title_fa || adRow.title}» (${adRow.reference_number}) تکراری نیست و اکنون در سایت منتشر شده است.`,
          });
        }
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
    return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
  }
}
