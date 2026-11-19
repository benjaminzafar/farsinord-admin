-- Optional Supabase Dashboard SQL Cleanup Script
-- Run this once in Supabase Dashboard -> SQL Editor to remove legacy permissive policies,
-- clear the Performance Advisor `multiple_permissive_policies` notice, and hide legacy `pin_code` values.
-- Note: Restrictive RLS policies are ALREADY active in production via migration `ad_lifecycle_restrictive_rls_and_credentials`.

-- 1. Backfill existing legacy PIN codes into private `public.ad_credentials` table
INSERT INTO public.ad_credentials (ad_id, pin_code)
SELECT id, pin_code
FROM public.swedpersiska_ads
WHERE pin_code IS NOT NULL AND pin_code <> 'PROTECTED'
ON CONFLICT (ad_id) DO NOTHING;

-- 2. Mask legacy `pin_code` values on the public ads table & revoke direct column SELECT
UPDATE public.swedpersiska_ads
SET pin_code = 'PROTECTED'
WHERE pin_code IS DISTINCT FROM 'PROTECTED';

REVOKE ALL ON TABLE public.swedpersiska_ads FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, reference_number, title, title_fa, category, country, city, area,
  price, price_type, description, contact_name, contact_phone,
  contact_whatsapp, contact_telegram, contact_email, contact_website,
  images, is_featured, status, views_count, created_at, updated_at,
  last_boosted_at, last_meaningful_activity_at, sort_timestamp,
  next_free_boost_at, boost_count, duplicate_detection_status,
  cleanup_warning_sent_at, scheduled_deletion_at, deleted_at,
  promotion_expires_at
) ON public.swedpersiska_ads TO anon, authenticated;

-- 3. Drop legacy permissive policies on swedpersiska_ads
DROP POLICY IF EXISTS "Public can delete ads" ON public.swedpersiska_ads;
DROP POLICY IF EXISTS "Public can insert ads" ON public.swedpersiska_ads;
DROP POLICY IF EXISTS "Public can update ads" ON public.swedpersiska_ads;
DROP POLICY IF EXISTS "Public can view active ads" ON public.swedpersiska_ads;

CREATE POLICY "Public read active non-deleted ads"
  ON public.swedpersiska_ads
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active' AND deleted_at IS NULL);

-- 4. Drop legacy overlapping permissive policies on swedpersiska_settings
DROP POLICY IF EXISTS "Public can manage settings" ON public.swedpersiska_settings;
DROP POLICY IF EXISTS "Public can read settings" ON public.swedpersiska_settings;

REVOKE ALL ON TABLE public.swedpersiska_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.swedpersiska_settings TO anon, authenticated;

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

-- 5. Lock down internal/admin SECURITY DEFINER helper RPCs from public REST invocation
REVOKE EXECUTE ON FUNCTION
  public._assert_service_or_system_role(),
  public._build_ad_public_json(public.swedpersiska_ads, boolean),
  public.is_ad_paid_protected(uuid),
  public.create_pending_ad_payment(uuid, text, text, numeric, text, integer),
  public.activate_ad_promotion_from_payment(uuid, text, text, text, numeric, text),
  public.sync_ad_payment_webhook_event(text, text, text, text),
  public.run_scheduled_ad_cleanup(text, boolean),
  public.log_permanent_ad_deletion(uuid, uuid, text, text, text[])
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.create_pending_ad_payment(uuid, text, text, numeric, text, integer),
  public.activate_ad_promotion_from_payment(uuid, text, text, text, numeric, text),
  public.sync_ad_payment_webhook_event(text, text, text, text),
  public.run_scheduled_ad_cleanup(text, boolean),
  public.log_permanent_ad_deletion(uuid, uuid, text, text, text[])
TO service_role;
