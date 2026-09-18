import { createAdminClient } from '@/lib/supabase/server'
import { PlayersTable, type PlayerRow } from './PlayersTable'

export default async function AdminPlayersPage() {
  const admin = await createAdminClient()

  // All three queries are independent — run them in parallel
  const [{ data: users }, { data: chainWords }, { data: invites }] = await Promise.all([
    admin
      .from('users')
      .select('id, email, phone, first_name, display_name, is_admin, created_at')
      .order('created_at', { ascending: true }),
    admin.from('chain_words').select('user_id, chain_id'),
    admin.from('chain_invites').select('inviter_user_id, invitee_user_id'),
  ])

  // Chains played per user (distinct chain_id in chain_words)
  const chainsByUser: Record<string, Set<string>> = {}
  for (const row of chainWords ?? []) {
    if (!chainsByUser[row.user_id]) chainsByUser[row.user_id] = new Set()
    chainsByUser[row.user_id].add(row.chain_id)
  }

  // Sent / received invites (distinct counterparties, shown as emails)
  const emailById: Record<string, string> = {}
  for (const u of users ?? []) emailById[u.id] = u.email

  const sentByUser: Record<string, Set<string>> = {}
  const recvByUser: Record<string, Set<string>> = {}
  for (const inv of invites ?? []) {
    if (inv.inviter_user_id && inv.invitee_user_id) {
      if (!sentByUser[inv.inviter_user_id]) sentByUser[inv.inviter_user_id] = new Set()
      sentByUser[inv.inviter_user_id].add(inv.invitee_user_id)
      if (!recvByUser[inv.invitee_user_id]) recvByUser[inv.invitee_user_id] = new Set()
      recvByUser[inv.invitee_user_id].add(inv.inviter_user_id)
    }
  }

  const idsToEmails = (ids?: Set<string>) =>
    [...(ids ?? [])].map(id => emailById[id]).filter(Boolean).sort()

  const rows: PlayerRow[] = (users ?? []).map(u => ({
    id: u.id,
    name: u.display_name ?? u.first_name,
    email: u.email,
    phone: u.phone,
    is_admin: u.is_admin,
    joined: u.created_at,
    chains: chainsByUser[u.id]?.size ?? 0,
    sentEmails: idsToEmails(sentByUser[u.id]),
    recvEmails: idsToEmails(recvByUser[u.id]),
  }))

  // Sorted by most chains (per wireframe)
  rows.sort((a, b) => b.chains - a.chains)

  return <PlayersTable initialRows={rows} />
}
