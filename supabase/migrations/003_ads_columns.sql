-- Add new columns to the ads table for banner/interstitial URL management
ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS banner_link_url text,
  ADD COLUMN IF NOT EXISTS interstitial_image_url text,
  ADD COLUMN IF NOT EXISTS interstitial_link_url text;
