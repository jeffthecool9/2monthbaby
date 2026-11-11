import { expect, test } from 'vitest'
import { blocksView } from '../../src/game/world/cutaway'

const wall = { a: { x: 0, z: 3 }, b: { x: 10, z: 3 } }

test('a wall between camera and player blocks the view', () => {
  expect(blocksView(wall, { x: 5, z: -4 }, { x: 5, z: 4.5 })).toBe(true)
})

test('a wall behind the player does not block the view', () => {
  expect(blocksView(wall, { x: 5, z: 10 }, { x: 5, z: 4.5 })).toBe(false)
})

test('a wall the line of sight passes beside does not block', () => {
  expect(blocksView(wall, { x: 12, z: -4 }, { x: 12, z: 4.5 })).toBe(false)
})

test('walls close in front of the camera block even when the player is just past them', () => {
  expect(blocksView(wall, { x: 5, z: 2 }, { x: 5, z: 3.4 })).toBe(true)
})
