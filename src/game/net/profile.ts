import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizeLook, type CharacterLook } from '../character/look'
import { cleanChat } from './protocol'
import type { Role, UserId } from '../types'

export type Profile = { id: UserId; name: string; role: Role; houseId: string; look: CharacterLook }
export type ChatRow = { id: string; sender: UserId; text: string; createdAt: string }

export function rowToProfile(row: unknown): Profile {
  const r = row as Record<string, unknown>
  if (!r || typeof r.id !== 'string' || typeof r.house_id !== 'string') throw new Error('bad profile row')
  if (r.role !== 'female' && r.role !== 'male') throw new Error(`bad role: ${String(r.role)}`)
  return {
    id: r.id,
    name: typeof r.display_name === 'string' && r.display_name ? r.display_name : r.role === 'female' ? 'Her' : 'Him',
    role: r.role,
    houseId: r.house_id,
    look: sanitizeLook(r.look, r.role),
  }
}

const COLS = 'id, display_name, role, house_id, look'

export async function loadMyProfile(c: SupabaseClient): Promise<Profile> {
  const { data: auth } = await c.auth.getUser()
  if (!auth.user) throw new Error('not signed in')
  const { data, error } = await c.from('profiles').select(COLS).eq('id', auth.user.id).single()
  if (error) throw error
  return rowToProfile(data)
}

export async function loadPartner(c: SupabaseClient, me: Profile): Promise<Profile | null> {
  const { data, error } = await c.from('profiles').select(COLS).eq('house_id', me.houseId).neq('id', me.id).limit(1)
  if (error) throw error
  return data?.[0] ? rowToProfile(data[0]) : null
}

export async function saveLook(c: SupabaseClient, look: CharacterLook): Promise<void> {
  const { data: auth } = await c.auth.getUser()
  if (!auth.user) return
  const { error } = await c.from('profiles').update({ look }).eq('id', auth.user.id)
  if (error) throw error
}

export async function loadRecentChat(c: SupabaseClient, houseId: string, limit = 50): Promise<ChatRow[]> {
  const { data, error } = await c
    .from('chat_messages')
    .select('id, sender, text, created_at')
    .eq('house_id', houseId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).reverse().map((r) => ({ id: r.id, sender: r.sender, text: r.text, createdAt: r.created_at }))
}

export async function insertChat(c: SupabaseClient, houseId: string, text: string): Promise<void> {
  const clean = cleanChat(text)
  const { data: auth } = await c.auth.getUser()
  if (!clean || !auth.user) return
  const { error } = await c.from('chat_messages').insert({ house_id: houseId, sender: auth.user.id, text: clean })
  if (error) throw error
}
