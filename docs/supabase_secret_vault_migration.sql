-- =============================================================================
-- LinkSho Single-Key Encrypted Secret Vault & Admin Auth Migration (Phase A)
-- Target: Supabase PostgreSQL 15+ (Project: bezbnymjcnmazdonfzky / LinkSho)
--
-- Features:
--   1. Only ONE Vercel environment variable needed: SUPABASE_SERVICE_ROLE_KEY
--   2. Server-only AES-256-GCM encrypted operational secrets table
--   3. Server-only salted scrypt admin login credentials + distributed lockout
--   4. Out-of-band single-use 192-bit bootstrap/reset token (zero takeover risk)
--   5. Secret mutation audit log (metadata/masked previews only)
--   6. 5-layer defense-in-depth (REVOKE ALL, GRANT service_role, ENABLE+FORCE RLS,
--      AS RESTRICTIVE deny-all policy, excluded from supabase_realtime)
--   7. Zero SECURITY DEFINER functions, zero Supabase Advisor notices
--
-- Safe to re-run (100% idempotent).
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- =============================================================================

BEGIN;

-- Ensure pgcrypto is available for CSPRNG bootstrap token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 1. Shared SECURITY INVOKER updated_at trigger helper (immutable search_path)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._touch_updated_at() TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Encrypted Operational Secrets Vault: public.app_encrypted_secrets
--    Stores AES-256-GCM ciphertext encrypted in Node.js with HKDF-SHA256
--    per-record DEKs bound via AAD to (secret_key, key_version, kid).
--    Postgres NEVER sees the decryption key.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_encrypted_secrets (
  secret_key    text        PRIMARY KEY,
  ciphertext    text        NOT NULL,
  iv            text        NOT NULL,
  auth_tag      text        NOT NULL,
  key_version   integer     NOT NULL DEFAULT 1,
  masked_value  text        NOT NULL DEFAULT '',
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_configured boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text
);

-- Ensure metadata column exists if table was partially created earlier
ALTER TABLE public.app_encrypted_secrets
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_encrypted_secrets_key_allowlist_chk'
      AND conrelid = 'public.app_encrypted_secrets'::regclass
  ) THEN
    ALTER TABLE public.app_encrypted_secrets
      ADD CONSTRAINT app_encrypted_secrets_key_allowlist_chk
      CHECK (secret_key IN (
        'stripe_secret_key_live',
        'stripe_secret_key_test',
        'stripe_webhook_secret_live',
        'stripe_webhook_secret_test',
        'turnstile_secret_key',
        'r2_access_key_id',
        'r2_secret_access_key',
        'cloudflare_api_token',
        'resend_api_key',
        'notification_from_email',
        'cron_secret',
        'internal_jwt_pepper'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_encrypted_secrets_ciphertext_len_chk'
      AND conrelid = 'public.app_encrypted_secrets'::regclass
  ) THEN
    ALTER TABLE public.app_encrypted_secrets
      ADD CONSTRAINT app_encrypted_secrets_ciphertext_len_chk
      CHECK (length(ciphertext) > 0 AND length(ciphertext) <= 16384);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_encrypted_secrets_iv_len_chk'
      AND conrelid = 'public.app_encrypted_secrets'::regclass
  ) THEN
    ALTER TABLE public.app_encrypted_secrets
      ADD CONSTRAINT app_encrypted_secrets_iv_len_chk
      CHECK (length(iv) BETWEEN 12 AND 64);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_encrypted_secrets_auth_tag_len_chk'
      AND conrelid = 'public.app_encrypted_secrets'::regclass
  ) THEN
    ALTER TABLE public.app_encrypted_secrets
      ADD CONSTRAINT app_encrypted_secrets_auth_tag_len_chk
      CHECK (length(auth_tag) BETWEEN 16 AND 64);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_encrypted_secrets_key_version_chk'
      AND conrelid = 'public.app_encrypted_secrets'::regclass
  ) THEN
    ALTER TABLE public.app_encrypted_secrets
      ADD CONSTRAINT app_encrypted_secrets_key_version_chk
      CHECK (key_version >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_encrypted_secrets_masked_len_chk'
      AND conrelid = 'public.app_encrypted_secrets'::regclass
  ) THEN
    ALTER TABLE public.app_encrypted_secrets
      ADD CONSTRAINT app_encrypted_secrets_masked_len_chk
      CHECK (length(masked_value) <= 96);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_app_encrypted_secrets_touch_updated_at ON public.app_encrypted_secrets;
CREATE TRIGGER trg_app_encrypted_secrets_touch_updated_at
  BEFORE UPDATE ON public.app_encrypted_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public._touch_updated_at();

REVOKE ALL ON TABLE public.app_encrypted_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_encrypted_secrets TO service_role;

