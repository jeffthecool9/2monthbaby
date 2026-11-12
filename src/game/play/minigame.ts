// First-person activities (Cooking-Mama style): each is a fixed sequence of hands-on steps.
// Pure rules here; the 3D sets in three/studio turn finger gestures into inputs and draw the state.
import type { FurnitureAction, FurnitureId } from '../world/layout'
import { DISHES, type DishId } from './recipes'

export type ActivityId = 'cook' | 'dishes' | 'water' | 'bed' | 'cleanbath' | 'bath' | 'tv' | 'sit' | 'sleep'

/** How the finger plays a step. */
export type Mechanic =
  | 'count' // N good gestures (chop, crack, add, shake, tap)
  | 'circle' // draw clockwise circles (stir, whisk)
  | 'gauge' // hold to fill, let go in the green zone (heat, pour, fill)
  | 'timing' // swipe up while it's ready (flip)
  | 'scrub' // rub every dirty spot away
  | 'relax' // no end: pop bubbles, change channels

/** What the step looks like in 3D. */
export type Action =
  | 'chop' | 'wash' | 'crack' | 'whisk' | 'heat' | 'pour' | 'add' | 'stir' | 'flip' | 'season' | 'plate'
  | 'scrub' | 'rinse' | 'smooth' | 'fluff' | 'pick' | 'fill' | 'warm' | 'foam' | 'soak' | 'watch' | 'sleep' | 'sit'

export type Target = { x: number; y: number }
export type Step = {
  action: Action
  mechanic: Mechanic
  title: string
  hint: string
  /** Gestures needed (count), radians (circle). */
  amount?: number
  /** Green zone of a gauge or timing bar, 0..1. */
  window?: [number, number]
  /** Seconds a gauge takes to fill when held. */
  seconds?: number
  /** Dirty spots in the scrubbed surface's own 0..1 space. */
  targets?: Target[]
  /** The ingredient, tool or thing this step works on (see three/studio). */
  item?: string
  /** Several things, e.g. what goes into the wok in an add step. */
  items?: string[]
}

export type Activity = {
  title: string
  emoji: string
  mission?: string
  /** Fixed steps; cooking takes them from the chosen dish instead. */
  steps: Step[]
}

export const grid = (n: number, seed: number, pad = 0.14): Target[] => {
  let s = seed
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  return Array.from({ length: n }, () => ({ x: pad + r() * (1 - pad * 2), y: pad + r() * (1 - pad * 2) }))
}

const relax = (action: Action, title: string, hint: string): Step => ({ action, mechanic: 'relax', title, hint })

export const ACTIVITIES: Record<ActivityId, Activity> = {
  cook: { title: 'Cook a meal', emoji: '🍳', mission: 'cook', steps: [] },
  dishes: {
    title: 'Wash the dishes', emoji: '🍽️', mission: 'dishes',
    steps: [
      { action: 'scrub', mechanic: 'scrub', title: 'Scrub the first plate', hint: 'Rub the sponge over every bit of food', targets: grid(6, 11, 0.22), item: 'plate' },
      { action: 'rinse', mechanic: 'gauge', title: 'Rinse it', hint: 'Hold to run the tap · let go when the suds are gone', window: [0.62, 0.86], seconds: 2.4 },
      { action: 'scrub', mechanic: 'scrub', title: 'Now the bowl', hint: 'Get the curry stains off', targets: grid(5, 37, 0.25), item: 'bowl' },
      { action: 'rinse', mechanic: 'gauge', title: 'Rinse it', hint: 'Hold to run the tap · let go when it’s clean', window: [0.62, 0.86], seconds: 2.4 },
      { action: 'add', mechanic: 'count', title: 'Into the rack', hint: 'Tap each dish to put it on the rack', amount: 2, items: ['plate', 'bowl'] },
    ],
  },
  water: {
    title: 'Water the plant', emoji: '🪴', mission: 'water',
    steps: [
      { action: 'pick', mechanic: 'count', title: 'Pick off the dry leaves', hint: 'Tap the yellow leaves', amount: 3 },
      { action: 'pour', mechanic: 'gauge', title: 'Water it just right', hint: 'Hold to pour · let go when the soil is dark', window: [0.55, 0.8], seconds: 3, item: 'can' },
    ],
  },
  bed: {
    title: 'Make the bed', emoji: '🛏️', mission: 'bed',
    steps: [
      { action: 'smooth', mechanic: 'count', title: 'Smooth the duvet', hint: 'Swipe across each wrinkle', amount: 4 },
      { action: 'fluff', mechanic: 'count', title: 'Fluff the pillows', hint: 'Tap each pillow a few times', amount: 4 },
    ],
  },
  cleanbath: {
    title: 'Clean the bathroom', emoji: '🧽', mission: 'bath',
    steps: [
      { action: 'scrub', mechanic: 'scrub', title: 'Scrub the tiles', hint: 'Rub away every patch of grime', targets: grid(7, 23), item: 'tiles' },
      { action: 'scrub', mechanic: 'scrub', title: 'Now the tub', hint: 'Scrub the ring off the bathtub', targets: grid(5, 51, 0.2), item: 'tub' },
      { action: 'rinse', mechanic: 'gauge', title: 'Shower it down', hint: 'Hold to spray · let go when it sparkles', window: [0.6, 0.85], seconds: 2.6 },
    ],
  },
  bath: {
    title: 'Bubble bath', emoji: '🛁',
    steps: [
      { action: 'fill', mechanic: 'gauge', title: 'Run the bath', hint: 'Hold the tap · let go at the line', window: [0.6, 0.78], seconds: 4 },
      { action: 'warm', mechanic: 'gauge', title: 'Make it warm', hint: 'Hold the hot tap · let go when it steams gently', window: [0.45, 0.7], seconds: 2.5 },
      { action: 'foam', mechanic: 'count', title: 'Add bubble bath', hint: 'Shake the bottle — swipe up and down', amount: 5 },
      relax('soak', 'Soak and relax', 'Tap bubbles to pop them · tap the duck 🦆'),
    ],
  },
  tv: { title: 'Watch TV', emoji: '📺', steps: [relax('watch', 'Movie night', 'Swipe to change channel · tap the popcorn')] },
  sit: { title: 'Sit back', emoji: '🪑', steps: [relax('sit', 'Enjoy the view', 'Take a breather')] },
  sleep: { title: 'Sleep', emoji: '😴', steps: [relax('sleep', 'Good night', 'Tap the lamp · tap the stars')] },
}

