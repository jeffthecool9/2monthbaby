import type { NetMsg } from '../net/protocol'
import type { Activity, InteractionKind, Vec2 } from '../types'
import type { NavGrid } from '../world/navgrid'

export type InteractMsg = Extract<NetMsg, { t: 'interact' }>

/** Clip length in ms for each couple interaction. */
export const INTERACTION_DURATION: Record<InteractionKind, number> = {
  kiss: 2500,
  hug: 3000,
  highfive: 1500,
  comfort: 3500,
  wave: 1500,
}

const GAP: Record<Exclude<InteractionKind, 'wave'>, number> = { kiss: 0.55, hug: 0.55, comfort: 0.55, highfive: 0.8 }
const WAVE_MIN_GAP = 1.2

export type Plan = { initiatorSpot: Vec2; partnerSpot: Vec2; initiatorFacing: number; partnerFacing: number }

/** Facing angle (0 = +z) from a toward b. */
export const facingTo = (a: Vec2, b: Vec2) => Math.atan2(b.x - a.x, b.z - a.z)

function facePlan(initiatorSpot: Vec2, partnerSpot: Vec2): Plan {
  const f = facingTo(initiatorSpot, partnerSpot)
  return { initiatorSpot, partnerSpot, initiatorFacing: f, partnerFacing: f + (f > 0 ? -Math.PI : Math.PI) }
}

export function planInteraction(kind: InteractionKind, initiator: Vec2, partner: Vec2, grid: NavGrid): Plan {
  const dx = partner.x - initiator.x, dz = partner.z - initiator.z
  const len = Math.hypot(dx, dz)
  const ux = len > 1e-6 ? dx / len : 1, uz = len > 1e-6 ? dz / len : 0

  if (kind === 'wave') {
    if (len >= WAVE_MIN_GAP) return facePlan({ ...initiator }, { ...partner })
    const back = grid.nearestWalkable({ x: partner.x - ux * WAVE_MIN_GAP, z: partner.z - uz * WAVE_MIN_GAP })
    return facePlan(back, { ...partner })
  }

  const gap = GAP[kind]
  const centre = { x: (initiator.x + partner.x) / 2, z: (initiator.z + partner.z) / 2 }
  const base = Math.atan2(ux, uz)
  // Search meeting points in rings around the midpoint; at each, try the natural axis
  // first, then rotate in 15° steps until both spots are free (e.g. sofa in the way).
  for (let r = 0; r <= 2; r += 0.25) {
    const ringSteps = r === 0 ? 1 : Math.round((2 * Math.PI * r) / 0.25)
    for (let k = 0; k < ringSteps; k++) {
      const ang = (k / ringSteps) * 2 * Math.PI
      const mid = { x: centre.x + r * Math.sin(ang), z: centre.z + r * Math.cos(ang) }
      if (!grid.isWalkable(mid)) continue
      for (let step = 0; step < 24; step++) {
        const a = base + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * (Math.PI / 12)
        const ax = Math.sin(a), az = Math.cos(a)
        const i = { x: mid.x - (ax * gap) / 2, z: mid.z - (az * gap) / 2 }
        const p = { x: mid.x + (ax * gap) / 2, z: mid.z + (az * gap) / 2 }
        if (grid.isWalkable(i) && grid.isWalkable(p)) return facePlan(i, p)
      }
    }
  }
  return facePlan(grid.nearestWalkable(initiator), grid.nearestWalkable(partner))
}

/** Both phones pick the same winner when two interactions cross. */
export function resolveCrossing(a: InteractMsg, b: InteractMsg): InteractMsg {
  if (a.at !== b.at) return a.at < b.at ? a : b
  return a.from < b.from ? a : b
}

export function needsRequest(partnerActivity: Activity): boolean {
  return partnerActivity === 'sitting' || partnerActivity === 'sleeping'
}