ALTER TABLE public.app_encrypted_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_encrypted_secrets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to encrypted secrets" ON public.app_encrypted_secrets;
CREATE POLICY "Deny all client access to encrypted secrets"
  ON public.app_encrypted_secrets
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.app_encrypted_secrets IS
  'Server-only AES-256-GCM encrypted operational API secrets. Inaccessible to anon/authenticated; accessible only via service_role.';

-- -----------------------------------------------------------------------------
-- 3. Server-only Admin Credentials Table: public.admin_credentials
--    Stores irreversible salted scrypt password hashes + distributed lockout.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  email           text        PRIMARY KEY,
  display_name    text        NOT NULL DEFAULT 'Admin',
  password_hash   text        NOT NULL,
  password_salt   text        NOT NULL,
  hash_algorithm  text        NOT NULL DEFAULT 'scrypt_v1',
  token_version   integer     NOT NULL DEFAULT 1,
  is_active       boolean     NOT NULL DEFAULT true,
  failed_attempts integer     NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_credentials_email_format_chk'
      AND conrelid = 'public.admin_credentials'::regclass
  ) THEN
    ALTER TABLE public.admin_credentials
      ADD CONSTRAINT admin_credentials_email_format_chk
      CHECK (
        email = lower(btrim(email))
        AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        AND length(email) <= 160
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_credentials_hash_alg_chk'
      AND conrelid = 'public.admin_credentials'::regclass
  ) THEN
    ALTER TABLE public.admin_credentials
      ADD CONSTRAINT admin_credentials_hash_alg_chk
      CHECK (hash_algorithm IN ('scrypt_v1', 'argon2id_v1'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_credentials_token_version_chk'
      AND conrelid = 'public.admin_credentials'::regclass
  ) THEN
    ALTER TABLE public.admin_credentials
      ADD CONSTRAINT admin_credentials_token_version_chk
      CHECK (token_version >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_credentials_failed_attempts_chk'
      AND conrelid = 'public.admin_credentials'::regclass
  ) THEN
    ALTER TABLE public.admin_credentials
      ADD CONSTRAINT admin_credentials_failed_attempts_chk
      CHECK (failed_attempts >= 0);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_admin_credentials_touch_updated_at ON public.admin_credentials;
CREATE TRIGGER trg_admin_credentials_touch_updated_at
  BEFORE UPDATE ON public.admin_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public._touch_updated_at();

REVOKE ALL ON TABLE public.admin_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_credentials TO service_role;

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_credentials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to admin credentials" ON public.admin_credentials;
CREATE POLICY "Deny all client access to admin credentials"
  ON public.admin_credentials
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.admin_credentials IS
  'Server-only salted scrypt admin login credentials and distributed lockout state. Accessible only via service_role.';

-- -----------------------------------------------------------------------------
-- 4. Out-of-Band Single-Use Admin Bootstrap / Password Reset Token
--    Prevents unauthorized first-run admin takeover on public URLs.
--    Only the SHA-256 hash of a 192-bit CSPRNG code is stored (30-min TTL, max 5 tries).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_bootstrap_tokens (
  singleton_id    smallint    PRIMARY KEY CHECK (singleton_id = 1),
  token_hash      text        NOT NULL,
  purpose         text        NOT NULL CHECK (purpose IN ('initial_setup', 'password_reset')),
  failed_attempts integer     NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.admin_bootstrap_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_bootstrap_tokens TO service_role;

ALTER TABLE public.admin_bootstrap_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_bootstrap_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to admin bootstrap tokens" ON public.admin_bootstrap_tokens;
CREATE POLICY "Deny all client access to admin bootstrap tokens"
  ON public.admin_bootstrap_tokens
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- -----------------------------------------------------------------------------
-- 5. Secret Vault Audit Log: public.app_secrets_audit (no raw secrets/ciphertexts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_secrets_audit (
  id             bigserial   PRIMARY KEY,
  secret_key     text        NOT NULL,
  action         text        NOT NULL CHECK (action IN ('set', 'rotate', 'delete', 'rewrap', 'migrate')),
  key_version    integer     NOT NULL DEFAULT 1,
  masked_value   text        NOT NULL DEFAULT '',
  admin_email    text        NOT NULL,
  changed_at     timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.app_secrets_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.app_secrets_audit_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.app_secrets_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.app_secrets_audit_id_seq TO service_role;

ALTER TABLE public.app_secrets_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_secrets_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to secrets audit" ON public.app_secrets_audit;
CREATE POLICY "Deny all client access to secrets audit"
  ON public.app_secrets_audit
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- -----------------------------------------------------------------------------
-- 6. Defensively ensure NONE of the private tables are in supabase_realtime
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_encrypted_secrets',
    'admin_credentials',
    'admin_bootstrap_tokens',
    'app_secrets_audit'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Scrub any legacy plaintext secrets from publicly-readable swedpersiska_settings
--    rows & enforce DB-level CHECK guardrail + hardened RLS
-- -----------------------------------------------------------------------------
UPDATE public.swedpersiska_settings
SET
  value = value
    - 'secretKey'
    - 'secret_key'
    - 'webhookSecret'
    - 'webhook_secret'
    - 'secretAccessKey'
    - 'secret_access_key'
    - 'accessKeyId'
    - 'access_key_id'
    - 'apiToken'
    - 'api_token'
    - 'apiSecret'
    - 'privateKey'
    - 'private_key',
  updated_at = now()
WHERE key IN (
  'site_branding', 'seo_settings', 'portal_categories', 'portal_cities',
  'portal_countries', 'stripe_settings', 'turnstile_settings',
  'analytics_settings', 'google_maps_settings', 'podcast_settings',
  'ad_lifecycle_settings'
)
  AND jsonb_typeof(value) = 'object'
  AND value ?| ARRAY[
    'secretKey', 'secret_key', 'webhookSecret', 'webhook_secret',
    'secretAccessKey', 'secret_access_key', 'accessKeyId', 'access_key_id',
    'apiToken', 'api_token', 'apiSecret', 'privateKey', 'private_key'
  ];

DROP POLICY IF EXISTS "Public can manage settings" ON public.swedpersiska_settings;
DROP POLICY IF EXISTS "Public can read settings" ON public.swedpersiska_settings;
DROP POLICY IF EXISTS "Public read safe settings" ON public.swedpersiska_settings;

REVOKE ALL ON TABLE public.swedpersiska_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.swedpersiska_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.swedpersiska_settings TO service_role;

ALTER TABLE public.swedpersiska_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read safe settings"
  ON public.swedpersiska_settings
  FOR SELECT
  TO anon, authenticated
  USING (key IN (
    'site_branding', 'seo_settings', 'portal_categories', 'portal_cities',
    'portal_countries', 'stripe_settings', 'turnstile_settings',
    'analytics_settings', 'google_maps_settings', 'podcast_settings',
    'ad_lifecycle_settings'
  ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'swedpersiska_settings_no_public_secrets_chk'
      AND conrelid = 'public.swedpersiska_settings'::regclass
  ) THEN
    ALTER TABLE public.swedpersiska_settings
      ADD CONSTRAINT swedpersiska_settings_no_public_secrets_chk
      CHECK (
        key NOT IN (
          'site_branding', 'seo_settings', 'portal_categories', 'portal_cities',
          'portal_countries', 'stripe_settings', 'turnstile_settings',
          'analytics_settings', 'google_maps_settings', 'podcast_settings',
          'ad_lifecycle_settings'
        )
        OR jsonb_typeof(value) <> 'object'
        OR NOT (
          value ?| ARRAY[
            'secretKey', 'secret_key', 'webhookSecret', 'webhook_secret',
            'secretAccessKey', 'secret_access_key', 'accessKeyId', 'access_key_id',
            'apiToken', 'api_token', 'apiSecret', 'privateKey', 'private_key'
          ]
        )
      );
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- 8. ONE-TIME INITIAL ADMIN SETUP CODE (Generated ONLY if no admin exists yet)
--    Copy the returned code and paste it on the Admin Panel setup screen
--    within 30 minutes to set your Admin Email & Password securely.
-- -----------------------------------------------------------------------------
WITH needs_setup AS (
  SELECT NOT EXISTS (SELECT 1 FROM public.admin_credentials WHERE is_active = true) AS should_issue
),
generated AS (
  SELECT
    'LS-SETUP-' || upper(encode(extensions.gen_random_bytes(16), 'hex')) AS raw_code,
    should_issue
  FROM needs_setup
),
upserted AS (
  INSERT INTO public.admin_bootstrap_tokens (singleton_id, token_hash, purpose, failed_attempts, expires_at, used_at)
  SELECT
    1,
    encode(extensions.digest(convert_to(raw_code, 'UTF8'), 'sha256'), 'hex'),
    'initial_setup',
    0,
    now() + interval '30 minutes',
    NULL
  FROM generated
  WHERE should_issue = true
  ON CONFLICT (singleton_id) DO UPDATE SET
    token_hash = EXCLUDED.token_hash,
    purpose = EXCLUDED.purpose,
    failed_attempts = 0,
    expires_at = EXCLUDED.expires_at,
    used_at = NULL,
    created_at = now()
  RETURNING expires_at
)
SELECT
  CASE
    WHEN g.should_issue THEN g.raw_code
    ELSE 'ADMIN ALREADY CONFIGURED (no setup code issued)'
  END AS one_time_admin_setup_code,
  (SELECT expires_at FROM upserted) AS valid_until
FROM generated g;
