// Procedural buildings with real massing: podiums, setbacks, crowns, fins, balconies, rooftop plant,
// antennas. Each design is one merged geometry pair (glazed facade + solid concrete) so a whole
// city instances cheaply with per-building colour.
import { BoxGeometry, BufferGeometry, CylinderGeometry, Matrix4, Vector3, type BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const FLOOR_H = 3.3
export const BAY_W = 3.6

export type BuildingDesign = {
  name: string
  /** Glazed parts: UVs tiled so the window texture repeats per floor/bay. */
  facade: BufferGeometry
  /** Concrete parts: podium, slabs, roof, balconies, antennas. */
  solid: BufferGeometry
  height: number
  footprint: number
}

type Part = { geo: BufferGeometry; glazed: boolean }

/** Box whose window texture repeats once per bay horizontally and once per floor vertically. */
function glazedBox(w: number, h: number, d: number, x: number, y: number, z: number): Part {
  const g = new BoxGeometry(w, h, d)
  const uv = g.attributes.uv as BufferAttribute
  const pos = g.attributes.position as BufferAttribute
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; 4 verts each.
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4)
    const u = uv.getX(i), v = uv.getY(i)
    const horiz = face === 0 || face === 1 ? d : face === 4 || face === 5 ? w : w
    const vert = face === 2 || face === 3 ? d : h
    uv.setXY(i, u * (horiz / BAY_W), v * (vert / FLOOR_H))
  }
  void pos
  g.translate(x, y, z)
  return { geo: g, glazed: true }
}

function solidBox(w: number, h: number, d: number, x: number, y: number, z: number): Part {
  const g = new BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return { geo: g, glazed: false }
}

function cylinder(rTop: number, rBot: number, h: number, segs: number, x: number, y: number, z: number, glazed: boolean): Part {
  const g = new CylinderGeometry(rTop, rBot, h, segs)
  if (glazed) {
    const uv = g.attributes.uv as BufferAttribute
    const circumference = 2 * Math.PI * rBot
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (circumference / BAY_W), uv.getY(i) * (h / FLOOR_H))
  }
  g.translate(x, y, z)
  return { geo: g, glazed }
}

/** Rooftop plant: water tanks, AC units, a lift motor room, sometimes an antenna. */
function roofKit(parts: Part[], w: number, d: number, top: number, antenna: boolean, seed: number) {
  parts.push(solidBox(w * 0.3, 3, d * 0.3, -w * 0.25, top + 1.5, -d * 0.2))
  for (let i = 0; i < 3; i++) parts.push(solidBox(1.6, 1.2, 1.6, w * 0.2 + ((i * 7 + seed) % 3) * 2.2 - 2, top + 0.6, d * 0.25 - i * 1.9))
  parts.push(cylinder(1.1, 1.1, 2.2, 12, w * 0.3, top + 1.1, -d * 0.3, false))
  parts.push(solidBox(w + 0.6, 0.9, d + 0.6, 0, top + 0.45, 0)) // parapet band
  if (antenna) {
    parts.push(cylinder(0.12, 0.25, 12, 6, 0, top + 6, 0, false))
    parts.push(solidBox(0.5, 0.5, 0.5, 0, top + 12, 0))
  }
}

function balconies(parts: Part[], w: number, d: number, floors: number, fromFloor: number, sides: ('n' | 's' | 'e' | 'w')[]) {
  for (let f = fromFloor; f < floors; f++) {
    const y = f * FLOOR_H + 0.08
    for (const side of sides) {
      if (side === 'n') parts.push(solidBox(w * 0.9, 0.16, 1.4, 0, y, d / 2 + 0.7))
      if (side === 's') parts.push(solidBox(w * 0.9, 0.16, 1.4, 0, y, -d / 2 - 0.7))
      if (side === 'e') parts.push(solidBox(1.4, 0.16, d * 0.9, w / 2 + 0.7, y, 0))
      if (side === 'w') parts.push(solidBox(1.4, 0.16, d * 0.9, -w / 2 - 0.7, y, 0))
    }
  }
}

function finish(name: string, parts: Part[], height: number, footprint: number): BuildingDesign {
  const facade = mergeGeometries(parts.filter((p) => p.glazed).map((p) => p.geo))!
  const solid = mergeGeometries(parts.filter((p) => !p.glazed).map((p) => p.geo))!
  return { name, facade, solid, height, footprint }
}

