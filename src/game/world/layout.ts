// Apartment layout in metres. x: west→east [0, 13], z: south→north [0, 6.5]. Window wall at z = 6.5.
import type { Vec2 } from '../types'

export const UNIT = { width: 13, depth: 6.5, wallHeight: 2.7 }

export type RoomId = 'living' | 'dining' | 'bathroom' | 'bedroom' | 'balcony'
export type FloorKind = 'wood' | 'tile' | 'deck'

export const ROOMS: Record<RoomId, { min: Vec2; max: Vec2; floor: FloorKind }> = {
  living: { min: { x: 0, z: 3 }, max: { x: 6.8, z: 6.5 }, floor: 'wood' },
  dining: { min: { x: 6.8, z: 3 }, max: { x: 13, z: 6.5 }, floor: 'wood' },
  bathroom: { min: { x: 0, z: 0 }, max: { x: 3, z: 3 }, floor: 'tile' },
  bedroom: { min: { x: 3, z: 0 }, max: { x: 9.8, z: 3 }, floor: 'wood' },
  balcony: { min: { x: 9.8, z: 0 }, max: { x: 13, z: 3 }, floor: 'deck' },
}

export type WallKind = 'solid' | 'window' | 'railing'
export const WALLS: { a: Vec2; b: Vec2; kind: WallKind }[] = [
  { a: { x: 0, z: 0 }, b: { x: 9.8, z: 0 }, kind: 'solid' },
  { a: { x: 9.8, z: 0 }, b: { x: 13, z: 0 }, kind: 'railing' },
  { a: { x: 13, z: 0 }, b: { x: 13, z: 3 }, kind: 'railing' },
  { a: { x: 13, z: 3 }, b: { x: 13, z: 6.5 }, kind: 'solid' },
  { a: { x: 0, z: 6.5 }, b: { x: 13, z: 6.5 }, kind: 'window' },
  { a: { x: 0, z: 0 }, b: { x: 0, z: 6.5 }, kind: 'solid' },
  { a: { x: 0, z: 3 }, b: { x: 13, z: 3 }, kind: 'solid' },
  { a: { x: 3, z: 0 }, b: { x: 3, z: 3 }, kind: 'solid' },
  { a: { x: 9.8, z: 0 }, b: { x: 9.8, z: 3 }, kind: 'solid' },
]

export const DOORS: { a: Vec2; b: Vec2 }[] = [
  { a: { x: 1.2, z: 3 }, b: { x: 2.0, z: 3 } },
  { a: { x: 4.8, z: 3 }, b: { x: 5.6, z: 3 } },
  { a: { x: 9.8, z: 1.0 }, b: { x: 9.8, z: 2.0 } },
]

export type FurnitureId =
  | 'sofa' | 'coffeeTable' | 'tv' | 'plant' | 'kitchen' | 'diningTable' | 'diningChairA' | 'diningChairB'
  | 'bath' | 'toilet' | 'sink' | 'bed' | 'wardrobe' | 'balconyChairA' | 'balconyChairB'
export type FurnitureAction = 'sit' | 'sleep' | 'wardrobe' | 'bathe'

export type Furniture = {
  id: FurnitureId
  room: RoomId
  /** Footprint centre. */
  pos: Vec2
  /** Facing (radians around Y); 0 faces +z. */
  rotY: number
  /** World-axis footprint (x, z). */
  size: Vec2
  actions: FurnitureAction[]
  /** Walkable point a character goes to before using it. */
  usePoint?: Vec2
}

const H = Math.PI / 2
export const FURNITURE: Furniture[] = [
  { id: 'tv', room: 'living', pos: { x: 0.3, z: 4.9 }, rotY: H, size: { x: 0.4, z: 1.6 }, actions: [] },
  { id: 'coffeeTable', room: 'living', pos: { x: 2.0, z: 4.9 }, rotY: 0, size: { x: 0.6, z: 1.0 }, actions: [] },
  { id: 'sofa', room: 'living', pos: { x: 3.2, z: 4.9 }, rotY: -H, size: { x: 0.9, z: 2.2 }, actions: ['sit'], usePoint: { x: 4.0, z: 4.9 } },
  { id: 'plant', room: 'living', pos: { x: 6.3, z: 6.0 }, rotY: 0, size: { x: 0.5, z: 0.5 }, actions: [], usePoint: { x: 5.7, z: 5.6 } },
  { id: 'kitchen', room: 'dining', pos: { x: 12.65, z: 4.75 }, rotY: -H, size: { x: 0.7, z: 3.2 }, actions: [], usePoint: { x: 11.85, z: 5.1 } },
  { id: 'diningTable', room: 'dining', pos: { x: 9.6, z: 4.9 }, rotY: 0, size: { x: 1.4, z: 0.9 }, actions: [] },
  { id: 'diningChairA', room: 'dining', pos: { x: 8.6, z: 4.9 }, rotY: H, size: { x: 0.5, z: 0.5 }, actions: ['sit'], usePoint: { x: 8.0, z: 4.9 } },
  { id: 'diningChairB', room: 'dining', pos: { x: 10.6, z: 4.9 }, rotY: -H, size: { x: 0.5, z: 0.5 }, actions: ['sit'], usePoint: { x: 11.2, z: 4.9 } },
  { id: 'bath', room: 'bathroom', pos: { x: 0.45, z: 1.2 }, rotY: 0, size: { x: 0.8, z: 1.7 }, actions: ['bathe'], usePoint: { x: 1.35, z: 1.4 } },
  { id: 'toilet', room: 'bathroom', pos: { x: 2.6, z: 0.4 }, rotY: 0, size: { x: 0.45, z: 0.65 }, actions: [] },
  { id: 'sink', room: 'bathroom', pos: { x: 2.65, z: 1.8 }, rotY: -H, size: { x: 0.5, z: 0.6 }, actions: [] },
  { id: 'bed', room: 'bedroom', pos: { x: 6.2, z: 1.1 }, rotY: 0, size: { x: 1.6, z: 2.0 }, actions: ['sleep'], usePoint: { x: 6.2, z: 2.5 } },
  { id: 'wardrobe', room: 'bedroom', pos: { x: 8.9, z: 0.35 }, rotY: 0, size: { x: 1.4, z: 0.6 }, actions: ['wardrobe'], usePoint: { x: 8.9, z: 1.1 } },
  { id: 'balconyChairA', room: 'balcony', pos: { x: 11.0, z: 1.0 }, rotY: Math.PI, size: { x: 0.55, z: 0.55 }, actions: ['sit'], usePoint: { x: 11.0, z: 1.7 } },
  { id: 'balconyChairB', room: 'balcony', pos: { x: 12.0, z: 1.0 }, rotY: Math.PI, size: { x: 0.55, z: 0.55 }, actions: ['sit'], usePoint: { x: 12.0, z: 1.7 } },
]

/** [female side, male side] of the bed: where the feet go, so heads rest on the pillows. */
export const BED_SLEEP_SPOTS: [Vec2, Vec2] = [{ x: 5.82, z: 2.0 }, { x: 6.58, z: 2.0 }]
export const SPAWN: Vec2 = { x: 4.5, z: 4.2 }
