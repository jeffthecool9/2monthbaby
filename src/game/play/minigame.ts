// First-person activities (Cooking-Mama style): each is a short sequence of hands-on steps.
// Pure rules here; the screens in ui/Activity.tsx just send inputs and draw the state.
import type { FurnitureAction, FurnitureId } from '../world/layout'

export type ActivityId = 'cook' | 'dishes' | 'water' | 'bed' | 'cleanbath' | 'bath' | 'tv' | 'sit' | 'sleep'

export type Target = { x: number; y: number }
export type Step = {
  kind: 'tap' | 'stir' | 'flip' | 'scrub' | 'pour' | 'swipe' | 'relax'
  title: string
  hint: string
  /** taps needed, stir radians, flips, scrub spots… */
  amount?: number
  targets?: Target[]
  /** Green zone of a gauge, 0..1. */
  window?: [number, number]
  emoji: string
}

export type Activity = {
  title: string
  emoji: string
  /** Where the eyes go in first person: offset from the furniture's use point (x right, y up, z forward toward it). */
  eye: [number, number, number]
  /** Where to look, relative to the furniture position. */
  look: [number, number, number]
  mission?: string
  steps: Step[]
}

const grid = (n: number, seed: number): Target[] => {
  let s = seed
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  return Array.from({ length: n }, () => ({ x: 0.12 + r() * 0.76, y: 0.15 + r() * 0.7 }))
}

export const ACTIVITIES: Record<ActivityId, Activity> = {
  cook: {
    title: 'Cook a meal', emoji: '🍳', mission: 'cook', eye: [0, 1.55, 0.35], look: [0, 0.95, 0],
    steps: [
      { kind: 'tap', title: 'Chop the vegetables', hint: 'Tap each piece as it lands on the board', amount: 12, emoji: '🔪' },
      { kind: 'stir', title: 'Stir the pan', hint: 'Draw circles clockwise with your finger', amount: 8 * Math.PI, emoji: '🥄' },
      { kind: 'flip', title: 'Flip it!', hint: 'Swipe up when the ring turns green', amount: 3, emoji: '🍳' },
      { kind: 'tap', title: 'Plate up', hint: 'Tap the plate to serve', amount: 1, emoji: '🍽️' },
    ],
  },
  dishes: {
    title: 'Wash the dishes', emoji: '🍽️', mission: 'dishes', eye: [0, 1.55, 0.35], look: [0, 0.9, 0],
    steps: [{ kind: 'scrub', title: 'Scrub the plates', hint: 'Rub the sponge over every dirty spot', targets: grid(7, 11), emoji: '🧽' }],
  },
  water: {
    title: 'Water the plant', emoji: '🪴', mission: 'water', eye: [0, 1.5, 0.3], look: [0, 0.7, 0],
    steps: [{ kind: 'pour', title: 'Water it just right', hint: 'Hold to pour, let go in the green zone', window: [0.55, 0.78], emoji: '💧' }],
  },
  bed: {
    title: 'Make the bed', emoji: '🛏️', mission: 'bed', eye: [0, 1.5, 0.4], look: [0, 0.5, 0],
    steps: [
      { kind: 'swipe', title: 'Smooth the duvet', hint: 'Swipe across the bed to flatten it', amount: 4, emoji: '🫧' },
      { kind: 'tap', title: 'Fluff the pillows', hint: 'Tap each pillow', amount: 4, emoji: '🛏️' },
    ],
  },
  cleanbath: {
    title: 'Clean the bathroom', emoji: '🧽', mission: 'bath', eye: [0, 1.5, 0.3], look: [0, 0.6, 0],
    steps: [{ kind: 'scrub', title: 'Scrub the tiles', hint: 'Rub away every bit of grime', targets: grid(9, 23), emoji: '✨' }],
  },
  bath: {
    title: 'Bubble bath', emoji: '🛁', eye: [0, 0.95, -0.5], look: [0, -1.2, 0],
    steps: [{ kind: 'relax', title: 'Soak and relax', hint: 'Pop the bubbles ✨', emoji: '🫧' }],
  },
  tv: {
    title: 'Watch TV', emoji: '📺', eye: [0, 1.05, 0], look: [0, 0.9, 0],
    steps: [{ kind: 'relax', title: 'Movie night', hint: 'Swipe to change the channel', emoji: '🍿' }],
  },
  sit: {
    title: 'Sit back', emoji: '🪑', eye: [0, 1.05, 0], look: [0, 1.2, 0],
    steps: [{ kind: 'relax', title: 'Enjoy the view', hint: 'Look around', emoji: '🌇' }],
  },
  sleep: {
    title: 'Sleep', emoji: '😴', eye: [0, 0.75, 0], look: [0, 2.6, 0],
    steps: [{ kind: 'relax', title: 'Good night', hint: 'Count the stars', emoji: '🌙' }],
  },
}

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
  step: number
  /** 0..1 within the current step. */
  progress: number
  gauge: number
  misses: number
  taps: number
  cleared: boolean[]
}

