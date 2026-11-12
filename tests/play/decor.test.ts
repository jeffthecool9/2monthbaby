import { describe, expect, test } from 'vitest'
import { CATALOG, applyDecor, canPlace, emptyDecor, type DecorState, type Placed } from '../../src/game/play/decor'
import { parseMsg } from '../../src/game/net/protocol'

const item = (id: string) => CATALOG.find((c) => c.id === id)!

describe('shop catalog', () => {
  test('has plenty of furniture and decor across rooms, each with a price', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(24)
    const kinds = new Set(CATALOG.map((c) => c.category))
    expect([...kinds].sort()).toEqual(['decor', 'lighting', 'plants', 'seating', 'tables', 'wall'])
    for (const c of CATALOG) expect(c.price).toBeGreaterThan(0)
  })
})

describe('placing', () => {
  const floorSpot = { x: 4.8, z: 5.6 }
  test('a floor item can go on free floor, not inside a wall or on furniture', () => {
    expect(canPlace(item('armchair'), floorSpot, [])).toBe(true)
    expect(canPlace(item('armchair'), { x: 6, z: 3 }, [])).toBe(false) // wall
    expect(canPlace(item('armchair'), { x: 6.2, z: 1.1 }, [])).toBe(false) // on the bed
  })
  test('items cannot overlap each other', () => {
    const placed: Placed[] = [{ uid: 'a', item: 'armchair', x: 4.8, z: 5.6, rot: 0, owner: 'her' }]
    expect(canPlace(item('armchair'), { x: 4.9, z: 5.7 }, placed)).toBe(false)
    expect(canPlace(item('armchair'), { x: 6.0, z: 4.2 }, placed)).toBe(true)
  })
  test('wall items snap to the nearest wall', () => {
    expect(canPlace(item('poster-sunset'), { x: 4, z: 2.95 }, [])).toBe(true)
    expect(canPlace(item('poster-sunset'), { x: 4, z: 4.5 }, [])).toBe(false)
  })
})

describe('shared decor state', () => {
  test('place, move, rotate, remove apply in order on both phones', () => {
    let s: DecorState = emptyDecor()
    s = applyDecor(s, { op: 'place', uid: 'p1', item: 'armchair', x: 2.5, z: 4, rot: 0, owner: 'her', seq: 1 })
    s = applyDecor(s, { op: 'move', uid: 'p1', x: 2.8, z: 4.2, rot: 1.57, seq: 2 })
    expect(s.items.p1).toMatchObject({ x: 2.8, z: 4.2, rot: 1.57 })
    s = applyDecor(s, { op: 'remove', uid: 'p1', seq: 3 })
    expect(s.items.p1).toBeUndefined()
    expect(s.seq).toBe(3)
  })
  test('old messages (lower seq) are ignored', () => {
    let s: DecorState = emptyDecor()
    s = applyDecor(s, { op: 'place', uid: 'p1', item: 'armchair', x: 2.5, z: 4, rot: 0, owner: 'her', seq: 5 })
    s = applyDecor(s, { op: 'move', uid: 'p1', x: 9, z: 9, rot: 0, seq: 2 })
    expect(s.items.p1.x).toBe(2.5)
  })
  test('decor messages go over the wire', () => {
    const m = { t: 'decor', from: 'her', at: 1, change: { op: 'place', uid: 'p1', item: 'armchair', x: 2.5, z: 4, rot: 0, owner: 'her', seq: 1 } }
    expect(parseMsg(m)).toEqual(m)
    expect(parseMsg({ ...m, change: { ...m.change, item: 'dragon' } })).toBeNull()
  })
})
