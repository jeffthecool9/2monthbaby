import { describe, expect, test } from 'vitest'
import { createSim, step, type SimState } from '../../src/game/sim/sim'
import { defaultLook } from '../../src/game/character/look'
import { MISSIONS } from '../../src/game/play/economy'
import type { PresenceState } from '../../src/game/net/protocol'

const her = { userId: 'her', name: 'Her', role: 'female' as const, look: defaultLook('female') }
const him = { userId: 'him', name: 'Him', role: 'male' as const, look: defaultLook('male') }
const tickFor = (s: SimState, ms: number, from: number) => {
  let st = s
  for (let t = 0; t < ms; t += 50) st = step(st, { type: 'tick', dt: 50 }, from + t)
  return st
}
const earned = (s: SimState) => s.hud.filter((h) => h.type === 'earn')

describe('missions', () => {
  test('doing a chore walks there, works, then pays the reward', () => {
    let s = createSim(her, { x: 4.5, z: 4.2 }, him)
    s = step(s, { type: 'mission', id: 'cook' }, 0)
    expect(s.me.activity).toBe('walking')
    s = tickFor({ ...s, hud: [] }, 15000, 1)
    const cook = MISSIONS.find((m) => m.id === 'cook')!
    expect(earned(s)).toEqual([{ type: 'earn', amount: cook.reward, reason: 'Cook a meal' }])
    expect(s.missionsDone.cook).toBeDefined()
  })

  test('a chore on cooldown is refused with a friendly message', () => {
    let s = createSim(her, { x: 4.5, z: 4.2 }, him)
    s = { ...s, missionsDone: { cook: 1000 } }
    s = step(s, { type: 'mission', id: 'cook' }, 61_000)
    expect(s.me.activity).toBe('idle')
    expect(s.hud.some((h) => h.type === 'toast')).toBe(true)
  })

  test('walking away mid-chore cancels it without pay', () => {
    let s = createSim(her, { x: 4.5, z: 4.2 }, him)
    s = step(s, { type: 'mission', id: 'water' }, 0)
    s = tickFor(s, 3000, 1)
    s = step({ ...s, hud: [] }, { type: 'tap-floor', point: { x: 2, z: 5.8 } }, 3100)
    s = tickFor(s, 8000, 3200)
    expect(earned(s)).toEqual([])
  })
})

describe('affection rewards', () => {
  test('she earns RM1 for a hug she gives once it plays out', () => {
    let s = createSim(her, { x: 3, z: 4.5 }, him)
    const p: PresenceState = { userId: 'him', name: 'Him', role: 'male', look: defaultLook('male'), pos: { x: 4, z: 4.5 }, facing: 0, activity: 'idle' }
    s = step(s, { type: 'presence', others: [p] }, 0)
    s = step({ ...s, hud: [] }, { type: 'interact', kind: 'hug', id: 'h1' }, 1)
    s = tickFor(s, 9000, 2)
    expect(earned(s)).toEqual([{ type: 'earn', amount: 1, reason: 'Hug' }])
  })

  test('receiving a hug earns nothing', () => {
    let s = createSim(him, { x: 4, z: 4.5 }, her)
    const p: PresenceState = { userId: 'her', name: 'Her', role: 'female', look: defaultLook('female'), pos: { x: 3, z: 4.5 }, facing: 0, activity: 'idle' }
    s = step(s, { type: 'presence', others: [p] }, 0)
    s = step({ ...s, hud: [] }, { type: 'net', msg: { t: 'interact', id: 'h1', from: 'her', to: 'him', kind: 'hug', at: 1 } }, 1)
    s = tickFor(s, 9000, 2)
    expect(earned(s)).toEqual([])
  })
})
