-- Make user deletion work: FK references to users had no ON DELETE rule,
-- so deleting any user who played/invited/was scheduled failed outright.
-- Policy: preserve game history — words stay in their chains (shown as
-- "Former player"), all user references null out on delete.

-- chain_words.user_id must become nullable to allow SET NULL
ALTER TABLE public.chain_words ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.chain_words DROP CONSTRAINT chain_words_user_id_fkey;
ALTER TABLE public.chain_words ADD CONSTRAINT chain_words_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.chains DROP CONSTRAINT chains_starter_user_id_fkey;
ALTER TABLE public.chains ADD CONSTRAINT chains_starter_user_id_fkey
  FOREIGN KEY (starter_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.chain_invites DROP CONSTRAINT chain_invites_inviter_user_id_fkey;
ALTER TABLE public.chain_invites ADD CONSTRAINT chain_invites_inviter_user_id_fkey
  FOREIGN KEY (inviter_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.chain_invites DROP CONSTRAINT chain_invites_invitee_user_id_fkey;
ALTER TABLE public.chain_invites ADD CONSTRAINT chain_invites_invitee_user_id_fkey
  FOREIGN KEY (invitee_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Scheduled chain starter: null user_id already means "random", so a
-- deleted user's future slots simply fall back to random selection.
ALTER TABLE public.chain_starters_queue DROP CONSTRAINT chain_starters_queue_user_id_fkey;
ALTER TABLE public.chain_starters_queue ADD CONSTRAINT chain_starters_queue_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
