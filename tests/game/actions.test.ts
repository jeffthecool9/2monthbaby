import { describe, expect, test } from 'vitest'
import { createSim, step, type SimState } from '../../src/game/sim/sim'
import { defaultLook } from '../../src/game/character/look'
import { parseMsg, type NetMsg, type PresenceState } from '../../src/game/net/protocol'

const her = { userId: 'her', name: 'Her', role: 'female' as const, look: defaultLook('female') }
const him = { userId: 'him', name: 'Him', role: 'male' as const, look: defaultLook('male') }
const pres = (pos: { x: number; z: number }, activity: PresenceState['activity'] = 'idle'): PresenceState => ({
  userId: 'him', name: 'Him', role: 'male', look: defaultLook('male'), pos, facing: 0, activity,
})
const withPartnerAt = (pos: { x: number; z: number }, activity: PresenceState['activity'] = 'idle'): SimState => {
  const s = step(createSim(her, { x: 3, z: 4.5 }, him), { type: 'presence', others: [pres(pos, activity)] }, 0)
  return { ...s, outbox: [], hud: [] }
}
const sent = (s: SimState, t: NetMsg['t']) => s.outbox.filter((m) => m.t === t)

describe('action wheel', () => {
  test('kiss with my partner close by becomes a real paired kiss', () => {
    const s = step(withPartnerAt({ x: 4, z: 4.5 }), { type: 'action', kind: 'kiss', id: 'a1' }, 10)
    expect(s.interaction?.kind).toBe('kiss')
    expect(sent(s, 'interact')).toHaveLength(1)
  })

  test('kiss with nobody near plays a solo blown kiss on the spot, seen by my partner', () => {
    const s = step(withPartnerAt({ x: 11, z: 5 }), { type: 'action', kind: 'kiss', id: 'a1' }, 10)
    expect(s.interaction).toBeNull()
    expect(s.me.clip).toBe('blow-kiss')
    expect(s.me.activity).toBe('idle')
    expect(sent(s, 'act')).toEqual([{ t: 'act', from: 'her', clip: 'blow-kiss', at: 10 }])
  })

  test('hug alone plays an open-arms hug in place', () => {
    const s = step(withPartnerAt({ x: 11, z: 5 }), { type: 'action', kind: 'hug', id: 'a1' }, 10)
    expect(s.me.clip).toBe('hug')
    expect(s.interaction).toBeNull()
  })

  test('when my partner is offline every action is solo', () => {
    const s = step(createSim(her, { x: 3, z: 4.5 }, him), { type: 'action', kind: 'highfive', id: 'a1' }, 10)
    expect(s.me.clip).toBe('highfive')
  })

  test('dance is always a solo action', () => {
    const s = step(withPartnerAt({ x: 3.5, z: 4.5 }), { type: 'action', kind: 'dance', id: 'a1' }, 10)
    expect(s.me.clip).toBe('dance')
    expect(s.interaction).toBeNull()
  })

  test("my partner's solo action plays on my screen", () => {
    let s = withPartnerAt({ x: 11, z: 5 })
    s = step(s, { type: 'net', msg: { t: 'act', from: 'him', clip: 'dance', at: 5 } }, 20)
    expect(s.partner!.clip).toBe('dance')
  })

  test('act messages are validated', () => {
    expect(parseMsg({ t: 'act', from: 'him', clip: 'dance', at: 1 })).toEqual({ t: 'act', from: 'him', clip: 'dance', at: 1 })
    expect(parseMsg({ t: 'act', from: 'him', clip: 'fly', at: 1 })).toBeNull()
  })

  test('a near partner who is asleep gets a request instead', () => {
    const s = step(withPartnerAt({ x: 4, z: 4.5 }, 'sleeping'), { type: 'action', kind: 'hug', id: 'a1' }, 10)
    expect(sent(s, 'interact-request')).toHaveLength(1)
  })
})
