import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemJueW1qY25tYXpkb25memt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTM1NjksImV4cCI6MjExMDI2OTU2OX0.ylsHBAZ1zo1z_aKpHx7hgl-yZu2yt2puFNhR8jBm6S4';

const supabase = createClient(supabaseUrl, supabaseKey);

const PAGE_SIZE = 10;
const FALLBACK_SECRET_SEED = `${supabaseKey}:${process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'Sam@13321332'}:linksho-admin-v1`;
const DETERMINISTIC_FALLBACK_SECRET = crypto.createHash('sha256').update(FALLBACK_SECRET_SEED, 'utf8').digest('hex');
const TOKEN_SECRET = process.env.ADMIN_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || DETERMINISTIC_FALLBACK_SECRET;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://farsinord-admin.vercel.app,https://swedpersiska.vercel.app,https://farsinord.vercel.app,https://farsinord-frontend.vercel.app')
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

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createAdminToken(email) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: email,
      role: 'admin',
      exp: Date.now() + 24 * 60 * 60 * 1000
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
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

    // 3. Protected Admin Actions
    if (action === 'overview') {
      const [firstPageRes, metaRes, settingsRes] = await Promise.all([
        supabase
          .from('swedpersiska_ads')
          .select('*')
          .eq('status', 'active')
          .order('is_featured', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        supabase.from('swedpersiska_ads').select('category, country, status, is_featured, views_count, created_at'),
        supabase.from('swedpersiska_settings').select('*')
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
      let totalViews = 0;

      (metaRes.data || []).forEach((row) => {
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
        if (row.is_featured) {
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
            if (row.is_featured) monthBuckets[ym].vip++;
          }
        }
      });

      const firstPageAds = firstPageRes.data || [];

      return res.status(200).json({
        ok: true,
        counts: {
          total: totalCount,
          active: activeCount,
          pending: pendingCount,
          vip: vipCount,
          totalViews
        },
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

      if (status && status !== 'all') q = q.eq('status', status);
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
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);

      const { data, count, error } = await q;
      if (error) throw error;
      return res.status(200).json({ ok: true, ads: data || [], count: count ?? 0, page });
    }

    if (action === 'toggle_featured') {
      const { id, is_featured } = body;
      const { error } = await supabase.from('swedpersiska_ads').update({ is_featured: !!is_featured }).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'update_status') {
      const { id, status } = body;
      if (!['active', 'pending', 'rejected'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status value' });
      }
      const { error } = await supabase
        .from('swedpersiska_ads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
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
      const { error } = await supabase.from('swedpersiska_ads').delete().eq('id', id);
      if (error) throw error;
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
        updated_at: new Date().toISOString()
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

    if (action === 'save_settings') {
      const { key, value } = body;
      const allowedKeys = ['site_branding', 'seo_settings', 'portal_categories', 'portal_cities', 'portal_countries', 'stripe_settings', 'turnstile_settings', 'analytics_settings', 'r2_settings', 'podcast_settings', 'seller_deployments', 'cloudflare_deploy_settings'];
      if (!allowedKeys.includes(key)) {
        return res.status(400).json({ ok: false, error: 'Invalid settings key' });
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

    return res.status(400).json({ ok: false, error: 'Unknown admin action' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
  }
}
