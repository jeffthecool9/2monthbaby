// Food you can actually cut and cook: ingredients that come apart slice by slice, eggs that
// crack, and pan contents (rice grains, noodles, egg curds, chili rings) that toss and brown.
import {
  CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, type BufferGeometry, Group, IcosahedronGeometry,
  InstancedMesh, LatheGeometry, type Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D,
  PlaneGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3, BoxGeometry,
} from 'three'
import { canvasTex, rng } from './common'

const phys = (o: ConstructorParameters<typeof MeshPhysicalMaterial>[0]) => new MeshPhysicalMaterial(o)

// ── Cross-section textures ──
const ringsTex = (outer: string, inner: string, rings = 6) =>
  canvasTex(128, 128, (c) => {
    for (let i = rings; i > 0; i--) {
      c.fillStyle = i % 2 ? outer : inner
      c.beginPath()
      c.arc(64, 64, (i / rings) * 64, 0, Math.PI * 2)
      c.fill()
    }
  })

const tomatoTex = () =>
  canvasTex(128, 128, (c) => {
    c.fillStyle = '#c8261c'
    c.fillRect(0, 0, 128, 128)
    c.fillStyle = '#e4462e'
    c.beginPath()
    c.arc(64, 64, 56, 0, Math.PI * 2)
    c.fill()
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4
      c.fillStyle = '#f39a5a'
      c.beginPath()
      c.ellipse(64 + Math.cos(a) * 28, 64 + Math.sin(a) * 28, 18, 12, a, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#f4e3a0'
      for (let s = 0; s < 6; s++) {
        c.beginPath()
        c.ellipse(64 + Math.cos(a) * (20 + s * 3), 64 + Math.sin(a) * (20 + s * 3) + (s % 2 ? 4 : -4), 2.5, 1.5, a, 0, Math.PI * 2)
        c.fill()
      }
    }
    c.fillStyle = '#f07a50'
    c.beginPath()
    c.arc(64, 64, 10, 0, Math.PI * 2)
    c.fill()
  })

const chiliTex = () =>
  canvasTex(64, 64, (c) => {
    c.fillStyle = '#b3120c'
    c.fillRect(0, 0, 64, 64)
    c.fillStyle = '#f0b8a0'
    c.beginPath()
    c.arc(32, 32, 24, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#f7e6b0'
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7
      c.beginPath()
      c.arc(32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9, 3, 0, Math.PI * 2)
      c.fill()
    }
  })

/** Papery onion-skin look: streaks running along the length. */
const papery = (base: string, streak: string) =>
  canvasTex(128, 64, (c) => {
    c.fillStyle = base
    c.fillRect(0, 0, 128, 64)
    const r = rng(11)
    for (let i = 0; i < 40; i++) {
      c.strokeStyle = r() > 0.5 ? streak : 'rgba(60,20,25,0.35)'
      c.globalAlpha = 0.25 + r() * 0.4
      c.lineWidth = 0.6 + r() * 1.6
      const x = r() * 128
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x + (r() - 0.5) * 6, 64)
      c.stroke()
    }
    c.globalAlpha = 1
  })

// ── Whole ingredients that slice apart ──
export type IngredientId = 'shallot' | 'chili' | 'tomato' | 'garlic' | 'choysum'

type Spec = { length: number; profile: (t: number) => number; skin: Material; flesh: Material; top?: (g: Group, len: number) => void }

