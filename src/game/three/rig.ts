// Maps the procedural Pose (poses.ts) onto VRM normalized humanoid bones.
// VRM normalized space: T-pose, model faces +Z, right arm points -X, left arm +X, legs point -Y.
import { Euler, Quaternion, Vector3 } from 'three'
import type { Pose } from '../character/poses'

export type BoneName =
  | 'spine' | 'neck' | 'head'
  | 'leftUpperArm' | 'leftLowerArm' | 'rightUpperArm' | 'rightLowerArm'
  | 'leftUpperLeg' | 'leftLowerLeg' | 'rightUpperLeg' | 'rightLowerLeg'
export type Quat = [number, number, number, number]

const q = new Quaternion(), qx = new Quaternion(), qy = new Quaternion(), qz = new Quaternion()
const X = { x: 1, y: 0, z: 0 } as const
const tuple = (r: Quaternion): Quat => [r.x, r.y, r.z, r.w]
const axis = (out: Quaternion, a: 'x' | 'y' | 'z', angle: number) =>
  out.setFromAxisAngle({ x: a === 'x' ? 1 : 0, y: a === 'y' ? 1 : 0, z: a === 'z' ? 1 : 0 } as never, angle)

/** Arm: hang down from the T-pose (Z), then swing forward/back (X), then in/out (Y). */
function arm(side: 1 | -1, p: { x: number; y: number; z: number }): Quat {
  // side 1 = right arm (points -X in T-pose), -1 = left arm.
  const down = side * (Math.PI / 2 - p.z)
  axis(qz, 'z', down)
  axis(qx, 'x', p.x)
  axis(qy, 'y', -p.y)
  return tuple(q.copy(qy).multiply(qx).multiply(qz))
}

const UP = new Vector3(0, 1, 0)
const upper = new Quaternion()

/**
 * Soft elbow bend when reaching forward (hugs, comfort): the forearm curls inward around the
 * body's vertical axis, expressed in the upper arm's local frame so it never folds upward.
 */
function elbow(side: 1 | -1, p: { x: number }, upperArm: Quat): Quat {
  upper.set(upperArm[0], upperArm[1], upperArm[2], upperArm[3]).invert()
  const localUp = UP.clone().applyQuaternion(upper)
  const curl = qy.setFromAxisAngle(localUp, -side * Math.max(0, -p.x - 0.3) * 0.55)
  // Reaching up past the shoulder (blowing a kiss, hands to face): fold the forearm back toward the face.
  const fold = Math.min(2.3, Math.max(0, (-p.x - 1.5) * 4.5))
  qz.setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, side * fold)
  return tuple(q.copy(curl).multiply(qz))
}

function euler(e: { x: number; y: number; z: number }, scale = 1): Quat {
  return tuple(q.setFromEuler(new Euler(e.x * scale, e.y * scale, e.z * scale, 'YXZ')))
}

export function poseToBones(p: Pose): Partial<Record<BoneName, Quat>> {
  const knee = (legX: number) => tuple(qx.setFromAxisAngle(X as never, legX < -0.8 ? -legX * 0.98 : Math.max(0, legX) * 0.9))
  const rightUpperArm = arm(1, p.armR), leftUpperArm = arm(-1, p.armL)
  return {
    spine: euler(p.body),
    neck: euler(p.head, 0.35),
    head: euler(p.head, 0.65),
    rightUpperArm,
    leftUpperArm,
    rightLowerArm: elbow(1, p.armR, rightUpperArm),
    leftLowerArm: elbow(-1, p.armL, leftUpperArm),
    rightUpperLeg: tuple(axis(q, 'x', p.legR.x)),
    leftUpperLeg: tuple(axis(q, 'x', p.legL.x)),
    rightLowerLeg: knee(p.legR.x),
    leftLowerLeg: knee(p.legL.x),
  }
}
