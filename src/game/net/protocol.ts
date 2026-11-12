import { LOOK_OPTIONS, type CharacterLook } from '../character/look'
import type { FurnitureId } from '../world/layout'
import type { Activity, EmoteKind, InteractionKind, Role, SoloClip, UserId, Vec2 } from '../types'

export type PresenceState = {
  userId: UserId
  name: string
  role: Role
  look: CharacterLook
  pos: Vec2
  facing: number
  activity: Activity
  furniture?: FurnitureId
  /** Storage path of a custom VRoid (.vrm) character, with a ?v= version suffix. */
  avatar?: string
}

export type NetMsg =
  | { t: 'move'; from: UserId; path: Vec2[]; at: number }
  | { t: 'interact'; id: string; from: UserId; to: UserId; kind: InteractionKind; at: number }
  | { t: 'interact-request'; id: string; from: UserId; to: UserId; kind: InteractionKind; at: number }
  | { t: 'interact-accept'; id: string; from: UserId }
  | { t: 'interact-cancel'; id: string; from: UserId }
  | { t: 'chat'; id: string; from: UserId; text: string; at: number }
  | { t: 'emote'; from: UserId; emote: EmoteKind; at: number }
  | { t: 'look'; from: UserId; look: CharacterLook }
  | { t: 'act'; from: UserId; clip: SoloClip; at: number }
  | { t: 'game'; from: UserId; game: GameId; op: GameOp; id: string; value?: number; at: number }

export type GameId = 'ttt' | 'tot'
export type GameOp = 'invite' | 'accept' | 'decline' | 'move' | 'next' | 'quit'
const GAME_IDS: readonly GameId[] = ['ttt', 'tot']
const GAME_OPS: readonly GameOp[] = ['invite', 'accept', 'decline', 'move', 'next', 'quit']

export const QUICK_MESSAGES = ['Hello 👋', 'Byebye 👋', 'Kiss 😘', 'Miss you 🥺', 'Good night 🌙', 'Hungry 🍜', 'Love you ❤️']
export const MAX_CHAT = 200
const MAX_PATH = 400

export const INTERACTION_KINDS: readonly InteractionKind[] = ['kiss', 'hug', 'highfive', 'comfort', 'wave']
export const EMOTE_KINDS: readonly EmoteKind[] = ['happy', 'shy', 'angry', 'crying', 'love', 'sleepy']
export const SOLO_CLIPS: readonly SoloClip[] = ['blow-kiss', 'hug', 'highfive', 'comfort', 'wave', 'dance']

export function cleanChat(s: string): string | null {
  const t = s.trim()
  return t ? t.slice(0, MAX_CHAT) : null
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isVec = (v: unknown): v is Vec2 =>
  !!v && typeof v === 'object' && isNum((v as Vec2).x) && isNum((v as Vec2).z)

export function isValidLook(v: unknown): v is CharacterLook {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (Object.keys(LOOK_OPTIONS) as (keyof CharacterLook)[]).every(
    (k) => typeof o[k] === 'string' && LOOK_OPTIONS[k].includes(o[k] as string),
  )
}

const ACTIVITIES: readonly Activity[] = ['idle', 'walking', 'interacting', 'sitting', 'sleeping']

export function parsePresence(x: unknown): PresenceState | null {
  if (!x || typeof x !== 'object') return null
  const s = x as Record<string, unknown>
  if (!isStr(s.userId) || typeof s.name !== 'string' || (s.role !== 'female' && s.role !== 'male')) return null
  if (!isValidLook(s.look) || !isVec(s.pos) || !isNum(s.facing) || !ACTIVITIES.includes(s.activity as Activity)) return null
  const out: PresenceState = {
    userId: s.userId, name: s.name.slice(0, 40), role: s.role, look: { ...s.look },
    pos: { x: s.pos.x, z: s.pos.z }, facing: s.facing, activity: s.activity as Activity,
  }
  if (typeof s.furniture === 'string') out.furniture = s.furniture as FurnitureId
  if (typeof s.avatar === 'string' && s.avatar.length <= 200) out.avatar = s.avatar
  return out
}

export function parseMsg(x: unknown): NetMsg | null {
  if (!x || typeof x !== 'object') return null
  const m = x as Record<string, unknown>
  switch (m.t) {
    case 'move':
      return isStr(m.from) && isNum(m.at) && Array.isArray(m.path) && m.path.length > 0 && m.path.length <= MAX_PATH && m.path.every(isVec)
        ? { t: 'move', from: m.from, path: m.path.map((p: Vec2) => ({ x: p.x, z: p.z })), at: m.at }
        : null
    case 'interact':
    case 'interact-request':
      return isStr(m.id) && isStr(m.from) && isStr(m.to) && isNum(m.at) && INTERACTION_KINDS.includes(m.kind as InteractionKind)
        ? { t: m.t, id: m.id, from: m.from, to: m.to, kind: m.kind as InteractionKind, at: m.at }
        : null
    case 'interact-accept':
    case 'interact-cancel':
      return isStr(m.id) && isStr(m.from) ? { t: m.t, id: m.id, from: m.from } : null
    case 'chat': {
      const text = typeof m.text === 'string' ? cleanChat(m.text) : null
      return isStr(m.id) && isStr(m.from) && isNum(m.at) && text ? { t: 'chat', id: m.id, from: m.from, text, at: m.at } : null
    }
    case 'emote':
      return isStr(m.from) && isNum(m.at) && EMOTE_KINDS.includes(m.emote as EmoteKind)
        ? { t: 'emote', from: m.from, emote: m.emote as EmoteKind, at: m.at }
        : null
    case 'look':
      return isStr(m.from) && isValidLook(m.look) ? { t: 'look', from: m.from, look: { ...m.look } } : null
    case 'game': {
      if (!isStr(m.from) || !isStr(m.id) || !isNum(m.at) || !GAME_IDS.includes(m.game as GameId) || !GAME_OPS.includes(m.op as GameOp)) return null
      const out: NetMsg = { t: 'game', from: m.from, game: m.game as GameId, op: m.op as GameOp, id: m.id, at: m.at }
      if (isNum(m.value)) out.value = m.value
      return out
    }
    case 'act':
      return isStr(m.from) && isNum(m.at) && SOLO_CLIPS.includes(m.clip as SoloClip) ? { t: 'act', from: m.from, clip: m.clip as SoloClip, at: m.at } : null
    default:
      return null
  }
}
