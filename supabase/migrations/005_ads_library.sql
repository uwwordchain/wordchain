-- Restructure ads into an image library:
-- each row = one uploaded image, with ad_type and is_active.
-- Global ON/OFF toggles live in the settings table.

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS ad_type text NOT NULL DEFAULT 'banner',
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_url text;

-- Global toggles
INSERT INTO public.settings (key, value) VALUES
  ('banner_ads_enabled', 'false'),
  ('interstitial_ads_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
