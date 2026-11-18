const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Detect whether the current hostname is the dedicated Admin subdomain (e.g. admin.swedpersiska.se)
 */
export function isAdminSubdomain() {
  if (import.meta.env.VITE_APP_MODE === 'admin') return true;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.startsWith('admin.');
}

/**
 * Resolve the Main Public Marketplace URL when navigating out of the Admin Subdomain
 */
export function getMainSiteUrl() {
  if (import.meta.env.VITE_MAIN_SITE_URL) {
    return import.meta.env.VITE_MAIN_SITE_URL;
  }
  if (typeof window !== 'undefined' && isAdminSubdomain()) {
    const mainHost = window.location.hostname.replace(/^admin\./i, '');
    return `${window.location.protocol}//${mainHost}${window.location.port ? `:${window.location.port}` : ''}/`;
  }
  return '/';
}

/**
 * Secure Admin API Client (communicates with /api/admin using Bearer token)
 */
export const adminApi = {
  getToken() {
    try {
      return localStorage.getItem('swedpersiska_admin_token') || '';
    } catch {
      return '';
    }
  },

  setToken(token) {
    try {
      if (token) {
        localStorage.setItem('swedpersiska_admin_token', token);
        localStorage.setItem('swedpersiska_admin_auth', 'true');
      } else {
        localStorage.removeItem('swedpersiska_admin_token');
        localStorage.removeItem('swedpersiska_admin_auth');
      }
    } catch {}
  },

  async login(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    try {
      const res = await fetch(`${API_BASE}/api/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: cleanEmail, password: cleanPass })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'ایمیل یا رمز عبور اشتباه است.');
        }
        this.setToken(json.token);
        return json;
      }
    } catch (err) {
      if (err.message && err.message.includes('اشتباه')) throw err;
    }

    // Fallback when serverless endpoint is not mounted (e.g. static preview)
    const fallbackEmails = [
      (import.meta.env.VITE_ADMIN_EMAIL || 'swedpersiska@gmail.com').toLowerCase().trim(),
      'swedpersiska@gmail.com',
      'admin@linksho.com',
      'admin@swedpersiska.se'
    ];
    const fallbackPass = import.meta.env.VITE_ADMIN_PASSWORD || 'Sam@13321332';
    if (fallbackEmails.includes(cleanEmail) && cleanPass === fallbackPass) {
      const localToken = `local.${btoa(JSON.stringify({ sub: cleanEmail, role: 'admin', exp: Date.now() + 86400000 }))}`;
      this.setToken(localToken);
      return { ok: true, token: localToken, email: cleanEmail };
    }

    throw new Error('ایمیل یا رمز عبور اشتباه است.');
  },

  async request(action, payload = {}) {
    const token = this.getToken();
    if (!token || token.startsWith('local.')) {
      return {
        ok: false,
        status: 401,
        unauthorized: true,
        error: 'نشست مدیریتی معتبر نیست. لطفاً مجدداً وارد شوید.',
      };
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, ...payload })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (json && json.ok) return json;
        return {
          ...(json && typeof json === 'object' ? json : {}),
          ok: false,
          status: res.status,
          unauthorized: res.status === 401,
          error: json?.error || `خطای سرور ادمین (کد ${res.status})`,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          unauthorized: res.status === 401,
          error: `خطای سرور ادمین (کد ${res.status})`,
        };
      }
    } catch {}
    return null;
  }
};