const specs = (): Record<IngredientId, Spec> => ({
  shallot: {
    length: 0.075,
    profile: (t) => 0.024 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.75) + 0.001,
    skin: phys({ map: papery('#8c3f4a', '#c07a6a'), roughness: 0.7, sheen: 0.5, sheenColor: new Color('#e3a08f') }),
    flesh: new MeshStandardMaterial({ map: ringsTex('#d9a4c4', '#f3e3ee'), roughness: 0.45 }),
    top: (g, len) => {
      const root = new Mesh(new CylinderGeometry(0.004, 0.006, 0.006, 8), new MeshStandardMaterial({ color: '#c9b08a', roughness: 0.9 }))
      root.rotation.z = Math.PI / 2
      root.position.x = -len / 2 - 0.002
      g.add(root)
    },
  },
  chili: {
    length: 0.13,
    profile: (t) => 0.0095 * Math.pow(1 - t, 0.55) * Math.min(1, t * 12 + 0.6) + 0.0008,
    skin: phys({ color: '#c0150d', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 }),
    flesh: new MeshStandardMaterial({ map: chiliTex(), roughness: 0.5 }),
    top: (g, len) => {
      const stem = new Mesh(new CylinderGeometry(0.0022, 0.003, 0.03, 8), new MeshStandardMaterial({ color: '#3f7a2a', roughness: 0.6 }))
      stem.rotation.z = Math.PI / 2 + 0.25
      stem.position.set(-len / 2 - 0.012, 0.003, 0)
      g.add(stem)
    },
  },
  tomato: {
    length: 0.072,
    profile: (t) => 0.037 * Math.sqrt(Math.max(0, 1 - Math.pow(t * 2 - 1, 2))) + 0.0005,
    skin: phys({ color: '#d01e12', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    flesh: new MeshStandardMaterial({ map: tomatoTex(), roughness: 0.35 }),
    top: (g, len) => {
      const m = new MeshStandardMaterial({ color: '#3d7a28', roughness: 0.6, side: DoubleSide })
      for (let i = 0; i < 5; i++) {
        const leaf = new Mesh(new PlaneGeometry(0.004, 0.016), m)
        leaf.position.set(-len / 2 + 0.002, 0, 0)
        leaf.rotation.set((i / 5) * Math.PI * 2, 0, Math.PI / 2 - 0.5)
        leaf.translateY(0.008)
        g.add(leaf)
      }
    },
  },
  garlic: {
    length: 0.05,
    profile: (t) => 0.021 * Math.pow(Math.sin(Math.PI * t), 0.6) * (1 - t * 0.35) + 0.001,
    skin: phys({ color: '#efe6d6', roughness: 0.7, sheen: 0.8, sheenColor: new Color('#ffffff') }),
    flesh: new MeshStandardMaterial({ map: ringsTex('#f3e6bf', '#fbf3dc', 3), roughness: 0.5 }),
  },
  choysum: {
    length: 0.2,
    profile: (t) => 0.0065 - t * 0.0015,
    skin: phys({ color: '#6fa64a', roughness: 0.35, clearcoat: 0.6 }),
    flesh: new MeshStandardMaterial({ map: ringsTex('#b9d98f', '#dcefc0', 2), roughness: 0.5 }),
    top: (g, len) => {
      const m = phys({ color: '#2f7a2c', roughness: 0.45, clearcoat: 0.4, side: DoubleSide })
      for (let i = 0; i < 3; i++) {
        const leaf = new Mesh(new SphereGeometry(0.03, 12, 8), m)
        leaf.scale.set(1.2, 0.08, 0.55)
        leaf.position.set(len / 2 + 0.025 + i * 0.012, 0.004 + i * 0.002, (i - 1) * 0.018)
        leaf.rotation.y = (i - 1) * 0.4
        g.add(leaf)
      }
    },
  },
})

let specCache: Record<IngredientId, Spec> | null = null
const spec = (id: IngredientId) => (specCache ??= specs())[id]

/** A whole ingredient lying along x on the board that comes apart into `slices` pieces, right to left. */
export class Sliceable {
  root = new Group()
  /** Cut positions (local x), rightmost first. */
  cuts: number[] = []
  private pieces: { g: Group; goal: Vector3; rot: number; t: number }[] = []
  private done = 0
  readonly length: number

  constructor(readonly id: IngredientId, slices: number) {
    const s = spec(id)
    this.length = s.length
    const L = s.length
    // Cut points spaced across the middle 80%, plus the two natural ends.
    const xs = [0, ...Array.from({ length: slices }, (_, i) => 0.18 + (i / Math.max(1, slices - 1)) * 0.64), 1].sort((a, b) => a - b)
    if (slices === 1) xs.splice(1, 1, 0.5)
    for (let i = 0; i < xs.length - 1; i++) {
      const g = new Group()
      const t0 = xs[i], t1 = xs[i + 1]
      const pts: Vector2[] = []
      const n = 10
      for (let k = 0; k <= n; k++) {
        const t = t0 + ((t1 - t0) * k) / n
        pts.push(new Vector2(s.profile(t), (t - 0.5) * L))
      }
      const side = new Mesh(new LatheGeometry(pts, 28), s.skin)
      side.castShadow = true
      g.add(side)
      for (const [t, dir] of [[t0, -1], [t1, 1]] as const) {
        const r = s.profile(t)
        if (r < 0.002) continue
        const cap = new Mesh(new CircleGeometry(r, 28), s.flesh)
        cap.position.y = (t - 0.5) * L
        cap.rotation.x = dir > 0 ? -Math.PI / 2 : Math.PI / 2
        g.add(cap)
      }
      // Lathe runs along y; lay it along x.
      const holder = new Group()
      holder.rotation.z = -Math.PI / 2
      holder.add(g)
      this.root.add(holder)
      this.pieces.push({ g: holder, goal: new Vector3(), rot: 0, t: 0 })
    }
    s.top?.(this.root, L)
    // Rest it on the board.
    this.root.position.y = Math.max(...Array.from({ length: 20 }, (_, i) => s.profile(i / 19)))
    // Cuts from the right end leftwards.
    this.cuts = xs.slice(1, -1).map((t) => (t - 0.5) * L).reverse()
  }

  get remaining() {
    return this.cuts.length - this.done
  }

  /** Local x of the next dotted line. */
  get nextCut(): number | null {
    return this.done < this.cuts.length ? this.cuts[this.done] : null
  }

  /** Separate the next slice and lay it down cut-face up. */
  chop() {
    if (this.done >= this.cuts.length) return
    const idx = this.pieces.length - 1 - this.done
    const p = this.pieces[idx]
    this.done++
    p.goal.set(0.02 + this.done * 0.006, 0, (this.done % 2 ? 1 : -1) * 0.004)
    p.rot = Math.PI / 2 - 0.25
    p.t = 0
  }

  update(dt: number) {
    for (const p of this.pieces) {
      if (!p.rot) continue
      p.t = Math.min(1, p.t + dt / 260)
      const e = 1 - Math.pow(1 - p.t, 3)
      p.g.position.x = p.goal.x * e
      p.g.position.z = p.goal.z * e
      p.g.position.y = Math.sin(e * Math.PI) * 0.01
      p.g.rotation.x = p.rot * e * (p.goal.z > 0 ? 1 : -1) * 0.25
    }
  }
}

// ── Eggs ──
const eggShell = () => phys({ color: '#e9c9a0', roughness: 0.55, sheen: 0.2 })
const eggProfile = (from: number, to: number) => {
  const pts: Vector2[] = []
  for (let i = 0; i <= 16; i++) {
    const t = from + ((to - from) * i) / 16
    const a = t * Math.PI
    const r = Math.sin(a) * 0.021 * (1 - 0.12 * Math.cos(a))
    pts.push(new Vector2(Math.max(0.0005, r), -Math.cos(a) * 0.028))
  }
  return pts
}

const crackTex = () =>
  canvasTex(128, 64, (c) => {
    c.fillStyle = '#e9c9a0'
    c.fillRect(0, 0, 128, 64)
    c.strokeStyle = '#6b4a2a'
    c.lineWidth = 1.5
    c.beginPath()
    let x = 0, y = 32
    c.moveTo(x, y)
    const r = rng(7)
    while (x < 128) {
      x += 6 + r() * 6
      y = 32 + (r() - 0.5) * 14
      c.lineTo(x, y)
    }
    c.stroke()
  })

/** An egg held over the bowl: knock it (cracks show), then open it (shell halves part, yolk drops). */
export class Egg {
  root = new Group()
  private top: Mesh
  private bottom: Mesh
  private yolk: Mesh
  private white: Mesh
  private stage = 0
  private t = 0
  private knock = 0

  constructor(private drop: number) {
    const shell = eggShell()
    this.top = new Mesh(new LatheGeometry(eggProfile(0.5, 1), 24), shell)
    this.bottom = new Mesh(new LatheGeometry(eggProfile(0, 0.5), 24), shell)
    for (const m of [this.top, this.bottom]) {
      m.castShadow = true
      ;(m.material as MeshPhysicalMaterial).side = DoubleSide
      this.root.add(m)
    }
    this.yolk = new Mesh(new SphereGeometry(0.012, 20, 14), phys({ color: '#f5a20c', roughness: 0.15, clearcoat: 1 }))
    this.white = new Mesh(new SphereGeometry(0.022, 20, 10), phys({ color: '#fbf6e8', roughness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 }))
    this.white.scale.y = 0.25
    this.yolk.visible = this.white.visible = false
    this.root.add(this.yolk, this.white)
  }

  hit() {
    if (this.stage === 0) {
      this.stage = 1
      this.knock = 1
      ;(this.top.material as MeshPhysicalMaterial).map = crackTex()
      ;(this.top.material as MeshPhysicalMaterial).needsUpdate = true
    } else if (this.stage === 1) {
      this.stage = 2
      this.t = 0
      this.yolk.visible = this.white.visible = true
    }
  }

  get opened() {
    return this.stage === 2 && this.t >= 1
  }

  update(dt: number) {
    this.knock = Math.max(0, this.knock - dt / 220)
    this.root.position.y = -Math.sin(this.knock * Math.PI) * 0.03
    if (this.stage === 2) {
      this.t = Math.min(1, this.t + dt / 700)
      const e = this.t
      this.top.position.set(-0.02 * e, 0.012 * e, 0)
      this.top.rotation.z = 0.9 * e
      this.bottom.position.set(0.02 * e, -0.004 * e, 0)
      this.bottom.rotation.z = -0.9 * e
      const fall = Math.min(1, e * 1.4)
      const y = -fall * fall * this.drop
      this.yolk.position.y = y + 0.006
      this.white.position.y = y
      this.white.scale.set(1 + fall * 0.6, 0.25, 1 + fall * 0.6)
      const fade = Math.max(0, (e - 0.75) * 4)
      this.top.visible = this.bottom.visible = fade < 1
      ;(this.top.material as MeshPhysicalMaterial).opacity = 1 - fade
      ;(this.top.material as MeshPhysicalMaterial).transparent = fade > 0
      if (e >= 1) this.yolk.visible = this.white.visible = false
    }
  }
}

// ── Bowl contents: eggs, milk, flour → batter ──
export class BowlMix {
  root = new Group()
  private liquid: Mesh
  private yolks: Mesh[] = []
  private flour: Mesh
  private swirl = 0
  level = 0
  eggs = 0
  milk = 0
  hasFlour = false
  beaten = 0

  constructor(private radius: number, private depth: number) {
    const swirlTex = canvasTex(128, 128, (c) => {
      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, 128, 128)
      c.strokeStyle = 'rgba(200,170,90,0.35)'
      c.lineWidth = 5
      for (let i = 0; i < 5; i++) {
        c.beginPath()
        c.arc(64, 64, 10 + i * 11, i, i + 4.2)
        c.stroke()
      }
    })
    this.liquid = new Mesh(new CircleGeometry(1, 40), phys({ color: '#fbf6e8', map: swirlTex, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.85 }))
    this.liquid.rotation.x = -Math.PI / 2
    this.liquid.visible = false
    this.root.add(this.liquid)
    this.flour = new Mesh(new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: '#f6f0e4', roughness: 1 }))
    this.flour.visible = false
    this.root.add(this.flour)
  }

  addEgg() {
    this.eggs++
    const y = new Mesh(new SphereGeometry(0.011, 18, 12), phys({ color: '#f5a20c', roughness: 0.15, clearcoat: 1 }))
    y.scale.y = 0.6
    const a = this.eggs * 2.2
    y.position.set(Math.cos(a) * this.radius * 0.3, 0, Math.sin(a) * this.radius * 0.3)
    this.yolks.push(y)
    this.root.add(y)
    this.refresh()
  }

  addFlour() {
    this.hasFlour = true
    this.refresh()
  }

  setMilk(v: number) {
    this.milk = v
    this.refresh()
  }

  setBeaten(v: number) {
    this.beaten = v
    this.refresh()
  }

  /** How much is in the bowl, 0..1 of the depth. */
  private refresh() {
    const vol = this.eggs * 0.18 + this.milk * 0.45 + (this.hasFlour ? 0.2 : 0)
    this.level = Math.min(0.85, vol)
    const r = this.radius * (0.55 + this.level * 0.42)
    this.liquid.visible = vol > 0
    this.liquid.scale.set(r, r, 1)
    this.liquid.position.y = -this.depth + this.level * this.depth + 0.004
    const raw = new Color(this.milk > 0 ? '#fbf7ee' : '#f6efd9')
    const done = new Color(this.hasFlour ? '#f1d9a0' : '#f7c23c')
    const mat = this.liquid.material as MeshPhysicalMaterial
    mat.color.copy(raw).lerp(done, this.eggs || this.hasFlour ? this.beaten : 0)
    mat.opacity = 0.6 + Math.max(this.beaten, this.milk > 0 ? 0.3 : 0) * 0.4
    for (const y of this.yolks) {
      y.position.y = this.liquid.position.y + 0.002
      y.scale.setScalar(Math.max(0.01, 1 - this.beaten * 1.2))
      y.scale.y *= 0.6
    }
    this.flour.visible = this.hasFlour && this.beaten < 0.9
    const fs = this.radius * 0.45 * (1 - this.beaten)
    this.flour.scale.set(fs, fs * 0.55, fs)
    this.flour.position.y = this.liquid.position.y
  }

  /** Spin the swirl while whisking. */
  stir(radians: number) {
    this.swirl += radians
    this.liquid.rotation.z = this.swirl
  }

  empty(amount: number) {
    // Pouring out: the level drops.
    this.liquid.position.y = -this.depth + Math.max(0, this.level * (1 - amount)) * this.depth + 0.004
    this.liquid.visible = amount < 0.98 && this.level > 0
    for (const y of this.yolks) y.visible = false
  }
}

