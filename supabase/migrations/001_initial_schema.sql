-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users (players)
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  phone text,
  first_name text not null,
  display_name text,
  pin_hash text not null,
  is_admin boolean default false,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

-- Word queue (pre-scheduled words of the day)
create table public.word_queue (
  id uuid primary key default uuid_generate_v4(),
  play_date date unique not null,
  word text not null,
  created_at timestamptz default now()
);

-- Game days (one row per day once game starts)
create table public.game_days (
  id uuid primary key default uuid_generate_v4(),
  play_date date unique not null,
  word text not null,
  launched_at timestamptz,
  closes_at timestamptz not null,
  created_at timestamptz default now()
);

-- Chain starters queue (pre-scheduled who starts each chain)
create table public.chain_starters_queue (
  id uuid primary key default uuid_generate_v4(),
  play_date date not null,
  chain_slot text not null check (chain_slot in ('A','B','C','D','E','F')),
  user_id uuid references public.users(id),  -- null = random
  phone_override text,                        -- non-user phone number
  created_at timestamptz default now(),
  unique(play_date, chain_slot)
);

-- Chains (one per chain per day, created at launch time)
create table public.chains (
  id uuid primary key default uuid_generate_v4(),
  game_day_id uuid references public.game_days(id) not null,
  slot text not null check (slot in ('A','B','C','D','E','F')),
  starter_user_id uuid references public.users(id),
  launched_at timestamptz default now(),
  last_activity_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(game_day_id, slot)
);

-- Chain words (each word submitted)
create table public.chain_words (
  id uuid primary key default uuid_generate_v4(),
  chain_id uuid references public.chains(id) not null,
  user_id uuid references public.users(id) not null,
  word text not null,
  position integer not null,
  submitted_at timestamptz default now(),
  unique(chain_id, position),
  unique(chain_id, word)  -- no repeats within a chain
);

-- Chain invites (who invited whom)
create table public.chain_invites (
  id uuid primary key default uuid_generate_v4(),
  chain_id uuid references public.chains(id) not null,
  inviter_user_id uuid references public.users(id),
  invitee_phone text,
  invitee_user_id uuid references public.users(id),
  token text unique not null,  -- the share link token
  used_at timestamptz,
  created_at timestamptz default now()
);

-- Ads
create table public.ads (
  id uuid primary key default uuid_generate_v4(),
  image_url text,
  is_banner_active boolean default false,
  is_interstitial_active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies
alter table public.users enable row level security;
alter table public.word_queue enable row level security;
alter table public.game_days enable row level security;
alter table public.chain_starters_queue enable row level security;
alter table public.chains enable row level security;
alter table public.chain_words enable row level security;
alter table public.chain_invites enable row level security;
alter table public.ads enable row level security;

-- Public read for game_days (players need to see WOTD)
create policy "Public read game_days" on public.game_days
  for select using (true);

-- Public read for ads
create policy "Public read ads" on public.ads
  for select using (true);

-- Users can read their own record
create policy "Users read own" on public.users
  for select using (auth.uid()::text = id::text);

-- Authenticated users can read chains and words (to see the chain they're in)
create policy "Auth read chains" on public.chains
  for select using (auth.role() = 'authenticated');

create policy "Auth read chain_words" on public.chain_words
  for select using (auth.role() = 'authenticated');

-- Only service role can write to most tables (admin panel uses service role)
