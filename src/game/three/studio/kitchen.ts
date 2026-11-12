// The kitchen close-up: marble counter, sink, mixing bowl, chopping board, gas stove with a wok
// (or a flat pan for pancakes) and a plate. Every cooking and dish-washing step happens here.
import {
  AdditiveBlending, BoxGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, LatheGeometry,
  Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, type Object3D, PlaneGeometry, PointLight,
  SphereGeometry, type Texture, TorusGeometry, Vector2, Vector3, Plane, Raycaster,
} from 'three'
import type { GameState, Step } from '../../play/minigame'
import { BaseStudio, Particles, addLights, approach, canvasTex, dirtTexture, rng, sfx, tex } from './common'
import { BowlMix, Egg, PanFood, type IngredientId, type PanKind, Sliceable, pile } from './food'

const TOP = 0.9
const SINK = new Vector3(-1.05, TOP, -0.02)
const BOWL = new Vector3(-0.5, TOP, 0)
const BOARD = new Vector3(0, TOP, 0.02)
const STOVE = new Vector3(0.6, TOP, -0.04)
const PLATE = new Vector3(1.07, TOP, 0.1)
const RACK = new Vector3(-1.5, TOP, -0.1)
const TRAY = [new Vector3(0.34, TOP, 0.12), new Vector3(0.36, TOP, -0.16)]
const SHELF = (i: number) => new Vector3(-0.16 + i * 0.11, TOP, -0.24)

const phys = (o: ConstructorParameters<typeof MeshPhysicalMaterial>[0]) => new MeshPhysicalMaterial(o)
const steel = () => phys({ color: '#c9ccd1', metalness: 1, roughness: 0.28 })
const ceramic = () => phys({ color: '#efede8', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 })

