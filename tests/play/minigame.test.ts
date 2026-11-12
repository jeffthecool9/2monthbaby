import { describe, expect, test } from 'vitest'
import { ACTIVITIES, HAS_SET, activityFor, newGame, applyInput, isDone, score, stepOf, stepsOf, type GameState, type Input } from '../../src/game/play/minigame'
import { DISHES, DISH_IDS } from '../../src/game/play/recipes'

/** Play a step perfectly. */
function solve(g: GameState): GameState {
  const s = stepOf(g)
  const at = g.step
  let guard = 0
  while (g.step === at && guard++ < 500) {
    switch (s.mechanic) {
      case 'count': g = applyInput(g, { type: 'hit' }); break
      case 'circle': g = applyInput(g, { type: 'circle', radians: 0.5 }); break
      case 'timing': g = applyInput(g, { type: 'swipe', inWindow: true }); break
      case 'scrub': for (const t of s.targets!) g = applyInput(g, { type: 'scrub', x: t.x, y: t.y }); break
      case 'gauge': {
        const [lo, hi] = s.window!
        g = applyInput({ ...g, gauge: (lo + hi) / 2 }, { type: 'release' })
        break
      }
      case 'relax': return g
    }
  }
  return g
}

describe('activities', () => {
  test('every chore and furniture action has an activity', () => {
    for (const id of ['cook', 'dishes', 'water', 'bed', 'bath', 'sit', 'tv', 'sleep', 'cleanbath'] as const) expect(ACTIVITIES[id].title).toBeTruthy()
    expect(activityFor({ mission: 'cook' })).toBe('cook')
    expect(activityFor({ furniture: 'sofa', action: 'sit' })).toBe('tv')
    expect(activityFor({ furniture: 'bath' })).toBe('bath')
    expect(activityFor({ furniture: 'bed', action: 'sleep' })).toBe('sleep')
    expect(HAS_SET.cook && HAS_SET.bath && !HAS_SET.sit).toBe(true)
  })
})

describe('recipes', () => {
  test('every dish has a fixed procedure from prep to plate', () => {
    expect(DISH_IDS.length).toBeGreaterThanOrEqual(4)
    for (const id of DISH_IDS) {
      const steps = DISHES[id].steps
      expect(steps.length).toBeGreaterThanOrEqual(8)
      expect(steps.some((s) => s.action === 'plate')).toBe(true)
      expect(steps.some((s) => s.action === 'heat')).toBe(true)
    }
    expect(DISHES.friedrice.steps[0].action).toBe('chop')
    expect(DISHES.pancakes.steps.some((s) => s.action === 'flip')).toBe(true)
  })

  test('cooking does nothing until a dish is chosen', () => {
    const g = newGame('cook')
    expect(stepsOf(g)).toEqual([])
    expect(applyInput(g, { type: 'hit' })).toBe(g)
    expect(isDone(g)).toBe(false)
  })

  test('playing every step of each dish perfectly finishes with 3 stars', () => {
    for (const id of DISH_IDS) {
      let g = newGame('cook', id)
      for (let i = 0; i < DISHES[id].steps.length; i++) g = solve(g)
      expect(isDone(g)).toBe(true)
      expect(score(g)).toBe(3)
    }
  })
})

describe('mechanics', () => {
  test('chop: each good slice counts, a slice off the line is a miss', () => {
    let g = newGame('cook', 'friedrice')
    expect(stepOf(g).action).toBe('chop')
    g = applyInput(g, { type: 'miss' })
    expect(g.misses).toBe(1)
    for (let i = 0; i < 4; i++) g = applyInput(g, { type: 'hit' })
    expect(g.step).toBe(1)
  })

  test('stir: clockwise circles fill the step; the other way does nothing', () => {
    let g = { ...newGame('cook', 'friedrice'), step: 6 }
    expect(stepOf(g).mechanic).toBe('circle')
    g = applyInput(g, { type: 'circle', radians: -2 })
    expect(g.progress).toBe(0)
    for (let i = 0; i < 40; i++) g = applyInput(g, { type: 'circle', radians: 0.5 })
    expect(g.step).toBe(7)
  })

  test('flip: a swipe outside the golden window is a miss', () => {
    const at = DISHES.pancakes.steps.findIndex((s) => s.action === 'flip')
    let g = { ...newGame('cook', 'pancakes'), step: at }
    g = applyInput(g, { type: 'swipe', inWindow: false })
    expect(g.misses).toBe(1)
    g = applyInput(g, { type: 'swipe', inWindow: true })
    expect(g.step).toBe(at + 1)
  })

  test('gauge: holding fills; overfilling is a miss and resets, stopping short keeps the level', () => {
    let g = { ...newGame('cook', 'friedrice'), step: 4 }
    expect(stepOf(g).action).toBe('heat')
    g = applyInput(g, { type: 'hold', dt: 1000 })
    expect(g.gauge).toBeGreaterThan(0.3)
    const short = applyInput(g, { type: 'release' })
    expect(short.misses).toBe(1)
    expect(short.gauge).toBe(g.gauge)
    const over = applyInput({ ...g, gauge: 0.99 }, { type: 'release' })
    expect(over.gauge).toBe(0)
  })

  test('scrub: covering every spot finishes; far away does nothing', () => {
    let g = newGame('dishes')
    expect(applyInput(g, { type: 'scrub', x: -5, y: -5 }).progress).toBe(0)
    for (const s of stepOf(g).targets!) g = applyInput(g, { type: 'scrub', x: s.x, y: s.y })
    expect(g.step).toBe(1)
  })

  test('every chore can be finished', () => {
    for (const id of ['dishes', 'water', 'bed', 'cleanbath'] as const) {
      let g = newGame(id)
      for (let i = 0; i < ACTIVITIES[id].steps.length; i++) g = solve(g)
      expect(isDone(g)).toBe(true)
    }
  })
})

describe('relax activities', () => {
  test('bath goes fill → warm → foam → soak and never ends on its own', () => {
    let g = newGame('bath')
    for (let i = 0; i < 3; i++) g = solve(g)
    expect(stepOf(g).action).toBe('soak')
    const b = applyInput(g, { type: 'hit' } as Input)
    expect(isDone(b)).toBe(false)
    expect(b.taps).toBe(g.taps + 1)
    expect(applyInput(g, { type: 'miss' }).misses).toBe(g.misses)
  })

  test('tv swipes change channel and never finish', () => {
    const g = applyInput(newGame('tv'), { type: 'swipe' })
    expect(g.progress).toBe(0.25)
    expect(isDone(g)).toBe(false)
  })
})
