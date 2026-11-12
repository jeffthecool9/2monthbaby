import { expect, test } from 'vitest'
import { classifyGesture } from '../../src/game/input/gesture'

test('a short still press is a tap', () => {
  expect(classifyGesture({ x: 0, y: 0, t: 0 }, { x: 3, y: 4, t: 120 }, 1)).toBe('tap')
})

test('moving the finger is a drag (camera rotate), not a walk', () => {
  expect(classifyGesture({ x: 0, y: 0, t: 0 }, { x: 30, y: 0, t: 120 }, 1)).toBe('drag')
})

test('a long press is not a tap', () => {
  expect(classifyGesture({ x: 0, y: 0, t: 0 }, { x: 2, y: 2, t: 600 }, 1)).toBe('drag')
})

test('two fingers (pinch) never count as a tap', () => {
  expect(classifyGesture({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 50 }, 2)).toBe('drag')
})