/** Podium with shops, main tower, setback crown, rooftop plant and antenna. */
export function podiumTower(floors = 32, w = 22, d = 20): BuildingDesign {
  const parts: Part[] = []
  const h = floors * FLOOR_H
  parts.push(solidBox(w + 10, FLOOR_H * 3, d + 8, 0, FLOOR_H * 1.5, 0))
  parts.push(glazedBox(w + 9.4, FLOOR_H * 2.6, d + 7.4, 0, FLOOR_H * 1.5, 0))
  parts.push(glazedBox(w, h - FLOOR_H * 3 - FLOOR_H * 4, d, 0, FLOOR_H * 3 + (h - FLOOR_H * 7) / 2, 0))
  for (let f = 3; f < floors - 4; f += 4) parts.push(solidBox(w + 0.5, 0.35, d + 0.5, 0, f * FLOOR_H, 0))
  parts.push(glazedBox(w * 0.7, FLOOR_H * 4, d * 0.7, 0, h - FLOOR_H * 2, 0))
  roofKit(parts, w * 0.7, d * 0.7, h, true, 1)
  return finish('podiumTower', parts, h + 12, Math.max(w, d) + 10)
}

/** Slim slab tower with vertical fins and balcony bands. */
export function slabTower(floors = 40, w = 30, d = 14): BuildingDesign {
  const parts: Part[] = []
  const h = floors * FLOOR_H
  parts.push(glazedBox(w, h, d, 0, h / 2, 0))
  for (let i = 0; i <= 8; i++) parts.push(solidBox(0.5, h, d + 0.8, -w / 2 + (i * w) / 8, h / 2, 0))
  parts.push(solidBox(w + 0.6, 0.4, d + 0.6, 0, FLOOR_H, 0))
  balconies(parts, w, d, floors, 2, ['n'])
  roofKit(parts, w, d, h, false, 2)
  return finish('slabTower', parts, h + 4, Math.max(w, d))
}

/** Two towers on a shared podium, linked by a sky bridge. */
export function twinTowers(floors = 36, w = 16, d = 16): BuildingDesign {
  const parts: Part[] = []
  const h = floors * FLOOR_H, gap = 12
  parts.push(solidBox(w * 2 + gap + 6, FLOOR_H * 2, d + 6, 0, FLOOR_H, 0))
  for (const x of [-(w + gap) / 2, (w + gap) / 2]) {
    parts.push(glazedBox(w, h - FLOOR_H * 2, d, x, FLOOR_H * 2 + (h - FLOOR_H * 2) / 2, 0))
    parts.push(solidBox(w + 0.6, 0.5, d + 0.6, x, h, 0))
    roofKit(parts, w, d, h, x > 0, 3)
  }
  const by = h * 0.6
  parts.push(glazedBox(gap, FLOOR_H * 1.5, 6, 0, by, 0))
  parts.push(solidBox(gap + 1, 0.4, 6.6, 0, by - FLOOR_H * 0.75, 0))
  parts.push(solidBox(gap + 1, 0.4, 6.6, 0, by + FLOOR_H * 0.75, 0))
  return finish('twinTowers', parts, h + 12, w * 2 + gap + 6)
}

/** Round tower with a crown ring. */
export function roundTower(floors = 45, r = 12): BuildingDesign {
  const parts: Part[] = []
  const h = floors * FLOOR_H
  parts.push(cylinder(r, r, h, 28, 0, h / 2, 0, true))
  for (let f = 1; f < floors; f += 3) parts.push(cylinder(r + 0.5, r + 0.5, 0.35, 28, 0, f * FLOOR_H, 0, false))
  parts.push(cylinder(r + 1.5, r + 0.3, 2, 28, 0, h + 1, 0, false))
  parts.push(cylinder(r * 0.6, r * 0.6, FLOOR_H * 2, 28, 0, h + FLOOR_H + 2, 0, true))
  parts.push(cylinder(0.15, 0.3, 14, 6, 0, h + FLOOR_H * 2 + 9, 0, false))
  return finish('roundTower', parts, h + FLOOR_H * 2 + 16, r * 2 + 3)
}

