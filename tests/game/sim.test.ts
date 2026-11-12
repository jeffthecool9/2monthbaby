import { describe, expect, test } from 'vitest'
import { createSim, step, type SimEvent, type SimState } from '../../src/game/sim/sim'
import { defaultLook } from '../../src/game/character/look'
import { BED_SLEEP_SPOTS } from '../../src/game/world/layout'
import type { NetMsg, PresenceState } from '../../src/game/net/protocol'

const her = { userId: 'her', name: 'Her', role: 'female' as const, look: defaultLook('female') }
const him = { userId: 'him', name: 'Him', role: 'male' as const, look: defaultLook('male') }
const presenceOf = (s: SimState): PresenceState => ({
  userId: s.me.userId, name: s.me.name, role: s.me.role, look: s.me.look, pos: s.me.pos, facing: s.me.facing, activity: s.me.activity,
})
const run = (s: SimState, events: SimEvent[], start = 0): SimState => events.reduce((acc, e, i) => step(acc, e, start + i), s)
const tickFor = (s: SimState, ms: number, from: number): SimState => {
  let st = s
  for (let t = 0; t < ms; t += 50) st = step(st, { type: 'tick', dt: 50 }, from + t)
  return st
}
const sent = (s: SimState, t: NetMsg['t']) => s.outbox.filter((m) => m.t === t)

function pair(): { a: SimState; b: SimState } {
  let a = createSim(her, { x: 2, z: 5.8 }, him)
  let b = createSim(him, { x: 4.6, z: 4.2 }, her)
  a = step(a, { type: 'presence', others: [presenceOf(b)] }, 0)
  b = step(b, { type: 'presence', others: [presenceOf(a)] }, 0)
  return { a: { ...a, outbox: [] }, b: { ...b, outbox: [] } }
}

describe('sim', () => {
  test('tapping the floor walks me there and tells my partner', () => {
    const { a } = pair()
    const s = step(a, { type: 'tap-floor', point: { x: 5, z: 4 } }, 10)
    expect(s.me.activity).toBe('walking')
    const moves = sent(s, 'move') as Extract<NetMsg, { t: 'move' }>[]
    expect(moves).toHaveLength(1)
    expect(moves[0].from).toBe('her')
    expect(moves[0].path[moves[0].path.length - 1]).toEqual({ x: 5, z: 4 })
    const later = tickFor(s, 5000, 20)
    expect(later.me.activity).toBe('idle')
    expect(Math.hypot(later.me.pos.x - 5, later.me.pos.z - 4)).toBeLessThan(0.05)
  })

  test("partner's move message makes them walk at 1.6 m/s", () => {
    const { b } = pair()
    const path = [{ x: 2, z: 5.8 }, { x: 4, z: 5.8 }]
    let s = step(b, { type: 'net', msg: { t: 'move', from: 'her', path, at: 0 } }, 0)
    expect(s.partner!.activity).toBe('walking')
    s = tickFor(s, 500, 1)
    expect(s.partner!.pos.x).toBeCloseTo(2 + 0.8, 1)
  })

  test('interacting with a sleeping partner sends a request instead', () => {
    let { a } = pair()
    a = step(a, { type: 'presence', others: [{ ...presenceOf(pair().b), activity: 'sleeping' }] }, 1)
    const s = step(a, { type: 'interact', kind: 'hug', id: 'i1' }, 2)
    expect(sent(s, 'interact-request')).toHaveLength(1)
    expect(sent(s, 'interact')).toHaveLength(0)
    expect(s.interaction).toBeNull()
  })

  test('interacting with a free partner starts the interaction on both phones', () => {
    let { a, b } = pair()
    a = step(a, { type: 'interact', kind: 'hug', id: 'i1' }, 100)
    const msg = sent(a, 'interact')[0]
    expect(a.interaction?.id).toBe('i1')
    b = step(b, { type: 'net', msg }, 120)
    expect(b.interaction?.id).toBe('i1')
    a = tickFor(a, 8000, 200)
    b = tickFor(b, 8000, 200)
    expect(a.interaction).toBeNull()
    expect(a.me.activity).toBe('idle')
    expect(b.me.activity).toBe('idle')
  })

  test('crossing taps: both phones play the same single interaction', () => {
    let { a, b } = pair()
    a = step(a, { type: 'interact', kind: 'hug', id: 'from-her' }, 1000)
    b = step(b, { type: 'interact', kind: 'kiss', id: 'from-him' }, 1000)
    const ma = sent(a, 'interact')[0], mb = sent(b, 'interact')[0]
    a = step(a, { type: 'net', msg: mb }, 1100)
    b = step(b, { type: 'net', msg: ma }, 1100)
    expect(a.interaction?.id).toBeDefined()
    expect(a.interaction?.id).toBe(b.interaction?.id)
  })

  test('partner leaving mid-interaction: I return to idle and they appear asleep in bed', () => {
    let { a } = pair()
    a = step(a, { type: 'interact', kind: 'hug', id: 'i1' }, 0)
    a = tickFor(a, 1000, 1)
    a = step(a, { type: 'presence', others: [] }, 1100)
    a = tickFor(a, 5000, 1200)
    expect(a.interaction).toBeNull()
    expect(a.me.activity).toBe('idle')
    expect(a.partner!.online).toBe(false)
    expect(a.partner!.activity).toBe('sleeping')
    expect(a.partner!.pos).toEqual(BED_SLEEP_SPOTS[1])
  })

  test('partner absent at start is shown asleep in bed', () => {
    const s = createSim(him, { x: 4.6, z: 4.2 }, her)
    expect(s.partner!.online).toBe(false)
    expect(s.partner!.activity).toBe('sleeping')
    expect(s.partner!.pos).toEqual(BED_SLEEP_SPOTS[0])
  })

  test('chat from my partner shows a bubble over them', () => {
    const { b } = pair()
    const s = step(b, { type: 'net', msg: { t: 'chat', id: 'c1', from: 'her', text: 'Hello 👋', at: 1 } }, 5)
    expect(s.hud).toContainEqual({ type: 'bubble', userId: 'her', text: 'Hello 👋' })
  })
})
