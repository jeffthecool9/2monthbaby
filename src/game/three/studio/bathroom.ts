// The bathroom close-up: tiled walls, an oval tub with taps, candles and a rubber duck.
// Bubble bath: run the water, warm it, shake in the bubble bath, then soak in first person.
// Cleaning: scrub the tiles and the tub ring, then shower it all down.
import {
  CircleGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, LatheGeometry, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, type Object3D, Object3D as O3, PlaneGeometry, PointLight, SphereGeometry,
  type Texture, TorusGeometry, Vector2, Vector3, BoxGeometry,
} from 'three'
import { stepsOf, type GameState, type Step } from '../../play/minigame'
import { BaseStudio, Particles, addLights, approach, canvasTex, dirtTexture, rng, sfx, tex } from './common'

const phys = (o: ConstructorParameters<typeof MeshPhysicalMaterial>[0]) => new MeshPhysicalMaterial(o)

// Tub: oval, centred at TUB, 1.5 m long along x.
const TUB = new Vector3(0, 0, 0)
const SX = 1.9 // x stretch of the round lathe into an oval
const RIM = 0.56
const FLOOR_IN = 0.08
const R_IN = 0.36

const tileCanvas = (c: CanvasRenderingContext2D, grout = '#b9c4c8', a = '#f2f6f7', b = '#e3eaec') => {
  c.fillStyle = grout
  c.fillRect(0, 0, 256, 256)
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const g = c.createLinearGradient(x * 64, y * 64, x * 64 + 64, y * 64 + 64)
      g.addColorStop(0, a)
      g.addColorStop(1, b)
      c.fillStyle = g
      c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60)
    }
  }
}

export class BathroomStudio extends BaseStudio {
  private water!: Mesh
  private waterLevel = 0
  private stream!: Mesh
  private hot!: Mesh
  private foam!: InstancedMesh
  private foamShown = 0
  private foamGoal = 0
  private duck!: Group
  private bubbles: { m: Mesh; v: Vector3; t: number }[] = []
  private bubbleGroup = new Group()
  private candles: PointLight[] = []
  private flames: Mesh[] = []
  private wall!: Mesh
  private tubFloor!: Mesh
  private dirt: { mesh: Mesh; draw: (c: boolean[]) => void } | null = null
  private sponge!: Mesh
  private bottle: Group | null = null
  private shower!: Group
  private mark!: Mesh
  private steam = new Particles(90, { color: '#ffffff', size: 0.12, opacity: 0.16, gravity: -0.03, lifeMs: 3000 })
  private splash = new Particles(160, { color: '#dff1ff', size: 0.02, opacity: 0.75, gravity: 2, lifeMs: 700 })
  private suds = new Particles(140, { color: '#ffffff', size: 0.03, opacity: 0.9, gravity: 0.05, lifeMs: 1400 })
  private sparkle = new Particles(80, { color: '#fff3b0', size: 0.04, opacity: 1, gravity: -0.05, lifeMs: 1300, additive: true })
  private warmth = 0
  private warmGoal = 0
  private lastTaps = 0
  private lastCleared = 0
  private scrubSound = 0
  private soaking = false

  constructor(env: Texture | null, private mode: 'bath' | 'clean') {
    super(env)
    this.scene.background = new Color('#2b2630')
    const l = addLights(this.scene, { intensity: mode === 'bath' ? 1.4 : 2.2, key: '#fff4e8' })
    l.key.position.set(1.5, 3.2, 2)
    this.build()
    this.scene.add(this.steam.points, this.splash.points, this.suds.points, this.sparkle.points, this.bubbleGroup)
    this.frame(new Vector3(0, 0.35, 0), 1.7, 0.75, 0, true)
  }

