import { describe, expect, test } from 'vitest'
import { FURNITURE, ROOMS, SPAWN } from '../../src/game/world/layout'
import { CELL, NavGrid } from '../../src/game/world/navgrid'
import type { Vec2 } from '../../src/game/types'

const grid = NavGrid.fromLayout()
const centre = (min: Vec2, max: Vec2): Vec2 => ({ x: (min.x + max.x) / 2, z: (min.z + max.z) / 2 })
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)
const furniture = (id: string) => FURNITURE.find((f) => f.id === id)!

describe('NavGrid', () => {
  test('path from spawn to bedroom is walkable and continuous', () => {
    const path = grid.findPath(SPAWN, centre(ROOMS.bedroom.min, ROOMS.bedroom.max))
    expect(path).not.toBeNull()
    for (const p of path!) expect(grid.isWalkable(p)).toBe(true)
    for (let i = 1; i < path!.length; i++) expect(dist(path![i - 1], path![i])).toBeLessThanOrEqual(CELL * 1.5)
  })

  test('living room to bathroom goes through the bathroom door', () => {
    const path = grid.findPath({ x: 2, z: 5 }, { x: 1.5, z: 1.5 })!
    const door = { x: 1.6, z: 3 }
    expect(Math.min(...path.map((p) => dist(p, door)))).toBeLessThanOrEqual(0.5)
  })

  test('furniture and walls are blocked', () => {
    expect(grid.isWalkable(furniture('sofa').pos)).toBe(false)
    expect(grid.isWalkable(furniture('bed').pos)).toBe(false)
    expect(grid.isWalkable({ x: 6, z: 3 })).toBe(false)
  })

  test('outside the unit is blocked', () => {
    expect(grid.isWalkable({ x: -1, z: 1 })).toBe(false)
    expect(grid.isWalkable({ x: 6, z: 7 })).toBe(false)
  })

  test('path to a point inside the bed ends at the nearest walkable point', () => {
    const target = furniture('bed').pos
    const path = grid.findPath(SPAWN, target)!
    expect(path).not.toBeNull()
    const end = path[path.length - 1]
    const near = grid.nearestWalkable(target)
    expect(dist(end, near)).toBeLessThan(0.01)
  })

  test('every furniture use point is walkable and reachable', () => {
    for (const f of FURNITURE.filter((f) => f.usePoint)) {
      expect(grid.isWalkable(f.usePoint!), f.id).toBe(true)
      expect(grid.findPath(SPAWN, f.usePoint!), f.id).not.toBeNull()
    }
  })

  test('balcony is reachable through the bedroom', () => {
    expect(grid.findPath(SPAWN, { x: 11.5, z: 1.5 })).not.toBeNull()
  })
})
