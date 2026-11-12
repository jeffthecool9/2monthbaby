import { describe, expect, test } from 'vitest'
import { createSim, step, type SimState } from '../../src/game/sim/sim'
import { defaultLook } from '../../src/game/character/look'
import { MISSIONS } from '../../src/game/play/economy'

const her = { userId: 'her', name: 'Her', role: 'female' as const, look: defaultLook('female') }
const him = { userId: 'him', name: 'Him', role: 'male' as const, look: defaultLook('male') }
const tickFor = (s: SimState, ms: number, from: number) => {
  let st = s
  for (let t = 0; t < ms; t += 50) st = step(st, { type: 'tick', dt: 50 }, from + t)
  return st
}
const hud = (s: SimState, type: string) => s.hud.filter((h) => h.type === type)
const cook = MISSIONS.find((m) => m.id === 'cook')!

describe('first-person activities', () => {
  test('arriving at a chore opens its activity', () => {
    let s = createSim(her, { x: 4.5, z: 4.2 }, him)
    s = step(s, { type: 'mission', id: 'cook' }, 0)
    s = tickFor({ ...s, hud: [] }, 12000, 1)
    expect(hud(s, 'activity')).toEqual([{ type: 'activity', activity: 'cook', furniture: 'kitchen', mission: 'cook' }])
  })

  test('finishing the mini-game pays early with a star bonus', () => {
    let s = createSim(her, { x: 11.85, z: 5.1 }, him)
    s = step(s, { type: 'mission', id: 'cook' }, 0)
    expect(s.me.chore).toBeDefined()
    s = step({ ...s, hud: [] }, { type: 'complete-chore', stars: 3 }, 2000)
    expect(hud(s, 'earn')).toEqual([{ type: 'earn', amount: Math.round(cook.reward * 1.5), reason: 'Cook a meal ⭐⭐⭐' }])
    expect(s.missionsDone.cook).toBe(2000)
    expect(s.me.chore).toBeUndefined()
    // Nothing more is paid when the timer would have run out.
    s = tickFor({ ...s, hud: [] }, 30000, 2100)
    expect(hud(s, 'earn')).toEqual([])
  })

  test('exiting a chore stands up without pay', () => {
    let s = createSim(her, { x: 11.85, z: 5.1 }, him)
    s = step(s, { type: 'mission', id: 'cook' }, 0)
    s = step({ ...s, hud: [] }, { type: 'exit-activity' }, 500)
    expect(s.me.chore).toBeUndefined()
    expect(s.me.activity).toBe('idle')
    s = tickFor(s, 30000, 600)
    expect(hud(s, 'earn')).toEqual([])
  })

  test('sitting on the sofa opens the TV activity; exiting stands up', () => {
    let s = createSim(her, { x: 4.0, z: 4.9 }, him)
    s = step(s, { type: 'use-furniture', id: 'sofa', action: 'sit' }, 0)
    expect(s.me.activity).toBe('sitting')
    expect(hud(s, 'activity')).toEqual([{ type: 'activity', activity: 'tv', furniture: 'sofa' }])
    s = step(s, { type: 'exit-activity' }, 10)
    expect(s.me.activity).toBe('idle')
    expect(s.me.furniture).toBeUndefined()
  })

  test('the bath can be used and opens the bubble bath', () => {
    let s = createSim(her, { x: 1.35, z: 1.4 }, him)
    s = step(s, { type: 'use-furniture', id: 'bath', action: 'bathe' }, 0)
    expect(s.me.activity).toBe('sitting')
    expect(s.me.furniture).toBe('bath')
    expect(hud(s, 'activity')).toEqual([{ type: 'activity', activity: 'bath', furniture: 'bath' }])
  })
})
