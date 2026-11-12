import { describe, expect, test } from 'vitest'
import { CLIP_DURATION, CLIP_LOOPS, REST_POSE, blendPose, sampleClip, type ClipName, type Pose } from '../../src/game/character/poses'
import { INTERACTION_DURATION } from '../../src/game/sim/interactions'

const JOINTS = ['head', 'body', 'armL', 'armR', 'legL', 'legR'] as const
const ALL: ClipName[] = [
  'idle', 'walk', 'sit', 'sleep', 'kiss', 'hug', 'highfive', 'comfort', 'wave', 'receive-kiss', 'receive-comfort',
  'happy', 'shy', 'angry', 'crying', 'love', 'sleepy',
]

function values(p: Pose): number[] {
  return [p.rootY, p.lean, ...JOINTS.flatMap((j) => [p[j].x, p[j].y, p[j].z])]
}

function expectPoseClose(a: Pose, b: Pose, tol: number) {
  const va = values(a), vb = values(b)
  va.forEach((v, i) => expect(Math.abs(v - vb[i])).toBeLessThanOrEqual(tol))
}

describe('blendPose', () => {
  test('halfway between two poses is the midpoint of every joint', () => {
    const a = sampleClip('idle', 0), b = sampleClip('wave', 750)
    const m = blendPose(a, b, 0.5)
    expect(m.armR.z).toBeCloseTo((a.armR.z + b.armR.z) / 2, 6)
    expect(blendPose(a, b, 0)).toEqual(a)
    expect(blendPose(a, b, 1)).toEqual(b)
  })
})

describe('poses', () => {
  test('idle stays near rest', () => {
    for (const t of [0, 500, 1000]) expectPoseClose(sampleClip('idle', t), REST_POSE, 0.05)
  })

  test('walk swings legs in opposite phase', () => {
    const p = sampleClip('walk', 250)
    expect(p.legL.x).toBeCloseTo(-p.legR.x, 5)
    expect(Math.abs(sampleClip('walk', CLIP_DURATION.walk / 4).legL.x)).toBeGreaterThan(0.2)
  })

  test('wave raises the right arm past 2 rad at 750 ms', () => {
    expect(sampleClip('wave', 750).armR.z).toBeGreaterThan(2.0)
  })

  test('hug puts both arms forward at 1500 ms', () => {
    const p = sampleClip('hug', 1500)
    expect(p.armL.x).toBeLessThan(-1.0)
    expect(p.armR.x).toBeLessThan(-1.0)
  })

  test('highfive raises the right arm at 750 ms', () => {
    expect(sampleClip('highfive', 750).armR.z).toBeGreaterThan(2.0)
  })

  test('sleep lies down', () => {
    expect(sampleClip('sleep', 1000).lean).toBeCloseTo(Math.PI / 2, 1)
  })

  test('looping clips are periodic', () => {
    for (const name of ALL.filter((n) => CLIP_LOOPS[n])) {
      expectPoseClose(sampleClip(name, 0), sampleClip(name, CLIP_DURATION[name]), 1e-6)
    }
  })

  test('non-looping clips hold their final pose after the end', () => {
    for (const name of ALL.filter((n) => !CLIP_LOOPS[n])) {
      const d = CLIP_DURATION[name]
      expectPoseClose(sampleClip(name, d + 500), sampleClip(name, d), 1e-9)
    }
  })

  test('interaction clip durations match INTERACTION_DURATION', () => {
    for (const [k, v] of Object.entries(INTERACTION_DURATION)) expect(CLIP_DURATION[k as ClipName]).toBe(v)
  })

  test('every sampled value is finite', () => {
    for (const name of ALL) for (const t of [0, 123, 777, 2000, 5000]) values(sampleClip(name, t)).forEach((v) => expect(Number.isFinite(v)).toBe(true))
  })
})
