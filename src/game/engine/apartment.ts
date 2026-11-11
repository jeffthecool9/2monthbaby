import '@babylonjs/loaders/glTF'
import {
  type AbstractMesh, Color3, Mesh, MeshBuilder, PBRMaterial, Scene, SceneLoader, ShadowGenerator, Texture,
  TransformNode, Vector3,
} from '@babylonjs/core'
import { DOORS, FURNITURE, ROOMS, UNIT, WALLS, type FloorKind, type FurnitureId, type WallKind } from '../world/layout'
import { blocksView } from '../world/cutaway'
import type { Vec2 } from '../types'

const TEX = '/assets/tex/'
const WALL_T = 0.12
const DOOR_H = 2.1
const CUT_H = 0.25

export type WallPiece = { mesh: Mesh; seg: { a: Vec2; b: Vec2 }; kind: WallKind }
export type Apartment = {
  floorMeshes: Mesh[]
  furnitureMeshes: Map<FurnitureId, AbstractMesh | TransformNode>
  walls: WallPiece[]
  /** Lower the walls between the camera and the player. Call every frame. */
  updateCutaway(camera: Vec2, player: Vec2): void
}

function pbrTex(scene: Scene, name: string, scale: Vec2, tint?: Color3): PBRMaterial {
  const m = new PBRMaterial(name, scene)
  const t = (kind: string) => {
    const tex = new Texture(`${TEX}${name}_${kind}.jpg`, scene)
    tex.uScale = scale.x
    tex.vScale = scale.z
    return tex
  }
  m.albedoTexture = t('diff')
  m.bumpTexture = t('nor')
  m.invertNormalMapY = true
  m.metallicTexture = t('arm')
  m.useAmbientOcclusionFromMetallicTextureRed = true
  m.useRoughnessFromMetallicTextureGreen = true
  m.useMetallnessFromMetallicTextureBlue = true
  m.metallic = 1
  m.roughness = 1
  if (tint) m.albedoColor = tint
  return m
}

function plain(scene: Scene, name: string, color: Color3, roughness = 0.6, metallic = 0): PBRMaterial {
  const m = new PBRMaterial(name, scene)
  m.albedoColor = color
  m.roughness = roughness
  m.metallic = metallic
  return m
}

const hex = (h: string) => Color3.FromHexString(h).toLinearSpace()

function glass(scene: Scene, name: string): PBRMaterial {
  const m = new PBRMaterial(name, scene)
  m.albedoColor = new Color3(0.85, 0.92, 1)
  m.alpha = 0.12
  m.roughness = 0.02
  m.metallic = 0
  m.indexOfRefraction = 1.5
  m.backFaceCulling = false
  return m
}

/** Splits a wall segment at the doors lying on it. Returns [start, end, isDoor] spans in 0..len. */
function spans(a: Vec2, b: Vec2): [number, number, boolean][] {
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len
  const cuts: [number, number][] = []
  for (const d of DOORS) {
    const t0 = (d.a.x - a.x) * ux + (d.a.z - a.z) * uz
    const t1 = (d.b.x - a.x) * ux + (d.b.z - a.z) * uz
    const off = Math.abs((d.a.x - a.x) * uz - (d.a.z - a.z) * ux)
    if (off < 0.01 && Math.max(t0, t1) > 0 && Math.min(t0, t1) < len) cuts.push([Math.min(t0, t1), Math.max(t0, t1)])
  }
  cuts.sort((p, q) => p[0] - q[0])
  const out: [number, number, boolean][] = []
  let t = 0
  for (const [s, e] of cuts) {
    if (s > t) out.push([t, s, false])
    out.push([s, e, true])
    t = e
  }
  if (t < len) out.push([t, len, false])
  return out
}

function wallBox(scene: Scene, name: string, a: Vec2, b: Vec2, t0: number, t1: number, y0: number, y1: number, thick: number): Mesh {
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len
  const mid = (t0 + t1) / 2
  const m = MeshBuilder.CreateBox(name, { width: t1 - t0, height: y1 - y0, depth: thick }, scene)
  m.position = new Vector3(a.x + ux * mid, (y0 + y1) / 2, a.z + uz * mid)
  m.rotation.y = -Math.atan2(uz, ux)
  return m
}

