import { describe, expect, test } from 'vitest'
import { createSim, step, type SimEvent, type SimState } from '../../src/game/sim/sim'
import { defaultLook } from '../../src/game/character/look'
import { FURNITURE } from '../../src/game/world/layout'
import type { NetMsg, PresenceState } from '../../src/game/net/protocol'
import { describeLoadError, setupKey } from '../../src/game/sessionSetup'

const her = { userId: 'her', name: 'Her', role: 'female' as const, look: defaultLook('female') }
const him = { userId: 'him', name: 'Him', role: 'male' as const, look: defaultLook('male') }
const pres = (s: SimState, patch: Partial<PresenceState> = {}): PresenceState => ({
  userId: s.me.userId, name: s.me.name, role: s.me.role, look: s.me.look, pos: s.me.pos, facing: s.me.facing, activity: s.me.activity, ...patch,
})
const tickFor = (s: SimState, ms: number, from: number) => {
  let st = s
  for (let t = 0; t < ms; t += 50) st = step(st, { type: 'tick', dt: 50 }, from + t)
  return st
}
const sent = (s: SimState, t: NetMsg['t']) => s.outbox.filter((m) => m.t === t)
function pair(): { a: SimState; b: SimState } {
  let a = createSim(her, { x: 2, z: 5.8 }, him)
  let b = createSim(him, { x: 4.6, z: 4.2 }, her)
  a = step(a, { type: 'presence', others: [pres(b)] }, 0)
  b = step(b, { type: 'presence', others: [pres(a)] }, 0)
  return { a: { ...a, outbox: [], hud: [] }, b: { ...b, outbox: [], hud: [] } }
}

describe('C1: the game is rebuilt only when the signed-in user changes', () => {
  test('a refreshed session for the same user keeps the same key', () => {
    const s1 = { user: { id: 'u1' }, access_token: 'a' }
    const s2 = { user: { id: 'u1' }, access_token: 'b' }
    expect(setupKey(s1)).toBe(setupKey(s2))
  })
  test('signing out or switching user changes the key', () => {
    expect(setupKey({ user: { id: 'u1' } })).not.toBe(setupKey({ user: { id: 'u2' } }))
    expect(setupKey(null)).toBeNull()
    expect(setupKey(undefined)).toBeNull()
  })
})

describe('I1: partner presence that arrives mid-walk is not lost', () => {
  test('partner sat down while my copy of their walk was still going → shown sitting once the walk ends', () => {
    let { a } = pair()
    const sofa = FURNITURE.find((f) => f.id === 'sofa')!
    const path = [{ x: 4.6, z: 4.2 }, { x: 4.4, z: 4.5 }, sofa.usePoint!]
    a = step(a, { type: 'net', msg: { t: 'move', from: 'him', path, at: 0 } }, 0)
    // His "now sitting" presence lands while her phone is still animating his walk.
    a = step(a, { type: 'presence', others: [{ ...pres(pair().b), pos: sofa.pos, activity: 'sitting', furniture: 'sofa' }] }, 100)
    a = tickFor(a, 3000, 150)
    expect(a.partner!.activity).toBe('sitting')
    expect(a.partner!.furniture).toBe('sofa')
  })
})

describe('I2: request/accept never makes the phones disagree', () => {
  test('accepting a request while an interaction is playing is ignored', () => {
    let { b } = pair()
    b = step(b, { type: 'net', msg: { t: 'interact-request', id: 'r1', from: 'her', to: 'him', kind: 'hug', at: 1 } }, 1)
    b = step(b, { type: 'interact', kind: 'hug', id: 'h1' }, 2)
    expect(b.interaction?.id).toBe('h1')
    const before = b
    b = step({ ...b, outbox: [] }, { type: 'accept', id: 'r1' }, 3)
    expect(sent(b, 'interact-accept')).toHaveLength(0)
    expect(b.me.activity).toBe(before.me.activity)
    expect(b.interaction?.id).toBe('h1')
  })

  test('an accept arriving while an interaction is playing does not replace it', () => {
    let { a } = pair()
    a = step(a, { type: 'presence', others: [{ ...pres(pair().b), activity: 'sitting' }] }, 1)
    a = step(a, { type: 'interact', kind: 'hug', id: 'r1' }, 2)
    a = step(a, { type: 'presence', others: [{ ...pres(pair().b), activity: 'idle' }] }, 3)
    a = step(a, { type: 'net', msg: { t: 'interact', id: 'h1', from: 'him', to: 'her', kind: 'kiss', at: 4 } }, 4)
    a = step({ ...a, outbox: [] }, { type: 'net', msg: { t: 'interact-accept', id: 'r1', from: 'him' } }, 5)
    expect(a.interaction?.id).toBe('h1')
    expect(sent(a, 'interact')).toHaveLength(0)
  })

  test('starting any interaction clears pending requests and dismisses the card', () => {
    let { b } = pair()
    b = step(b, { type: 'net', msg: { t: 'interact-request', id: 'r1', from: 'her', to: 'him', kind: 'hug', at: 1 } }, 1)
    b = step({ ...b, hud: [] }, { type: 'net', msg: { t: 'interact', id: 'h1', from: 'her', to: 'him', kind: 'kiss', at: 2 } }, 2)
    expect(b.incoming).toBeNull()
    expect(b.hud).toContainEqual({ type: 'request-cancel' })
  })
})

describe('M2 (re-graded): tapping an offline partner explains instead of doing nothing', () => {
  test('offline partner → toast, no wheel', () => {
    const s = step(createSim(him, { x: 4.6, z: 4.2 }, her), { type: 'tap-partner', screen: { x: 1, y: 2 } } as SimEvent, 0)
    expect(s.hud.some((h) => h.type === 'wheel-partner')).toBe(false)
    expect(s.hud.some((h) => h.type === 'toast')).toBe(true)
  })
  test('online partner → wheel', () => {
    const { a } = pair()
    const s = step(a, { type: 'tap-partner', screen: { x: 1, y: 2 } } as SimEvent, 0)
    expect(s.hud).toContainEqual({ type: 'wheel-partner', screen: { x: 1, y: 2 } })
  })
})

describe('wardrobe preview', () => {
  test('turning to face the camera changes my facing and tells my partner via presence only', () => {
    const { a } = pair()
    const s = step(a, { type: 'face', facing: 1.2 }, 0)
    expect(s.me.facing).toBeCloseTo(1.2)
    expect(s.outbox).toHaveLength(0)
  })
  test('facing is ignored while walking or interacting', () => {
    let { a } = pair()
    a = step(a, { type: 'tap-floor', point: { x: 5, z: 4 } }, 0)
    const s = step(a, { type: 'face', facing: 2 }, 1)
    expect(s.me.facing).toBe(a.me.facing)
  })
})

describe('M3 (re-graded): load errors are explained for a person, not a developer', () => {
  test('missing profile row → not-linked message', () => {
    expect(describeLoadError({ code: 'PGRST116' }).kind).toBe('not-linked')
  })
  test('network failure → retryable message', () => {
    expect(describeLoadError(new TypeError('Failed to fetch')).kind).toBe('network')
  })
})
