// The high-rise apartment: rooms, walls, furniture and the small things that move.
import {
  AdditiveBlending, Box3, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Group,
  InstancedMesh, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, PointLight,
  Points, PointsMaterial, RepeatWrapping, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3, BoxGeometry, type Texture,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { DOORS, FURNITURE, ROOMS, UNIT, WALLS, type FurnitureId, type WallKind } from '../world/layout'
import { blocksView } from '../world/cutaway'
import type { Vec2 } from '../types'
import type { Daylight } from '../world/daylight'

const TEX = '/assets/tex/'
const WALL_T = 0.12
const DOOR_H = 2.1
const CUT_H = 0.22

export type WallPiece = { mesh: Mesh; seg: { a: Vec2; b: Vec2 }; kind: WallKind; bottom: number; top: number }
export type Apartment = {
  root: Group
  floorMeshes: Mesh[]
  furniture: Map<FurnitureId, Object3D>
  updateCutaway(camera: Vec2, player: Vec2): void
  update(dt: number, t: number): void
  /** Lamps on after dusk, off by day; fairy lights dim in daylight. */
  setDaylight(d: Daylight): void
}

const loader = new TextureLoader()
const texCache = new Map<string, Texture>()
function tex(name: string, srgb: boolean, repeat: Vec2): Texture {
  const key = `${name}:${repeat.x}:${repeat.z}`
  let t = texCache.get(key)
  if (!t) {
    t = loader.load(`${TEX}${name}.jpg`)
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(repeat.x, repeat.z)
    t.anisotropy = 8
    if (srgb) t.colorSpace = SRGBColorSpace
    texCache.set(key, t)
  }
  return t
}

/** Poly Haven PBR set: diffuse + normal + ARM (AO/roughness/metal packed, which three reads natively). */
function pbr(name: string, repeat: Vec2, tint = '#ffffff', extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial {
  const arm = tex(`${name}_arm`, false, repeat)
  return new MeshStandardMaterial({
    map: tex(`${name}_diff`, true, repeat), normalMap: tex(`${name}_nor`, false, repeat),
    aoMap: arm, roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1, color: new Color(tint), ...extra,
  })
}

const mat = (color: string, roughness = 0.6, metalness = 0, extra: object = {}) =>
  new MeshStandardMaterial({ color: new Color(color), roughness, metalness, ...extra })

function shadowed<T extends Object3D>(o: T, cast = true): T {
  o.traverse((c) => {
    if ((c as Mesh).isMesh) {
      c.castShadow = cast
      c.receiveShadow = true
    }
  })
  return o
}

function rbox(w: number, h: number, d: number, r: number, m: MeshStandardMaterial, x: number, y: number, z: number, parent: Object3D) {
  const mesh = new Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), m)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

/** Splits a wall segment at the doors on it: [start, end, isDoor] in metres along the wall. */
function spans(a: Vec2, b: Vec2): [number, number, boolean][] {
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len
  const cuts: [number, number][] = []
  for (const d of DOORS) {
    const t0 = (d.a.x - a.x) * ux + (d.a.z - a.z) * uz, t1 = (d.b.x - a.x) * ux + (d.b.z - a.z) * uz
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

function wallBox(a: Vec2, b: Vec2, t0: number, t1: number, y0: number, y1: number, thick: number, m: MeshStandardMaterial | MeshPhysicalMaterial) {
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len, mid = (t0 + t1) / 2
  const mesh = new Mesh(new BoxGeometry(t1 - t0, y1 - y0, thick), m)
  mesh.position.set(a.x + ux * mid, (y0 + y1) / 2, a.z + uz * mid)
  mesh.rotation.y = -Math.atan2(uz, ux)
  return mesh
}

/** Fit a loaded model into a footprint: centred, standing on the floor, facing rotY. */
function fit(model: Object3D, pos: Vec2, rotY: number, size: Vec2, height?: number): Group {
  const box = new Box3().setFromObject(model)
  const ext = box.getSize(new Vector3()), centre = box.getCenter(new Vector3())
  const sideways = Math.abs(Math.sin(rotY)) > 0.7
  const tx = sideways ? size.z : size.x, tz = sideways ? size.x : size.z
  let s = Math.min(tx / ext.x, tz / ext.z)
  if (height) s = Math.min(s, height / ext.y)
  model.position.set(-centre.x, -box.min.y, -centre.z)
  const pivot = new Group()
  pivot.add(model)
  pivot.scale.setScalar(s)
  pivot.rotation.y = rotY
  pivot.position.set(pos.x, 0, pos.z)
  return pivot
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

function painting(seed: number): CanvasTexture {
  const palettes = [['#f7c6d6', '#ffe8c2', '#b9d8f0', '#e9a8c6'], ['#2f4b6e', '#f3b391', '#f6e1c3', '#8fb1c9'], ['#e4d6f7', '#ffd3b5', '#a9d6c8', '#f29fb5']]
  const p = palettes[seed % palettes.length]
  return canvasTexture(512, 640, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 640)
    g.addColorStop(0, p[0])
    g.addColorStop(1, p[1])
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 640)
    let s = seed * 9301 + 49297
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = 0.55
      ctx.fillStyle = p[2 + (i % 2)]
      ctx.beginPath()
      ctx.ellipse(rnd() * 512, 200 + rnd() * 400, 60 + rnd() * 160, 40 + rnd() * 110, rnd() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(380, 150, 46, 0, Math.PI * 2)
    ctx.fill()
  })
}

function rugTexture(): CanvasTexture {
  return canvasTexture(1024, 768, (ctx) => {
    ctx.fillStyle = '#f3e3dc'
    ctx.fillRect(0, 0, 1024, 768)
    ctx.strokeStyle = '#d9a7b5'
    ctx.lineWidth = 18
    ctx.strokeRect(40, 40, 944, 688)
    ctx.lineWidth = 4
    ctx.strokeRect(78, 78, 868, 612)
    ctx.fillStyle = 'rgba(215,160,175,0.35)'
    for (let y = 140; y < 680; y += 90) for (let x = 140; x < 900; x += 110) {
      ctx.beginPath()
      ctx.moveTo(x, y - 22); ctx.lineTo(x + 22, y); ctx.lineTo(x, y + 22); ctx.lineTo(x - 22, y)
      ctx.fill()
    }
    // Fibre noise for a woven feel.
    const img = ctx.getImageData(0, 0, 1024, 768)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
  })
}

async function loadModel(name: string): Promise<Object3D | null> {
  try {
    const gltf = await new GLTFLoader().loadAsync(`/assets/models/${name}/${name}.gltf`)
    return gltf.scene
  } catch (err) {
    console.warn('model failed', name, err)
    return null
  }
}

export async function buildApartment(opts: { lite?: boolean } = {}): Promise<Apartment> {
  const root = new Group()
  const movers: ((dt: number, t: number) => void)[] = []
  const lamps: { light?: PointLight; shade: MeshStandardMaterial; glow: number }[] = []
  const floorMeshes: Mesh[] = []
  const furniture = new Map<FurnitureId, Object3D>()

  // ── Floors ───────────────────────────────────────────────
  const floorFor = { wood: 'floor_wood', tile: 'floor_tile', deck: 'floor_deck' } as const
  for (const [id, r] of Object.entries(ROOMS)) {
    const w = r.max.x - r.min.x, d = r.max.z - r.min.z
    const m = pbr(floorFor[r.floor], { x: w / 2.2, z: d / 2.2 }, r.floor === 'wood' ? '#f4e2cf' : '#ffffff', r.floor === 'tile' ? { envMapIntensity: 1.3 } : {})
    const f = new Mesh(new PlaneGeometry(w, d), m)
    f.rotation.x = -Math.PI / 2
    f.position.set((r.min.x + r.max.x) / 2, 0, (r.min.z + r.max.z) / 2)
    f.receiveShadow = true
    f.userData = { kind: 'floor' }
    root.add(f)
    floorMeshes.push(f)
  }

  // Slab edge and facade under our floor, Sims-style cutaway of the tower.
  const slab = new Mesh(new BoxGeometry(UNIT.width + 0.3, 0.32, UNIT.depth + 0.3), mat('#e7ddd8', 0.85))
  slab.position.set(UNIT.width / 2, -0.165, UNIT.depth / 2)
  const facade = new Mesh(new BoxGeometry(UNIT.width + 0.3, 84, UNIT.depth + 0.3), mat('#bfc6d4', 0.3, 0.35))
  facade.position.set(UNIT.width / 2, -42.33, UNIT.depth / 2)
  root.add(slab, facade)
  // Our tower: balcony slabs and glass bands on every floor below us.
  const bandMat = mat('#e9e2dc', 0.8)
  const glassBand = new MeshStandardMaterial({ color: '#1e2a40', roughness: 0.15, metalness: 0.7, envMapIntensity: 1.2 })
  for (let f = 1; f <= 25; f++) {
    const y = -f * 3.3
    const band = new Mesh(new BoxGeometry(UNIT.width + 1.6, 0.25, UNIT.depth + 1.6), bandMat)
    band.position.set(UNIT.width / 2, y, UNIT.depth / 2)
    const glass = new Mesh(new BoxGeometry(UNIT.width + 0.5, 1.9, UNIT.depth + 0.5), glassBand)
    glass.position.set(UNIT.width / 2, y + 1.3, UNIT.depth / 2)
    root.add(band, glass)
  }

  // ── Walls, window wall, balcony railing ─────────────────
  const wallMat = pbr('wall_plaster', { x: 2, z: 1 }, '#fff7f1')
  const glassMat = new MeshPhysicalMaterial({ color: '#e6f1ff', transparent: true, opacity: 0.06, roughness: 0.02, metalness: 0, envMapIntensity: 0.9, side: DoubleSide, depthWrite: false })
  const frameMat = mat('#24232b', 0.35, 0.8)
  const walls: WallPiece[] = []
  WALLS.forEach((wall) => {
    const { a, b, kind } = wall
    for (const [s, e, door] of spans(a, b)) {
      if (kind === 'solid') {
        const [y0, y1] = door ? [DOOR_H, UNIT.wallHeight] : [0, UNIT.wallHeight]
        const m = wallBox(a, b, s, e, y0, y1, WALL_T, wallMat)
        shadowed(m)
        root.add(m)
        walls.push({ mesh: m, seg: wall, kind, bottom: y0, top: y1 })
        // Skirting board
        if (!door) {
          const skirt = wallBox(a, b, s, e, 0, 0.09, WALL_T + 0.025, mat('#f1e7df', 0.5))
          root.add(skirt)
        }
      } else if (kind === 'window') {
        const pane = wallBox(a, b, s, e, 0, UNIT.wallHeight, 0.02, glassMat)
        pane.renderOrder = 2
        root.add(pane)
        for (let t = s; t <= e + 1e-6; t += (e - s) / 6) root.add(wallBox(a, b, t - 0.025, t + 0.025, 0, UNIT.wallHeight, 0.07, frameMat))
        root.add(wallBox(a, b, s, e, UNIT.wallHeight - 0.06, UNIT.wallHeight, 0.08, frameMat))
        root.add(wallBox(a, b, s, e, 0, 0.05, 0.1, frameMat))
      } else {
        const pane = wallBox(a, b, s, e, 0.05, 1.05, 0.02, glassMat)
        pane.renderOrder = 2
        root.add(pane, wallBox(a, b, s, e, 1.05, 1.1, 0.05, frameMat))
      }
    }
  })

  // ── Materials for furniture ──────────────────────────────
  // Soft boucle: physical material with sheen so the fabric catches the light like cloth.
  const fabric = new MeshPhysicalMaterial({ color: '#efd9dc', roughness: 0.95, sheen: 0.7, sheenRoughness: 0.6, sheenColor: new Color('#fff0f4'), normalMap: tex('fabric_sofa_nor', false, { x: 4, z: 4 }) })
  const oak = mat('#b88b62', 0.55)
  const walnut = mat('#5d4030', 0.5)
  const white = mat('#f6f3ee', 0.4)
  const porcelain = new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 })
  const steel = mat('#d4d7dc', 0.22, 1)
  const brass = mat('#c9a46a', 0.3, 1)
  const marble = pbr('counter_marble', { x: 1, z: 1 }, '#ffffff', { envMapIntensity: 1.4 })
  const spec = (id: FurnitureId) => FURNITURE.find((f) => f.id === id)!
  const place = (id: FurnitureId, g: Object3D) => {
    const f = spec(id)
    g.position.set(f.pos.x, g.position.y, f.pos.z)
    g.rotation.y = g.rotation.y || f.rotY
    shadowed(g)
    g.traverse((c) => (c.userData = { kind: 'furniture', id }))
    furniture.set(id, g)
    root.add(g)
  }

  // Sofa: soft rounded cushions, built facing local +z.
  {
    const f = spec('sofa'), g = new Group(), L = f.size.z, D = f.size.x
    rbox(L - 0.3, 0.24, D - 0.06, 0.06, fabric, 0, 0.2, 0, g)
    for (const sx of [-0.5, 0.5]) {
      rbox(L / 2 - 0.2, 0.17, D - 0.32, 0.07, fabric, (sx * (L - 0.32)) / 2, 0.41, 0.08, g)
      const back = rbox(L / 2 - 0.2, 0.46, 0.2, 0.08, fabric, (sx * (L - 0.32)) / 2, 0.64, -D / 2 + 0.16, g)
      back.rotation.x = -0.12
    }
    for (const sx of [-1, 1]) {
      rbox(0.2, 0.5, D - 0.02, 0.09, fabric, (sx * (L - 0.2)) / 2, 0.38, 0, g)
      for (const sz of [-1, 1]) {
        const leg = new Mesh(new CylinderGeometry(0.022, 0.016, 0.1, 10), walnut)
        leg.position.set((sx * (L - 0.4)) / 2, 0.05, (sz * (D - 0.2)) / 2)
        g.add(leg)
      }
    }
    const pinkPillow = mat('#f29bb8', 0.92), creamPillow = mat('#fff3e6', 0.92)
    for (const [cx, rz, m] of [[-0.7, 0.25, pinkPillow], [0.75, -0.2, creamPillow], [0.45, 0.1, pinkPillow]] as const) {
      const p = rbox(0.4, 0.38, 0.13, 0.06, m, cx, 0.66, -D / 2 + 0.33, g)
      p.rotation.z = rz
      p.rotation.x = -0.25
    }
    // Knitted throw over one arm.
    rbox(0.5, 0.03, 0.6, 0.015, mat('#cfe0f2', 0.95), L / 2 - 0.18, 0.64, 0.05, g)
    g.rotation.y = f.rotY
    place('sofa', g)
  }

  // Rug under the coffee table and sofa.
  {
    const rug = new Mesh(new PlaneGeometry(2.6, 1.9), new MeshStandardMaterial({ map: rugTexture(), roughness: 1 }))
    rug.rotation.x = -Math.PI / 2
    rug.rotation.z = Math.PI / 2
    rug.position.set(2.2, 0.006, 4.9)
    rug.receiveShadow = true
    rug.userData = { kind: 'floor' }
    root.add(rug)
    floorMeshes.push(rug)
  }

  // TV: slim screen with a gently moving picture, on a walnut cabinet.
  {
    const f = spec('tv'), g = new Group()
    rbox(0.42, 0.42, 1.6, 0.03, walnut, 0, 0.21, 0, g)
    rbox(0.05, 0.64, 1.12, 0.015, mat('#111114', 0.3, 0.5), 0.02, 0.9, 0, g)
    const screenTex = canvasTexture(256, 144, () => {})
    const screen = new Mesh(new PlaneGeometry(1.06, 0.6), new MeshBasicMaterial({ map: screenTex, toneMapped: false }))
    screen.position.set(0.048, 0.9, 0)
    screen.rotation.y = Math.PI / 2
    g.add(screen)
    const ctx = (screenTex.image as HTMLCanvasElement).getContext('2d')!
    let acc = 0
    movers.push((dt, t) => {
      acc += dt
      if (acc < 120) return
      acc = 0
      const gr = ctx.createLinearGradient(0, 0, 256, 144)
      gr.addColorStop(0, `hsl(${(t / 60) % 360},60%,${42 + 8 * Math.sin(t / 900)}%)`)
      gr.addColorStop(1, `hsl(${(t / 60 + 80) % 360},55%,30%)`)
      ctx.fillStyle = gr
      ctx.fillRect(0, 0, 256, 144)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.arc(128 + 70 * Math.sin(t / 1400), 72 + 30 * Math.cos(t / 1100), 26, 0, Math.PI * 2)
      ctx.fill()
      screenTex.needsUpdate = true
    })
    g.position.y = 0
    place('tv', g)
    g.rotation.y = 0
  }

  // CC0 models.
  const models: [FurnitureId, string, number?][] = [['coffeeTable', 'coffeeTable', 0.45], ['plant', 'plant', 1.35], ['diningTable', 'diningTable', 0.76], ['diningChairA', 'diningChair', 0.95], ['diningChairB', 'diningChair', 0.95], ['wardrobe', 'wardrobe', 1.95]]
  await Promise.all(models.map(async ([id, name, h]) => {
    const m = await loadModel(name)
    if (!m) return
    const f = spec(id)
    const g = fit(m, { x: 0, z: 0 }, 0, f.size, h)
    const pivot = new Group()
    pivot.add(g)
    pivot.rotation.y = f.rotY
    place(id, pivot)
    if (id === 'plant') movers.push((_dt, t) => (g.rotation.z = Math.sin(t / 1700) * 0.025))
  }))

  // Kitchen along the east wall: base units, marble top, upper cabinets, fridge, stove.
  {
    const f = spec('kitchen'), g = new Group(), d = f.size.x, len = f.size.z
    rbox(d, 0.86, len - 0.8, 0.02, white, 0, 0.43, 0.4, g)
    rbox(d + 0.04, 0.04, len - 0.8, 0.01, marble, 0, 0.88, 0.4, g)
    rbox(0.36, 0.7, len - 0.8, 0.02, white, 0.17, 1.95, 0.4, g)
    for (let z = -len / 2 + 1.1; z < len / 2; z += 0.6) rbox(0.02, 0.02, 0.18, 0.005, brass, -d / 2 - 0.01, 0.7, z, g)
    rbox(d, 1.9, 0.76, 0.04, steel, 0, 0.95, -len / 2 + 0.38, g)
    const stove = await loadModel('stove')
    if (stove) {
      const s = fit(stove, { x: 0, z: 1.0 }, -Math.PI / 2, { x: 0.6, z: 0.6 }, 0.12)
      s.position.y = 0.9
      g.add(s)
    }
    g.rotation.y = 0
    place('kitchen', g)
    g.rotation.y = 0
  }

  // Bed with linen duvet, pillows and bedside tables with warm lamps.
  {
    const f = spec('bed'), g = new Group(), W = f.size.x, Lb = f.size.z
    const duvet = mat('#f6cdd8', 0.96, 0, { normalMap: tex('fabric_sofa_nor', false, { x: 3, z: 3 }), normalScale: { x: 0.4, y: 0.4 } as never })
    rbox(W, 0.3, Lb, 0.04, oak, 0, 0.15, 0, g)
    rbox(W + 0.08, 1.0, 0.1, 0.04, fabric, 0, 0.6, -Lb / 2 + 0.05, g)
    rbox(W - 0.06, 0.22, Lb - 0.12, 0.08, white, 0, 0.41, 0.03, g)
    rbox(W + 0.02, 0.09, Lb * 0.66, 0.045, duvet, 0, 0.55, Lb * 0.16, g)
    rbox(W + 0.03, 0.05, 0.4, 0.025, mat('#e98aa9', 0.95), 0, 0.6, Lb * 0.36, g)
    for (const sx of [-0.4, 0.4]) rbox(0.62, 0.15, 0.38, 0.07, white, sx, 0.6, -Lb / 2 + 0.33, g)
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + 0.32)
      rbox(0.42, 0.5, 0.38, 0.03, oak, x, 0.25, -Lb / 2 + 0.25, g)
      const base = new Mesh(new CylinderGeometry(0.05, 0.07, 0.22, 16), mat('#efe6dc', 0.4))
      base.position.set(x, 0.61, -Lb / 2 + 0.25)
      const shadeMat = new MeshStandardMaterial({ color: '#fff3df', emissive: '#ffc98a', emissiveIntensity: 0.5, side: DoubleSide, roughness: 0.9 })
      const shade = new Mesh(new CylinderGeometry(0.1, 0.14, 0.17, 24, 1, true), shadeMat)
      shade.position.set(x, 0.8, -Lb / 2 + 0.25)
      g.add(base, shade)
      let light: PointLight | undefined
      if (!opts.lite && sx === 1) {
        light = new PointLight('#ffbf80', 2.2, 3.5, 2)
        light.position.set(x, 0.85, -Lb / 2 + 0.3)
        g.add(light)
      }
      lamps.push({ light, shade: shadeMat, glow: 0.5 })
    }
    place('bed', g)
  }

  // Bathroom fixtures.
  {
    const f = spec('bath'), g = new Group()
    rbox(f.size.x, 0.56, f.size.z, 0.12, porcelain, 0, 0.28, 0, g)
    const water = new Mesh(new PlaneGeometry(f.size.x - 0.14, f.size.z - 0.14), new MeshPhysicalMaterial({ color: '#bfe6f2', roughness: 0.02, transmission: 0.6, transparent: true, opacity: 0.85 }))
    water.rotation.x = -Math.PI / 2
    water.position.y = 0.5
    g.add(water)
    place('bath', g)
  }
  {
    const g = new Group()
    const bowl = new Mesh(new CylinderGeometry(0.2, 0.15, 0.4, 24), porcelain)
    bowl.position.set(0, 0.2, 0.08)
    g.add(bowl)
    rbox(0.4, 0.4, 0.18, 0.05, porcelain, 0, 0.6, -0.22, g)
    place('toilet', g)
  }
  {
    const f = spec('sink'), g = new Group()
    rbox(f.size.x, 0.8, f.size.z, 0.03, walnut, 0, 0.4, 0, g)
    const basin = new Mesh(new CylinderGeometry(0.2, 0.17, 0.12, 24), porcelain)
    basin.position.y = 0.86
    g.add(basin)
    rbox(0.03, 0.75, 0.55, 0.01, mat('#cfd8e0', 0.03, 1), f.size.x / 2 - 0.02, 1.5, 0, g)
    place('sink', g)
  }

  // Balcony: one outdoor set fills both chair spots, plus potted plants.
  {
    const a = spec('balconyChairA'), b = spec('balconyChairB')
    const m = await loadModel('balconySet')
    if (m) {
      const node = fit(m, { x: (a.pos.x + b.pos.x) / 2, z: a.pos.z }, 0, { x: 1.7, z: 0.8 }, 0.9)
      shadowed(node)
      node.traverse((c) => (c.userData = { kind: 'furniture', id: 'balconyChairA' }))
      root.add(node)
      furniture.set('balconyChairA', node)
      furniture.set('balconyChairB', node)
    }
  }

  // ── Cosy details that move ───────────────────────────────
  // Framed art on the walls you face from the usual camera angle; hidden when its wall is cut away.
  const art: { g: Group; seg: { a: Vec2; b: Vec2 } }[] = []
  const artAt: [number, number, number, number, number][] = [
    // x, y, z, rotation (facing), index of the wall it hangs on
    [0.07, 1.75, 4.9, Math.PI / 2, 5],
    [7.6, 1.6, 2.93, Math.PI, 6],
    [4.3, 1.6, 2.93, Math.PI, 6],
    [3.07, 1.55, 1.4, Math.PI / 2, 7],
  ]
  artAt.forEach(([x, y, z, rot, wi], i) => {
    const g = new Group()
    rbox(0.82, 1.02, 0.04, 0.01, oak, 0, 0, 0, g)
    const pic = new Mesh(new PlaneGeometry(0.72, 0.92), new MeshStandardMaterial({ map: painting(i), roughness: 0.85 }))
    pic.position.z = 0.022
    g.add(pic)
    g.position.set(x, y, z)
    g.rotation.y = rot
    shadowed(g)
    root.add(g)
    art.push({ g, seg: WALLS[wi] })
  })

  // Floor lamp by the sofa with a warm glow.
  {
    const g = new Group()
    const pole = new Mesh(new CylinderGeometry(0.012, 0.012, 1.5, 8), brass)
    pole.position.y = 0.75
    const foot = new Mesh(new CylinderGeometry(0.14, 0.16, 0.03, 24), brass)
    const floorShade = new MeshStandardMaterial({ color: '#fff6e8', emissive: '#ffcf95', emissiveIntensity: 0.55, side: DoubleSide, roughness: 0.9 })
    const shade = new Mesh(new CylinderGeometry(0.17, 0.24, 0.3, 32, 1, true), floorShade)
    shade.position.y = 1.55
    g.add(pole, foot, shade)
    let light: PointLight | undefined
    if (!opts.lite) {
      light = new PointLight('#ffc48a', 3, 4.5, 2)
      light.position.y = 1.45
      g.add(light)
    }
    lamps.push({ light, shade: floorShade, glow: 0.55 })
    g.position.set(3.3, 0, 6.05)
    shadowed(g, false)
    root.add(g)
  }

  // Pendant over the dining table.
  {
    const table = spec('diningTable')
    const cord = new Mesh(new CylinderGeometry(0.005, 0.005, 0.9, 6), mat('#222', 0.5))
    cord.position.set(table.pos.x, UNIT.wallHeight - 0.45, table.pos.z)
    const pendantMat = new MeshStandardMaterial({ color: '#f2e7d8', emissive: '#ffd39b', emissiveIntensity: 0.9, side: DoubleSide, roughness: 0.4 })
    const shade = new Mesh(new SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), pendantMat)
    shade.rotation.x = Math.PI
    shade.position.set(table.pos.x, UNIT.wallHeight - 0.9, table.pos.z)
    root.add(cord, shade)
    let light: PointLight | undefined
    if (!opts.lite) {
      light = new PointLight('#ffcf99', 2.6, 4, 2)
      light.position.set(table.pos.x, UNIT.wallHeight - 1.05, table.pos.z)
      root.add(light)
    }
    lamps.push({ light, shade: pendantMat, glow: 0.9 })
  }

  // Sheer curtains that sway gently by the window.
  const curtainMat = new MeshStandardMaterial({ color: '#fff1f4', roughness: 0.9, transparent: true, opacity: 0.82, side: DoubleSide })
  for (const cx of [0.55, 6.55, 7.05, 12.45]) {
    const geo = new PlaneGeometry(0.9, UNIT.wallHeight - 0.1, 28, 6)
    const base = Float32Array.from(geo.attributes.position.array as Float32Array)
    const curtain = new Mesh(geo, curtainMat)
    curtain.position.set(cx, (UNIT.wallHeight - 0.1) / 2, UNIT.depth - 0.18)
    curtain.castShadow = true
    root.add(curtain)
    const pos = geo.attributes.position as BufferAttribute
    movers.push((_dt, t) => {
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1]
        const sway = (1 - (y / (UNIT.wallHeight - 0.1) + 0.5)) * 0.04
        pos.setZ(i, Math.sin(x * 22) * 0.035 + Math.sin(t / 1300 + x * 4 + cx) * sway)
      }
      pos.needsUpdate = true
    })
  }

  let fairyLevel = 1
  // Fairy lights along the top of the window, twinkling.
  {
    const n = 70
    const bulbs = new InstancedMesh(new SphereGeometry(0.018, 8, 6), new MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), n)
    const dummy = new Object3D(), c = new Color()
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), x = 0.3 + u * (UNIT.width - 0.6)
      const sag = Math.abs(Math.sin(u * Math.PI * 7)) * 0.12
      dummy.position.set(x, UNIT.wallHeight - 0.14 - sag, UNIT.depth - 0.12)
      dummy.updateMatrix()
      bulbs.setMatrixAt(i, dummy.matrix)
      bulbs.setColorAt(i, c.set('#ffd9a0'))
    }
    root.add(bulbs)
    const warm = new Color('#ffcf8a'), pink = new Color('#ffb3d1')
    movers.push((_dt, t) => {
      for (let i = 0; i < n; i++) {
        const k = 0.55 + 0.45 * Math.sin(t / 380 + i * 1.7) * Math.sin(t / 970 + i * 0.6)
        c.copy(i % 3 ? warm : pink).multiplyScalar((1.4 + k * 1.6) * fairyLevel)
        bulbs.setColorAt(i, c)
      }
      bulbs.instanceColor!.needsUpdate = true
    })
  }

  // Dust motes floating in the evening sun.
  if (!opts.lite) {
    const n = 160, geo = new BufferGeometry(), p = new Float32Array(n * 3), seed = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      p[i * 3] = Math.random() * 7
      p[i * 3 + 1] = 0.3 + Math.random() * 2.2
      p[i * 3 + 2] = 3.3 + Math.random() * 3
      seed[i] = Math.random() * 100
    }
    geo.setAttribute('position', new BufferAttribute(p, 3))
    const sprite = canvasTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, 'rgba(255,240,220,1)')
      g.addColorStop(1, 'rgba(255,240,220,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 64, 64)
    })
    const motes = new Points(geo, new PointsMaterial({ size: 0.035, map: sprite, transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending }))
    root.add(motes)
    movers.push((dt) => {
      const a = geo.attributes.position as BufferAttribute
      for (let i = 0; i < n; i++) {
        seed[i] += dt / 1000
        a.setX(i, a.getX(i) + Math.sin(seed[i] * 0.7) * 0.0006)
        let y = a.getY(i) + 0.00025 * dt / 16
        if (y > 2.6) y = 0.3
        a.setY(i, y)
      }
      a.needsUpdate = true
    })
  }

  // ── Cutaway: walls between camera and player drop low ────
  const updateCutaway = (camera: Vec2, player: Vec2) => {
    for (const w of walls) {
      const cut = blocksView(w.seg, camera, player)
      if (w.bottom >= DOOR_H - 0.01) {
        w.mesh.visible = !cut
        continue
      }
      const top = cut ? CUT_H : w.top
      const full = w.top - w.bottom
      w.mesh.scale.y = (top - w.bottom) / full
      w.mesh.position.y = w.bottom + (top - w.bottom) / 2
    }
    for (const a of art) a.g.visible = !blocksView(a.seg, camera, player)
  }

  const setDaylight = (d: Daylight) => {
    const on = d.lampsOn ? 1 : 0.08
    for (const l of lamps) {
      l.shade.emissiveIntensity = l.glow * on
      if (l.light) l.light.intensity = (l.light.userData.base ??= l.light.intensity) * (d.lampsOn ? 1 : 0)
    }
    fairyLevel = d.lampsOn ? 1 : 0.25
  }
  return { root, floorMeshes, furniture, updateCutaway, update: (dt, t) => movers.forEach((m) => m(dt, t)), setDaylight }
}