// ── Things in the pan ──
export type PanKind = IngredientId | 'egg' | 'rice' | 'noodles'

type Kind = { geo: BufferGeometry; raw: string; cooked: string; count: number; size: number; flat?: boolean }

const KINDS = (): Record<PanKind, Kind> => ({
  shallot: { geo: new TorusGeometry(0.006, 0.0016, 6, 14), raw: '#d6a0c0', cooked: '#a9643a', count: 40, size: 1, flat: true },
  chili: { geo: new TorusGeometry(0.0045, 0.0018, 6, 12), raw: '#cf1a10', cooked: '#8e1408', count: 34, size: 1, flat: true },
  tomato: { geo: new IcosahedronGeometry(0.008, 0), raw: '#e0301c', cooked: '#b52412', count: 26, size: 1 },
  garlic: { geo: new BoxGeometry(0.004, 0.003, 0.004), raw: '#f5ecd0', cooked: '#d19a4a', count: 40, size: 1 },
  choysum: { geo: new BoxGeometry(0.018, 0.0012, 0.011), raw: '#3f8a35', cooked: '#2c6a24', count: 36, size: 1, flat: true },
  egg: { geo: new IcosahedronGeometry(0.008, 1).scale(1.3, 0.45, 1), raw: '#f8d860', cooked: '#efc04a', count: 34, size: 1 },
  rice: { geo: new CapsuleGeometry(0.0016, 0.0042, 2, 6), raw: '#f7f3ea', cooked: '#c98a46', count: 650, size: 1 },
  noodles: { geo: new TorusGeometry(0.028, 0.0019, 5, 24, 2.6), raw: '#f2cf6a', cooked: '#a8642a', count: 46, size: 1 },
})

