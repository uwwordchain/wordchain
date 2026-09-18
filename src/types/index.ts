export type User = {
  id: string
  email: string
  phone: string | null
  first_name: string
  display_name: string | null
  is_admin: boolean
  created_at: string
}

export type GameDay = {
  id: string
  play_date: string
  word: string
  launched_at: string | null
  closes_at: string
}

export type Chain = {
  id: string
  game_day_id: string
  slot: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  starter_user_id: string | null
  launched_at: string
  last_activity_at: string
}

export type ChainWord = {
  id: string
  chain_id: string
  user_id: string
  word: string
  position: number
  submitted_at: string
  user?: User
}

export type ChainInvite = {
  id: string
  chain_id: string
  inviter_user_id: string | null
  invitee_phone: string | null
  invitee_user_id: string | null
  token: string
  used_at: string | null
}

export type WordQueueEntry = {
  id: string
  play_date: string
  word: string
}

export type ChainStarterEntry = {
  id: string
  play_date: string
  chain_slot: string
  user_id: string | null
  phone_override: string | null
  user?: User
}

export type Ad = {
  id: string
  ad_type: 'banner' | 'interstitial'
  name: string | null
  image_url: string | null
  link_url: string | null
  is_active: boolean
}
