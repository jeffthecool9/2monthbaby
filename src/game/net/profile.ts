import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizeLook, type CharacterLook } from '../character/look'
import { cleanChat } from './protocol'
import type { Role, UserId } from '../types'

export type Profile = { id: UserId; name: string; role: Role; houseId: string; look: CharacterLook; avatar?: string }
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
    ...(typeof r.avatar_path === 'string' && r.avatar_path ? { avatar: r.avatar_path } : {}),
  }
}

const COLS = 'id, display_name, role, house_id, look, avatar_path'
const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_BYTES = 50 * 1024 * 1024

/** Upload my VRoid character and remember it on my profile. Returns the versioned path. */
export async function uploadAvatar(c: SupabaseClient, file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith('.vrm')) throw new Error('Please choose a .vrm file exported from VRoid Studio.')
  if (file.size > MAX_AVATAR_BYTES) throw new Error('That file is over 50 MB. In VRoid export, turn on polygon reduction and use a 2048 texture atlas.')
  const { data: auth } = await c.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')
  const key = `${auth.user.id}/avatar.vrm`
  const { error } = await c.storage.from(AVATAR_BUCKET).upload(key, file, { upsert: true, contentType: 'model/gltf-binary', cacheControl: '3600' })
  if (error) throw error
  const path = `${key}?v=${Date.now()}`
  const { error: e2 } = await c.from('profiles').update({ avatar_path: path }).eq('id', auth.user.id)
  if (e2) throw e2
  return path
}

/** Private, time-limited URL for a stored avatar (only housemates are allowed by storage policy). */
export async function avatarUrl(c: SupabaseClient, path: string): Promise<string> {
  const [key, version] = path.split('?')
  const { data, error } = await c.storage.from(AVATAR_BUCKET).createSignedUrl(key, 60 * 60 * 24)
  if (error || !data) throw error ?? new Error('no url')
  return version ? `${data.signedUrl}&${version}` : data.signedUrl
}

/** Profiles query that still works before migration 0002 has added the avatar_path column. */
async function queryProfiles(c: SupabaseClient, filter: (q: ReturnType<ReturnType<SupabaseClient['from']>['select']>) => PromiseLike<{ data: unknown[] | null; error: { code?: string } | null }>) {
  const first = await filter(c.from('profiles').select(COLS))
  if (first.error?.code === '42703') return filter(c.from('profiles').select(COLS.replace(', avatar_path', '')))
  return first
}

export async function loadMyProfile(c: SupabaseClient): Promise<Profile> {
  const { data: auth } = await c.auth.getUser()
  if (!auth.user) throw new Error('not signed in')
  const id = auth.user.id
  const { data, error } = await queryProfiles(c, (q) => q.eq('id', id).limit(1))
  if (error) throw error
  if (!data?.length) throw { code: 'PGRST116' }
  return rowToProfile(data[0])
}

export async function loadPartner(c: SupabaseClient, me: Profile): Promise<Profile | null> {
  const { data, error } = await queryProfiles(c, (q) => q.eq('house_id', me.houseId).neq('id', me.id).limit(1))
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
