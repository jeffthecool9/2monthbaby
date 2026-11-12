export type PointerSample = { x: number; y: number; t: number }

const TAP_MAX_MOVE = 8
const TAP_MAX_MS = 300

/** A tap is one finger, barely moved, quickly released. Anything else is camera control. */
export function classifyGesture(down: PointerSample, up: PointerSample, maxPointers: number): 'tap' | 'drag' {
  if (maxPointers !== 1) return 'drag'
  if (Math.hypot(up.x - down.x, up.y - down.y) > TAP_MAX_MOVE) return 'drag'
  return up.t - down.t <= TAP_MAX_MS ? 'tap' : 'drag'
}
