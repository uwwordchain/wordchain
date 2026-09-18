-- Collect full names at signup: single "Name" field split into first/last.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name text;
