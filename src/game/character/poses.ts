// Procedural pose clips for the chibi rig. Angles in radians, relative to the rest pose.
// Conventions: arm/leg `x` < 0 swings forward; arm `z` > 0 raises the arm outward (mirrored for the
// left side by the renderer); `lean` tips the whole body forward (π/2 = lying down).
import type { EmoteKind, InteractionKind } from '../types'
import { INTERACTION_DURATION } from '../sim/interactions'

export type Euler = { x: number; y: number; z: number }
export type Pose = { rootY: number; lean: number; head: Euler; body: Euler; armL: Euler; armR: Euler; legL: Euler; legR: Euler }
export type ClipName = 'idle' | 'walk' | 'sit' | 'sleep' | InteractionKind | 'receive-kiss' | 'receive-comfort' | EmoteKind | 'blow-kiss' | 'dance' | 'chore'

const e = (x = 0, y = 0, z = 0): Euler => ({ x, y, z })
export const REST_POSE: Pose = { rootY: 0, lean: 0, head: e(), body: e(), armL: e(0, 0, 0.12), armR: e(0, 0, 0.12), legL: e(), legR: e() }

type Partial2 = { rootY?: number; lean?: number } & { [K in 'head' | 'body' | 'armL' | 'armR' | 'legL' | 'legR']?: Partial<Euler> }
type Key = [number, Partial2]

export const CLIP_DURATION: Record<ClipName, number> = {
  idle: 3000, walk: 600, sit: 4000, sleep: 4000,
  ...INTERACTION_DURATION,
  'receive-kiss': INTERACTION_DURATION.kiss,
  'receive-comfort': INTERACTION_DURATION.comfort,
  happy: 1500, shy: 2000, angry: 1500, crying: 2500, love: 2000, sleepy: 2500,
  'blow-kiss': 2000, dance: 4000, chore: 1400,
}

export const CLIP_LOOPS: Record<ClipName, boolean> = {
  idle: true, walk: true, sit: true, sleep: true,
  kiss: false, hug: false, highfive: false, comfort: false, wave: false, 'receive-kiss': false, 'receive-comfort': false,
  happy: false, shy: false, angry: false, crying: false, love: false, sleepy: false,
  'blow-kiss': false, dance: false, chore: true,
}

