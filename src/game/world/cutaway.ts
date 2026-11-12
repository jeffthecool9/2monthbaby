// Sims-style cutaway: walls between the camera and the player are lowered so the player stays visible.
import type { Vec2 } from '../types'

const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)

function segmentsIntersect(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const d1 = cross(q1, q2, p1), d2 = cross(q1, q2, p2)
  const d3 = cross(p1, p2, q1), d4 = cross(p1, p2, q2)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** True when the wall crosses the line of sight from camera to player (both projected on the floor). */
export function blocksView(wall: { a: Vec2; b: Vec2 }, camera: Vec2, player: Vec2): boolean {
  return segmentsIntersect(wall.a, wall.b, camera, player)
}
