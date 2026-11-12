// The furniture shop and shared home decoration: what you can buy, where it may go, and the
// change log both phones apply in the same order.
import { FURNITURE, WALLS, DOORS, UNIT } from '../world/layout'
import { NavGrid } from '../world/navgrid'
import type { Vec2 } from '../types'

export type Category = 'seating' | 'tables' | 'lighting' | 'plants' | 'decor' | 'wall'
export type CatalogItem = {
  id: string
  name: string
  emoji: string
  category: Category
  price: number
  /** Footprint on the floor (x, z) in metres; wall items use x = width, z = thickness. */
  size: Vec2
  /** Hangs on a wall at this height instead of standing on the floor. */
  wall?: boolean
  /** Hex colour used by the procedural model. */
  color: string
}

export const CATALOG: CatalogItem[] = [
  { id: 'armchair', name: 'Boucle armchair', emoji: '🛋️', category: 'seating', price: 180, size: { x: 0.8, z: 0.8 }, color: '#f3e4df' },
  { id: 'beanbag', name: 'Bean bag', emoji: '🫘', category: 'seating', price: 90, size: { x: 0.9, z: 0.9 }, color: '#ffb3cd' },
  { id: 'stool', name: 'Oak stool', emoji: '🪑', category: 'seating', price: 60, size: { x: 0.4, z: 0.4 }, color: '#c89a68' },
  { id: 'loveseat', name: 'Velvet loveseat', emoji: '💕', category: 'seating', price: 320, size: { x: 1.4, z: 0.8 }, color: '#c75b7a' },
  { id: 'side-table', name: 'Side table', emoji: '🪵', category: 'tables', price: 70, size: { x: 0.45, z: 0.45 }, color: '#b88b62' },
  { id: 'desk', name: 'Study desk', emoji: '🖥️', category: 'tables', price: 240, size: { x: 1.2, z: 0.6 }, color: '#e9e2d9' },
  { id: 'bookshelf', name: 'Bookshelf', emoji: '📚', category: 'tables', price: 210, size: { x: 0.9, z: 0.35 }, color: '#d9c7b0' },
  { id: 'bar-cart', name: 'Bar cart', emoji: '🍹', category: 'tables', price: 150, size: { x: 0.7, z: 0.4 }, color: '#c9a46a' },
  { id: 'floor-lamp', name: 'Arc floor lamp', emoji: '💡', category: 'lighting', price: 130, size: { x: 0.4, z: 0.4 }, color: '#c9a46a' },
  { id: 'table-lamp', name: 'Mushroom lamp', emoji: '🍄', category: 'lighting', price: 80, size: { x: 0.3, z: 0.3 }, color: '#ff8fb3' },
  { id: 'neon-heart', name: 'Neon heart', emoji: '💖', category: 'lighting', price: 160, size: { x: 0.7, z: 0.08 }, wall: true, color: '#ff4f93' },
  { id: 'candles', name: 'Candle set', emoji: '🕯️', category: 'lighting', price: 45, size: { x: 0.3, z: 0.3 }, color: '#fff2dc' },
  { id: 'monstera', name: 'Monstera', emoji: '🌿', category: 'plants', price: 95, size: { x: 0.6, z: 0.6 }, color: '#4f8f5e' },
  { id: 'cactus', name: 'Cactus', emoji: '🌵', category: 'plants', price: 40, size: { x: 0.3, z: 0.3 }, color: '#6fae6a' },
  { id: 'bonsai', name: 'Bonsai', emoji: '🌳', category: 'plants', price: 120, size: { x: 0.4, z: 0.4 }, color: '#5c8f4a' },
  { id: 'flowers', name: 'Tulips in a vase', emoji: '🌷', category: 'plants', price: 35, size: { x: 0.25, z: 0.25 }, color: '#ff8fa8' },
  { id: 'rug-round', name: 'Round rug', emoji: '⭕', category: 'decor', price: 110, size: { x: 1.6, z: 1.6 }, color: '#f1d8e0' },
  { id: 'teddy', name: 'Giant teddy', emoji: '🧸', category: 'decor', price: 140, size: { x: 0.6, z: 0.6 }, color: '#c9966b' },
  { id: 'cat-tree', name: 'Cat tree', emoji: '🐱', category: 'decor', price: 170, size: { x: 0.6, z: 0.6 }, color: '#e8dcc8' },
  { id: 'record-player', name: 'Record player', emoji: '🎶', category: 'decor', price: 190, size: { x: 0.5, z: 0.4 }, color: '#5a3a2e' },
  { id: 'aquarium', name: 'Aquarium', emoji: '🐠', category: 'decor', price: 260, size: { x: 0.8, z: 0.4 }, color: '#8fd3ff' },
  { id: 'poster-sunset', name: 'Sunset print', emoji: '🌅', category: 'wall', price: 55, size: { x: 0.8, z: 0.05 }, wall: true, color: '#ffb27a' },
  { id: 'poster-moon', name: 'Moon print', emoji: '🌙', category: 'wall', price: 55, size: { x: 0.6, z: 0.05 }, wall: true, color: '#9aa8ff' },
  { id: 'photo-wall', name: 'Our photos', emoji: '📷', category: 'wall', price: 120, size: { x: 1.2, z: 0.05 }, wall: true, color: '#ffffff' },
  { id: 'mirror', name: 'Round mirror', emoji: '🪞', category: 'wall', price: 140, size: { x: 0.7, z: 0.05 }, wall: true, color: '#dfe6ee' },
  { id: 'clock', name: 'Wall clock', emoji: '🕰️', category: 'wall', price: 65, size: { x: 0.4, z: 0.05 }, wall: true, color: '#2a2622' },
]