const R: Partial2 = {}
const KEYS: Partial<Record<ClipName, Key[]>> = {
  chore: [[0, { lean: 0.22, head: { x: 0.35 }, armL: { x: -0.9, y: 0.35, z: 0.25 }, armR: { x: -0.7, y: -0.35, z: 0.25 } }], [700, { lean: 0.25, head: { x: 0.4 }, armL: { x: -0.7, y: 0.25, z: 0.25 }, armR: { x: -1.0, y: -0.45, z: 0.3 } }], [1400, { lean: 0.22, head: { x: 0.35 }, armL: { x: -0.9, y: 0.35, z: 0.25 }, armR: { x: -0.7, y: -0.35, z: 0.25 } }]],
  'blow-kiss': [[0, R], [500, { armR: { x: -1.8, y: -0.45, z: 0.35 }, head: { x: 0.1 } }], [900, { armR: { x: -1.82, y: -0.45, z: 0.35 }, head: { x: 0.15 } }], [1300, { armR: { x: -1.3, y: 0.2, z: 1.2 }, lean: 0.08, head: { x: -0.1 } }], [2000, R]],
  dance: [[0, R], [450, { rootY: 0.04, lean: 0.05, body: { y: -0.35, z: -0.08 }, head: { z: 0.12 }, armL: { z: 0.9, x: -0.3 }, armR: { z: 1.9, x: -0.3 }, legL: { x: 0.1 }, legR: { x: -0.25 } }], [900, { rootY: 0, lean: 0.05, body: { y: 0.35, z: 0.08 }, head: { z: -0.12 }, armL: { z: 1.9, x: -0.3 }, armR: { z: 0.9, x: -0.3 }, legL: { x: -0.25 }, legR: { x: 0.1 } }], [1350, { rootY: 0.04, lean: 0.05, body: { y: -0.35, z: -0.08 }, head: { z: 0.12 }, armL: { z: 0.9, x: -0.3 }, armR: { z: 1.9, x: -0.3 }, legL: { x: 0.1 }, legR: { x: -0.25 } }], [1800, { rootY: 0, lean: 0.05, body: { y: 0.35, z: 0.08 }, head: { z: -0.12 }, armL: { z: 1.9, x: -0.3 }, armR: { z: 0.9, x: -0.3 }, legL: { x: -0.25 }, legR: { x: 0.1 } }], [2250, { rootY: 0.04, lean: 0.05, body: { y: -0.35, z: -0.08 }, head: { z: 0.12 }, armL: { z: 0.9, x: -0.3 }, armR: { z: 1.9, x: -0.3 }, legL: { x: 0.1 }, legR: { x: -0.25 } }], [2700, { rootY: 0, lean: 0.05, body: { y: 0.35, z: 0.08 }, head: { z: -0.12 }, armL: { z: 1.9, x: -0.3 }, armR: { z: 0.9, x: -0.3 }, legL: { x: -0.25 }, legR: { x: 0.1 } }], [3150, { rootY: 0.04, lean: 0.05, body: { y: -0.35, z: -0.08 }, head: { z: 0.12 }, armL: { z: 0.9, x: -0.3 }, armR: { z: 1.9, x: -0.3 }, legL: { x: 0.1 }, legR: { x: -0.25 } }], [4000, R]],
  kiss: [[0, R], [600, { lean: 0.25, head: { x: 0.15 }, armL: { x: 0.5, z: 0.3 }, armR: { x: 0.5, z: 0.3 } }], [1900, { lean: 0.25, head: { x: 0.15 }, armL: { x: 0.5, z: 0.3 }, armR: { x: 0.5, z: 0.3 } }], [2500, R]],
  'receive-kiss': [[0, R], [600, { head: { z: 0.25 }, armL: { x: -0.4, z: 0.5 }, armR: { x: -0.4, z: 0.5 } }], [1900, { head: { z: 0.25 }, armL: { x: -0.4, z: 0.5 }, armR: { x: -0.4, z: 0.5 } }], [2500, R]],
  hug: [[0, R], [700, { lean: 0.15, armL: { x: -1.25, y: 0.3, z: 0.45 }, armR: { x: -1.25, y: -0.3, z: 0.45 } }], [2300, { lean: 0.15, head: { z: 0.15 }, armL: { x: -1.25, y: 0.3, z: 0.45 }, armR: { x: -1.25, y: -0.3, z: 0.45 } }], [3000, R]],
  highfive: [[0, R], [450, { armR: { x: -0.4, z: 2.6 } }], [900, { armR: { x: -0.6, z: 2.6 }, lean: 0.1 }], [1500, R]],
  comfort: [[0, R], [700, { armR: { x: -1.2, z: 0.5 }, head: { z: -0.2 } }], [1300, { armR: { x: -1.35, z: 0.5 }, head: { z: -0.2 } }], [1900, { armR: { x: -1.2, z: 0.5 }, head: { z: -0.2 } }], [2500, { armR: { x: -1.35, z: 0.5 }, head: { z: -0.2 } }], [3500, R]],
  'receive-comfort': [[0, R], [700, { head: { x: 0.35 }, lean: 0.1, armL: { x: -0.3 }, armR: { x: -0.3 } }], [2800, { head: { x: 0.3, z: 0.15 }, lean: 0.1, armL: { x: -0.3 }, armR: { x: -0.3 } }], [3500, R]],
  wave: [[0, R], [300, { armR: { z: 2.5, y: 0.0 } }], [600, { armR: { z: 2.7, y: 0.4 } }], [900, { armR: { z: 2.5, y: -0.4 } }], [1200, { armR: { z: 2.7, y: 0.4 } }], [1500, R]],
  happy: [[0, R], [250, { rootY: 0.18, armL: { z: 2.2 }, armR: { z: 2.2 } }], [500, R], [750, { rootY: 0.18, armL: { z: 2.2 }, armR: { z: 2.2 } }], [1000, R], [1500, R]],
  shy: [[0, R], [400, { head: { x: 0.3, z: 0.25 }, armL: { x: -0.6, y: 0.8 }, armR: { x: -0.6, y: -0.8 } }], [1600, { head: { x: 0.3, z: 0.3 }, armL: { x: -0.6, y: 0.8 }, armR: { x: -0.6, y: -0.8 } }], [2000, R]],
  angry: [[0, R], [200, { rootY: 0.05, armL: { z: 0.7 }, armR: { z: 0.7 }, legR: { x: -0.4 } }], [400, { armL: { z: 0.7 }, armR: { z: 0.7 } }], [600, { rootY: 0.05, armL: { z: 0.7 }, armR: { z: 0.7 }, legL: { x: -0.4 } }], [800, { armL: { z: 0.7 }, armR: { z: 0.7 } }], [1500, R]],
  crying: [[0, R], [400, { head: { x: 0.35 }, armL: { x: -2.0, y: 0.5 }, armR: { x: -2.0, y: -0.5 } }], [1200, { head: { x: 0.45 }, armL: { x: -2.1, y: 0.5 }, armR: { x: -2.1, y: -0.5 } }], [2000, { head: { x: 0.35 }, armL: { x: -2.0, y: 0.5 }, armR: { x: -2.0, y: -0.5 } }], [2500, R]],
  love: [[0, R], [400, { armL: { z: 2.4, x: -0.3 }, armR: { z: 2.4, x: -0.3 }, head: { z: 0.15 } }], [1600, { armL: { z: 2.4, x: -0.3 }, armR: { z: 2.4, x: -0.3 }, head: { z: -0.15 } }], [2000, R]],
  sleepy: [[0, R], [600, { head: { x: 0.5 }, lean: 0.12, armR: { x: -2.2, z: 0.3 } }], [1400, { head: { x: 0.6 }, lean: 0.15 }], [2000, { head: { x: 0.5 }, lean: 0.12 }], [2500, R]],
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const clone = (p: Pose): Pose => ({ rootY: p.rootY, lean: p.lean, head: { ...p.head }, body: { ...p.body }, armL: { ...p.armL }, armR: { ...p.armR }, legL: { ...p.legL }, legR: { ...p.legR } })
const JOINTS = ['head', 'body', 'armL', 'armR', 'legL', 'legR'] as const

function resolve(k: Partial2): Pose {
  const p = clone(REST_POSE)
  if (k.rootY !== undefined) p.rootY = k.rootY
  if (k.lean !== undefined) p.lean = k.lean
  for (const j of JOINTS) if (k[j]) Object.assign(p[j], k[j])
  return p
}

export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t
  const le = (x: Euler, y: Euler) => ({ x: l(x.x, y.x), y: l(x.y, y.y), z: l(x.z, y.z) })
  return { rootY: l(a.rootY, b.rootY), lean: l(a.lean, b.lean), head: le(a.head, b.head), body: le(a.body, b.body), armL: le(a.armL, b.armL), armR: le(a.armR, b.armR), legL: le(a.legL, b.legL), legR: le(a.legR, b.legR) }
}

