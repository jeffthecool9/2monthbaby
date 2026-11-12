// Pure game state for one phone: my avatar, my partner's avatar, the current couple interaction.
// The controller feeds it events (taps, network messages, presence, timer ticks), renders the result,
// sends `outbox` over the Room and shows `hud` events in React.
import type { CharacterLook } from '../character/look'
import { CLIP_DURATION, type ClipName } from '../character/poses'
import type { NetMsg, PresenceState } from '../net/protocol'
import { BED_SLEEP_SPOTS, FURNITURE, type FurnitureAction, type FurnitureId } from '../world/layout'
import { NavGrid } from '../world/navgrid'
import type { ActionKind, Activity, EmoteKind, InteractionKind, Role, SoloClip, UserId, Vec2 } from '../types'
import { MISSIONS, affectionReward, missionReady, type Mission } from '../play/economy'
import { activityFor, type ActivityId } from '../play/minigame'
import { INTERACTION_DURATION, facingTo, needsRequest, planInteraction, resolveCrossing, type InteractMsg, type Plan } from './interactions'

export const WALK_SPEED = 1.6 // m/s
const KIND_LABEL: Record<InteractionKind, string> = { kiss: 'Kiss', hug: 'Hug', highfive: 'High five', comfort: 'Comfort', wave: 'Wave' }
/** Within this distance an action becomes a real couple interaction. */
export const PAIR_RANGE = 1.8
const SOLO_CLIP: Record<ActionKind, SoloClip> = { kiss: 'blow-kiss', hug: 'hug', highfive: 'highfive', comfort: 'comfort', wave: 'wave', dance: 'dance' }
const APPROACH_TIMEOUT = 4000
const SNAP_DISTANCE = 0.6

export type Identity = { userId: UserId; name: string; role: Role; look: CharacterLook; avatar?: string }

export type Avatar = Identity & {
  pos: Vec2
  facing: number
  activity: Activity
  path: Vec2[]
  clip: ClipName
  clipStart: number
  expression: EmoteKind | 'neutral'
  expressionUntil: number
  furniture?: FurnitureId
  online: boolean
  /** What to do on arrival at the end of `path`. */
  then?: { use: FurnitureId; action: FurnitureAction } | { mission: string }
  /** A chore in progress: pays when `until` passes, cancelled by walking away. */
  chore?: { id: string; until: number }
  /** Set when I just started something hands-on; the tick turns it into a HUD `activity` event. */
  announce?: { activity: ActivityId; furniture: FurnitureId; mission?: string }
}

export type ActiveInteraction = {
  id: string
  kind: InteractionKind
  initiator: UserId
  at: number
  plan: Plan
  phase: 'approach' | 'play'
  phaseStart: number
}

export type HudEvent =
  | { type: 'wheel-partner'; screen: { x: number; y: number } }
  | { type: 'wheel-furniture'; id: FurnitureId; screen: { x: number; y: number } }
  | { type: 'request'; id: string; from: string; kind: InteractionKind }
  | { type: 'bubble'; userId: UserId; text: string }
  | { type: 'partner-online'; online: boolean; name: string }
  | { type: 'wardrobe' }
  | { type: 'toast'; text: string }
  | { type: 'request-cancel' }
  | { type: 'earn'; amount: number; reason: string }
  | { type: 'activity'; activity: ActivityId; furniture: FurnitureId; mission?: string }
  | { type: 'game'; msg: Extract<NetMsg, { t: 'game' }> }

export type SimState = {
  me: Avatar
  partner: Avatar | null
  interaction: ActiveInteraction | null
  /** Interaction requests I sent while my partner was busy: id → kind. */
  outgoing: Record<string, InteractionKind>
  incoming: { id: string; kind: InteractionKind; from: UserId } | null
  /** Latest presence from my partner's phone, reconciled whenever we're not simulating them. */
  partnerPresence: PresenceState | null
  /** When each chore was last finished (ms). */
  missionsDone: Record<string, number>
  outbox: NetMsg[]
  hud: HudEvent[]
}

