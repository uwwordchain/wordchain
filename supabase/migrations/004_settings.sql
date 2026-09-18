-- Global app settings (key-value store)
CREATE TABLE IF NOT EXISTS public.settings (
  key   text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- Seed the auto-launch default (OFF)
INSERT INTO public.settings (key, value)
VALUES ('auto_launch_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Service role can do anything
GRANT ALL ON public.settings TO service_role;

-- Authenticated users cannot touch settings
REVOKE ALL ON public.settings FROM authenticated, anon;