function sampleKeys(keys: Key[], t: number): Pose {
  if (t <= keys[0][0]) return resolve(keys[0][1])
  for (let i = 1; i < keys.length; i++) {
    const [t1, k1] = keys[i]
    if (t <= t1) {
      const [t0, k0] = keys[i - 1]
      return blendPose(resolve(k0), resolve(k1), smooth((t - t0) / (t1 - t0)))
    }
  }
  return resolve(keys[keys.length - 1][1])
}

function procedural(name: 'idle' | 'walk' | 'sit' | 'sleep', t: number): Pose {
  const p = clone(REST_POSE)
  const ph = (2 * Math.PI * t) / CLIP_DURATION[name]
  const breathe = Math.sin(ph)
  switch (name) {
    case 'idle':
      p.body.x = 0.02 * breathe
      p.rootY = 0.004 * breathe
      p.head.z = 0.03 * Math.sin(ph + 1)
      break
    case 'walk': {
      const s = Math.sin(ph)
      p.legL.x = 0.5 * s
      p.legR.x = -0.5 * s
      p.armL.x = -0.45 * s
      p.armR.x = 0.45 * s
      p.rootY = 0.03 * Math.abs(Math.sin(ph))
      p.lean = 0.06
      break
    }
    case 'sit':
      p.legL.x = -1.45
      p.legR.x = -1.45
      p.rootY = -0.2
      p.armL.x = -0.3
      p.armR.x = -0.3
      p.body.x = 0.02 * breathe
      break
    case 'sleep':
      p.lean = Math.PI / 2
      p.body.x = 0.03 * breathe
      p.armL.z = 0.2
      p.armR.z = 0.2
      break
  }
  return p
}

export function sampleClip(name: ClipName, tMs: number): Pose {
  const d = CLIP_DURATION[name]
  const t = CLIP_LOOPS[name] ? ((tMs % d) + d) % d : Math.min(Math.max(tMs, 0), d)
  if (name === 'idle' || name === 'walk' || name === 'sit' || name === 'sleep') return procedural(name, t)
  return sampleKeys(KEYS[name]!, t)
}
