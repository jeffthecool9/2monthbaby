import { describe, expect, test } from 'vitest'
import { ACTIVITIES, activityFor, newGame, applyInput, isDone, score, stepOf, type Input } from '../../src/game/play/minigame'

describe('activities', () => {
  test('every chore and furniture action has an activity with a first-person view', () => {
    for (const id of ['cook', 'dishes', 'water', 'bed', 'bath', 'sit', 'tv', 'sleep', 'cleanbath'] as const) {
      expect(ACTIVITIES[id].title).toBeTruthy()
      expect(ACTIVITIES[id].eye.length).toBe(3)
    }
    expect(activityFor({ mission: 'cook' })).toBe('cook')
    expect(activityFor({ furniture: 'sofa', action: 'sit' })).toBe('tv')
    expect(activityFor({ furniture: 'bath' })).toBe('bath')
    expect(activityFor({ furniture: 'bed', action: 'sleep' })).toBe('sleep')
  })
})

describe('cooking game', () => {
  test('chop: tapping the vegetables completes the step', () => {
    let g = newGame('cook')
    expect(stepOf(g).kind).toBe('tap')
    for (let i = 0; i < 12; i++) g = applyInput(g, { type: 'tap', hit: true })
    expect(g.step).toBe(1)
  })

  test('stir: circling the spoon fills the step; wrong direction does nothing', () => {
    let g = newGame('cook')
    g = { ...g, step: 1 }
    expect(stepOf(g).kind).toBe('stir')
    g = applyInput(g, { type: 'stir', radians: -2 })
    expect(g.progress).toBe(0)
    for (let i = 0; i < 8; i++) g = applyInput(g, { type: 'stir', radians: Math.PI })
    expect(g.step).toBe(2)
  })

  test('flip: a swipe inside the timing window counts, outside is a miss', () => {
    let g = { ...newGame('cook'), step: 2 }
    expect(stepOf(g).kind).toBe('flip')
    g = applyInput(g, { type: 'swipe', inWindow: false })
    expect(g.misses).toBe(1)
    g = applyInput(g, { type: 'swipe', inWindow: true })
    g = applyInput(g, { type: 'swipe', inWindow: true })
    g = applyInput(g, { type: 'swipe', inWindow: true })
    expect(g.step).toBe(3)
  })

  test('plating finishes the dish and misses lower the score', () => {
    let g = { ...newGame('cook'), step: 3 }
    g = applyInput(g, { type: 'tap', hit: true })
    expect(isDone(g)).toBe(true)
    expect(score(g)).toBe(3)
    expect(score({ ...g, misses: 4 })).toBe(1)
  })
})

describe('scrub games', () => {
  test('dishes: covering every dirty spot finishes', () => {
    let g = newGame('dishes')
    const spots = stepOf(g).targets!
    expect(spots.length).toBeGreaterThan(3)
    for (const s of spots) g = applyInput(g, { type: 'scrub', x: s.x, y: s.y })
    expect(isDone(g)).toBe(true)
  })

  test('scrubbing far from a spot does nothing', () => {
    const g = newGame('cleanbath')
    expect(applyInput(g, { type: 'scrub', x: -5, y: -5 }).progress).toBe(0)
  })
})

describe('pour game', () => {
  test('watering: holding fills the gauge; release in the green zone succeeds', () => {
    let g = newGame('water')
    g = applyInput(g, { type: 'hold', dt: 1500 })
    expect(g.gauge).toBeGreaterThan(0)
    const target = stepOf(g).window!
    g = { ...g, gauge: (target[0] + target[1]) / 2 }
    g = applyInput(g, { type: 'release' })
    expect(isDone(g)).toBe(true)
  })

  test('overfilling counts as a miss and resets the gauge', () => {
    let g = newGame('water')
    g = { ...g, gauge: 0.99 }
    g = applyInput(g, { type: 'release' })
    expect(g.misses).toBe(1)
    expect(g.gauge).toBe(0)
  })
})

describe('relax activities', () => {
  test('tv and bath are not missions: they never finish on their own', () => {
    expect(isDone(newGame('tv'))).toBe(false)
    const b = applyInput(newGame('bath'), { type: 'tap', hit: true } as Input)
    expect(isDone(b)).toBe(false)
    expect(b.taps).toBe(1)
  })
})