export type SimEvent =
  | { type: 'tick'; dt: number }
  | { type: 'tap-floor'; point: Vec2 }
  | { type: 'net'; msg: NetMsg }
  | { type: 'presence'; others: PresenceState[] }
  | { type: 'interact'; kind: InteractionKind; id: string }
  | { type: 'tap-partner'; screen: { x: number; y: number } }
  | { type: 'face'; facing: number }
  | { type: 'set-avatar'; avatar: string }
  | { type: 'action'; kind: ActionKind; id: string }
  | { type: 'mission'; id: string }
  | { type: 'complete-chore'; stars: 1 | 2 | 3 }
  | { type: 'exit-activity' }
  | { type: 'chore-mode'; hands: boolean }
  | { type: 'accept'; id: string }
  | { type: 'use-furniture'; id: FurnitureId; action: FurnitureAction }
  | { type: 'say'; text: string; id: string }
  | { type: 'emote'; emote: EmoteKind }
  | { type: 'look'; look: CharacterLook }

const grid = NavGrid.fromLayout()
const bedSpot = (role: Role) => BED_SLEEP_SPOTS[role === 'female' ? 0 : 1]
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)

function avatar(id: Identity, pos: Vec2, online: boolean): Avatar {
  return {
    ...id, pos: { ...pos }, facing: Math.PI, activity: online ? 'idle' : 'sleeping', path: [],
    clip: online ? 'idle' : 'sleep', clipStart: 0, expression: 'neutral', expressionUntil: 0, online,
  }
}

function asleep(a: Avatar, online: boolean): Avatar {
  return { ...a, pos: bedSpot(a.role), facing: 0, activity: 'sleeping', path: [], clip: 'sleep', clipStart: 0, then: undefined, furniture: 'bed', online }
}

export function createSim(me: Identity, start: Vec2, partner: Identity | null): SimState {
  return {
    me: avatar(me, start, true),
    partner: partner ? asleep(avatar(partner, bedSpot(partner.role), false), false) : null,
    interaction: null, outgoing: {}, incoming: null, partnerPresence: null, missionsDone: {}, outbox: [], hud: [],
  }
}

/** Clip each side plays during an interaction. */
export function interactionClip(kind: InteractionKind, initiator: boolean): ClipName {
  if (initiator) return kind
  if (kind === 'kiss') return 'receive-kiss'
  if (kind === 'comfort') return 'receive-comfort'
  return kind
}

function walkTo(a0: Avatar, target: Vec2, now: number): Avatar {
  const a: Avatar = { ...a0, chore: undefined }
  // Already there: no micro-walk, just arrive.
  if (dist(a.pos, target) < 0.12) return { ...a, pos: { ...target }, path: [], activity: 'idle', clip: 'idle', clipStart: now, furniture: undefined }
  const path = grid.findPath(a.pos, target)
  if (!path || path.length < 2) return { ...a, path: [], activity: 'idle', clip: 'idle', clipStart: now, furniture: undefined }
  return { ...a, path: path.slice(1), activity: 'walking', clip: 'walk', clipStart: now, furniture: undefined }
}

function advance(a: Avatar, dt: number, now: number): Avatar {
  if (!a.path.length) return a
  let pos = { ...a.pos }, facing = a.facing, path = [...a.path], left = (WALK_SPEED * dt) / 1000
  while (left > 0 && path.length) {
    const next = path[0], d = dist(pos, next)
    if (d > 1e-6) facing = facingTo(pos, next)
    if (d <= left) {
      pos = { ...next }
      left -= d
      path.shift()
    } else {
      pos = { x: pos.x + ((next.x - pos.x) * left) / d, z: pos.z + ((next.z - pos.z) * left) / d }
      left = 0
    }
  }
  const moved = { ...a, pos, facing, path }
  if (path.length) return moved
  if (a.then && 'mission' in a.then) {
    const m = MISSIONS.find((x) => x.id === (a.then as { mission: string }).mission)
    if (m) return startChore(moved, m, now)
  }
  if (a.then && 'use' in a.then) return useFurniture(moved, a.then.use, a.then.action, now)
  return { ...moved, activity: a.activity === 'walking' ? 'idle' : a.activity, clip: a.activity === 'walking' ? 'idle' : a.clip, clipStart: now }
}

function startChore(a: Avatar, m: Mission, now: number): Avatar {
  const act = activityFor({ mission: m.id })
  const f = FURNITURE.find((x) => x.id === m.furniture)!
  return {
    ...a, then: undefined, activity: 'idle', clip: 'chore', clipStart: now, chore: { id: m.id, until: now + m.durationMs },
    facing: facingTo(a.pos, f.pos),
    announce: act ? { activity: act, furniture: m.furniture, mission: m.id } : undefined,
  }
}

