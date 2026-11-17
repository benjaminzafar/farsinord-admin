import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemJueW1qY25tYXpkb25memt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTM1NjksImV4cCI6MjExMDI2OTU2OX0.ylsHBAZ1zo1z_aKpHx7hgl-yZu2yt2puFNhR8jBm6S4';

const supabase = createClient(supabaseUrl, supabaseKey);

const PAGE_SIZE = 10;
const TOKEN_SECRET = process.env.ADMIN_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'swedpersiska-admin-hmac-secret-2026';

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
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

      const isEmailValid = safeEqual(email, validEmail);
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
      const [totalRes, activeRes, pendingRes, vipRes, recentRes, metaRes, settingsRes] = await Promise.all([
        supabase.from('swedpersiska_ads').select('*', { count: 'exact', head: true }),
        supabase.from('swedpersiska_ads').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('swedpersiska_ads').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('swedpersiska_ads').select('*', { count: 'exact', head: true }).eq('is_featured', true),
        supabase.from('swedpersiska_ads').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(5),
        supabase.from('swedpersiska_ads').select('category, country, status, is_featured, views_count'),
        supabase.from('swedpersiska_settings').select('*')
      ]);

      const countryStats = {
        se: { total: 0, active: 0, vip: 0, views: 0 },
        no: { total: 0, active: 0, vip: 0, views: 0 },
        dk: { total: 0, active: 0, vip: 0, views: 0 },
        fi: { total: 0, active: 0, vip: 0, views: 0 }
      };
      const categoryCounts = {};
      let totalViews = 0;

      (metaRes.data || []).forEach((row) => {
        const c = row.country || 'se';
        if (!countryStats[c]) countryStats[c] = { total: 0, active: 0, vip: 0, views: 0 };
        countryStats[c].total++;
        if (row.status === 'active') countryStats[c].active++;
        if (row.is_featured) countryStats[c].vip++;
        countryStats[c].views += row.views_count || 1;
        totalViews += row.views_count || 1;
        if (row.category) {
          categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
        }
      });

      return res.status(200).json({
        ok: true,
        counts: {
          total: totalRes.count ?? 0,
          active: activeRes.count ?? 0,
          pending: pendingRes.count ?? 0,
          vip: vipRes.count ?? 0,
          totalViews
        },
        countryStats,
        categoryCounts,
        recentActiveAds: recentRes.data || [],
        settings: (settingsRes.data || []).map((item) => {
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
        .select('*', { count: 'exact' })
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

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
      if (!buf.length || buf.length > 1048576) {
        return res.status(400).json({ ok: false, error: 'حداکثر حجم فایل لوگو یا آیکون ۱ مگابایت است.' });
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

      const kind = body.kind === 'favicon' ? 'favicon' : 'logo';
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
      const allowedKeys = ['site_branding', 'seo_settings', 'portal_categories', 'portal_cities', 'stripe_settings', 'turnstile_settings', 'analytics_settings', 'r2_settings'];
      if (!allowedKeys.includes(key)) {
        return res.status(400).json({ ok: false, error: 'Invalid settings key' });
      }
      let nextValue = value;
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

    return res.status(400).json({ ok: false, error: 'Unknown admin action' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
  }
}
