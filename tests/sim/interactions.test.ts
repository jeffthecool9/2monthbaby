import { describe, expect, test } from 'vitest'
import { needsRequest, planInteraction, resolveCrossing, type InteractMsg } from '../../src/game/sim/interactions'
import { NavGrid } from '../../src/game/world/navgrid'
import type { InteractionKind, Vec2 } from '../../src/game/types'

const grid = NavGrid.fromLayout()
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)
const angleDiff = (a: number, b: number) => {
  const d = Math.abs(((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI)
  return d
}

describe('planInteraction', () => {
  const me = { x: 2, z: 5.8 }
  const partner = { x: 4.6, z: 5.8 }

  test.each<[InteractionKind, number]>([
    ['kiss', 0.55],
    ['hug', 0.55],
    ['comfort', 0.55],
    ['highfive', 0.8],
  ])('%s spots are walkable and %f m apart', (kind, gap) => {
    const plan = planInteraction(kind, me, partner, grid)
    expect(grid.isWalkable(plan.initiatorSpot)).toBe(true)
    expect(grid.isWalkable(plan.partnerSpot)).toBe(true)
    expect(Math.abs(dist(plan.initiatorSpot, plan.partnerSpot) - gap)).toBeLessThanOrEqual(0.1)
  })

  test('wave: partner stays put, initiator does not move, at least 1.2 m apart', () => {
    const plan = planInteraction('wave', me, partner, grid)
    expect(plan.partnerSpot).toEqual(partner)
    expect(plan.initiatorSpot).toEqual(me)
    expect(dist(plan.initiatorSpot, plan.partnerSpot)).toBeGreaterThanOrEqual(1.2)
  })

  test('both face each other', () => {
    const plan = planInteraction('hug', me, partner, grid)
    expect(angleDiff(plan.initiatorFacing, plan.partnerFacing)).toBeCloseTo(Math.PI, 1)
    // initiator faces toward partner spot
    const dx = plan.partnerSpot.x - plan.initiatorSpot.x
    const dz = plan.partnerSpot.z - plan.initiatorSpot.z
    expect(angleDiff(plan.initiatorFacing, Math.atan2(dx, dz))).toBeLessThan(0.05)
  })
})

describe('resolveCrossing', () => {
  const a: InteractMsg = { t: 'interact', id: 'a1', from: 'userB', to: 'userA', kind: 'hug', at: 1000 }
  const b: InteractMsg = { t: 'interact', id: 'b1', from: 'userA', to: 'userB', kind: 'kiss', at: 1200 }

  test('earlier message wins regardless of order', () => {
    expect(resolveCrossing(a, b)).toBe(a)
    expect(resolveCrossing(b, a)).toBe(a)
  })

  test('equal time: smaller sender id wins regardless of order', () => {
    const b2 = { ...b, at: 1000 }
    expect(resolveCrossing(a, b2)).toBe(b2)
    expect(resolveCrossing(b2, a)).toBe(b2)
  })
})

describe('needsRequest', () => {
  test('busy partners need a request, free partners do not', () => {
    expect(needsRequest('sleeping')).toBe(true)
    expect(needsRequest('sitting')).toBe(true)
    expect(needsRequest('idle')).toBe(false)
    expect(needsRequest('walking')).toBe(false)
  })
})