export type Placed = { uid: string; item: string; x: number; z: number; rot: number; owner: string }
export type DecorState = { items: Record<string, Placed>; seq: number }
export type DecorChange =
  | { op: 'place'; uid: string; item: string; x: number; z: number; rot: number; owner: string; seq: number }
  | { op: 'move'; uid: string; x: number; z: number; rot: number; seq: number }
  | { op: 'remove'; uid: string; seq: number }

export const emptyDecor = (): DecorState => ({ items: {}, seq: 0 })

export function applyDecor(s: DecorState, c: DecorChange): DecorState {
  if (c.seq <= s.seq && s.seq !== 0) return s
  const items = { ...s.items }
  if (c.op === 'place') items[c.uid] = { uid: c.uid, item: c.item, x: c.x, z: c.z, rot: c.rot, owner: c.owner }
  else if (c.op === 'move') {
    if (!items[c.uid]) return s
    items[c.uid] = { ...items[c.uid], x: c.x, z: c.z, rot: c.rot }
  } else delete items[c.uid]
  return { items, seq: Math.max(s.seq, c.seq) }
}

const grid = NavGrid.fromLayout()

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
}
const WALL_SNAP = 0.35

/** Nearest wall point and the wall's facing, or null if no wall is close. */
export function nearestWall(p: Vec2): { x: number; z: number; rot: number } | null {
  let best: { x: number; z: number; rot: number; d: number } | null = null
  for (const w of WALLS) {
    if (w.kind !== 'solid') continue
    const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z, len2 = dx * dx + dz * dz
    const len = Math.sqrt(len2), margin = 0.3 / len
    const t = Math.max(margin, Math.min(1 - margin, ((p.x - w.a.x) * dx + (p.z - w.a.z) * dz) / len2))
    const x = w.a.x + dx * t, z = w.a.z + dz * t
    const d = Math.hypot(p.x - x, p.z - z)
    const inDoor = DOORS.some((door) => segDist({ x, z }, door.a, door.b) < 0.5)
    if (d < WALL_SNAP && !inDoor && (!best || d < best.d)) {
      // Face into the room: the side the point is on.
      const side = Math.sign((p.x - x) * -dz + (p.z - z) * dx) || 1
      best = { x, z, rot: Math.atan2(-dz * side, dx * side), d }
    }
  }
  return best
}

export function canPlace(item: CatalogItem, at: Vec2, placed: Placed[], ignoreUid?: string): boolean {
  if (at.x < 0 || at.z < 0 || at.x > UNIT.width || at.z > UNIT.depth) return false
  if (item.wall) return nearestWall(at) !== null
  // Every corner of the footprint must be walkable floor (not a wall, not fixed furniture).
  const hx = item.size.x / 2, hz = item.size.z / 2
  for (const [cx, cz] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz], [0, 0]]) if (!grid.isWalkable({ x: at.x + cx, z: at.z + cz })) return false
  for (const f of FURNITURE) if (Math.abs(f.pos.x - at.x) < f.size.x / 2 + hx && Math.abs(f.pos.z - at.z) < f.size.z / 2 + hz) return false
  for (const p of placed) {
    if (p.uid === ignoreUid) continue
    const other = CATALOG.find((c) => c.id === p.item)
    if (!other || other.wall) continue
    if (Math.abs(p.x - at.x) < other.size.x / 2 + hx && Math.abs(p.z - at.z) < other.size.z / 2 + hz) return false
  }
  return true
}

export const CATALOG_IDS = new Set(CATALOG.map((c) => c.id))