/** Activities with their own close-up 3D set; the rest are watched in the apartment. */
export const HAS_SET: Record<ActivityId, boolean> = { cook: true, dishes: true, water: true, bed: true, cleanbath: true, bath: true, tv: true, sit: false, sleep: true }

/** Which first-person activity a chore or furniture action opens. */
export function activityFor(what: { mission?: string; furniture?: FurnitureId; action?: FurnitureAction }): ActivityId | null {
  if (what.mission) {
    const byMission: Record<string, ActivityId> = { cook: 'cook', dishes: 'dishes', water: 'water', bed: 'bed', bath: 'cleanbath' }
    return byMission[what.mission] ?? null
  }
  if (what.furniture === 'bath') return 'bath'
  if (what.action === 'sleep') return 'sleep'
  if (what.action === 'sit') return what.furniture === 'sofa' ? 'tv' : 'sit'
  return null
}

export type GameState = {
  activity: ActivityId
  dish?: DishId
  step: number
  /** 0..1 within the current step. */
  progress: number
  gauge: number
  misses: number
  taps: number
  cleared: boolean[]
}

export type Input =
  | { type: 'hit' }
  | { type: 'miss' }
  | { type: 'circle'; radians: number }
  | { type: 'swipe'; inWindow?: boolean }
  | { type: 'scrub'; x: number; y: number }
  | { type: 'hold'; dt: number }
  | { type: 'release' }

export function newGame(activity: ActivityId, dish?: DishId): GameState {
  return { activity, dish, step: 0, progress: 0, gauge: 0, misses: 0, taps: 0, cleared: [] }
}

export const stepsOf = (g: { activity: ActivityId; dish?: DishId }): Step[] =>
  g.activity === 'cook' ? (g.dish ? DISHES[g.dish].steps : []) : ACTIVITIES[g.activity].steps

export const stepOf = (g: GameState): Step => {
  const steps = stepsOf(g)
  return steps[Math.min(g.step, steps.length - 1)]
}
export const isDone = (g: GameState): boolean => !!ACTIVITIES[g.activity].mission && stepsOf(g).length > 0 && g.step >= stepsOf(g).length

const advance = (g: GameState): GameState => ({ ...g, step: g.step + 1, progress: 0, gauge: 0, cleared: [] })
const bump = (g: GameState, by: number): GameState => {
  const p = g.progress + by
  return p >= 0.999 ? advance(g) : { ...g, progress: p }
}

export const SCRUB_RADIUS = 0.1

export function applyInput(g: GameState, input: Input): GameState {
  if (isDone(g) || !stepsOf(g).length) return g
  const step = stepOf(g)
  if (input.type === 'miss') return step.mechanic === 'relax' ? g : { ...g, misses: g.misses + 1 }
  switch (step.mechanic) {
    case 'count':
      return input.type === 'hit' ? { ...bump(g, 1 / (step.amount ?? 1)), taps: g.taps + 1 } : g
    case 'circle':
      return input.type === 'circle' && input.radians > 0 ? bump(g, input.radians / (step.amount ?? 1)) : g
    case 'timing': {
      if (input.type !== 'swipe') return g
      if (!input.inWindow) return { ...g, misses: g.misses + 1 }
      return bump(g, 1 / (step.amount ?? 1))
    }
    case 'scrub': {
      if (input.type !== 'scrub') return g
      const targets = step.targets ?? []
      const cleared = targets.map((t, i) => g.cleared[i] || Math.hypot(t.x - input.x, t.y - input.y) < SCRUB_RADIUS)
      const n = cleared.filter(Boolean).length
      return n === targets.length ? advance(g) : { ...g, cleared, progress: n / targets.length }
    }
    case 'gauge': {
      if (input.type === 'hold') return { ...g, gauge: Math.min(1, g.gauge + input.dt / ((step.seconds ?? 3) * 1000)) }
      if (input.type === 'release') {
        const [lo, hi] = step.window ?? [0.5, 0.8]
        if (g.gauge >= lo && g.gauge <= hi) return advance(g)
        return { ...g, misses: g.misses + 1, gauge: g.gauge > hi ? 0 : g.gauge }
      }
      return g
    }
    case 'relax':
      if (input.type === 'hit') return { ...g, taps: g.taps + 1 }
      if (input.type === 'swipe') return { ...g, progress: (g.progress + 0.25) % 1 }
      return g
  }
}

/** 1–3 stars: fewer misses, more stars. */
export function score(g: GameState): 1 | 2 | 3 {
  return g.misses === 0 ? 3 : g.misses <= 2 ? 2 : 1
}