function useFurniture(a: Avatar, id: FurnitureId, action: FurnitureAction, now: number): Avatar {
  const f = FURNITURE.find((x) => x.id === id)
  if (!f) return a
  const act = activityFor({ furniture: id, action })
  const announce = act ? { activity: act, furniture: id } : undefined
  if (action === 'sleep') return { ...asleep(a, a.online), clipStart: now, announce }
  if (action === 'sit' || action === 'bathe') return { ...a, then: undefined, path: [], pos: { ...f.pos }, facing: f.rotY, activity: 'sitting', clip: 'sit', clipStart: now, furniture: id, announce }
  return { ...a, then: undefined, path: [], activity: 'idle', clip: 'idle', clipStart: now }
}

/** Stand up / stop whatever I'm doing, on a walkable spot next to it. */
function standUp(a: Avatar, now: number): Avatar {
  const pos = a.furniture ? (FURNITURE.find((f) => f.id === a.furniture)?.usePoint ?? grid.nearestWalkable(a.pos)) : a.pos
  return { ...a, pos: { ...pos }, chore: undefined, then: undefined, furniture: undefined, path: [], activity: 'idle', clip: 'idle', clipStart: now }
}

function startInteraction(s: SimState, msg: InteractMsg, now: number): SimState {
  if (!s.partner) return s
  const iAmInitiator = msg.from === s.me.userId
  const initiator = iAmInitiator ? s.me : s.partner
  const receiver = iAmInitiator ? s.partner : s.me
  const plan = planInteraction(msg.kind, initiator.pos, receiver.pos, grid)
  const go = (a: Avatar, spot: Vec2) => (dist(a.pos, spot) < 0.05 ? { ...a, path: [], furniture: undefined } : walkTo(a, spot, now))
  const ini = { ...go(initiator, plan.initiatorSpot), then: undefined, activity: 'interacting' as Activity }
  const rec = { ...go(receiver, plan.partnerSpot), then: undefined, activity: 'interacting' as Activity }
  // Any interaction supersedes pending requests in both directions.
  const hadRequest = !!s.incoming
  return {
    ...s,
    me: iAmInitiator ? ini : rec,
    partner: iAmInitiator ? rec : ini,
    interaction: { id: msg.id, kind: msg.kind, initiator: msg.from, at: msg.at, plan, phase: 'approach', phaseStart: now },
    incoming: null,
    outgoing: {},
    hud: hadRequest ? [...s.hud, { type: 'request-cancel' }] : s.hud,
  }
}

const clipFor = (a: Activity): ClipName => (a === 'sleeping' ? 'sleep' : a === 'sitting' ? 'sit' : 'idle')

/** Snap my partner to what their own phone says, unless I'm currently animating them. */
function reconcilePartner(s: SimState, now: number): SimState {
  const p = s.partnerPresence, partner = s.partner
  if (!p || !partner || !partner.online || s.interaction || partner.path.length) return s
  const activity = p.activity === 'walking' ? 'idle' : p.activity
  if (dist(partner.pos, p.pos) <= SNAP_DISTANCE && activity === partner.activity && p.furniture === partner.furniture) return s
  if (activity === partner.activity && activity === 'idle' && dist(partner.pos, p.pos) <= SNAP_DISTANCE) return s
  return { ...s, partner: { ...partner, pos: { ...p.pos }, facing: p.facing, activity, furniture: p.furniture, clip: clipFor(activity), clipStart: now } }
}

function endInteraction(s: SimState, now: number): SimState {
  const idle = (a: Avatar): Avatar => (a.online ? { ...a, path: [], activity: 'idle', clip: 'idle', clipStart: now } : a)
  return { ...s, interaction: null, me: idle(s.me), partner: s.partner ? idle(s.partner) : null }
}

