import React, { useEffect, useRef, useState } from 'react';

// Official Cloudflare Turnstile Test Sitekeys:
// 1x00000000000000000000AA -> Always passes (non-interactive)
// 2x00000000000000000000AB -> Always blocks
// 3x00000000000000000000FF -> Interactive challenge (click checkbox to verify)
export const CLOUDFLARE_TEST_SITEKEY = '1x00000000000000000000AA';

function sanitizeKey(raw) {
  return String(raw || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
}

function formatDiagnosticError(errCode) {
  const code = String(errCode || '').trim();
  if (code === '110200') {
    return 'خطای کلودفلر (110200): دامنه فعلی در بخش Hostname Management ویجت Turnstile ثبت نشده است.';
  }
  if (['110100', '110110', '400020', '400070'].includes(code)) {
    return `خطای کلودفلر (${code}): کلید عمومی (Site Key) در پنل کلودفلر نامعتبر، حذف‌شده یا متعلق به ویجت دیگری است.`;
  }
  return code ? `خطا در احراز هویت امنیتی (کد ${code})` : 'خطا در احراز هویت امنیتی';
}

export default function CloudflareTurnstile({
  mode,
  siteKey,
  theme = 'auto',
  onVerify,
  onExpire,
  onError,
  showDiagnosticErrors = false,
  className = ''
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  const [loaded, setLoaded] = useState(() => typeof window !== 'undefined' && Boolean(window.turnstile));
  const [errorState, setErrorState] = useState({ key: '', msg: '' });

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  });

  const effectiveKey = (() => {
    if (mode === 'test') return CLOUDFLARE_TEST_SITEKEY;
    if (mode === 'live') return sanitizeKey(siteKey);
    const direct = sanitizeKey(siteKey);
    if (direct) return direct;
    try {
      const saved = localStorage.getItem('swedpersiska_turnstile_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode === 'live' && sanitizeKey(parsed.siteKey)) {
          return sanitizeKey(parsed.siteKey);
        }
      }
    } catch {}
    return CLOUDFLARE_TEST_SITEKEY;
  })();

  const missingLiveKey = showDiagnosticErrors && mode === 'live' && !effectiveKey;
  const visibleError = missingLiveKey
    ? 'کلید عمومی کلودفلر (Site Key) وارد نشده است.'
    : (errorState.key === effectiveKey ? errorState.msg : '');

  useEffect(() => {
    if (window.turnstile) return;

    const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existingScript) {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          setLoaded(true);
        }
      }, 100);
      return () => clearInterval(interval);
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setLoaded(true);
    };
    script.onerror = () => {
      if (showDiagnosticErrors) {
        setErrorState({ key: effectiveKey, msg: 'بارگذاری اسکریپت کلودفلر با خطا مواجه شد.' });
      } else {
        callbacksRef.current.onVerify?.('turnstile-script-fallback');
      }
      callbacksRef.current.onError?.('Script load error');
    };
    document.head.appendChild(script);
  }, [effectiveKey, showDiagnosticErrors]);

  useEffect(() => {
    if (!loaded || !window.turnstile || !containerRef.current || !effectiveKey) return;

    if (widgetIdRef.current !== null) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {}
      widgetIdRef.current = null;
    }

    try {
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: effectiveKey,
        theme,
        callback: (token) => {
          setErrorState({ key: '', msg: '' });
          callbacksRef.current.onVerify?.(token);
        },
        'expired-callback': () => {
          callbacksRef.current.onExpire?.();
        },
        'error-callback': (err) => {
          console.warn('Cloudflare Turnstile error:', err);
          if (showDiagnosticErrors) {
            setErrorState({ key: effectiveKey, msg: formatDiagnosticError(err) });
          } else {
            callbacksRef.current.onVerify?.('turnstile-error-fallback');
          }
          callbacksRef.current.onError?.(err);
        }
      });

      widgetIdRef.current = widgetId;
    } catch (e) {
      console.error('Failed to render Cloudflare Turnstile widget:', e);
      if (showDiagnosticErrors) {
        setErrorState({ key: effectiveKey, msg: 'خطا در راه‌اندازی ویجت کلودفلر' });
      } else {
        callbacksRef.current.onVerify?.('turnstile-render-fallback');
      }
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [loaded, effectiveKey, theme, showDiagnosticErrors]);

  return (
    <div className={`cloudflare-turnstile-container flex flex-col items-center justify-center min-h-[68px] ${className}`} dir="ltr">
      <div ref={containerRef} className="inline-block" />
      {visibleError && (
        <span className="text-[11px] text-rose-600 mt-1.5 font-medium font-vazir text-center leading-relaxed" dir="rtl">
          {visibleError}
        </span>
      )}
    </div>
  );
}
