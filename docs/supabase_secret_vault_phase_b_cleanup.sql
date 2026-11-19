-- =============================================================================
-- LinkSho Secret Vault — Phase B Post-Migration Plaintext Strip & Emergency Reset
--
-- SECTION 1: Run ONLY AFTER you have logged into Admin Panel and confirmed that
--            R2 and Cloudflare keys are encrypted in public.app_encrypted_secrets
--            (you can click "انتقال خودکار کلیدهای قدیمی به خزانه" in Admin -> امنیت سیستم).
-- =============================================================================

BEGIN;

-- 1. Strip plaintext R2 credentials (keeps public enabled/accountId/bucketName/publicUrl)
UPDATE public.swedpersiska_settings
SET
  value = value - 'accessKeyId' - 'secretAccessKey' - 'access_key_id' - 'secret_access_key',
  updated_at = now()
WHERE key = 'r2_settings'
  AND jsonb_typeof(value) = 'object'
  AND value ?| ARRAY['accessKeyId', 'secretAccessKey', 'access_key_id', 'secret_access_key'];

-- 2. Strip plaintext Cloudflare Deploy API token (keeps non-secret accountId/deployUrl)
UPDATE public.swedpersiska_settings
SET
  value = value - 'apiToken' - 'api_token',
  updated_at = now()
WHERE key = 'cloudflare_deploy_settings'
  AND jsonb_typeof(value) = 'object'
  AND value ?| ARRAY['apiToken', 'api_token'];

-- 3. Permanently block plaintext credentials in r2_settings & cloudflare_deploy_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'swedpersiska_settings_no_internal_secrets_chk'
      AND conrelid = 'public.swedpersiska_settings'::regclass
  ) THEN
    ALTER TABLE public.swedpersiska_settings
      ADD CONSTRAINT swedpersiska_settings_no_internal_secrets_chk
      CHECK (
        key NOT IN ('r2_settings', 'cloudflare_deploy_settings')
        OR jsonb_typeof(value) <> 'object'
        OR NOT (
          value ?| ARRAY[
            'accessKeyId', 'access_key_id',
            'secretAccessKey', 'secret_access_key',
            'apiToken', 'api_token',
            'secretKey', 'secret_key',
            'webhookSecret', 'webhook_secret'
          ]
        )
      );
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- SECTION 2 (REFERENCE ONLY — DO NOT RUN UNLESS LOCKED OUT OF ADMIN PANEL):
-- Emergency 15-Minute Password Reset Code Generator
-- Uncomment and run in Supabase SQL Editor if you ever forget your Admin Password:
-- =============================================================================
/*
WITH generated AS (
  SELECT 'LS-RESET-' || upper(encode(extensions.gen_random_bytes(16), 'hex')) AS raw_code
),
upserted AS (
  INSERT INTO public.admin_bootstrap_tokens (singleton_id, token_hash, purpose, failed_attempts, expires_at, used_at)
  SELECT
    1,
    encode(extensions.digest(convert_to(raw_code, 'UTF8'), 'sha256'), 'hex'),
    'password_reset',
    0,
    now() + interval '15 minutes',
    NULL
  FROM generated
  ON CONFLICT (singleton_id) DO UPDATE SET
    token_hash = EXCLUDED.token_hash,
    purpose = EXCLUDED.purpose,
    failed_attempts = 0,
    expires_at = EXCLUDED.expires_at,
    used_at = NULL,
    created_at = now()
  RETURNING expires_at
)
SELECT raw_code AS one_time_password_reset_code, (SELECT expires_at FROM upserted) AS valid_until
FROM generated;
*/