  private build() {
    const s = this.scene
    const tile = canvasTex(256, 256, (c) => tileCanvas(c))
    tile.wrapS = tile.wrapT = 1000
    tile.repeat.set(4, 2.5)
    const wallMat = phys({ map: tile, roughness: 0.15, clearcoat: 0.7 })
    const back = new Mesh(new PlaneGeometry(4, 2.5), wallMat)
    back.position.set(0, 1.25, -0.46)
    back.receiveShadow = true
    const side = new Mesh(new PlaneGeometry(2, 2.5), wallMat)
    side.position.set(-0.86, 1.25, 0.5)
    side.rotation.y = Math.PI / 2
    s.add(back, side)
    const floor = new Mesh(new PlaneGeometry(4, 3), new MeshStandardMaterial({ map: tex('floor_tile_diff', 3, true), normalMap: tex('floor_tile_nor', 3), roughness: 0.4 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.z = 0.6
    floor.receiveShadow = true
    s.add(floor)
    // Scrubbable wall panel over the tub (cleaning mode draws grime on it).
    this.wall = new Mesh(new PlaneGeometry(1.1, 0.7), phys({ map: canvasTex(256, 256, (c) => tileCanvas(c)), roughness: 0.15, clearcoat: 0.7 }))
    this.wall.position.set(0.15, RIM + 0.5, -0.455)
    s.add(this.wall)

    // The tub: a round lathe stretched into an oval.
    const pts: Vector2[] = [
      new Vector2(0.001, FLOOR_IN), new Vector2(R_IN - 0.08, FLOOR_IN), new Vector2(R_IN - 0.02, FLOOR_IN + 0.04),
      new Vector2(R_IN, 0.25), new Vector2(R_IN + 0.01, RIM - 0.02), new Vector2(R_IN + 0.03, RIM),
      new Vector2(R_IN + 0.07, RIM), new Vector2(R_IN + 0.08, RIM - 0.02), new Vector2(R_IN + 0.06, 0.02), new Vector2(R_IN + 0.04, 0),
    ]
    const enamel = phys({ color: '#fbfbfa', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, side: DoubleSide })
    const tub = new Mesh(new LatheGeometry(pts, 64), enamel)
    tub.scale.x = SX
    tub.castShadow = tub.receiveShadow = true
    tub.position.copy(TUB)
    s.add(tub)
    this.tubFloor = new Mesh(new CircleGeometry(R_IN - 0.06, 48), phys({ color: '#fbfbfa', roughness: 0.1, clearcoat: 1 }))
    this.tubFloor.rotation.x = -Math.PI / 2
    this.tubFloor.scale.x = SX
    this.tubFloor.position.set(TUB.x, FLOOR_IN + 0.002, TUB.z)
    s.add(this.tubFloor)
    // Water.
    this.water = new Mesh(new CircleGeometry(R_IN + 0.005, 64), phys({ color: '#bfe3ef', roughness: 0.02, transmission: 0.6, thickness: 0.3, transparent: true, opacity: 0.7, clearcoat: 1, ior: 1.33 }))
    this.water.rotation.x = -Math.PI / 2
    this.water.scale.x = SX
    this.water.visible = false
    s.add(this.water)
    // Fill line (shown while filling).
    this.mark = new Mesh(new TorusGeometry(R_IN + 0.004, 0.003, 6, 64), new MeshBasicMaterial({ color: '#5fe08a', transparent: true, opacity: 0.8 }))
    this.mark.rotation.x = -Math.PI / 2
    this.mark.scale.x = SX
    this.mark.visible = false
    s.add(this.mark)
    // Taps at the left end.
    const chrome = phys({ color: '#e8eaee', metalness: 1, roughness: 0.12 })
    const spout = new Mesh(new CylinderGeometry(0.018, 0.018, 0.16, 16), chrome)
    spout.rotation.x = Math.PI / 2
    spout.position.set(-0.62, RIM + 0.16, -0.36)
    const tapX = -0.62
    s.add(spout)
    this.stream = new Mesh(new CylinderGeometry(0.012, 0.016, RIM + 0.16 - FLOOR_IN, 12, 1, true), phys({ color: '#e6f6ff', roughness: 0, transparent: true, opacity: 0.5, clearcoat: 1 }))
    this.stream.position.set(tapX, (RIM + 0.16 + FLOOR_IN) / 2, -0.28)
    this.stream.visible = false
    s.add(this.stream)
    const knob = (color: string, z: number) => {
      const k = new Mesh(new CylinderGeometry(0.03, 0.03, 0.03, 6), chrome)
      k.rotation.x = Math.PI / 2
      k.position.set(tapX + z, RIM + 0.26, -0.43)
      const dot = new Mesh(new CircleGeometry(0.01, 16), new MeshBasicMaterial({ color }))
      dot.position.y = 0.016
      dot.rotation.x = -Math.PI / 2
      k.add(dot)
      s.add(k)
      return k
    }
    this.hot = knob('#e0403a', -0.09)
    knob('#3a7ae0', 0.09)
    // Shower head on the wall.
    this.shower = new Group()
    const head = new Mesh(new CylinderGeometry(0.07, 0.05, 0.03, 24), chrome)
    head.rotation.x = 0.6
    const arm = new Mesh(new CylinderGeometry(0.01, 0.01, 0.25, 10), chrome)
    arm.rotation.x = Math.PI / 2
    arm.position.z = -0.12
    this.shower.add(head, arm)
    this.shower.position.set(-0.4, 1.7, -0.34)
    s.add(this.shower)
    // Candles on the rim, a plant, a towel.
    for (const [x, z, h] of [[0.62, -0.34, 0.1], [0.7, -0.3, 0.07], [0.55, -0.38, 0.13]] as const) {
      const c = new Mesh(new CylinderGeometry(0.025, 0.025, h, 16), new MeshStandardMaterial({ color: '#fff4e0', roughness: 0.6 }))
      c.position.set(x, RIM + h / 2, z)
      c.castShadow = true
      const f = new Mesh(new SphereGeometry(0.007, 8, 6), new MeshBasicMaterial({ color: '#ffbf5a' }))
      f.scale.y = 2
      f.position.set(x, RIM + h + 0.012, z)
      const light = new PointLight('#ffa040', 0.25, 1.5, 2)
      light.position.copy(f.position)
      s.add(c, f, light)
      this.flames.push(f)
      this.candles.push(light)
    }
    const pot = new Mesh(new CylinderGeometry(0.08, 0.06, 0.16, 18), new MeshStandardMaterial({ color: '#d8cfc4', roughness: 0.7 }))
    pot.position.set(1.05, 0.08, -0.25)
    s.add(pot)
    const r = rng(9)
    for (let i = 0; i < 9; i++) {
      const leaf = new Mesh(new SphereGeometry(0.09, 10, 6), new MeshStandardMaterial({ color: '#3f7f3a', roughness: 0.7, side: DoubleSide }))
      leaf.scale.set(0.35, 0.06, 1)
      leaf.position.set(1.05 + (r() - 0.5) * 0.1, 0.25 + r() * 0.25, -0.25 + (r() - 0.5) * 0.1)
      leaf.rotation.set(r() - 0.5, r() * 6, 0.6 + r() * 0.6)
      s.add(leaf)
    }
    const towel = new Mesh(new BoxGeometry(0.4, 0.5, 0.03), new MeshStandardMaterial({ map: tex('fabric_sofa_diff', 1, true), color: '#f3b8c8', roughness: 1 }))
    towel.position.set(-0.84, 1.05, 0.55)
    towel.rotation.y = Math.PI / 2
    s.add(towel)
    // Foam: soft white clumps on the water.
    const foamGeo = new SphereGeometry(0.05, 10, 8)
    this.foam = new InstancedMesh(foamGeo, phys({ color: '#ffffff', roughness: 0.6, sheen: 1, sheenColor: new Color('#ffffff') }), 260)
    const d = new O3()
    const rr = rng(4)
    for (let i = 0; i < 260; i++) {
      const a = rr() * Math.PI * 2, k = Math.sqrt(rr()) * 0.95
      d.position.set(Math.cos(a) * k * R_IN * SX * 0.95, 0, Math.sin(a) * k * R_IN * 0.95)
      d.scale.set(0.6 + rr() * 0.9, 0.35 + rr() * 0.35, 0.6 + rr() * 0.9)
      d.updateMatrix()
      this.foam.setMatrixAt(i, d.matrix)
    }
    this.foam.count = 0
    this.foam.castShadow = false
    this.foam.frustumCulled = false
    s.add(this.foam)
    // Rubber duck.
    this.duck = new Group()
    const yellow = phys({ color: '#ffd21f', roughness: 0.25, clearcoat: 1 })
    const body = new Mesh(new SphereGeometry(0.05, 20, 14), yellow)
    body.scale.set(1.25, 0.85, 1)
    const headM = new Mesh(new SphereGeometry(0.032, 18, 12), yellow)
    headM.position.set(0.035, 0.05, 0)
    const beak = new Mesh(new SphereGeometry(0.014, 12, 8), new MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.4 }))
    beak.scale.set(1.4, 0.6, 1)
    beak.position.set(0.066, 0.046, 0)
    const eyeM = new MeshBasicMaterial({ color: '#111' })
    for (const z of [-0.013, 0.013]) {
      const e = new Mesh(new SphereGeometry(0.0045, 8, 6), eyeM)
      e.position.set(0.058, 0.062, z)
      this.duck.add(e)
    }
    this.duck.add(body, headM, beak)
    this.duck.visible = false
    s.add(this.duck)
    // Sponge for cleaning.
    this.sponge = new Mesh(new BoxGeometry(0.1, 0.04, 0.065), new MeshStandardMaterial({ color: '#7fc8f0', roughness: 0.95 }))
    this.sponge.visible = false
    s.add(this.sponge)
  }

  // ── Steps ──
  protected enterStep(step: Step) {
    const g = this.game!
    this.lastTaps = g.taps
    this.lastCleared = 0
    this.stream.visible = false
    this.mark.visible = false
    this.sponge.visible = false
    this.dirt = null
    if (this.bottle) {
      this.scene.remove(this.bottle)
      this.bottle = null
    }
    const tubView = () => this.frame(new Vector3(-0.05, 0.3, 0.02), 1.2, 0.95)
    switch (step.action) {
      case 'fill': {
        this.mark.visible = true
        const [lo, hi] = step.window ?? [0.6, 0.78]
        this.mark.position.set(TUB.x, this.levelFor((lo + hi) / 2), TUB.z)
        tubView()
        break
      }
      case 'warm':
        this.frame(new Vector3(-0.62, RIM + 0.15, -0.3), 0.5, 0.7)
        break
      case 'foam': {
        const b = new Group()
        const body = new Mesh(new CylinderGeometry(0.035, 0.04, 0.16, 20), phys({ color: '#ff8fb8', roughness: 0.1, clearcoat: 1, transmission: 0.3, transparent: true }))
        const cap = new Mesh(new CylinderGeometry(0.015, 0.02, 0.04, 16), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }))
        cap.position.y = 0.1
        const label = new Mesh(new CylinderGeometry(0.0405, 0.0405, 0.06, 20, 1, true), new MeshStandardMaterial({ map: canvasTex(128, 32, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 32); c.fillStyle = '#d0476f'; c.font = 'bold 16px sans-serif'; c.fillText('BUBBLES', 26, 22) }) }))
        b.add(body, cap, label)
        b.position.set(0.1, RIM + 0.35, 0)
        b.rotation.z = 2.5
        this.scene.add(b)
        this.bottle = b
        tubView()
        break
      }
      case 'soak':
        this.startSoak()
        break
      case 'scrub': {
        const tiles = step.item === 'tiles'
        const mesh = tiles ? this.wall : this.tubFloor
        const { texture, draw } = dirtTexture((c) => (tiles ? tileCanvas(c) : (c.fillStyle = '#fbfbfa', c.fillRect(0, 0, 256, 256))), tiles ? 'rgba(120,110,70,0.75)' : 'rgba(140,120,90,0.7)', step.targets ?? [], tiles ? 0.08 : 0.1)
        const mat = mesh.material as MeshPhysicalMaterial
        mat.map = texture
        mat.color.set('#ffffff')
        mat.needsUpdate = true
        this.dirt = { mesh, draw }
        this.sponge.visible = true
        if (tiles) this.frame(new Vector3(0.15, RIM + 0.5, -0.45), 1.2, 0.08, 0, false, 0.8)
        else this.frame(new Vector3(TUB.x, FLOOR_IN, TUB.z), 1.2, 1.25)
        break
      }
      case 'rinse':
        this.frame(new Vector3(-0.1, 0.5, -0.2), 1.4, 0.6)
        break
    }
  }

  private levelFor(gauge: number) {
    return FLOOR_IN + 0.02 + gauge * (RIM - FLOOR_IN - 0.06)
  }

  private startSoak() {
    this.soaking = true
    this.duck.visible = true
    for (let i = 0; i < 14; i++) this.spawnBubble()
    // Lie back at the right end of the tub, looking down the water to the taps.
    const water = this.levelFor(0.68)
    this.place(new Vector3(0.5, water + 0.22, 0.02), new Vector3(-0.55, water + 0.02, -0.04))
  }

  private spawnBubble() {
    const m = new Mesh(new SphereGeometry(0.03 + Math.random() * 0.03, 20, 14), phys({ color: '#ffffff', roughness: 0, transmission: 1, thickness: 0.002, iridescence: 1, iridescenceIOR: 1.3, transparent: true, opacity: 0.55, clearcoat: 1 }))
    const y = this.levelFor(0.68) + 0.05 + Math.random() * 0.2
    m.position.set(-0.6 + Math.random() * 0.8, y, (Math.random() - 0.5) * 0.5)
    this.bubbleGroup.add(m)
    this.bubbles.push({ m, v: new Vector3((Math.random() - 0.5) * 0.02, 0.01 + Math.random() * 0.02, (Math.random() - 0.5) * 0.02), t: Math.random() * 6 })
  }

  // ── Hooks ──
  protected gesture() {
    return this.step?.action === 'foam' ? 'shake' : 'tap'
  }

  protected tapTargets(): Object3D[] {
    return this.soaking ? [this.duck, ...this.bubbles.map((b) => b.m)] : []
  }

  protected onTap(hit: Object3D | null) {
    if (!this.soaking || !hit) return false
    if (hit.parent === this.bubbleGroup) {
      const i = this.bubbles.findIndex((b) => b.m === hit)
      if (i >= 0) {
        for (let k = 0; k < 8; k++) this.splash.emit(hit.position, new Vector3((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4), 0.02)
        this.bubbleGroup.remove(hit)
        this.bubbles.splice(i, 1)
        sfx.pop()
        setTimeout(() => this.spawnBubble(), 1200)
      }
      return true
    }
    let p: Object3D | null = hit
    while (p && p !== this.duck) p = p.parent
    if (p === this.duck) {
      this.duck.userData.bob = 1
      sfx.squeak()
      return true
    }
    return false
  }

  protected scrubSurface() {
    return this.dirt?.mesh ?? null
  }

  protected onScrubAt(p: Vector3 | null) {
    if (!p) return
    const tiles = this.step?.item === 'tiles'
    this.sponge.position.copy(p).add(new Vector3(0, tiles ? 0 : 0.02, tiles ? 0.03 : 0))
    this.sponge.rotation.x = tiles ? Math.PI / 2 : 0
    this.suds.emit(p.clone().add(new Vector3(0, 0, tiles ? 0.02 : 0)), new Vector3(0, -0.02, 0), 0.05, 2)
    const now = performance.now()
    if (now - this.scrubSound > 140) {
      this.scrubSound = now
      sfx.shake()
    }
  }

  protected onState(g: GameState, prev: GameState | null) {
    const step = this.step
    if (!step) return
    if (prev && g.misses > prev.misses) sfx.miss()
    if (prev && step.action === 'foam' && g.taps > this.lastTaps && prev.step !== g.step) this.bottle && (this.bottle.userData.jig = 1)
    if (prev && prev.step !== g.step && step.mechanic === 'scrub' && this.dirt) this.dirt.draw((step.targets ?? []).map(() => true))
    if (prev && prev.step === g.step) {
      if (step.action === 'fill') this.waterGoal = g.gauge
      if (step.action === 'warm') this.warmGoal = g.gauge
      if (step.action === 'foam' && g.taps > this.lastTaps) {
        this.foamGoal = Math.round(g.progress * 260)
        this.bottle && (this.bottle.userData.jig = 1)
        sfx.shake()
        const mouth = this.bottle?.localToWorld(new Vector3(0, 0.12, 0))
        if (mouth) for (let i = 0; i < 10; i++) this.splash.emit(mouth, new Vector3((Math.random() - 0.5) * 0.2, -0.6, 0), 0.01)
      }
      if (step.mechanic === 'scrub' && this.dirt && g.cleared.filter(Boolean).length !== this.lastCleared) {
        this.dirt.draw(g.cleared)
        this.lastCleared = g.cleared.filter(Boolean).length
        sfx.pop()
      }
    }
    if (prev && prev.step !== g.step) {
      const before = stepsOf(prev)[prev.step]
      if (before?.action === 'fill') this.waterGoal = 0.68
      if (before?.action === 'warm') this.warmGoal = 0.58
      if (before?.action === 'foam') this.foamGoal = 260
      if (before && before.mechanic !== 'relax') sfx.ding()
      if (before?.mechanic === 'scrub') this.sparkleAt(this.dirt?.mesh.getWorldPosition(new Vector3()) ?? new Vector3(0, 0.5, 0))
    }
    this.lastTaps = g.taps
  }
  private waterGoal = 0

  private sparkleAt(p: Vector3) {
    for (let i = 0; i < 30; i++) this.sparkle.emit(p, new Vector3((Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.2, (Math.random() - 0.5) * 0.4), 0.3)
  }

  protected onFinish() {
    this.sponge.visible = false
    this.frame(new Vector3(0, 0.45, 0), 1.6, 0.6)
    this.sparkleAt(new Vector3(0, 0.6, 0))
    sfx.ding()
  }

  protected tick(dt: number, now: number) {
    const step = this.step
    for (const p of [this.steam, this.splash, this.suds, this.sparkle]) p.update(dt)
    // Water level rises while the tap runs; overfilling drains back.
    const running = step?.action === 'fill' && this.isHolding
    this.stream.visible = running || (step?.action === 'warm' && this.isHolding)
    const target = this.mode === 'bath' ? this.waterGoal : 0
    this.waterLevel = approach(this.waterLevel, target, dt, running ? 120 : 500)
    this.water.visible = this.waterLevel > 0.01
    this.water.position.set(TUB.x, this.levelFor(this.waterLevel), TUB.z)
    const k = 0.8 + this.waterLevel * 0.2
    this.water.scale.set(SX * k, k, 1)
    if (this.stream.visible) this.splash.emit(new Vector3(-0.62, this.levelFor(this.waterLevel) + 0.01, -0.28), new Vector3(0, 0.5, 0), 0.05, 2)
    sfx.loop('water', this.stream.visible || (step?.action === 'rinse' && this.isHolding) ? 1 : 0)
    // Warmth: knob turns, water tints, steam rises.
    this.warmth = approach(this.warmth, this.warmGoal, dt, 300)
    this.hot.rotation.y = -this.warmth * 2.5
    ;(this.water.material as MeshPhysicalMaterial).color.set('#bfe3ef').lerp(new Color('#e8ddd0'), this.warmth * 0.5)
    if (this.waterLevel > 0.1 && Math.random() < dt / (40 + (1 - this.warmth) * 400)) {
      this.steam.emit(new Vector3((Math.random() - 0.5) * 1.1, this.levelFor(this.waterLevel) + 0.05, (Math.random() - 0.5) * 0.4), new Vector3(0, 0.05 + this.warmth * 0.08, 0), 0.1)
    }
    // Foam grows clump by clump and rides the water.
    this.foamShown = approach(this.foamShown, this.foamGoal, dt, 300)
    this.foam.count = Math.round(this.foamShown)
    this.foam.position.set(TUB.x, this.levelFor(this.waterLevel) + 0.005, TUB.z)
    this.foam.scale.setScalar(0.85 + this.waterLevel * 0.2)
    this.foam.rotation.y = Math.sin(now / 4000) * 0.03
    // Shower spray while rinsing.
    if (step?.action === 'rinse' && this.isHolding) {
      const head = this.shower.localToWorld(new Vector3(0, -0.02, 0.02))
      for (let i = 0; i < 4; i++) this.splash.emit(head, new Vector3(0.4 + Math.random() * 0.6, -0.8, 0.3 + Math.random() * 0.3), 0.06)
      if (Math.random() < dt / 80) this.sparkle.emit(new Vector3(Math.random() - 0.4, 0.3 + Math.random() * 0.6, -0.3), new Vector3(0, 0.05, 0), 0.1)
    }
    // Bottle jiggle.
    if (this.bottle) {
      const j = (this.bottle.userData.jig ?? 0) as number
      this.bottle.userData.jig = Math.max(0, j - dt / 160)
      this.bottle.position.y = RIM + 0.35 + Math.sin(j * Math.PI) * 0.05
    }
    // Duck bobs on the water.
    if (this.duck.visible) {
      const bob = (this.duck.userData.bob ?? 0) as number
      this.duck.userData.bob = Math.max(0, bob - dt / 500)
      const y = this.levelFor(this.waterLevel) + 0.025 + Math.sin(now / 700) * 0.006 + Math.sin(bob * Math.PI) * 0.04
      this.duck.position.set(-0.3 + Math.sin(now / 5000) * 0.15, y, 0.12 + Math.cos(now / 6000) * 0.06)
      this.duck.rotation.y = Math.PI + Math.sin(now / 3000) * 0.4
      this.duck.rotation.z = Math.sin(bob * Math.PI * 3) * 0.3
    }
    // Floating soap bubbles.
    for (const b of this.bubbles) {
      b.t += dt / 1000
      b.m.position.addScaledVector(b.v, dt / 1000)
      b.m.position.x += Math.sin(b.t * 1.3) * 0.0006
      if (b.m.position.y > 1.4) b.m.position.y = this.levelFor(this.waterLevel) + 0.05
    }
    // Candle flicker.
    this.candles.forEach((c, i) => (c.intensity = 0.22 + Math.sin(now / 90 + i * 2) * 0.04 + Math.random() * 0.03))
    this.flames.forEach((f, i) => (f.scale.y = 1.8 + Math.sin(now / 70 + i) * 0.3))
  }

  dispose() {
    sfx.loop('water', 0)
    super.dispose()
  }
}