function tickInteraction(s: SimState, now: number): SimState {
  const it = s.interaction
  if (!it || !s.partner) return s
  if (!s.partner.online) return endInteraction(s, now)
  if (it.phase === 'approach') {
    const arrived = !s.me.path.length && !s.partner.path.length
    if (!arrived && now - it.phaseStart < APPROACH_TIMEOUT) return s
    const iAmInitiator = it.initiator === s.me.userId
    const place = (a: Avatar, spot: Vec2, facing: number, initiator: boolean): Avatar => ({
      ...a, pos: { ...spot }, path: [], facing, clip: interactionClip(it.kind, initiator), clipStart: now, activity: 'interacting',
    })
    const me = iAmInitiator
      ? place(s.me, it.plan.initiatorSpot, it.plan.initiatorFacing, true)
      : place(s.me, it.plan.partnerSpot, it.plan.partnerFacing, false)
    const partner = iAmInitiator
      ? place(s.partner, it.plan.partnerSpot, it.plan.partnerFacing, false)
      : place(s.partner, it.plan.initiatorSpot, it.plan.initiatorFacing, true)
    return { ...s, me, partner, interaction: { ...it, phase: 'play', phaseStart: now } }
  }
  if (now - it.phaseStart < INTERACTION_DURATION[it.kind]) return s
  const reward = it.initiator === s.me.userId ? affectionReward(s.me.role, it.kind) : 0
  const done = endInteraction(s, now)
  return reward ? { ...done, hud: [...done.hud, { type: 'earn', amount: reward, reason: KIND_LABEL[it.kind] }] } : done
}

function onPresence(s: SimState, others: PresenceState[], now: number): SimState {
  if (!s.partner) {
    const p = others[0]
    if (!p) return s
    return { ...s, partner: { ...avatar(p, p.pos, true), facing: p.facing } }
  }
  const p = others.find((o) => o.userId === s.partner!.userId)
  if (!p) {
    if (!s.partner.online) return s
    const next = { ...s, partnerPresence: null, partner: asleep(s.partner, false), hud: [...s.hud, { type: 'partner-online' as const, online: false, name: s.partner.name }] }
    return next.interaction ? endInteraction(next, now) : next
  }
  let partner: Avatar = { ...s.partner, name: p.name, look: p.look, avatar: p.avatar ?? s.partner.avatar }
  const hud = [...s.hud]
  if (!s.partner.online) {
    const activity = p.activity === 'walking' ? 'idle' : p.activity
    partner = { ...partner, online: true, pos: { ...p.pos }, facing: p.facing, activity, path: [], clip: clipFor(activity), clipStart: now, furniture: p.furniture }
    hud.push({ type: 'partner-online', online: true, name: p.name })
  }
  // Keep the latest report; it's applied now or as soon as my copy of their walk ends.
  return reconcilePartner({ ...s, partner, hud, partnerPresence: p }, now)
}

function onNet(s: SimState, msg: NetMsg, now: number): SimState {
  const partner = s.partner
  if (!partner || ('from' in msg && msg.from !== partner.userId)) return s
  switch (msg.t) {
    case 'move':
      if (s.interaction) return s
      return { ...s, partner: { ...partner, pos: { ...msg.path[0] }, path: msg.path.slice(1), activity: 'walking', clip: 'walk', clipStart: now, furniture: undefined, then: undefined } }
    case 'interact': {
      if (msg.to !== s.me.userId) return s
      const cur = s.interaction
      if (cur) {
        if (cur.id === msg.id) return s
        const mine: InteractMsg = { t: 'interact', id: cur.id, from: cur.initiator, to: cur.initiator === s.me.userId ? partner.userId : s.me.userId, kind: cur.kind, at: cur.at }
        const winner = resolveCrossing(mine, msg)
        if (winner === mine) return s
        return startInteraction(endInteraction(s, now), msg, now)
      }
      return startInteraction(s, msg, now)
    }
    case 'interact-request':
      if (msg.to !== s.me.userId) return s
      return { ...s, incoming: { id: msg.id, kind: msg.kind, from: msg.from }, hud: [...s.hud, { type: 'request', id: msg.id, from: partner.name, kind: msg.kind }] }
    case 'interact-accept': {
      const kind = s.outgoing[msg.id]
      if (!kind || s.interaction) return s
      const { [msg.id]: _, ...outgoing } = s.outgoing
      const im: InteractMsg = { t: 'interact', id: msg.id, from: s.me.userId, to: partner.userId, kind, at: now }
      return startInteraction({ ...s, outgoing, outbox: [...s.outbox, im] }, im, now)
    }
    case 'interact-cancel':
      return s.interaction?.id === msg.id ? endInteraction(s, now) : s
    case 'chat':
      return { ...s, hud: [...s.hud, { type: 'bubble', userId: partner.userId, text: msg.text }] }
    case 'emote':
      return { ...s, partner: emoteOn(partner, msg.emote, now) }
    case 'look':
      return { ...s, partner: { ...partner, look: msg.look } }
    case 'game':
      return { ...s, hud: [...s.hud, { type: 'game', msg }] }
    case 'act':
      if (s.interaction || partner.activity === 'walking') return s
      return { ...s, partner: { ...partner, activity: 'idle', clip: msg.clip, clipStart: now } }
  }
}

