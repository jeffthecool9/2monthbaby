import type { Vec2 } from '../types'
import { DOORS, FURNITURE, UNIT, WALLS } from './layout'

export const CELL = 0.25
const WALL_CLEARANCE = 0.2
const FURNITURE_INFLATE = 0.15
const SQRT2 = Math.SQRT2

function distToSegment(p: Vec2, a: Vec2, b: Vec2): { d: number; t: number } {
  const dx = b.x - a.x, dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2))
  return { d: Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)), t }
}

function inDoor(p: Vec2): boolean {
  return DOORS.some((door) => {
    const { d, t } = distToSegment(p, door.a, door.b)
    return d < WALL_CLEARANCE + 0.01 && t > 0 && t < 1
  })
}

export class NavGrid {
  readonly cols: number
  readonly rows: number
  private walkable: Uint8Array

  private constructor(cols: number, rows: number, walkable: Uint8Array) {
    this.cols = cols
    this.rows = rows
    this.walkable = walkable
  }

  static fromLayout(): NavGrid {
    const cols = Math.round(UNIT.width / CELL)
    const rows = Math.round(UNIT.depth / CELL)
    const w = new Uint8Array(cols * rows)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = { x: (c + 0.5) * CELL, z: (r + 0.5) * CELL }
        const nearWall = WALLS.some((wall) => distToSegment(p, wall.a, wall.b).d < WALL_CLEARANCE)
        const blockedByWall = nearWall && !inDoor(p)
        const blockedByFurniture = FURNITURE.some(
          (f) =>
            Math.abs(p.x - f.pos.x) < f.size.x / 2 + FURNITURE_INFLATE &&
            Math.abs(p.z - f.pos.z) < f.size.z / 2 + FURNITURE_INFLATE,
        )
        w[r * cols + c] = blockedByWall || blockedByFurniture ? 0 : 1
      }
    }
    return new NavGrid(cols, rows, w)
  }

  private cellOf(p: Vec2): [number, number] {
    return [Math.floor(p.x / CELL), Math.floor(p.z / CELL)]
  }

  private centre(c: number, r: number): Vec2 {
    return { x: (c + 0.5) * CELL, z: (r + 0.5) * CELL }
  }

  private open(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.walkable[r * this.cols + c] === 1
  }

  isWalkable(p: Vec2): boolean {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return false
    const [c, r] = this.cellOf(p)
    return this.open(c, r)
  }

  private nearestCell(p: Vec2): [number, number] | null {
    let best: [number, number] | null = null
    let bestD = Infinity
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.open(c, r)) continue
        const q = this.centre(c, r)
        const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2
        if (d < bestD) { bestD = d; best = [c, r] }
      }
    }
    return best
  }

  nearestWalkable(p: Vec2): Vec2 {
    if (this.isWalkable(p)) return { x: p.x, z: p.z }
    const cell = this.nearestCell(p)
    return cell ? this.centre(cell[0], cell[1]) : { x: p.x, z: p.z }
  }

  findPath(from: Vec2, to: Vec2): Vec2[] | null {
    const start = this.isWalkable(from) ? this.cellOf(from) : this.nearestCell(from)
    const targetWalkable = this.isWalkable(to)
    const goal = targetWalkable ? this.cellOf(to) : this.nearestCell(to)
    if (!start || !goal) return null
    const idx = (c: number, r: number) => r * this.cols + c
    const startI = idx(start[0], start[1])
    const goalI = idx(goal[0], goal[1])
    const g = new Float64Array(this.cols * this.rows).fill(Infinity)
    const came = new Int32Array(this.cols * this.rows).fill(-1)
    const closed = new Uint8Array(this.cols * this.rows)
    const h = (i: number) => {
      const dc = Math.abs((i % this.cols) - goal[0]), dr = Math.abs(Math.floor(i / this.cols) - goal[1])
      return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr)
    }
    // Small binary heap of [f, index].
    const heap: [number, number][] = []
    const push = (f: number, i: number) => {
      heap.push([f, i])
      let k = heap.length - 1
      while (k > 0) {
        const parent = (k - 1) >> 1
        if (heap[parent][0] <= heap[k][0]) break
        ;[heap[parent], heap[k]] = [heap[k], heap[parent]]
        k = parent
      }
    }
    const pop = (): [number, number] => {
      const top = heap[0]
      const last = heap.pop()!
      if (heap.length > 0) {
        heap[0] = last
        let k = 0
        for (;;) {
          const l = 2 * k + 1, r = l + 1
          let m = k
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r
          if (m === k) break
          ;[heap[m], heap[k]] = [heap[k], heap[m]]
          k = m
        }
      }
      return top
    }
    g[startI] = 0
    push(h(startI), startI)
    while (heap.length) {
      const [, i] = pop()
      if (closed[i]) continue
      if (i === goalI) break
      closed[i] = 1
      const c = i % this.cols, r = Math.floor(i / this.cols)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue
          const nc = c + dc, nr = r + dr
          if (!this.open(nc, nr)) continue
          if (dc && dr && (!this.open(c + dc, r) || !this.open(c, r + dr))) continue
          const ni = idx(nc, nr)
          const ng = g[i] + (dc && dr ? SQRT2 : 1)
          if (ng < g[ni]) {
            g[ni] = ng
            came[ni] = i
            push(ng + h(ni), ni)
          }
        }
      }
    }
    if (g[goalI] === Infinity) return null
    const cells: Vec2[] = []
    for (let i = goalI; i !== -1; i = came[i]) cells.push(this.centre(i % this.cols, Math.floor(i / this.cols)))
    cells.reverse()
    const path: Vec2[] = [{ x: from.x, z: from.z }, ...cells]
    if (targetWalkable) path.push({ x: to.x, z: to.z })
    return path
  }
}