/** Fit an imported model into a furniture footprint: centred, on the floor, facing rotY. */
function fit(root: TransformNode, meshes: AbstractMesh[], pos: Vec2, rotY: number, size: Vec2, height?: number) {
  root.rotationQuaternion = null
  root.rotation = Vector3.Zero()
  root.scaling = Vector3.One()
  root.computeWorldMatrix(true)
  let min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const m of meshes) {
    m.computeWorldMatrix(true)
    const bb = m.getBoundingInfo().boundingBox
    min = Vector3.Minimize(min, bb.minimumWorld)
    max = Vector3.Maximize(max, bb.maximumWorld)
  }
  const ext = max.subtract(min)
  const sideways = Math.abs(Math.sin(rotY)) > 0.7
  const tx = sideways ? size.z : size.x, tz = sideways ? size.x : size.z
  let s = Math.min(tx / ext.x, tz / ext.z)
  if (height) s = Math.min(s, height / ext.y)
  const pivot = new TransformNode(`${root.name}-fit`, root.getScene())
  root.parent = pivot
  root.position = new Vector3(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2)
  pivot.scaling = new Vector3(s, s, s)
  pivot.rotation.y = rotY
  pivot.position = new Vector3(pos.x, 0, pos.z)
  return pivot
}

async function loadModel(scene: Scene, name: string): Promise<{ root: TransformNode; meshes: AbstractMesh[] } | null> {
  try {
    const r = await SceneLoader.ImportMeshAsync('', `/assets/models/${name}/`, `${name}.gltf`, scene)
    const root = r.meshes[0] as unknown as TransformNode
    return { root, meshes: r.meshes.filter((m) => m.getTotalVertices() > 0) }
  } catch (err) {
    console.warn('model failed', name, err)
    return null
  }
}