type Piece = { kind: PanKind; r: number; a: number; h: number; spin: Quaternion; scale: number; from?: Vector3; t: number; hop: number }

/**
 * Everything in the wok as instanced pieces sitting on a curved pan bottom. Pieces fly in from
 * where they came from, swirl round with the spatula, brown as they cook and slide onto the plate.
 */
export class PanFood {
  root = new Group()
  private meshes = new Map<PanKind, InstancedMesh>()
  private pieces: Piece[] = []
  private kinds = KINDS()
  private dummy = new Object3D()
  private plate: { pos: Vector3; t: number } | null = null
  private sauce = 0
  cookLevel = 0

  constructor(private center: Vector3, private radius: number, private depth: number) {
    const r = rng(3)
    for (const [k, def] of Object.entries(this.kinds) as [PanKind, Kind][]) {
      const mesh = new InstancedMesh(def.geo, phys({ color: def.raw, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.4 }), def.count)
      mesh.count = 0
      mesh.castShadow = true
      mesh.frustumCulled = false
      this.meshes.set(k, mesh)
      this.root.add(mesh)
      void r
    }
  }

  /** Throw `kind` in, flying from `from` (world space). */
  add(kind: PanKind, from: Vector3) {
    const def = this.kinds[kind]
    const mesh = this.meshes.get(kind)!
    const r = rng(kind.length * 31 + this.pieces.length)
    const q = new Quaternion()
    for (let i = 0; i < def.count; i++) {
      q.setFromAxisAngle(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), r() * Math.PI * 2)
      if (def.flat) q.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2 + (r() - 0.5) * 0.6).premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), r() * 6.3))
      this.pieces.push({ kind, r: Math.sqrt(r()) * this.radius * 0.78, a: r() * Math.PI * 2, h: r() * 0.006, spin: q.clone(), scale: 0.8 + r() * 0.45, from: from.clone().add(new Vector3((r() - 0.5) * 0.04, r() * 0.02, (r() - 0.5) * 0.03)), t: -i * (0.5 / def.count), hop: 0 })
    }
    mesh.count = def.count
  }

  has(kind: PanKind) {
    return this.pieces.some((p) => p.kind === kind)
  }

  get empty() {
    return this.pieces.length === 0
  }

  /** Spatula went round by `radians`: everything near it swirls and some pieces hop. */
  stir(radians: number) {
    for (const p of this.pieces) {
      p.a += radians * (0.6 + (1 - p.r / this.radius) * 0.6)
      p.r = Math.min(this.radius * 0.82, Math.max(0, p.r + (Math.random() - 0.5) * 0.006))
      if (Math.random() < Math.abs(radians) * 0.5) p.hop = 1
    }
  }

  /** Splash of sauce darkens everything a little. */
  season(amount: number) {
    this.sauce = Math.min(1, this.sauce + amount)
  }

  /** Slide everything onto the plate at `pos` (world). */
  serve(pos: Vector3) {
    this.plate = { pos: pos.clone(), t: 0 }
  }

  get served() {
    return !!this.plate && this.plate.t >= 1
  }

  update(dt: number) {
    const counts = new Map<PanKind, number>()
    const plate = this.plate
    if (plate) plate.t = Math.min(1, plate.t + dt / 900)
    const colors = new Map<PanKind, Color>()
    for (const [k, def] of Object.entries(this.kinds) as [PanKind, Kind][]) {
      const c = new Color(def.raw).lerp(new Color(def.cooked), Math.min(1, this.cookLevel * 0.85 + this.sauce * 0.35))
      if (this.sauce > 0 && (k === 'rice' || k === 'noodles')) c.lerp(new Color('#7a4320'), this.sauce * 0.35)
      colors.set(k, c)
    }
    for (const [k, mesh] of this.meshes) (mesh.material as MeshPhysicalMaterial).color.copy(colors.get(k)!)
    for (const p of this.pieces) {
      const i = counts.get(p.kind) ?? 0
      counts.set(p.kind, i + 1)
      p.hop = Math.max(0, p.hop - dt / 380)
      let pos: Vector3
      const rr = p.r / this.radius
      const inPan = new Vector3(this.center.x + Math.cos(p.a) * p.r, this.center.y - this.depth + this.depth * rr * rr * 0.9 + p.h + Math.sin(p.hop * Math.PI) * 0.035, this.center.z + Math.sin(p.a) * p.r)
      if (p.t < 1 && p.from) {
        p.t = Math.min(1, p.t + dt / 520)
        const e = Math.max(0, p.t)
        pos = p.from.clone().lerp(inPan, e)
        pos.y += Math.sin(e * Math.PI) * 0.08
        if (p.t <= 0) pos = p.from.clone()
      } else pos = inPan
      if (plate) {
        // A neat mound on the plate.
        const pr = Math.min(1, p.r / this.radius) * 0.075
        const onPlate = new Vector3(plate.pos.x + Math.cos(p.a) * pr, plate.pos.y + (1 - (pr / 0.075) ** 2) * 0.032 + p.h, plate.pos.z + Math.sin(p.a) * pr)
        const e = Math.min(1, Math.max(0, plate.t * 1.6 - rr * 0.6))
        pos = pos.lerp(onPlate, e)
        pos.y += Math.sin(e * Math.PI) * 0.12
      }
      this.dummy.position.copy(pos)
      this.dummy.quaternion.copy(p.spin)
      this.dummy.rotateY(p.a)
      this.dummy.scale.setScalar(p.scale)
      this.dummy.updateMatrix()
      this.meshes.get(p.kind)!.setMatrixAt(i, this.dummy.matrix)
    }
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true
  }
}

/** A heap of `kind` pieces sitting in a small bowl of the given radius (for prep bowls). */
export function pile(kind: PanKind, radius: number, count?: number): InstancedMesh {
  const def = KINDS()[kind]
  const n = count ?? Math.min(def.count, 60)
  const mesh = new InstancedMesh(def.geo, phys({ color: def.raw, roughness: 0.4, clearcoat: 0.5 }), n)
  const r = rng(kind.length * 7 + 1)
  const d = new Object3D()
  for (let i = 0; i < n; i++) {
    const rr = Math.sqrt(r()) * radius
    const a = r() * Math.PI * 2
    d.position.set(Math.cos(a) * rr, (1 - (rr / radius) ** 2) * radius * 0.5 + r() * 0.004, Math.sin(a) * rr)
    d.rotation.set(r() * 6, r() * 6, r() * 6)
    d.scale.setScalar(0.8 + r() * 0.4)
    d.updateMatrix()
    mesh.setMatrixAt(i, d.matrix)
  }
  mesh.castShadow = true
  return mesh
}