export type Input =
  | { type: 'tap'; hit: boolean }
  | { type: 'stir'; radians: number }
  | { type: 'swipe'; inWindow?: boolean }
  | { type: 'scrub'; x: number; y: number }
  | { type: 'hold'; dt: number }
  | { type: 'release' }

export function newGame(activity: ActivityId): GameState {
  return { activity, step: 0, progress: 0, gauge: 0, misses: 0, taps: 0, cleared: [] }
}

export const stepOf = (g: GameState): Step => ACTIVITIES[g.activity].steps[Math.min(g.step, ACTIVITIES[g.activity].steps.length - 1)]
export const isDone = (g: GameState): boolean => !!ACTIVITIES[g.activity].mission && g.step >= ACTIVITIES[g.activity].steps.length

const advance = (g: GameState): GameState => ({ ...g, step: g.step + 1, progress: 0, gauge: 0, cleared: [] })

export function applyInput(g: GameState, input: Input): GameState {
  if (isDone(g)) return g
  const step = stepOf(g)
  switch (step.kind) {
    case 'tap': {
      if (input.type !== 'tap') return g
      if (!input.hit) return { ...g, misses: g.misses + 1 }
      const p = g.progress + 1 / (step.amount ?? 1)
      return p >= 0.999 ? advance(g) : { ...g, progress: p, taps: g.taps + 1 }
    }
    case 'stir': {
      if (input.type !== 'stir' || input.radians <= 0) return g
      const p = g.progress + input.radians / (step.amount ?? 1)
      return p >= 0.999 ? advance(g) : { ...g, progress: p }
    }
    case 'flip': {
      if (input.type !== 'swipe') return g
      if (!input.inWindow) return { ...g, misses: g.misses + 1 }
      const p = g.progress + 1 / (step.amount ?? 1)
      return p >= 0.999 ? advance(g) : { ...g, progress: p }
    }
    case 'swipe': {
      if (input.type !== 'swipe') return g
      const p = g.progress + 1 / (step.amount ?? 1)
      return p >= 0.999 ? advance(g) : { ...g, progress: p }
    }
    case 'scrub': {
      if (input.type !== 'scrub') return g
      const targets = step.targets ?? []
      const cleared = targets.map((t, i) => g.cleared[i] || Math.hypot(t.x - input.x, t.y - input.y) < 0.09)
      const n = cleared.filter(Boolean).length
      return n === targets.length ? advance(g) : { ...g, cleared, progress: n / targets.length }
    }
    case 'pour': {
      if (input.type === 'hold') return { ...g, gauge: Math.min(1, g.gauge + input.dt / 3000) }
      if (input.type === 'release') {
        const [lo, hi] = step.window ?? [0.5, 0.8]
        if (g.gauge >= lo && g.gauge <= hi) return advance(g)
        return { ...g, misses: g.misses + 1, gauge: 0 }
      }
      return g
    }
    case 'relax':
      if (input.type === 'tap') return { ...g, taps: g.taps + 1 }
      if (input.type === 'swipe') return { ...g, progress: (g.progress + 0.25) % 1 }
      return g
  }
}

/** 1–3 stars: fewer misses, more stars. */
export function score(g: GameState): 1 | 2 | 3 {
  return g.misses === 0 ? 3 : g.misses <= 2 ? 2 : 1
}