/** Stepped ziggurat with roof gardens on each tier. */
export function steppedTower(floors = 38, w = 34, d = 30): BuildingDesign {
  const parts: Part[] = []
  const tiers = 3
  let y = 0
  for (let t = 0; t < tiers; t++) {
    const tw = w * (1 - t * 0.26), td = d * (1 - t * 0.26), th = (floors / tiers) * FLOOR_H
    parts.push(glazedBox(tw, th, td, 0, y + th / 2, 0))
    parts.push(solidBox(tw + 0.8, 0.6, td + 0.8, 0, y + th, 0))
    if (t < tiers - 1) {
      // Roof garden strip on the setback.
      parts.push(solidBox(tw * 0.9, 0.5, 2.5, 0, y + th + 0.55, td * 0.37))
    }
    y += th
  }
  roofKit(parts, w * 0.48, d * 0.48, y, false, 4)
  return finish('steppedTower', parts, y + 4, Math.max(w, d))
}

/** Glass tower with chamfered corners and a sloped crown. */
export function chamferTower(floors = 50, r = 13): BuildingDesign {
  const parts: Part[] = []
  const h = floors * FLOOR_H
  parts.push(cylinder(r, r, h, 8, 0, h / 2, 0, true))
  parts.push(cylinder(r + 0.4, r + 0.4, FLOOR_H * 2, 8, 0, FLOOR_H, 0, false))
  parts.push(cylinder(r * 0.2, r, FLOOR_H * 3, 8, 0, h + FLOOR_H * 1.5, 0, true))
  parts.push(cylinder(0.12, 0.2, 10, 6, 0, h + FLOOR_H * 3 + 5, 0, false))
  return finish('chamferTower', parts, h + FLOOR_H * 3 + 10, r * 2)
}

/** Residential mid-rise with balconies on every floor and a water-tank roof. */
export function balconyBlock(floors = 18, w = 26, d = 14): BuildingDesign {
  const parts: Part[] = []
  const h = floors * FLOOR_H
  parts.push(glazedBox(w, h, d, 0, h / 2, 0))
  parts.push(solidBox(w + 0.4, h, 0.5, 0, h / 2, 0)) // central core strip through the middle
  balconies(parts, w, d, floors, 1, ['n', 's'])
  for (let f = 1; f < floors; f++) {
    parts.push(solidBox(w * 0.9, 1.0, 0.1, 0, f * FLOOR_H + 0.6, d / 2 + 1.38))
    parts.push(solidBox(w * 0.9, 1.0, 0.1, 0, f * FLOOR_H + 0.6, -d / 2 - 1.38))
  }
  roofKit(parts, w, d, h, false, 5)
  return finish('balconyBlock', parts, h + 4, w + 3)
}

/** Shophouse row: 3–5 storeys, flat roof with tanks, continuous awning at street level. */
export function lowRise(floors = 5, w = 24, d = 14): BuildingDesign {
  const parts: Part[] = []
  const h = floors * FLOOR_H
  parts.push(glazedBox(w, h - FLOOR_H, d, 0, FLOOR_H + (h - FLOOR_H) / 2, 0))
  parts.push(solidBox(w, FLOOR_H, d, 0, FLOOR_H / 2, 0))
  parts.push(solidBox(w, 0.3, 2.2, 0, FLOOR_H - 0.4, d / 2 + 1.1)) // awning
  for (let i = 1; i < 4; i++) parts.push(solidBox(0.4, h, d + 0.3, -w / 2 + (i * w) / 4, h / 2, 0))
  parts.push(solidBox(w + 0.4, 0.8, d + 0.4, 0, h + 0.4, 0))
  parts.push(cylinder(1, 1, 1.8, 10, w * 0.3, h + 1.7, -d * 0.2, false))
  parts.push(solidBox(1.4, 1, 1.4, -w * 0.3, h + 1.3, d * 0.2))
  return finish('lowRise', parts, h + 3, w)
}

export function allDesigns(): BuildingDesign[] {
  return [podiumTower(), slabTower(), twinTowers(), roundTower(), steppedTower(), chamferTower(), balconyBlock(), lowRise()]
}

export const tmpMatrix = new Matrix4()
export const tmpVec = new Vector3()