export async function buildApartment(scene: Scene, shadows: ShadowGenerator): Promise<Apartment> {
  const floorMats: Record<FloorKind, PBRMaterial> = {
    wood: pbrTex(scene, 'floor_wood', { x: 1, z: 1 }),
    tile: pbrTex(scene, 'floor_tile', { x: 1, z: 1 }),
    deck: pbrTex(scene, 'floor_deck', { x: 1, z: 1 }),
  }
  const wallMat = pbrTex(scene, 'wall_plaster', { x: 2, z: 1 }, hex('#fff5ec'))
  const glassMat = glass(scene, 'glass')
  const frameMat = plain(scene, 'frame', hex('#2b2b30'), 0.4, 0.8)
  const whiteMat = plain(scene, 'white', hex('#f4f1ec'), 0.35)
  const porcelain = plain(scene, 'porcelain', hex('#fbfbfb'), 0.12)
  const woodDark = plain(scene, 'woodDark', hex('#6b4a33'), 0.55)
  const steel = plain(scene, 'steel', hex('#c9ccd1'), 0.25, 1)
  const marble = pbrTex(scene, 'counter_marble', { x: 1, z: 1 })

  const floorMeshes: Mesh[] = []
  for (const [id, r] of Object.entries(ROOMS)) {
    const w = r.max.x - r.min.x, d = r.max.z - r.min.z
    const f = MeshBuilder.CreateGround(`floor-${id}`, { width: w, height: d }, scene)
    f.position = new Vector3((r.min.x + r.max.x) / 2, 0, (r.min.z + r.max.z) / 2)
    const mat = floorMats[r.floor].clone(`floor-${id}-mat`)
    for (const t of mat.getActiveTextures()) if (t instanceof Texture) { t.uScale = w / 2; t.vScale = d / 2 }
    f.material = mat
    f.receiveShadows = true
    f.metadata = { kind: 'floor' }
    floorMeshes.push(f)
  }

  // Building slab and facade below our floor, like a Sims cutaway of a tower.
  const slab = MeshBuilder.CreateBox('slab', { width: UNIT.width + 0.3, height: 0.35, depth: UNIT.depth + 0.3 }, scene)
  slab.position = new Vector3(UNIT.width / 2, -0.18, UNIT.depth / 2)
  slab.material = plain(scene, 'concrete', hex('#cfc6c4'), 0.8)
  slab.isPickable = false
  const facade = MeshBuilder.CreateBox('facade', { width: UNIT.width + 0.3, height: 40, depth: UNIT.depth + 0.3 }, scene)
  facade.position = new Vector3(UNIT.width / 2, -20.35, UNIT.depth / 2)
  facade.material = plain(scene, 'facade', hex('#4b4560'), 0.3, 0.2)
  facade.isPickable = false

  const walls: WallPiece[] = []
  const add = (mesh: Mesh, seg: { a: Vec2; b: Vec2 }, kind: WallKind) => {
    mesh.receiveShadows = true
    mesh.isPickable = false
    walls.push({ mesh, seg, kind })
  }
  WALLS.forEach((wall, wi) => {
    const { a, b, kind } = wall
    for (const [s, e, door] of spans(a, b)) {
      if (kind === 'solid') {
        if (door) {
          const lintel = wallBox(scene, `lintel-${wi}`, a, b, s, e, DOOR_H, UNIT.wallHeight, WALL_T)
          lintel.material = wallMat
          add(lintel, wall, kind)
        } else {
          const m = wallBox(scene, `wall-${wi}`, a, b, s, e, 0, UNIT.wallHeight, WALL_T)
          m.material = wallMat
          shadows.addShadowCaster(m)
          add(m, wall, kind)
        }
      } else if (kind === 'window') {
        const pane = wallBox(scene, `glass-${wi}`, a, b, s, e, 0, UNIT.wallHeight, 0.02)
        pane.material = glassMat
        add(pane, wall, kind)
        const len = e - s
        for (let t = s; t <= e + 1e-6; t += len / 5) {
          const mull = wallBox(scene, `mullion-${wi}`, a, b, t - 0.03, t + 0.03, 0, UNIT.wallHeight, 0.08)
          mull.material = frameMat
          add(mull, wall, kind)
        }
        const top = wallBox(scene, `wtop-${wi}`, a, b, s, e, UNIT.wallHeight - 0.08, UNIT.wallHeight, 0.08)
        top.material = frameMat
        add(top, wall, kind)
      } else {
        const pane = wallBox(scene, `rail-glass-${wi}`, a, b, s, e, 0.05, 1.05, 0.02)
        pane.material = glassMat
        const rail = wallBox(scene, `rail-${wi}`, a, b, s, e, 1.05, 1.1, 0.06)
        rail.material = frameMat
        pane.isPickable = rail.isPickable = false
      }
    }
  })

  const furnitureMeshes = new Map<FurnitureId, AbstractMesh | TransformNode>()
  const tag = (node: TransformNode, id: FurnitureId) => {
    node.metadata = { kind: 'furniture', id }
    for (const m of node.getChildMeshes(false)) {
      m.metadata = { kind: 'furniture', id }
      m.receiveShadows = true
      shadows.addShadowCaster(m)
    }
    furnitureMeshes.set(id, node)
  }
  const spec = (id: FurnitureId) => FURNITURE.find((f) => f.id === id)!
  const group = (id: string) => new TransformNode(`${id}-root`, scene)
  const boxAt = (name: string, parent: TransformNode, w: number, h: number, d: number, x: number, y: number, z: number, mat: PBRMaterial) => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
    m.position = new Vector3(x, y, z)
    m.material = mat
    m.parent = parent
    return m
  }

  // Imported CC0 models.
  const modelFor: Partial<Record<FurnitureId, [string, number?]>> = {
    coffeeTable: ['coffeeTable', 0.45], plant: ['plant', 1.3], diningTable: ['diningTable', 0.78],
    diningChairA: ['diningChair', 0.95], diningChairB: ['diningChair', 0.95], wardrobe: ['wardrobe', 2.0],
  }
  await Promise.all(
    (Object.entries(modelFor) as [FurnitureId, [string, number?]][]).map(async ([id, [name, h]]) => {
      const f = spec(id)
      const model = await loadModel(scene, name)
      if (!model) return
      tag(fit(model.root, model.meshes, f.pos, f.rotY, f.size, h), id)
    }),
  )

  // Modern boucle sofa: soft cushions, rounded arms, wooden legs. Built facing local +z.
  {
    const f = spec('sofa')
    const g = group('sofa')
    // Pastel colour with the boucle's normal map for a soft, real-looking fabric surface.
    const fabric = plain(scene, 'sofa-fabric', hex('#efd9dc'), 0.95)
    const nor = new Texture(`${TEX}fabric_sofa_nor.jpg`, scene)
    nor.uScale = nor.vScale = 6
    fabric.bumpTexture = nor
    fabric.sheen.isEnabled = true
    fabric.sheen.intensity = 0.4
    const L = f.size.z, D = f.size.x
    boxAt('sofa-base', g, L - 0.3, 0.22, D - 0.05, 0, 0.2, 0, fabric)
    for (const sx of [-0.5, 0.5]) {
      const seat = MeshBuilder.CreateCapsule('sofa-seat', { radius: 0.1, height: L / 2 - 0.15, orientation: Vector3.Right(), tessellation: 12 }, scene)
      seat.scaling = new Vector3(1, 1, 3.2)
      seat.position = new Vector3((sx * (L - 0.3)) / 2, 0.38, 0.06)
      seat.material = fabric
      seat.parent = g
      const back = MeshBuilder.CreateCapsule('sofa-back', { radius: 0.12, height: L / 2 - 0.15, orientation: Vector3.Right(), tessellation: 12 }, scene)
      back.scaling = new Vector3(1, 2.4, 1)
      back.position = new Vector3((sx * (L - 0.3)) / 2, 0.66, -D / 2 + 0.17)
      back.rotation.x = -0.12
      back.material = fabric
      back.parent = g
    }
    for (const sx of [-1, 1]) {
      const arm = MeshBuilder.CreateCapsule('sofa-arm', { radius: 0.14, height: D, orientation: Vector3.Forward(), tessellation: 12 }, scene)
      arm.scaling = new Vector3(1, 1.5, 1)
      arm.position = new Vector3((sx * (L - 0.28)) / 2, 0.42, 0)
      arm.material = fabric
      arm.parent = g
      for (const sz of [-1, 1]) {
        const leg = MeshBuilder.CreateCylinder('sofa-leg', { height: 0.1, diameterTop: 0.05, diameterBottom: 0.035 }, scene)
        leg.position = new Vector3((sx * (L - 0.4)) / 2, 0.05, (sz * (D - 0.2)) / 2)
        leg.material = woodDark
        leg.parent = g
      }
    }
    const cushion = plain(scene, 'cushion', hex('#f4a3c0'), 0.9)
    for (const [cx, rz] of [[-0.75, 0.2], [0.75, -0.2]]) {
      const c = MeshBuilder.CreateSphere('sofa-cushion', { diameterX: 0.42, diameterY: 0.4, diameterZ: 0.14 }, scene)
      c.position = new Vector3(cx, 0.65, -D / 2 + 0.33)
      c.rotation.z = rz
      c.material = cushion
      c.parent = g
    }
    g.rotation.y = f.rotY
    g.position = new Vector3(f.pos.x, 0, f.pos.z)
    tag(g, 'sofa')
  }

  // TV on a low cabinet.
  {
    const f = spec('tv')
    const g = group('tv')
    boxAt('tv-cabinet', g, 0.4, 0.45, 1.6, 0, 0.225, 0, woodDark)
    const model = await loadModel(scene, 'tv')
    if (model) {
      const p = fit(model.root, model.meshes, { x: 0, z: 0 }, f.rotY, { x: 0.25, z: 1.2 }, 0.75)
      p.parent = g
      p.position.y = 0.45
    }
    g.position = new Vector3(f.pos.x, 0, f.pos.z)
    tag(g, 'tv')
  }

  // Kitchen: cabinets with a marble top along the east wall, stove and a fridge.
  {
    const f = spec('kitchen')
    const g = group('kitchen')
    boxAt('counter', g, f.size.x, 0.86, f.size.z - 0.8, 0, 0.43, 0.4, whiteMat)
    boxAt('counter-top', g, f.size.x + 0.04, 0.04, f.size.z - 0.8, 0, 0.88, 0.4, marble)
    boxAt('fridge', g, f.size.x, 1.85, 0.75, 0, 0.925, -f.size.z / 2 + 0.38, steel)
    const stove = await loadModel(scene, 'stove')
    if (stove) {
      const p = fit(stove.root, stove.meshes, { x: 0, z: 0.9 }, -Math.PI / 2, { x: 0.6, z: 0.6 }, 0.12)
      p.parent = g
      p.position.y = 0.9
    }
    g.position = new Vector3(f.pos.x, 0, f.pos.z)
    tag(g, 'kitchen')
  }

  // Bed with mattress, pastel duvet and pillows.
  {
    const f = spec('bed')
    const g = group('bed')
    const duvet = plain(scene, 'duvet', hex('#f7c6d6'), 0.85)
    boxAt('bed-base', g, f.size.x, 0.3, f.size.z, 0, 0.15, 0, woodDark)
    boxAt('bed-head', g, f.size.x, 0.9, 0.08, 0, 0.45, -f.size.z / 2 + 0.04, woodDark)
    boxAt('mattress', g, f.size.x - 0.06, 0.2, f.size.z - 0.1, 0, 0.4, 0.02, whiteMat)
    boxAt('duvet', g, f.size.x - 0.02, 0.08, f.size.z * 0.62, 0, 0.53, f.size.z * 0.17, duvet)
    for (const sx of [-0.4, 0.4]) {
      const p = MeshBuilder.CreateSphere('pillow', { diameterX: 0.6, diameterY: 0.16, diameterZ: 0.36 }, scene)
      p.position = new Vector3(sx, 0.56, -f.size.z / 2 + 0.3)
      p.material = whiteMat
      p.parent = g
    }
    g.position = new Vector3(f.pos.x, 0, f.pos.z)
    tag(g, 'bed')
  }

  // Bathroom fixtures.
  {
    const f = spec('bath')
    const g = group('bath')
    boxAt('bath-shell', g, f.size.x, 0.55, f.size.z, 0, 0.275, 0, porcelain)
    const water = plain(scene, 'water', hex('#bfe6f2'), 0.05)
    water.alpha = 0.8
    boxAt('bath-water', g, f.size.x - 0.12, 0.02, f.size.z - 0.12, 0, 0.5, 0, water)
    g.position = new Vector3(f.pos.x, 0, f.pos.z)
    tag(g, 'bath')
  }
  {
    const f = spec('toilet')
    const g = group('toilet')
    const bowl = MeshBuilder.CreateCylinder('toilet-bowl', { height: 0.4, diameterTop: 0.42, diameterBottom: 0.3 }, scene)
    bowl.position = new Vector3(0, 0.2, 0.08)
    bowl.material = porcelain
    bowl.parent = g
    boxAt('toilet-tank', g, 0.4, 0.4, 0.18, 0, 0.6, -0.22, porcelain)
    g.position = new Vector3(f.pos.x, 0, f.pos.z)
    tag(g, 'toilet')
  }
  {
    const f = spec('sink')
    const g = group('sink')
    boxAt('vanity', g, f.size.x, 0.8, f.size.z, 0, 0.4, 0, woodDark)
    const basin = MeshBuilder.CreateCylinder('basin', { height: 0.12, diameter: 0.4 }, scene)
    basin.position = new Vector3(0, 0.86, 0)
    basin.material = porcelain
    basin.parent = g
    boxAt('mirror', g, 0.03, 0.7, 0.5, f.size.x / 2 - 0.02, 1.5, 0, steel)
    g.position = new Vector3(f.pos.x, 0, f.pos.z)
    tag(g, 'sink')
  }

  // Balcony: one outdoor set fills both chair spots.
  {
    const a = spec('balconyChairA'), b = spec('balconyChairB')
    const model = await loadModel(scene, 'balconySet')
    if (model) {
      const centre = { x: (a.pos.x + b.pos.x) / 2, z: a.pos.z }
      const node = fit(model.root, model.meshes, centre, 0, { x: 1.7, z: 0.8 }, 0.9)
      tag(node, 'balconyChairA')
      furnitureMeshes.set('balconyChairB', node)
    }
  }

  const ceilingLamp = await loadModel(scene, 'ceilingLamp')
  if (ceilingLamp) fit(ceilingLamp.root, ceilingLamp.meshes, { x: 3.2, z: 4.9 }, 0, { x: 0.6, z: 0.6 }, 0.5).position.y = UNIT.wallHeight - 0.5

  const frame = await loadModel(scene, 'pictureFrame')
  if (frame) {
    const p = fit(frame.root, frame.meshes, { x: 2.0, z: 4.6 }, Math.PI / 2, { x: 0.2, z: 0.2 }, 0.22)
    p.position.y = 0.45
  }

  const updateCutaway = (camera: Vec2, player: Vec2) => {
    for (const w of walls) {
      if (w.kind === 'window') continue
      const cut = blocksView(w.seg, camera, player)
      const h = w.mesh.getBoundingInfo().boundingBox.extendSize.y * 2
      const fullTop = w.mesh.metadata?.top ?? (w.mesh.metadata = { top: w.mesh.position.y + h / 2, bottom: w.mesh.position.y - h / 2 }).top
      const bottom = w.mesh.metadata.bottom as number
      if (bottom >= DOOR_H - 0.01) {
        w.mesh.isVisible = !cut
        continue
      }
      const top = cut ? CUT_H : fullTop
      w.mesh.scaling.y = (top - bottom) / h
      w.mesh.position.y = bottom + (top - bottom) / 2
    }
  }

  return { floorMeshes, furnitureMeshes, walls, updateCutaway }
}
