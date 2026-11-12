import { describe, expect, test } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { poseToBones } from '../../src/game/three/rig'
import { REST_POSE, sampleClip } from '../../src/game/character/poses'

/** Direction a limb points after applying its bone rotation to its T-pose direction. */
const dir = (q: [number, number, number, number] | undefined, tpose: Vector3) =>
  tpose.clone().applyQuaternion(new Quaternion(...(q ?? [0, 0, 0, 1])))

// VRM normalized T-pose, model facing +Z: right arm points -X, left arm +X, legs point -Y.
const RIGHT = new Vector3(-1, 0, 0), LEFT = new Vector3(1, 0, 0), DOWN = new Vector3(0, -1, 0)

describe('poseToBones', () => {
  test('at rest both arms hang down at the sides', () => {
    const b = poseToBones(REST_POSE)
    expect(dir(b.rightUpperArm, RIGHT).y).toBeLessThan(-0.9)
    expect(dir(b.leftUpperArm, LEFT).y).toBeLessThan(-0.9)
  })

  test('wave lifts the right arm above the shoulder', () => {
    expect(dir(poseToBones(sampleClip('wave', 750)).rightUpperArm, RIGHT).y).toBeGreaterThan(0.6)
  })

  test('hug reaches both arms forward', () => {
    const b = poseToBones(sampleClip('hug', 1500))
    expect(dir(b.rightUpperArm, RIGHT).z).toBeGreaterThan(0.6)
    expect(dir(b.leftUpperArm, LEFT).z).toBeGreaterThan(0.6)
  })

  test('walking swings the legs forward and back in opposite phase', () => {
    const b = poseToBones(sampleClip('walk', 150))
    const l = dir(b.leftUpperLeg, DOWN).z, r = dir(b.rightUpperLeg, DOWN).z
    expect(Math.sign(l)).toBe(-Math.sign(r))
    expect(Math.abs(l)).toBeGreaterThan(0.2)
  })

  test('sitting puts the thighs forward and bends the knees down', () => {
    const b = poseToBones(sampleClip('sit', 0))
    const thigh = dir(b.leftUpperLeg, DOWN)
    expect(thigh.z).toBeGreaterThan(0.9)
    // Shin: thigh rotation then knee rotation, relative to the T-pose leg direction.
    const knee = new Quaternion(...b.leftUpperLeg!).multiply(new Quaternion(...b.leftLowerLeg!))
    expect(DOWN.clone().applyQuaternion(knee).y).toBeLessThan(-0.8)
  })

  test('blowing a kiss brings the right hand up in front of the face', () => {
    const b = poseToBones(sampleClip('blow-kiss', 800))
    const up = new Quaternion(...b.rightUpperArm!)
    const fore = up.clone().multiply(new Quaternion(...b.rightLowerArm!))
    // Shoulder at origin; upper arm and forearm ~0.25 m each.
    const hand = RIGHT.clone().applyQuaternion(up).multiplyScalar(0.25).add(RIGHT.clone().applyQuaternion(fore).multiplyScalar(0.25))
    expect(hand.y).toBeGreaterThan(0.05) // above the shoulder, near the mouth
    expect(hand.z).toBeGreaterThan(0.1) // in front of the body
    expect(hand.x).toBeGreaterThan(-0.15) // pulled in toward the face, not out to the side
  })

  test('every rotation is a unit quaternion', () => {
    for (const q of Object.values(poseToBones(sampleClip('highfive', 700)))) {
      expect(Math.hypot(...q!)).toBeCloseTo(1, 5)
    }
  })
})
