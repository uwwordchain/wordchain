-- Performance indexes.
-- Postgres does NOT automatically index foreign key columns; these cover
-- the app's hottest lookups. (play_date / token / email columns already
-- have indexes from their UNIQUE constraints.)

-- Chain words are always looked up by chain (play screen, admin, graphic)
CREATE INDEX IF NOT EXISTS idx_chain_words_chain_id ON public.chain_words (chain_id);

-- "Has this user played today?" lookup on the home page
CREATE INDEX IF NOT EXISTS idx_chain_words_user_id ON public.chain_words (user_id);

-- Chains are always looked up by game day
CREATE INDEX IF NOT EXISTS idx_chains_game_day_id ON public.chains (game_day_id);

-- Invite lookups by chain, and sent/received counts on the players page
CREATE INDEX IF NOT EXISTS idx_chain_invites_chain_id ON public.chain_invites (chain_id);
CREATE INDEX IF NOT EXISTS idx_chain_invites_inviter ON public.chain_invites (inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_chain_invites_invitee ON public.chain_invites (invitee_user_id);

-- Active ad lookups (banner + interstitial on every page view)
CREATE INDEX IF NOT EXISTS idx_ads_type_active ON public.ads (ad_type, is_active);