/** A lathe bowl/plate shape: radius, depth, flat bottom fraction. */
function dish(radius: number, depth: number, flat: number, mat = ceramic(), wall = 0.004) {
  // Closed at the centre top and bottom, so the base has no hole.
  const pts: Vector2[] = [new Vector2(0.001, 0)]
  const n = 14
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const r = flat * radius + (1 - flat) * radius * t
    pts.push(new Vector2(Math.max(0.001, r), Math.pow(t, 1.8) * depth))
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n
    const r = flat * radius + (1 - flat) * radius * t - wall
    pts.push(new Vector2(Math.max(0.001, r), Math.pow(t, 1.8) * depth + wall))
  }
  pts.push(new Vector2(0.001, wall))
  mat.side = DoubleSide
  const m = new Mesh(new LatheGeometry(pts, 40), mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

type Source = { group: Group; kind: PanKind | 'flour'; used: boolean; t: number; home: Vector3 }

export class KitchenStudio extends BaseStudio {
  private board!: Mesh
  private bowl!: Group
  private mix!: BowlMix
  private wok!: Group
  private flatPan!: Group
  private pan!: PanFood
  private panInfo = { center: new Vector3(), radius: 0.13, depth: 0.06 }
  private plate!: Group
  private knife!: Group
  private guide!: Mesh
  private spatula!: Group
  private whisk!: Group
  private sponge!: Mesh
  private stream!: Mesh
  private flames!: Group
  private flameLight!: PointLight
  private knob!: Mesh
  private oil!: Mesh
  private steam = new Particles(80, { color: '#ffffff', size: 0.05, opacity: 0.22, gravity: -0.02, lifeMs: 2200 })
  private smoke = new Particles(60, { color: '#5b5b5b', size: 0.09, opacity: 0.35, gravity: -0.04, lifeMs: 2400 })
  private drops = new Particles(120, { color: '#3a2412', size: 0.012, opacity: 0.95, gravity: 2.2, lifeMs: 700 })
  private splash = new Particles(120, { color: '#d9eeff', size: 0.014, opacity: 0.7, gravity: 1.6, lifeMs: 600 })
  private foam = new Particles(160, { color: '#ffffff', size: 0.02, opacity: 0.9, gravity: 0.05, lifeMs: 1500 })
  private sparkle = new Particles(60, { color: '#fff3b0', size: 0.03, opacity: 1, gravity: -0.05, lifeMs: 1200, additive: true })

  // Per-step things
  private stepProps: Object3D[] = []
  private sliceable: Sliceable | null = null
  private prepared = new Map<string, Group>()
  private egg: Egg | null = null
  private eggHolder = new Group()
  private eggsOpened = 0
  private sources: Source[] = []
  private dirt: { mesh: Mesh; draw: (c: boolean[]) => void } | null = null
  private suds: Mesh[] = []
  private pourer: { obj: Group; tilt: number; mouth: () => Vector3; color: string } | null = null
  private pancake: Group | null = null
  private pancakeTop: MeshStandardMaterial | null = null
  private pancakeEdge: MeshStandardMaterial | null = null
  private syrup: Mesh | null = null
  private bottle: Group | null = null
  private dirtyDishes: { plate: Group; bowl: Group } | null = null

  // State
  private chopAnim = { t: 1, x: 0 }
  private heat = 0
  private heatGoal = 0
  private stirAngle = 0
  private lastStir = 0
  private flipT = 0
  private flipAnim = -1
  private tilt = 0
  private serving = false
  private finished = false
  private water = 0
  private lastProgress = 0
  private lastTaps = 0
  private lastCleared = 0
  private boardPlane = new Plane(new Vector3(0, 1, 0), -(TOP + 0.03))
  private scrubSound = 0

  constructor(env: Texture | null, private mode: 'cook' | 'dishes') {
    super(env)
    this.scene.background = new Color('#3a2a2c')
    addLights(this.scene)
    this.build()
    for (const p of [this.steam, this.smoke, this.drops, this.splash, this.foam, this.sparkle]) this.scene.add(p.points)
    if (mode === 'dishes') this.frame(SINK.clone().add(new Vector3(0, -0.04, 0)), 0.46, 1.1, 0, true)
    else this.frame(new Vector3(0.1, TOP, 0), 1.1, 0.85, 0, true)
  }

  // ── Scene ────────────────────────────────────────────
  private build() {
    const s = this.scene
    const marble = new MeshStandardMaterial({ map: tex('counter_marble_diff', 2, true), normalMap: tex('counter_marble_nor', 2), roughnessMap: tex('counter_marble_arm', 2), roughness: 0.9, color: '#f4efe9' })
    const slab = (x0: number, x1: number, z0: number, z1: number) => {
      const m = new Mesh(new BoxGeometry(x1 - x0, 0.06, z1 - z0), marble)
      m.position.set((x0 + x1) / 2, TOP - 0.03, (z0 + z1) / 2)
      m.receiveShadow = true
      s.add(m)
    }
    // Counter with a hole for the sink.
    slab(-2.2, -1.32, -0.36, 0.36)
    slab(-0.78, 2.2, -0.36, 0.36)
    slab(-1.32, -0.78, 0.16, 0.36)
    slab(-1.32, -0.78, -0.36, -0.22)
    const cab = new Mesh(new BoxGeometry(4.4, TOP - 0.24, 0.68), new MeshStandardMaterial({ color: '#e9e2da', roughness: 0.6 }))
    cab.position.set(0, (TOP - 0.24) / 2, 0)
    // Cabinet front up to the worktop (the sink basin hangs in the space behind it).
    const front = new Mesh(new BoxGeometry(4.4, 0.18, 0.02), cab.material)
    front.position.set(0, TOP - 0.15, 0.33)
    s.add(front)
    s.add(cab)
    // Sink basin.
    const st = steel()
    const basinD = 0.19
    const basin = new Group()
    const floor = new Mesh(new PlaneGeometry(0.54, 0.38), st)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -basinD
    basin.add(floor)
    for (const [w, x, z, ry] of [[0.54, 0, -0.19, 0], [0.54, 0, 0.19, Math.PI], [0.38, -0.27, 0, Math.PI / 2], [0.38, 0.27, 0, -Math.PI / 2]] as const) {
      const wall = new Mesh(new PlaneGeometry(w, basinD), st)
      wall.position.set(x, -basinD / 2, z)
      wall.rotation.y = ry
      basin.add(wall)
    }
    const drain = new Mesh(new CircleGeometry(0.03, 24), new MeshStandardMaterial({ color: '#555', metalness: 1, roughness: 0.4 }))
    drain.rotation.x = -Math.PI / 2
    drain.position.y = -basinD + 0.001
    basin.add(drain)
    basin.position.set(SINK.x, TOP, -0.03)
    s.add(basin)
    // Tiled backsplash.
    const tiles = canvasTex(256, 256, (c) => {
      c.fillStyle = '#d8d2c8'
      c.fillRect(0, 0, 256, 256)
      for (let row = 0; row < 8; row++) {
        for (let col = -1; col < 4; col++) {
          const x = col * 64 + (row % 2) * 32
          const g = c.createLinearGradient(0, row * 32, 0, row * 32 + 32)
          g.addColorStop(0, '#fbf8f2')
          g.addColorStop(1, '#ece6dc')
          c.fillStyle = g
          c.fillRect(x + 2, row * 32 + 2, 60, 28)
        }
      }
    })
    tiles.repeat.set(5, 1.2)
    tiles.wrapS = tiles.wrapT = 1000
    const splash = new Mesh(new PlaneGeometry(4.4, 0.9), phys({ map: tiles, roughness: 0.2, clearcoat: 0.6 }))
    splash.position.set(0, TOP + 0.45, -0.36)
    splash.receiveShadow = true
    s.add(splash)
    // Faucet.
    const fz = -0.29
    const post = new Mesh(new CylinderGeometry(0.014, 0.018, 0.3, 20), st)
    post.position.set(SINK.x, TOP + 0.15, fz)
    const arc = new Mesh(new TorusGeometry(0.09, 0.013, 12, 24, Math.PI), st)
    arc.position.set(SINK.x, TOP + 0.3, fz + 0.09)
    arc.rotation.y = Math.PI / 2
    const lever = new Mesh(new BoxGeometry(0.012, 0.008, 0.07), st)
    lever.position.set(SINK.x + 0.03, TOP + 0.27, fz + 0.01)
    s.add(post, arc, lever)
    const spoutY = TOP + 0.3
    this.stream = new Mesh(new CylinderGeometry(0.007, 0.009, spoutY - (TOP - basinD), 12, 1, true), phys({ color: '#dff1ff', roughness: 0, transparent: true, opacity: 0.45, clearcoat: 1 }))
    this.stream.position.set(SINK.x, (spoutY + TOP - basinD) / 2, fz + 0.18)
    this.stream.visible = false
    s.add(this.stream)
    // Mixing bowl with what's in it.
    this.bowl = new Group()
    this.bowl.add(dish(0.085, 0.065, 0.35))
    this.mix = new BowlMix(0.08, 0.06)
    this.mix.root.position.y = 0.066
    this.bowl.add(this.mix.root)
    this.bowl.position.copy(BOWL)
    s.add(this.bowl)
    this.eggHolder.position.set(BOWL.x + 0.02, TOP + 0.19, BOWL.z + 0.02)
    s.add(this.eggHolder)
    // Chopping board.
    const wood = new MeshStandardMaterial({ map: tex('floor_wood_diff', 0.6, true), normalMap: tex('floor_wood_nor', 0.6), roughness: 0.7, color: '#e8c9a0' })
    this.board = new Mesh(new BoxGeometry(0.44, 0.03, 0.27), wood)
    this.board.position.set(BOARD.x, TOP + 0.015, BOARD.z)
    this.board.castShadow = this.board.receiveShadow = true
    s.add(this.board)
    // Knife (blade along z, edge down).
    this.knife = new Group()
    const blade = new Mesh(new BoxGeometry(0.002, 0.045, 0.17), phys({ color: '#dfe3e8', metalness: 1, roughness: 0.18 }))
    blade.position.set(0, 0.022, -0.02)
    const handle = new Mesh(new BoxGeometry(0.014, 0.022, 0.1), new MeshStandardMaterial({ color: '#2b211c', roughness: 0.5 }))
    handle.position.set(0, 0.03, 0.115)
    this.knife.add(blade, handle)
    this.knife.traverse((o) => (o.castShadow = true))
    this.knife.visible = false
    this.knife.scale.setScalar(0.7)
    this.knife.rotation.z = -0.65
    s.add(this.knife)
    const dash = canvasTex(16, 64, (c) => {
      c.clearRect(0, 0, 16, 64)
      c.fillStyle = '#ffffff'
      for (let y = 0; y < 64; y += 16) c.fillRect(4, y, 8, 9)
    })
    this.guide = new Mesh(new PlaneGeometry(0.006, 0.09), new MeshBasicMaterial({ map: dash, transparent: true, opacity: 0.9, depthTest: false }))
    this.guide.rotation.x = -Math.PI / 2
    this.guide.renderOrder = 10
    this.guide.visible = false
    s.add(this.guide)
    // Stove.
    const glass = new Mesh(new BoxGeometry(0.62, 0.012, 0.5), phys({ color: '#101012', roughness: 0.08, clearcoat: 1, metalness: 0.2 }))
    glass.position.set(STOVE.x, TOP + 0.006, STOVE.z)
    glass.receiveShadow = true
    s.add(glass)
    const grate = new Mesh(new TorusGeometry(0.1, 0.006, 8, 32), new MeshStandardMaterial({ color: '#222', metalness: 0.6, roughness: 0.5 }))
    grate.rotation.x = -Math.PI / 2
    grate.position.set(STOVE.x, TOP + 0.03, STOVE.z)
    s.add(grate)
    for (let i = 0; i < 4; i++) {
      const leg = new Mesh(new BoxGeometry(0.012, 0.024, 0.06), grate.material)
      leg.position.set(STOVE.x + Math.cos((i * Math.PI) / 2) * 0.1, TOP + 0.02, STOVE.z + Math.sin((i * Math.PI) / 2) * 0.1)
      leg.rotation.y = (-i * Math.PI) / 2
      s.add(leg)
    }
    this.knob = new Mesh(new CylinderGeometry(0.02, 0.022, 0.025, 24), new MeshStandardMaterial({ color: '#d8d8da', metalness: 0.9, roughness: 0.3 }))
    this.knob.position.set(STOVE.x + 0.2, TOP + 0.025, STOVE.z + 0.19)
    const mark = new Mesh(new BoxGeometry(0.004, 0.003, 0.018), new MeshBasicMaterial({ color: '#e04040' }))
    mark.position.set(0, 0.014, -0.008)
    this.knob.add(mark)
    s.add(this.knob)
    // Flames.
    this.flames = new Group()
    const flameMat = new MeshBasicMaterial({ color: '#4f8dff', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false })
    for (let i = 0; i < 16; i++) {
      const f = new Mesh(new ConeGeometry(0.008, 0.035, 8, 1, true), flameMat)
      const a = (i / 16) * Math.PI * 2
      f.position.set(Math.cos(a) * 0.09, 0.016, Math.sin(a) * 0.09)
      f.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4)
      this.flames.add(f)
    }
    this.flames.position.set(STOVE.x, TOP, STOVE.z)
    this.flames.scale.setScalar(0.001)
    s.add(this.flames)
    this.flameLight = new PointLight('#ff9a4a', 0, 0.22, 2)
    this.flameLight.position.set(STOVE.x, TOP + 0.02, STOVE.z)
    s.add(this.flameLight)
    // Wok and flat pan.
    const iron = phys({ color: '#2a2a2d', metalness: 0.85, roughness: 0.38, side: DoubleSide })
    this.wok = new Group()
    const wokPts: Vector2[] = []
    for (let i = 0; i <= 16; i++) {
      const r = (i / 16) * 0.16
      wokPts.push(new Vector2(Math.max(0.001, r), 0.07 * Math.pow(r / 0.16, 2)))
    }
    const wokBody = new Mesh(new LatheGeometry(wokPts, 48), iron)
    wokBody.castShadow = wokBody.receiveShadow = true
    this.wok.add(wokBody)
    const wokHandle = new Mesh(new CylinderGeometry(0.012, 0.014, 0.2, 12), new MeshStandardMaterial({ color: '#5b3a22', roughness: 0.6 }))
    wokHandle.rotation.z = Math.PI / 2 - 0.15
    wokHandle.position.set(0.25, 0.085, 0)
    this.wok.add(wokHandle)
    this.wok.position.set(STOVE.x, TOP + 0.04, STOVE.z)
    s.add(this.wok)
    this.flatPan = new Group()
    const flat = dish(0.13, 0.035, 0.82, phys({ color: '#26262a', metalness: 0.7, roughness: 0.45, side: DoubleSide }), 0.004)
    this.flatPan.add(flat)
    const panHandle = new Mesh(new CylinderGeometry(0.011, 0.013, 0.18, 12), new MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.5 }))
    panHandle.rotation.z = Math.PI / 2 - 0.08
    panHandle.position.set(0.21, 0.04, 0)
    this.flatPan.add(panHandle)
    this.flatPan.position.set(STOVE.x, TOP + 0.04, STOVE.z)
    this.flatPan.visible = false
    s.add(this.flatPan)
    this.oil = new Mesh(new CircleGeometry(0.06, 32), phys({ color: '#e8b64a', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0, metalness: 0.1 }))
    this.oil.rotation.x = -Math.PI / 2
    this.oil.position.set(STOVE.x, TOP + 0.043, STOVE.z)
    s.add(this.oil)
    this.panInfo = { center: new Vector3(STOVE.x, TOP + 0.04 + 0.07, STOVE.z), radius: 0.15, depth: 0.07 }
    this.pan = new PanFood(this.panInfo.center, 0.15, 0.07)
    s.add(this.pan.root)
    // Plate.
    this.plate = new Group()
    this.plate.add(dish(0.12, 0.02, 0.6))
    this.plate.position.copy(PLATE)
    s.add(this.plate)
    // Spatula, whisk, sponge.
    this.spatula = new Group()
    const sblade = new Mesh(new BoxGeometry(0.055, 0.002, 0.045), steel())
    sblade.rotation.x = -0.45
    const shandle = new Mesh(new CylinderGeometry(0.006, 0.007, 0.2, 10), new MeshStandardMaterial({ color: '#4a2f1e', roughness: 0.6 }))
    shandle.rotation.x = -0.9
    shandle.position.set(0, 0.075, 0.1)
    this.spatula.add(sblade, shandle)
    this.spatula.visible = false
    s.add(this.spatula)
    this.whisk = new Group()
    const wireMat = steel()
    for (let i = 0; i < 4; i++) {
      const loop = new Mesh(new TorusGeometry(0.025, 0.0012, 6, 24), wireMat)
      loop.scale.y = 1.8
      loop.rotation.y = (i / 4) * Math.PI
      loop.position.y = 0.045
      this.whisk.add(loop)
    }
    const wh = new Mesh(new CylinderGeometry(0.008, 0.01, 0.12, 12), new MeshStandardMaterial({ color: '#e9e4dc', roughness: 0.4 }))
    wh.position.y = 0.14
    this.whisk.add(wh)
    this.whisk.rotation.z = 0.35
    this.whisk.visible = false
    s.add(this.whisk)
    this.sponge = new Mesh(new BoxGeometry(0.07, 0.03, 0.045), new MeshStandardMaterial({ color: '#f5d24a', roughness: 0.95 }))
    const scour = new Mesh(new BoxGeometry(0.07, 0.008, 0.045), new MeshStandardMaterial({ color: '#2f8a4a', roughness: 1 }))
    scour.position.y = 0.019
    this.sponge.add(scour)
    this.sponge.visible = false
    s.add(this.sponge)
    // Dish rack.
    const rack = new Group()
    const wire = new MeshStandardMaterial({ color: '#d0d4d8', metalness: 0.9, roughness: 0.3 })
    for (let i = 0; i < 9; i++) {
      const bar = new Mesh(new CylinderGeometry(0.003, 0.003, 0.12, 6), wire)
      bar.position.set(-0.16 + i * 0.04, 0.06, 0)
      rack.add(bar)
    }
    const base = new Mesh(new BoxGeometry(0.36, 0.01, 0.22), wire)
    base.position.y = 0.005
    rack.add(base)
    rack.position.copy(RACK)
    s.add(rack)
    // Little bits of life on the counter.
    const jar = new Mesh(new CylinderGeometry(0.035, 0.035, 0.12, 20), phys({ color: '#ffffff', roughness: 0.05, transmission: 0.9, thickness: 0.01, transparent: true }))
    jar.position.set(-0.3, TOP + 0.06, -0.28)
    const herbs = new Mesh(new SphereGeometry(0.05, 10, 8), new MeshStandardMaterial({ color: '#4c8a3c', roughness: 0.8 }))
    herbs.position.set(0.25, TOP + 0.08, -0.29)
    herbs.scale.y = 0.8
    const pot = new Mesh(new CylinderGeometry(0.04, 0.032, 0.06, 16), new MeshStandardMaterial({ color: '#c46a4a', roughness: 0.8 }))
    pot.position.set(0.25, TOP + 0.03, -0.29)
    s.add(jar, herbs, pot)
  }

  // ── Steps ────────────────────────────────────────────
  private clearStep() {
    for (const o of this.stepProps) o.parent?.remove(o)
    this.stepProps = []
    this.knife.visible = this.guide.visible = this.spatula.visible = this.whisk.visible = this.sponge.visible = false
    this.stream.visible = false
    this.water = 0
    this.pourer = null
    this.bottle = null
    this.dirt = null
    this.sources = []
    // Chopped pieces move to a little prep bowl on the shelf.
    if (this.sliceable) {
      const id = this.sliceable.id
      this.sliceable.root.parent?.remove(this.sliceable.root)
      this.sliceable = null
      this.prepared.set(id, this.prepBowl(id, SHELF(this.prepared.size)))
    }
  }

  private add(o: Object3D, keep = false) {
    this.scene.add(o)
    if (!keep) this.stepProps.push(o)
    return o
  }

  private prepBowl(kind: PanKind, at: Vector3) {
    const g = new Group()
    g.add(dish(0.048, 0.035, 0.4))
    const p = pile(kind, 0.036, kind === 'rice' ? 160 : kind === 'noodles' ? 18 : undefined)
    p.position.y = 0.012
    g.add(p)
    g.position.copy(at)
    this.scene.add(g)
    return g
  }

  protected enterStep(step: Step, _i: number, prev: GameState | null) {
    const g = this.game!
    if (prev === null || _i === 0) {
      const pancakes = g.dish === 'pancakes'
      this.flatPan.visible = pancakes
      this.wok.visible = !pancakes
      if (pancakes) {
        this.panInfo = { center: new Vector3(STOVE.x, TOP + 0.04 + 0.035, STOVE.z), radius: 0.12, depth: 0.03 }
      }
    }
    // A flip that just landed: celebrate before moving on.
    this.clearStep()
    this.lastProgress = 0
    this.lastTaps = g.taps
    this.lastCleared = 0
    this.lastStir = performance.now()
    const stove = () => this.frame(STOVE.clone().add(new Vector3(0, 0.05, 0.02)), 0.42, 1.0)
    switch (step.action) {
      case 'chop': {
        const s = new Sliceable(step.item as IngredientId, step.amount ?? 4)
        s.root.position.add(new Vector3(BOARD.x - 0.02, TOP + 0.03, BOARD.z))
        this.scene.add(s.root)
        this.sliceable = s
        this.knife.visible = this.guide.visible = true
        this.chopAnim = { t: 1, x: s.root.position.x + (s.nextCut ?? 0) + 0.035 }
        this.frame(BOARD.clone().add(new Vector3(0, 0.03, 0)), Math.max(0.2, s.length * 1.6), 1.1)
        break
      }
      case 'wash': {
        const { texture, draw } = dirtTexture((c) => {
          const gr = c.createRadialGradient(128, 110, 10, 128, 128, 160)
          gr.addColorStop(0, '#ff5a3c')
          gr.addColorStop(0.6, '#d01e12')
          gr.addColorStop(1, '#8e0f08')
          c.fillStyle = gr
          c.fillRect(0, 0, 256, 256)
        }, 'rgba(95,72,40,0.85)', step.targets ?? [], 0.08)
        const tomato = new Mesh(new SphereGeometry(0.04, 40, 28), phys({ map: texture, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }))
        tomato.rotation.y = -Math.PI / 2
        tomato.position.set(SINK.x, TOP + 0.08, -0.1)
        tomato.castShadow = true
        this.add(tomato)
        this.dirt = { mesh: tomato, draw }
        this.stream.visible = true
        this.water = 1
        this.frame(new Vector3(SINK.x, TOP + 0.08, -0.1), 0.2, 0.5, 0, false, 0.2)
        break
      }
      case 'crack':
        this.eggsOpened = 0
        this.newEgg()
        this.frame(BOWL.clone().add(new Vector3(0, 0.08, 0)), 0.32, 0.85)
        break
      case 'whisk':
        this.whisk.visible = true
        this.frame(BOWL.clone().add(new Vector3(0, 0.05, 0)), 0.28, 1.05)
        break
      case 'heat':
        this.knob.userData.goal = 0
        stove()
        break
      case 'pour':
        this.setupPour(step.item ?? 'milk')
        break
      case 'add':
        this.setupAdd(step.items ?? [])
        break
      case 'stir':
        this.spatula.visible = true
        stove()
        break
      case 'flip':
        this.flipT = 0.05
        stove()
        break
      case 'season': {
        const b = new Group()
        const soy = step.item !== 'salt'
        const body = new Mesh(new CylinderGeometry(soy ? 0.022 : 0.018, soy ? 0.024 : 0.018, soy ? 0.13 : 0.07, 20), soy ? phys({ color: '#1e0d06', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.92 }) : phys({ color: '#ffffff', roughness: 0.05, transmission: 0.8, thickness: 0.01, transparent: true }))
        const neck = new Mesh(new CylinderGeometry(0.008, soy ? 0.02 : 0.018, 0.035, 16), body.material)
        neck.position.y = soy ? 0.082 : 0.05
        const cap = new Mesh(new CylinderGeometry(0.01, 0.01, 0.015, 16), new MeshStandardMaterial({ color: soy ? '#c8261c' : '#c0c4c8', metalness: soy ? 0 : 0.9, roughness: 0.3 }))
        cap.position.y = soy ? 0.105 : 0.072
        b.add(body, neck, cap)
        if (soy) {
          const label = new Mesh(new CylinderGeometry(0.0245, 0.0245, 0.05, 20, 1, true), new MeshStandardMaterial({ map: canvasTex(128, 32, (c) => { c.fillStyle = '#f2d36b'; c.fillRect(0, 0, 128, 32); c.fillStyle = '#7a1a10'; c.font = 'bold 18px sans-serif'; c.fillText('KICAP', 34, 23) }), roughness: 0.6 }))
          b.add(label)
        }
        b.traverse((o) => (o.castShadow = true))
        b.position.set(STOVE.x + 0.05, TOP + 0.24, STOVE.z)
        b.rotation.z = 2.3
        this.add(b)
        this.bottle = b
        stove()
        break
      }
      case 'plate':
        this.frame(new Vector3(0.84, TOP + 0.05, 0.03), 0.72, 1.0)
        break
      case 'scrub':
        this.setupScrub(step)
        break
      case 'rinse':
        this.frame(new Vector3(SINK.x, TOP - 0.12, SINK.z + 0.04), 0.4, 1.15)
        break
    }
    // Dishes: the rack step.
    if (step.action === 'add' && this.mode === 'dishes') this.frame(new Vector3((SINK.x + RACK.x) / 2, TOP, -0.05), 0.75, 1.0)
  }

  private newEgg() {
    if (this.egg) this.eggHolder.remove(this.egg.root)
    this.egg = new Egg(0.16)
    this.egg.root.rotation.z = 0.5
    this.eggHolder.add(this.egg.root)
  }

  private setupPour(item: string) {
    const mk = (body: Mesh, mouthOffset: Vector3, color: string, at: Vector3, frameAt: Vector3, width: number) => {
      const g = new Group()
      g.add(body)
      g.position.copy(at)
      this.add(g)
      this.pourer = { obj: g, tilt: 0, color, mouth: () => g.localToWorld(mouthOffset.clone()) }
      this.frame(frameAt, width, 1.0)
    }
    if (item === 'milk') {
      const jug = dish(0.04, 0.13, 0.9, phys({ color: '#ffffff', roughness: 0.02, transmission: 0.95, thickness: 0.005, transparent: true, side: DoubleSide }), 0.002)
      const milk = new Mesh(new CylinderGeometry(0.036, 0.036, 0.09, 24), new MeshStandardMaterial({ color: '#fbfbf6', roughness: 0.3 }))
      milk.position.y = 0.047
      jug.add(milk)
      mk(jug, new Vector3(-0.04, 0.13, 0), '#fbfbf6', new Vector3(BOWL.x + 0.13, TOP + 0.1, BOWL.z), BOWL.clone().add(new Vector3(0.05, 0.08, 0)), 0.36)
    } else if (item === 'syrup') {
      const b = new Mesh(new CylinderGeometry(0.02, 0.025, 0.12, 18), phys({ color: '#9a4a10', roughness: 0.05, transmission: 0.4, transparent: true, opacity: 0.95, clearcoat: 1 }))
      b.position.y = 0.06
      mk(b as unknown as Mesh, new Vector3(-0.0, 0.13, 0), '#b8661c', new Vector3(PLATE.x + 0.08, TOP + 0.14, PLATE.z), PLATE.clone().add(new Vector3(0.03, 0.06, 0)), 0.32)
      this.syrup = new Mesh(new CircleGeometry(0.05, 32), phys({ color: '#a9560f', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.85 }))
      this.syrup.rotation.x = -Math.PI / 2
      this.syrup.position.set(PLATE.x, TOP + 0.02, PLATE.z)
      this.syrup.scale.setScalar(0.01)
      this.scene.add(this.syrup)
    } else {
      // Eggs or batter from the mixing bowl into the pan.
      this.bowl.position.copy(TRAY[0]).add(new Vector3(0.02, 0.08, 0))
      this.pourer = { obj: this.bowl, tilt: 0, color: item === 'batter' ? '#f1d9a0' : '#f7c23c', mouth: () => this.bowl.localToWorld(new Vector3(0.085, 0.06, 0)) }
      if (item === 'batter' && !this.pancake) this.makePancake()
      this.frame(new Vector3(0.5, TOP + 0.06, -0.01), 0.5, 1.0)
    }
  }

  private makePancake() {
    const g = new Group()
    // Raw side: pale batter that gets little bubbles as it cooks. Cooked side: mottled gold.
    this.pancakeTop = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, map: canvasTex(128, 128, (c) => {
      c.fillStyle = '#f2dcaa'
      c.fillRect(0, 0, 128, 128)
      const r = rng(3)
      for (let i = 0; i < 60; i++) {
        c.fillStyle = `rgba(190,140,70,${0.15 + r() * 0.3})`
        c.beginPath()
        c.arc(r() * 128, r() * 128, 1 + r() * 2.5, 0, Math.PI * 2)
        c.fill()
      }
    }) })
    this.pancakeEdge = new MeshStandardMaterial({ color: '#efd394', roughness: 0.7 })
    const h = 0.012
    const top = new Mesh(new CircleGeometry(1, 40), this.pancakeTop)
    top.rotation.x = -Math.PI / 2
    top.position.y = h
    const bottom = new Mesh(new CircleGeometry(1, 40), new MeshStandardMaterial({ map: this.goldenTex(), roughness: 0.6 }))
    bottom.rotation.x = Math.PI / 2
    const edge = new Mesh(new CylinderGeometry(1, 0.97, h, 40, 1, true), this.pancakeEdge)
    edge.position.y = h / 2
    g.add(top, bottom, edge)
    g.traverse((o) => (o.castShadow = true))
    g.position.set(STOVE.x, TOP + 0.045, STOVE.z)
    g.scale.setScalar(0.001)
    this.scene.add(g)
    this.pancake = g
  }

  private goldenTex() {
    return canvasTex(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 10, 64, 64, 64)
      g.addColorStop(0, '#b8692a')
      g.addColorStop(0.7, '#d48a3c')
      g.addColorStop(1, '#e8b468')
      c.fillStyle = g
      c.fillRect(0, 0, 128, 128)
      const r = rng(8)
      for (let i = 0; i < 90; i++) {
        c.fillStyle = `rgba(${r() > 0.5 ? '120,60,20' : '240,190,110'},${0.15 + r() * 0.25})`
        c.beginPath()
        c.arc(r() * 128, r() * 128, 2 + r() * 6, 0, Math.PI * 2)
        c.fill()
      }
    })
  }

  /** After the flip: the golden side faces up; on the plate it gets a pat of butter. */
  private goldenSide() {
    if (!this.pancakeTop || !this.pancakeEdge) return
    this.pancakeTop.map = this.goldenTex()
    this.pancakeTop.needsUpdate = true
    this.pancakeEdge.color.set('#c98a3a')
  }

  private addButter() {
    if (!this.pancake) return
    const b = new Mesh(new BoxGeometry(0.022, 0.012, 0.018), phys({ color: '#fbe27a', roughness: 0.3, clearcoat: 0.6 }))
    b.position.set(PLATE.x + 0.005, TOP + 0.024, PLATE.z - 0.004)
    b.rotation.y = 0.5
    b.castShadow = true
    this.scene.add(b)
  }

  private setupAdd(items: string[]) {
    if (this.mode === 'dishes') {
      // Put the clean plate and bowl on the rack.
      const d = this.dirtyDishes!
      this.sources = [
        { group: d.plate, kind: 'egg', used: false, t: 0, home: d.plate.position.clone() },
        { group: d.bowl, kind: 'egg', used: false, t: 0, home: d.bowl.position.clone() },
      ]
      return
    }
    if (items.includes('flour')) {
      const bag = new Group()
      const paper = new Mesh(new BoxGeometry(0.08, 0.13, 0.05), new MeshStandardMaterial({ map: canvasTex(128, 192, (c) => { c.fillStyle = '#f4eee2'; c.fillRect(0, 0, 128, 192); c.fillStyle = '#2f5aa8'; c.fillRect(0, 60, 128, 50); c.fillStyle = '#fff'; c.font = 'bold 26px sans-serif'; c.fillText('FLOUR', 20, 95) }), roughness: 0.9 }))
      paper.position.y = 0.065
      bag.add(paper)
      bag.position.set(BOWL.x + 0.14, TOP, BOWL.z - 0.02)
      this.add(bag)
      this.sources.push({ group: bag, kind: 'flour', used: false, t: 0, home: bag.position.clone() })
      this.frame(BOWL.clone().add(new Vector3(0.06, 0.06, 0)), 0.36, 1.0)
      return
    }
    items.forEach((it, i) => {
      const at = TRAY[i % TRAY.length]
      let g: Group
      if (it === 'egg') {
        g = this.bowl
        g.position.copy(at)
      } else if (this.prepared.has(it)) {
        g = this.prepared.get(it)!
        g.position.copy(at)
      } else {
        g = this.prepBowl(it as PanKind, at)
        this.stepProps.push(g)
      }
      this.sources.push({ group: g, kind: it as PanKind, used: false, t: 0, home: at.clone() })
    })
    this.frame(new Vector3(0.5, TOP + 0.04, -0.01), 0.56, 1.0)
  }

  private setupScrub(step: Step) {
    if (step.item === 'plate' || step.item === 'bowl') {
      if (!this.dirtyDishes) {
        const plate = new Group()
        plate.add(dish(0.11, 0.018, 0.6))
        plate.position.set(SINK.x - 0.06, TOP - 0.185, SINK.z)
        const bowl = new Group()
        bowl.add(dish(0.07, 0.055, 0.4))
        bowl.position.set(SINK.x + 0.16, TOP - 0.185, SINK.z - 0.06)
        this.scene.add(plate, bowl)
        this.dirtyDishes = { plate, bowl }
      }
      const target = step.item === 'plate' ? this.dirtyDishes.plate : this.dirtyDishes.bowl
      const r = step.item === 'plate' ? 0.1 : 0.05
      const y = step.item === 'plate' ? 0.012 : 0.006
      const { texture, draw } = dirtTexture((c) => {
        c.fillStyle = '#fbfaf7'
        c.fillRect(0, 0, 256, 256)
        c.strokeStyle = 'rgba(0,0,0,0.05)'
        c.lineWidth = 6
        c.beginPath()
        c.arc(128, 128, 110, 0, Math.PI * 2)
        c.stroke()
      }, step.item === 'plate' ? 'rgba(168,92,34,0.9)' : 'rgba(210,140,30,0.9)', step.targets ?? [], 0.09)
      const face = new Mesh(new CircleGeometry(r, 40), phys({ map: texture, roughness: 0.15, clearcoat: 1 }))
      face.rotation.x = -Math.PI / 2
      face.position.y = y
      target.add(face)
      this.stepProps.push(face)
      this.dirt = { mesh: face, draw }
      this.sponge.visible = true
      // Move the sink camera over this dish.
      const wp = target.getWorldPosition(new Vector3())
      this.frame(wp.clone().add(new Vector3(0, 0.02, 0)), r * 3.2, 1.25)
    }
  }

  // ── Hooks ────────────────────────────────────────────
  protected gesture() {
    const a = this.step?.action
    return a === 'chop' ? 'chop' : a === 'season' ? 'shake' : 'tap'
  }

  protected tapTargets(): Object3D[] {
    const a = this.step?.action
    if (a === 'crack' && this.egg) return [this.egg.root]
    if (a === 'add') return this.sources.filter((s) => !s.used).map((s) => s.group)
    if (a === 'plate') return [this.pancake && this.flatPan.visible ? this.flatPan : this.wok, ...(this.pancake ? [this.pancake] : [])]
    return []
  }

  protected onTap(hit: Object3D | null) {
    const a = this.step?.action
    if (!hit) {
      if (a !== undefined) sfx.miss()
      return false
    }
    if (a === 'crack' && this.egg) {
      this.egg.hit()
      sfx.crack()
    } else if (a === 'add') {
      const src = this.sources.find((s) => !s.used && (hit === s.group || isChildOf(hit, s.group)))
      if (src) this.useSource(src)
    } else if (a === 'plate') {
      this.serve()
    }
    return false
  }

  private useSource(src: Source) {
    src.used = true
    src.t = 0
    sfx.plop()
    if (this.mode === 'dishes') return
    if (src.kind === 'flour') {
      setTimeout(() => this.mix.addFlour(), 350)
      for (let i = 0; i < 20; i++) this.foam.emit(BOWL.clone().add(new Vector3(0, 0.1, 0)), new Vector3((Math.random() - 0.5) * 0.1, 0.05, (Math.random() - 0.5) * 0.1), 0.04)
      return
    }
    const from = src.group.position.clone().add(new Vector3(0, 0.05, 0))
    setTimeout(() => {
      this.pan.add(src.kind as PanKind, from)
      if (src.kind === 'egg') this.mix.empty(1)
    }, 250)
  }

  private serve() {
    if (this.serving) return
    this.serving = true
    if (this.pancake && this.flatPan.visible) return
    setTimeout(() => this.pan.serve(PLATE.clone().add(new Vector3(0, 0.02, 0))), 250)
  }

  protected circleCenter() {
    return this.step?.action === 'whisk' ? BOWL.clone().add(new Vector3(0, 0.04, 0)) : this.panInfo.center.clone().add(new Vector3(0, -0.04, 0))
  }

  protected scrubSurface() {
    return this.dirt?.mesh ?? null
  }

  protected onScrubAt(p: Vector3 | null) {
    if (!p) return
    this.sponge.position.copy(p).add(new Vector3(0, 0.02, 0))
    if (this.step?.action === 'wash') {
      this.splash.emit(p, new Vector3(0, 0.3, 0), 0.03, 2)
    } else {
      this.foam.emit(p.clone().add(new Vector3(0, 0.01, 0)), new Vector3(0, 0.02, 0), 0.04, 2)
      const now = performance.now()
      if (now - this.scrubSound > 140) {
        this.scrubSound = now
        sfx.shake()
      }
    }
  }

  protected onChop(start: Vector2, end: Vector2) {
    const s = this.sliceable
    if (!s) return false
    const x = this.boardX(new Vector2((start.x + end.x) / 2, (start.y + end.y) / 2))
    this.chopAnim = { t: 0, x }
    sfx.chop()
    const cut = s.nextCut
    if (cut === null) return false
    const cutX = s.root.position.x + cut
    return Math.abs(x - cutX) < 0.022
  }

  protected onDrag(ndc: Vector2, down: boolean) {
    if (this.step?.action === 'chop' && this.chopAnim.t >= 1 && down) this.chopAnim.x = this.boardX(ndc)
  }

  private boardX(ndc: Vector2) {
    const r = new Raycaster()
    r.setFromCamera(ndc, this.camera)
    const p = new Vector3()
    return r.ray.intersectPlane(this.boardPlane, p) ? p.x : BOARD.x
  }

  protected timingOk() {
    const [lo, hi] = this.step?.window ?? [0.55, 0.8]
    return this.flipT >= lo && this.flipT <= hi
  }

  get timing() {
    return this.step?.action === 'flip' ? this.flipT : 0
  }

  // ── State → visuals ─────────────────────────────────
  protected onState(g: GameState, prev: GameState | null) {
    const step = this.step
    if (!step || !prev) return
    const leaving = prev.step !== g.step
    if (g.misses > prev.misses) sfx.miss()
    const hit = g.taps > this.lastTaps
    {
      const dp = (leaving ? 1 : g.progress) - this.lastProgress
      if (step.action === 'chop' && hit) this.sliceable?.chop()
      if (step.action === 'crack' && hit) {
        const n = leaving ? step.amount ?? 2 : Math.round(g.progress * (step.amount ?? 2))
        if (n % 2 === 0) {
          // Egg opened: drop it in, and bring the next one.
          setTimeout(() => {
            this.mix.addEgg()
            sfx.plop()
            if (n < (step.amount ?? 2)) this.newEgg()
            else if (this.egg) this.eggHolder.remove(this.egg.root)
          }, 650)
        }
      }
      if (step.action === 'whisk' && dp > 0) {
        this.mix.stir(dp * (step.amount ?? 1))
        this.mix.setBeaten(Math.min(1, g.progress))
        this.stirAngle += dp * (step.amount ?? 1)
      }
      if (step.action === 'stir' && dp > 0) {
        const rad = dp * (step.amount ?? 1)
        this.pan.stir(rad)
        this.stirAngle += rad
        this.lastStir = performance.now()
        this.pan.cookLevel = Math.min(1, this.pan.cookLevel + dp * 0.45)
      }
      if (step.action === 'season' && hit) this.shakeBottle()
      if (step.mechanic === 'scrub' && this.dirt) {
        const cleared = leaving ? (step.targets ?? []).map(() => true) : g.cleared
        const n = cleared.filter(Boolean).length
        if (n !== this.lastCleared) {
          this.dirt.draw(cleared)
          this.lastCleared = n
          sfx.pop()
        }
      }
      if (!leaving) {
        if (step.action === 'pour' && step.item === 'milk') this.mix.setMilk(g.gauge)
        if (step.action === 'pour' && step.item === 'eggs') this.mix.empty(g.gauge)
        if (step.action === 'pour' && step.item === 'batter' && this.pancake) { const r = Math.max(0.001, g.gauge * 0.085); this.pancake.scale.set(r, 1, r) }
        if (step.action === 'pour' && step.item === 'syrup' && this.syrup) this.syrup.scale.setScalar(Math.max(0.01, g.gauge * 1.1))
        if (step.action === 'heat') this.heatGoal = g.gauge
      }
    }
    // Leaving a step: lock in what it did.
    if (leaving) {
      const before = step
      if (before.action === 'pour' && before.item === 'milk') this.mix.setMilk(0.65)
      if (before.action === 'pour' && before.item === 'syrup' && this.syrup) this.syrup.scale.setScalar(0.8)
      if (before?.action === 'heat') {
        this.heatGoal = 0.62
        sfx.ding()
      }
      if (before?.action === 'pour' && before.item === 'eggs') this.pan.add('egg', TRAY[0].clone().add(new Vector3(0.06, 0.1, 0)))
      if (before?.action === 'pour' && before.item === 'batter' && this.pancake) this.pancake.scale.set(0.085, 1, 0.085)
      if (before?.action === 'pour' && (before.item === 'eggs' || before.item === 'batter')) this.bowl.position.copy(BOWL)
      if (before?.action === 'flip') {
        this.flipAnim = 0
        sfx.ding()
      }
      if (before?.action === 'whisk') this.mix.setBeaten(1)
      if (before?.mechanic === 'scrub') this.sparkleAt(this.dirt?.mesh.getWorldPosition(new Vector3()) ?? SINK)
    }
    this.lastProgress = g.step === prev?.step ? g.progress : 0
    this.lastTaps = g.taps
  }

  private shakeBottle() {
    const b = this.bottle
    if (!b) return
    b.userData.jig = 1
    sfx.shake()
    const mouth = b.localToWorld(new Vector3(0, 0.12, 0))
    const salt = this.step?.item === 'salt'
    for (let i = 0; i < 10; i++) this.drops.emit(mouth, new Vector3((Math.random() - 0.5) * 0.15, -0.4, (Math.random() - 0.5) * 0.15), 0.01)
    if (salt) (this.drops.points.material as MeshBasicMaterial).color.set('#ffffff')
    else (this.drops.points.material as MeshBasicMaterial).color.set('#3a2412')
    this.pan.season(0.22)
  }

  private sparkleAt(p: Vector3) {
    for (let i = 0; i < 24; i++) this.sparkle.emit(p.clone().add(new Vector3(0, 0.03, 0)), new Vector3((Math.random() - 0.5) * 0.2, 0.15 + Math.random() * 0.2, (Math.random() - 0.5) * 0.2), 0.06)
    sfx.ding()
  }

  protected onFinish() {
    if (this.finished) return
    this.finished = true
    this.clearStep()
    if (this.mode === 'dishes') {
      this.frame(RACK.clone().add(new Vector3(0, 0.06, 0)), 0.45, 0.85)
      this.sparkleAt(RACK)
      return
    }
    setTimeout(() => {
      this.frame(PLATE.clone().add(new Vector3(0, 0.03, 0)), 0.3, 0.75)
      this.sparkleAt(PLATE)
      if (this.flatPan.visible) this.addButter()
    }, 900)
  }

  // ── Per frame ────────────────────────────────────────
  protected tick(dt: number, now: number) {
    const step = this.step
    this.sliceable?.update(dt)
    this.egg?.update(dt)
    this.pan.update(dt)
    for (const p of [this.steam, this.smoke, this.drops, this.splash, this.foam, this.sparkle]) p.update(dt)

    // Knife: hover at the finger, slam down on a chop.
    if (this.knife.visible && this.sliceable) {
      this.chopAnim.t = Math.min(1, this.chopAnim.t + dt / 180)
      const down = this.chopAnim.t < 1 ? Math.sin(this.chopAnim.t * Math.PI) : 0
      const surface = TOP + 0.03
      this.knife.position.set(this.chopAnim.x, surface + 0.075 - down * 0.075, BOARD.z + 0.01)
      const cut = this.sliceable.nextCut
      this.guide.visible = cut !== null
      if (cut !== null) {
        this.guide.position.set(this.sliceable.root.position.x + cut, surface + 0.06, BOARD.z)
        ;(this.guide.material as MeshBasicMaterial).opacity = 0.55 + Math.sin(now / 180) * 0.35
      }
    }

    // Heat: knob, flames, oil shimmer, sizzle.
    this.heat = approach(this.heat, this.heatGoal, dt, 250)
    this.knob.rotation.y = -this.heat * 2.4
    const fl = this.heat
    this.flames.scale.set(1, 0.3 + fl * 0.9, 1).multiplyScalar(fl > 0.02 ? 1 : 0.001)
    this.flames.children.forEach((f, i) => (f.scale.y = 0.8 + Math.sin(now / 60 + i * 1.7) * 0.25))
    this.flameLight.intensity = fl * 0.7
    const oilMat = this.oil.material as MeshPhysicalMaterial
    oilMat.opacity = approach(oilMat.opacity, this.heatGoal > 0 || this.heat > 0.05 ? 0.75 : 0, dt, 400)
    this.oil.position.y = (this.flatPan.visible ? TOP + 0.046 : TOP + 0.042) + Math.sin(now / 90) * 0.0004
    this.oil.scale.setScalar(1 + Math.sin(now / 140) * 0.02)
    const sizzling = this.heat > 0.3 && (!this.pan.empty || (this.pancake?.scale.x ?? 0) > 0.01)
    sfx.loop('sizzle', sizzling ? Math.min(1, this.heat) : this.heat > 0.4 ? 0.15 : 0)
    if (this.heat > 0.4 && Math.random() < dt / (sizzling ? 50 : 200)) this.steam.emit(this.panInfo.center.clone().add(new Vector3(0, -0.03, 0)), new Vector3(0, 0.12, 0), 0.14)
    if (step?.action === 'heat' && this.game && this.game.gauge > (step.window?.[1] ?? 0.8) && Math.random() < dt / 60) this.smoke.emit(this.panInfo.center, new Vector3(0, 0.1, 0), 0.1)

    // Stir: spatula follows; idle too long burns.
    if (this.spatula.visible) {
      const r = this.panInfo.radius * 0.45
      this.spatula.position.set(this.panInfo.center.x + Math.cos(this.stirAngle) * r, this.panInfo.center.y - this.panInfo.depth + 0.02 + 0.01, this.panInfo.center.z + Math.sin(this.stirAngle) * r)
      this.spatula.rotation.y = -this.stirAngle + Math.PI / 2
      if (step?.action === 'stir' && performance.now() - this.lastStir > 2800) {
        this.lastStir = performance.now()
        for (let i = 0; i < 12; i++) this.smoke.emit(this.panInfo.center, new Vector3(0, 0.12, 0), 0.12)
        this.onInput({ type: 'miss' })
      }
    }
    if (this.whisk.visible) {
      const r = 0.035
      this.whisk.position.set(BOWL.x + Math.cos(this.stirAngle) * r, TOP + 0.01, BOWL.z + Math.sin(this.stirAngle) * r)
    }

    // Pouring.
    if (this.pourer) {
      const pouring = this.isHolding
      this.pourer.tilt = approach(this.pourer.tilt, pouring ? 1 : 0, dt, 160)
      this.pourer.obj.rotation.z = this.pourer.tilt * (this.pourer.obj === this.bowl ? 1.1 : 1.9)
      if (pouring && this.pourer.tilt > 0.6) {
        const m = this.pourer.mouth()
        this.drops.emit(m, new Vector3(-0.05, -0.2, 0), 0.006, 3)
        ;(this.drops.points.material as MeshBasicMaterial).color.set(this.pourer.color)
      }
    }

    // Running water.
    if (step?.action === 'rinse') {
      this.stream.visible = this.isHolding
      for (const s of this.suds) s.visible = false
      if (this.isHolding) this.splash.emit(new Vector3(SINK.x, TOP - 0.17, SINK.z + 0.1), new Vector3(0, 0.4, 0), 0.04, 2)
    }
    sfx.loop('water', this.stream.visible ? 1 : 0)

    // Flip: the pancake browns; leave it too long and it burns.
    if (step?.action === 'flip' && this.pancake && this.pancakeEdge && this.pancakeTop) {
      this.flipT += dt / 4200
      if (this.flipT > (step.window?.[1] ?? 0.8) + 0.18) {
        this.flipT = 0.3
        for (let i = 0; i < 12; i++) this.smoke.emit(this.panInfo.center, new Vector3(0, 0.1, 0), 0.08)
        this.onInput({ type: 'miss' })
      }
      this.pancakeEdge.color.set('#f1d9a0').lerp(new Color('#c47a2a'), Math.min(1, this.flipT))
      this.pancakeTop.color.set('#f6e3b4').lerp(new Color('#e9c98a'), this.flipT * 0.6)
    }
    if (this.pancake && this.flipAnim >= 0) {
      this.flipAnim = Math.min(1, this.flipAnim + dt / 600)
      const e = this.flipAnim
      this.pancake.position.y = TOP + 0.045 + Math.sin(e * Math.PI) * 0.14
      this.pancake.rotation.x = e * Math.PI
      if (e >= 1) {
        this.flipAnim = -1
        this.pancake.rotation.x = 0
        // Golden side up now.
        this.goldenSide()
        this.pancakeEdge?.color.set('#c98a3a')
      }
    }

    // Serving: tilt the wok toward the plate, or slide the pancake over.
    if (this.serving) {
      this.tilt = approach(this.tilt, this.pan.served || (this.pancake && this.flatPan.visible && this.pancake.position.x > PLATE.x - 0.01) ? 0 : 1, dt, 200)
      const pan = this.flatPan.visible ? this.flatPan : this.wok
      pan.rotation.z = -this.tilt * 0.45
      if (this.pancake && this.flatPan.visible) {
        this.pancake.position.lerp(new Vector3(PLATE.x, TOP + 0.006, PLATE.z), 1 - Math.exp(-dt / 220))
        this.pancake.rotation.x = 0
      }
    }

    // Used sources tip in and fade (or go to the rack).
    for (const s of this.sources) {
      if (!s.used) {
        s.group.position.y = s.home.y + (Math.sin(now / 300 + s.home.x * 10) + 1) * 0.004
        continue
      }
      s.t = Math.min(1, s.t + dt / 600)
      if (this.mode === 'dishes') {
        const slot = RACK.clone().add(new Vector3(s === this.sources[0] ? -0.06 : 0.08, 0.11, 0))
        s.group.position.lerpVectors(s.home, slot, s.t)
        s.group.position.y += Math.sin(s.t * Math.PI) * 0.15
        s.group.rotation.x = s.t * 1.45
      } else {
        s.group.rotation.z = Math.sin(Math.min(1, s.t * 1.5) * Math.PI) * 1.2
        s.group.position.x = s.home.x + Math.sin(Math.min(1, s.t * 1.5) * Math.PI) * 0.06
        if (s.kind !== 'flour' && s.kind !== 'egg' && s.t >= 1) s.group.visible = false
      }
    }

    if (this.bottle) {
      const j = (this.bottle.userData.jig ?? 0) as number
      this.bottle.userData.jig = Math.max(0, j - dt / 160)
      this.bottle.position.y = TOP + 0.24 + Math.sin(j * Math.PI) * 0.03
    }
  }

  dispose() {
    sfx.loop('sizzle', 0)
    sfx.loop('water', 0)
    super.dispose()
  }
}


function isChildOf(o: Object3D, parent: Object3D) {
  let p: Object3D | null = o
  while (p) {
    if (p === parent) return true
    p = p.parent
  }
  return false
}
