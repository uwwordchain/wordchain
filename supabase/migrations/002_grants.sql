-- Grant service_role full access (bypasses RLS for admin operations)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant anon role access to public-facing tables only
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.game_days TO anon;
GRANT SELECT ON public.ads TO anon;

-- Grant authenticated role access for players
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.game_days TO authenticated;
GRANT SELECT ON public.ads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.chains TO authenticated;
GRANT SELECT, INSERT ON public.chain_words TO authenticated;
GRANT SELECT, INSERT ON public.chain_invites TO authenticated;
GRANT SELECT ON public.word_queue TO authenticated;
GRANT SELECT ON public.chain_starters_queue TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