function emoteOn(a: Avatar, emote: EmoteKind, now: number): Avatar {
  const free = a.activity === 'idle'
  return { ...a, expression: emote, expressionUntil: now + CLIP_DURATION[emote], ...(free ? { clip: emote, clipStart: now } : {}) }
}

export function step(s0: SimState, e: SimEvent, now: number): SimState {
  const s = { ...s0, outbox: s0.outbox, hud: s0.hud }
  switch (e.type) {
    case 'tick': {
      let me = advance(s.me, e.dt, now)
      let partner = s.partner ? advance(s.partner, e.dt, now) : null
      const settle = (a: Avatar): Avatar => {
        let out = a
        if (a.expression !== 'neutral' && now >= a.expressionUntil) out = { ...out, expression: 'neutral' }
        if (out.chore || !CLIP_DURATION[out.clip] || out.activity !== 'idle') return out
        const isEmote = out.clip !== 'idle' && out.clip !== 'walk' && out.clip !== 'sit' && out.clip !== 'sleep'
        return isEmote && now - out.clipStart >= CLIP_DURATION[out.clip] ? { ...out, clip: 'idle', clipStart: now } : out
      }
      me = settle(me)
      partner = partner ? settle(partner) : null
      let hud = s.hud, missionsDone = s.missionsDone
      if (me.announce) {
        hud = [...hud, { type: 'activity', ...me.announce }]
        me = { ...me, announce: undefined }
      }
      // Finished chore → pay it and start its cooldown.
      if (me.chore && now >= me.chore.until) {
        const m = MISSIONS.find((x) => x.id === me.chore!.id)!
        hud = [...hud, { type: 'earn', amount: m.reward, reason: m.label }]
        missionsDone = { ...missionsDone, [m.id]: now }
        me = { ...me, chore: undefined, clip: 'happy', clipStart: now }
      }
      return reconcilePartner(tickInteraction({ ...s, me, partner, hud, missionsDone }, now), now)
    }
    case 'tap-floor': {
      if (s.interaction) return s
      const me = walkTo({ ...s.me, then: undefined }, e.point, now)
      if (me.activity !== 'walking') return { ...s, me }
      return { ...s, me, outbox: [...s.outbox, { t: 'move', from: me.userId, path: [{ ...s.me.pos }, ...me.path], at: now }] }
    }
    case 'use-furniture': {
      if (s.interaction) return s
      const f = FURNITURE.find((x) => x.id === e.id)
      if (!f) return s
      if (e.action === 'wardrobe') return { ...s, hud: [...s.hud, { type: 'wardrobe' }] }
      const target = f.usePoint ?? grid.nearestWalkable(f.pos)
      let me = walkTo(s.me, target, now)
      me = me.activity === 'walking' ? { ...me, then: { use: e.id, action: e.action } } : useFurniture(me, e.id, e.action, now)
      const outbox = me.activity === 'walking' ? [...s.outbox, { t: 'move' as const, from: me.userId, path: [{ ...s.me.pos }, ...me.path], at: now }] : s.outbox
      const hud = me.announce ? [...s.hud, { type: 'activity' as const, ...me.announce }] : s.hud
      return { ...s, me: { ...me, announce: undefined }, outbox, hud }
    }
    case 'interact': {
      const p = s.partner
      if (!p || !p.online || s.interaction) return s
      if (needsRequest(p.activity)) {
        return { ...s, outgoing: { ...s.outgoing, [e.id]: e.kind }, outbox: [...s.outbox, { t: 'interact-request', id: e.id, from: s.me.userId, to: p.userId, kind: e.kind, at: now }] }
      }
      const msg: InteractMsg = { t: 'interact', id: e.id, from: s.me.userId, to: p.userId, kind: e.kind, at: now }
      return startInteraction({ ...s, outbox: [...s.outbox, msg] }, msg, now)
    }
    case 'mission': {
      const m = MISSIONS.find((x) => x.id === e.id)
      if (!m || s.interaction) return s
      if (!missionReady(m, s.missionsDone[m.id], now)) {
        const mins = Math.ceil((m.cooldownMs - (now - s.missionsDone[m.id])) / 60_000)
        return { ...s, hud: [...s.hud, { type: 'toast', text: `${m.emoji} ${m.label} again in ${mins} min` }] }
      }
      const f = FURNITURE.find((x) => x.id === m.furniture)!
      let me = walkTo(s.me, f.usePoint ?? grid.nearestWalkable(f.pos), now)
      if (me.activity !== 'walking') me = startChore(me, m, now)
      else me = { ...me, then: { mission: m.id } }
      const outbox = me.activity === 'walking' ? [...s.outbox, { t: 'move' as const, from: me.userId, path: [{ ...s.me.pos }, ...me.path], at: now }] : s.outbox
      const hud = me.announce ? [...s.hud, { type: 'activity' as const, ...me.announce }] : s.hud
      return { ...s, me: { ...me, announce: undefined }, outbox, hud }
    }
    case 'complete-chore': {
      const c = s.me.chore
      if (!c) return s
      const m = MISSIONS.find((x) => x.id === c.id)!
      const bonus = e.stars === 3 ? 1.5 : e.stars === 2 ? 1.2 : 1
      const stars = '⭐'.repeat(e.stars)
      return {
        ...s,
        me: { ...standUp(s.me, now), clip: 'happy', clipStart: now },
        missionsDone: { ...s.missionsDone, [m.id]: now },
        hud: [...s.hud, { type: 'earn', amount: Math.round(m.reward * bonus), reason: `${m.label} ${stars}` }],
      }
    }
    case 'chore-mode': {
      // Hands-on: the chore waits for the mini-game. Watching in 3D: it finishes on its timer.
      const c = s.me.chore
      if (!c) return s
      const m = MISSIONS.find((x) => x.id === c.id)!
      return { ...s, me: { ...s.me, chore: { ...c, until: e.hands ? Infinity : now + m.durationMs } } }
    }
    case 'exit-activity':
      if (s.interaction) return s
      return { ...s, me: standUp(s.me, now) }
    case 'action': {
      if (s.interaction || s.me.activity === 'walking') return s
      const p = s.partner
      const couple = e.kind !== 'dance'
      // Someone right next to me → the real thing, together. Otherwise I do it on my own.
      if (couple && p?.online && dist(p.pos, s.me.pos) <= PAIR_RANGE) return step(s, { type: 'interact', kind: e.kind as InteractionKind, id: e.id }, now)
      const clip = SOLO_CLIP[e.kind]
      const me: Avatar = { ...s.me, activity: 'idle', furniture: undefined, clip, clipStart: now }
      return { ...s, me, outbox: [...s.outbox, { t: 'act', from: s.me.userId, clip, at: now }] }
    }
    case 'set-avatar':
      return { ...s, me: { ...s.me, avatar: e.avatar } }
    case 'face':
      if (s.interaction || s.me.activity !== 'idle') return s
      return { ...s, me: { ...s.me, facing: e.facing } }
    case 'tap-partner': {
      const p = s.partner
      if (!p) return s
      if (!p.online) return { ...s, hud: [...s.hud, { type: 'toast', text: `${p.name} is asleep right now 😴` }] }
      return { ...s, hud: [...s.hud, { type: 'wheel-partner', screen: e.screen }] }
    }
    case 'accept': {
      if (!s.incoming || s.incoming.id !== e.id || s.interaction) return s
      const me: Avatar = { ...s.me, activity: 'idle', clip: 'idle', clipStart: now, furniture: undefined, pos: s.me.furniture ? grid.nearestWalkable(s.me.pos) : s.me.pos }
      return { ...s, me, incoming: null, outbox: [...s.outbox, { t: 'interact-accept', id: e.id, from: s.me.userId }] }
    }
    case 'say':
      return { ...s, outbox: [...s.outbox, { t: 'chat', id: e.id, from: s.me.userId, text: e.text, at: now }], hud: [...s.hud, { type: 'bubble', userId: s.me.userId, text: e.text }] }
    case 'emote':
      return { ...s, me: emoteOn(s.me, e.emote, now), outbox: [...s.outbox, { t: 'emote', from: s.me.userId, emote: e.emote, at: now }] }
    case 'look':
      return { ...s, me: { ...s.me, look: e.look }, outbox: [...s.outbox, { t: 'look', from: s.me.userId, look: e.look }] }
    case 'presence':
      return onPresence(s, e.others, now)
    case 'net':
      return onNet(s, e.msg, now)
  }
}
