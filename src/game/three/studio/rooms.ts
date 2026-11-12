// Smaller close-up sets: watering the plant, making the bed / lying in bed, and movie night on the sofa.
import {
  BoxGeometry, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, InstancedMesh,
  LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, type Object3D, Object3D as O3,
  PlaneGeometry, PointLight, SphereGeometry, SRGBColorSpace, type Texture, TorusGeometry, Vector2, Vector3,
} from 'three'
import { stepsOf, type GameState, type Step } from '../../play/minigame'
import { BaseStudio, Particles, addLights, approach, canvasTex, rng, sfx, tex } from './common'

const phys = (o: ConstructorParameters<typeof MeshPhysicalMaterial>[0]) => new MeshPhysicalMaterial(o)

function room(scene: Group | import('three').Scene, wall: string, floorTex = 'floor_wood') {
  const floor = new Mesh(new PlaneGeometry(6, 6), new MeshStandardMaterial({ map: tex(`${floorTex}_diff`, 3, true), normalMap: tex(`${floorTex}_nor`, 3), roughness: 0.6 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  const back = new Mesh(new PlaneGeometry(6, 3.2), new MeshStandardMaterial({ map: tex('wall_plaster_diff', 3, true), normalMap: tex('wall_plaster_nor', 3), color: wall, roughness: 0.9 }))
  back.position.set(0, 1.6, -1)
  back.receiveShadow = true
  scene.add(floor, back)
}

// ── Plant ───────────────────────────────────────────────
export class PlantStudio extends BaseStudio {
  private soil!: Mesh
  private dry: Mesh[] = []
  private can!: Group
  private tilt = 0
  private wet = 0
  private drops = new Particles(160, { color: '#bfe6ff', size: 0.014, opacity: 0.85, gravity: 2.4, lifeMs: 650 })
  private sparkle = new Particles(40, { color: '#fff3b0', size: 0.03, opacity: 1, gravity: -0.05, lifeMs: 1200, additive: true })
  private puddle!: Mesh

  constructor(env: Texture | null) {
    super(env)
    this.scene.background = new Color('#30262a')
    addLights(this.scene)
    room(this.scene, '#f1e6dc')
    const pot = new Mesh(new LatheGeometry([new Vector2(0.001, 0), new Vector2(0.11, 0), new Vector2(0.15, 0.26), new Vector2(0.165, 0.27), new Vector2(0.165, 0.29), new Vector2(0.15, 0.29), new Vector2(0.14, 0.27)], 40), new MeshStandardMaterial({ color: '#c46a45', roughness: 0.85, side: DoubleSide }))
    pot.castShadow = true
    this.scene.add(pot)
    this.soil = new Mesh(new CircleGeometry(0.142, 32), new MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 }))
    this.soil.rotation.x = -Math.PI / 2
    this.soil.position.y = 0.25
    this.scene.add(this.soil)
    this.puddle = new Mesh(new CircleGeometry(0.25, 32), phys({ color: '#9fc8e0', roughness: 0, transparent: true, opacity: 0, clearcoat: 1 }))
    this.puddle.rotation.x = -Math.PI / 2
    this.puddle.position.y = 0.002
    this.scene.add(this.puddle)
    // Leafy plant: stems with big glossy leaves.
    const r = rng(17)
    const green = phys({ color: '#2f7a34', roughness: 0.35, clearcoat: 0.6, side: DoubleSide })
    const stemMat = new MeshStandardMaterial({ color: '#4f7f3a', roughness: 0.7 })
    for (let i = 0; i < 11; i++) {
      const a = r() * Math.PI * 2, h = 0.25 + r() * 0.35, lean = 0.2 + r() * 0.5
      const stem = new Mesh(new CylinderGeometry(0.004, 0.006, h, 6), stemMat)
      stem.position.set(Math.cos(a) * 0.03, 0.25 + h / 2, Math.sin(a) * 0.03)
      stem.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean)
      const tip = new Vector3(0, h / 2, 0).applyEuler(stem.rotation).add(stem.position)
      const leaf = new Mesh(new SphereGeometry(0.075, 14, 8), green)
      leaf.scale.set(1, 0.05, 0.55)
      leaf.position.copy(tip)
      leaf.rotation.set(0.3 + r() * 0.4, -a, 0.3)
      leaf.castShadow = true
      this.scene.add(stem, leaf)
    }
    const yellow = new MeshStandardMaterial({ color: '#d8b13a', roughness: 0.8, side: DoubleSide })
    for (let i = 0; i < 3; i++) {
      const a = 0.6 + i * 2.1
      const leaf = new Mesh(new SphereGeometry(0.06, 12, 8), yellow)
      leaf.scale.set(1, 0.06, 0.5)
      leaf.position.set(Math.cos(a) * 0.17, 0.33 + i * 0.05, Math.sin(a) * 0.17 + 0.03)
      leaf.rotation.set(0.5, -a, 0.6)
      leaf.castShadow = true
      this.scene.add(leaf)
      this.dry.push(leaf)
    }
    // Watering can.
    this.can = new Group()
    const tin = phys({ color: '#6fb6a6', metalness: 0.6, roughness: 0.35 })
    const body = new Mesh(new CylinderGeometry(0.07, 0.08, 0.15, 24), tin)
    const spout = new Mesh(new CylinderGeometry(0.008, 0.014, 0.22, 10), tin)
    spout.position.set(-0.11, 0.06, 0)
    spout.rotation.z = 1.0
    const rose = new Mesh(new CylinderGeometry(0.022, 0.012, 0.025, 14), tin)
    rose.position.set(-0.2, 0.12, 0)
    rose.rotation.z = 1.0
    const handle = new Mesh(new TorusGeometry(0.06, 0.008, 8, 20, Math.PI), tin)
    handle.position.set(0.02, 0.08, 0)
    this.can.add(body, spout, rose, handle)
    this.can.traverse((o) => (o.castShadow = true))
    this.can.position.set(0.28, 0.62, 0.05)
    this.scene.add(this.can, this.drops.points, this.sparkle.points)
    this.frame(new Vector3(0.05, 0.38, 0), 0.75, 0.6, 0, true)
  }

  protected enterStep(step: Step) {
    if (step.action === 'pick') this.frame(new Vector3(0, 0.38, 0.03), 0.6, 0.55)
    else this.frame(new Vector3(0.08, 0.42, 0), 0.7, 0.6)
  }

  protected tapTargets(): Object3D[] {
    return this.step?.action === 'pick' ? this.dry.filter((l) => l.visible) : []
  }

  protected onTap(hit: Object3D | null) {
    if (hit && this.dry.includes(hit as Mesh)) {
      hit.userData.fall = 0.0001
      sfx.tap()
    } else if (this.step?.action === 'pick') sfx.miss()
    return false
  }

  protected onState(g: GameState, prev: GameState | null) {
    if (this.step?.action === 'pour' && prev?.step === g.step) this.wetGoal = g.gauge
    if (prev && g.misses > prev.misses && prev.step === g.step) {
      sfx.miss()
      if (this.step?.action === 'pour') (this.puddle.material as MeshPhysicalMaterial).opacity = 0.6
    }
    if (prev && prev.step !== g.step) sfx.ding()
  }
  private wetGoal = 0

  protected onFinish() {
    for (let i = 0; i < 30; i++) this.sparkle.emit(new Vector3(0, 0.5, 0), new Vector3((Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.2, (Math.random() - 0.5) * 0.4), 0.2)
    this.wetGoal = 0.7
  }

  protected tick(dt: number, now: number) {
    this.drops.update(dt)
    this.sparkle.update(dt)
    for (const l of this.dry) {
      if (!l.userData.fall) continue
      l.userData.fall += dt / 900
      l.position.y -= dt / 1000 * 0.4
      l.position.x += dt / 1000 * 0.15
      l.rotation.z += dt / 300
      if (l.userData.fall > 1) l.visible = false
    }
    const pouring = this.step?.action === 'pour' && this.isHolding
    this.tilt = approach(this.tilt, pouring ? 1 : 0, dt, 180)
    this.can.rotation.z = this.tilt * 0.75
    if (pouring && this.tilt > 0.6) {
      const tip = this.can.localToWorld(new Vector3(-0.21, 0.12, 0))
      this.drops.emit(tip, new Vector3(-0.15, -0.1, 0), 0.02, 3)
    }
    this.wet = approach(this.wet, this.wetGoal, dt, 300)
    ;(this.soil.material as MeshStandardMaterial).color.set('#8a6a46').lerp(new Color('#3a2616'), Math.min(1, this.wet * 1.3))
    const pm = this.puddle.material as MeshPhysicalMaterial
    pm.opacity = Math.max(0, pm.opacity - dt / 3000)
    sfx.loop('water', pouring && this.tilt > 0.6 ? 0.5 : 0)
    void now
  }

  dispose() {
    sfx.loop('water', 0)
    super.dispose()
  }
}

// ── Bed: make it, or lie down and sleep ─────────────────
export class BedStudio extends BaseStudio {
  private duvet!: Mesh
  private base!: Float32Array
  private wrinkles = [1, 1, 1, 1].map((a, i) => ({ a, goal: a, z: -0.55 + i * 0.36 }))
  private pillows: Mesh[] = []
  private lamp!: PointLight
  private lampShade!: Mesh
  private lampOn = true
  private stars: Mesh[] = []
  private sparkle = new Particles(40, { color: '#fff3b0', size: 0.04, opacity: 1, gravity: -0.05, lifeMs: 1200, additive: true })
  private zzz = new Particles(10, { color: '#c9d4ff', size: 0.06, opacity: 0.7, gravity: -0.06, lifeMs: 2600 })
  private fluffs = [0, 0]

  constructor(env: Texture | null, private mode: 'bed' | 'sleep') {
    super(env)
    this.scene.background = new Color('#241d2a')
    addLights(this.scene, { intensity: mode === 'sleep' ? 0.5 : 2, dim: mode === 'sleep' })
    room(this.scene, '#e9dff0')
    // Bed frame and mattress; the bed's head is at -z.
    const wood = new MeshStandardMaterial({ map: tex('floor_wood_diff', 1, true), color: '#c9a07a', roughness: 0.6 })
    const frame = new Mesh(new BoxGeometry(1.7, 0.3, 2.1), wood)
    frame.position.set(0, 0.15, 0)
    const head = new Mesh(new BoxGeometry(1.8, 1.0, 0.08), new MeshStandardMaterial({ map: tex('fabric_sofa_diff', 2, true), normalMap: tex('fabric_sofa_nor', 2), color: '#d9c2d6', roughness: 1 }))
    head.position.set(0, 0.7, -1.02)
    const mattress = new Mesh(new BoxGeometry(1.6, 0.22, 2.0), new MeshStandardMaterial({ color: '#f7f4ef', roughness: 0.9 }))
    mattress.position.set(0, 0.41, 0)
    frame.castShadow = mattress.receiveShadow = true
    this.scene.add(frame, head, mattress)
    // Duvet: a soft sheet with wrinkles that smooth out.
    const geo = new PlaneGeometry(1.66, 1.5, 60, 60)
    geo.rotateX(-Math.PI / 2)
    this.base = new Float32Array(geo.attributes.position.array)
    const quilt = canvasTex(256, 256, (c) => {
      c.fillStyle = '#f6c9d6'
      c.fillRect(0, 0, 256, 256)
      c.strokeStyle = 'rgba(255,255,255,0.55)'
      c.lineWidth = 3
      for (let i = 0; i <= 256; i += 32) {
        c.beginPath()
        c.moveTo(i, 0)
        c.lineTo(i, 256)
        c.moveTo(0, i)
        c.lineTo(256, i)
        c.stroke()
      }
    })
    this.duvet = new Mesh(geo, phys({ map: quilt, color: '#e8d4da', roughness: 0.9, sheen: 0.25, sheenColor: new Color('#ffe6ee'), side: DoubleSide }))
    this.duvet.position.set(0, 0.55, 0.22)
    this.duvet.castShadow = this.duvet.receiveShadow = true
    this.scene.add(this.duvet)
    if (mode === 'sleep') this.wrinkles.forEach((w) => (w.a = w.goal = 0))
    this.shapeDuvet()
    // Pillows.
    const pm = phys({ color: '#ecebf2', roughness: 0.9, sheen: 0.3, sheenColor: new Color('#f3f0ff') })
    for (const x of [-0.4, 0.4]) {
      const p = new Mesh(new SphereGeometry(0.3, 24, 16), pm)
      p.scale.set(1, 0.22, 0.6)
      p.position.set(x, 0.6, -0.72)
      p.rotation.set(mode === 'sleep' ? 0 : 0.3, mode === 'sleep' ? 0 : x * 0.8, mode === 'sleep' ? 0 : -x * 0.5)
      p.castShadow = true
      this.scene.add(p)
      this.pillows.push(p)
    }
    // Bedside lamp.
    const table = new Mesh(new BoxGeometry(0.45, 0.5, 0.4), wood)
    table.position.set(1.15, 0.25, -0.75)
    this.lampShade = new Mesh(new CylinderGeometry(0.1, 0.15, 0.2, 24, 1, true), new MeshStandardMaterial({ color: '#fff1d6', emissive: '#ffcf8a', emissiveIntensity: 0.8, side: DoubleSide }))
    this.lampShade.position.set(1.15, 0.85, -0.75)
    const lampBase = new Mesh(new CylinderGeometry(0.02, 0.06, 0.3, 16), new MeshStandardMaterial({ color: '#c9a86a', metalness: 0.8, roughness: 0.3 }))
    lampBase.position.set(1.15, 0.65, -0.75)
    this.lamp = new PointLight('#ffc98a', 2.2, 4, 2)
    this.lamp.position.set(1.15, 0.85, -0.75)
    this.scene.add(table, this.lampShade, lampBase, this.lamp)
    // Ceiling with glow-in-the-dark stars for the sleeping view.
    const ceil = new Mesh(new PlaneGeometry(6, 6), new MeshStandardMaterial({ color: '#d9d0e6', roughness: 1 }))
    ceil.rotation.x = Math.PI / 2
    ceil.position.y = 2.6
    this.scene.add(ceil)
    const starTex = canvasTex(64, 64, (c) => {
      c.translate(32, 32)
      c.fillStyle = '#e8ffb8'
      c.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 12 : 28, a = (i / 10) * Math.PI * 2 - Math.PI / 2
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      c.fill()
    })
    const r = rng(5)
    for (let i = 0; i < 14; i++) {
      const s = new Mesh(new PlaneGeometry(0.12, 0.12), new MeshBasicMaterial({ map: starTex, transparent: true, color: '#ffffff', opacity: 0.25 }))
      s.rotation.x = Math.PI / 2
      s.rotation.z = r() * 6
      s.position.set((r() - 0.5) * 2.4, 2.59, -0.8 + r() * 2)
      this.scene.add(s)
      this.stars.push(s)
    }
    // A window with the moon.
    const win = new Mesh(new PlaneGeometry(0.9, 1.1), new MeshBasicMaterial({ map: canvasTex(128, 160, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 160)
      g.addColorStop(0, '#0d1236')
      g.addColorStop(1, '#3a2a5a')
      c.fillStyle = g
      c.fillRect(0, 0, 128, 160)
      c.fillStyle = '#fff8dc'
      c.beginPath()
      c.arc(88, 40, 14, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#ffffff'
      for (let i = 0; i < 30; i++) c.fillRect((i * 37) % 128, (i * 53) % 160, 1.5, 1.5)
      c.strokeStyle = '#e9dff0'
      c.lineWidth = 6
      c.strokeRect(0, 0, 128, 160)
      c.beginPath()
      c.moveTo(64, 0)
      c.lineTo(64, 160)
      c.stroke()
    }) }))
    win.position.set(0.3, 1.75, 2.19)
    win.rotation.y = Math.PI
    const front = new Mesh(new PlaneGeometry(6, 3.2), new MeshStandardMaterial({ map: tex('wall_plaster_diff', 3, true), color: '#e9dff0', roughness: 0.9 }))
    front.position.set(0, 1.6, 2.2)
    front.rotation.y = Math.PI
    this.scene.add(front)
    this.scene.add(win, this.sparkle.points, this.zzz.points)

    if (mode === 'sleep') {
      // Lying on the pillow, looking up past the duvet to the ceiling.
      this.place(new Vector3(0.38, 0.85, -0.62), new Vector3(0.25, 1.95, 2.1), true)
    } else this.frame(new Vector3(0, 0.55, -0.05), 1.9, 0.95, 0, true)
  }

  private shapeDuvet() {
    const pos = this.duvet.geometry.attributes.position
    const arr = pos.array as Float32Array
    for (let i = 0; i < arr.length; i += 3) {
      const x = this.base[i], z = this.base[i + 2]
      let y = 0
      for (const w of this.wrinkles) y += w.a * 0.1 * Math.exp(-((z - w.z) ** 2) / 0.006) * (0.6 + 0.4 * Math.sin(x * 7 + w.z * 5))
      // Drape over the sides of the mattress.
      const edge = Math.max(0, Math.abs(x) - 0.78)
      arr[i + 1] = y - edge * 3
      arr[i] = this.base[i] - Math.sign(x) * edge * 0.6
    }
    pos.needsUpdate = true
    this.duvet.geometry.computeVertexNormals()
  }

  protected enterStep(step: Step) {
    if (step.action === 'smooth') this.frame(new Vector3(0, 0.55, 0.2), 1.85, 1.05)
    else if (step.action === 'fluff') this.frame(new Vector3(0, 0.6, -0.68), 1.4, 0.85)
  }

  protected gesture() {
    return this.step?.action === 'smooth' ? 'swipe' : 'tap'
  }

  protected onSwipe(start: Vector2, end: Vector2) {
    // Smooth the wrinkle nearest the swipe.
    const mid = new Vector2((start.x + end.x) / 2, (start.y + end.y) / 2)
    this.ray.setFromCamera(mid, this.camera)
    const hit = this.ray.intersectObject(this.duvet)[0]
    const left = this.wrinkles.filter((w) => w.goal > 0)
    if (!left.length) return false
    const z = hit ? hit.point.z - this.duvet.position.z : 0
    const w = left.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a))
    w.goal = 0
    sfx.shake()
    return true
  }

  protected tapTargets(): Object3D[] {
    if (this.step?.action === 'fluff') return this.pillows
    if (this.mode === 'sleep') return [this.lampShade, ...this.stars]
    return []
  }

  protected onTap(hit: Object3D | null) {
    if (this.step?.action === 'fluff') {
      const i = this.pillows.indexOf(hit as Mesh)
      if (i < 0) {
        sfx.miss()
        return false
      }
      if (this.fluffs[i] >= 2) return true // already plump: no credit, no miss
      this.fluffs[i]++
      hit!.userData.bounce = 1
      sfx.tap()
      return false
    }
    if (this.mode === 'sleep') {
      // A star twinkles; tapping anywhere else reaches for the bedside lamp.
      if (hit && hit !== this.lampShade) {
        hit.userData.twinkle = 1
        sfx.pop()
      } else {
        this.lampOn = !this.lampOn
        sfx.tap()
      }
      return true
    }
    return false
  }

  protected onState(g: GameState, prev: GameState | null) {
    if (prev && prev.step !== g.step && stepsOf(prev)[prev.step]?.mechanic !== 'relax') sfx.ding()
  }

  protected onFinish() {
    for (let i = 0; i < 30; i++) this.sparkle.emit(new Vector3(0, 0.8, 0), new Vector3((Math.random() - 0.5) * 0.8, 0.3, (Math.random() - 0.5) * 0.8), 0.6)
    this.frame(new Vector3(0, 0.55, -0.1), 2, 0.75)
  }

  protected tick(dt: number, now: number) {
    this.sparkle.update(dt)
    this.zzz.update(dt)
    let moved = false
    for (const w of this.wrinkles) {
      const a = approach(w.a, w.goal, dt, 160)
      if (Math.abs(a - w.a) > 1e-4) moved = true
      w.a = a
    }
    if (moved) this.shapeDuvet()
    this.pillows.forEach((p, i) => {
      const b = (p.userData.bounce ?? 0) as number
      p.userData.bounce = Math.max(0, b - dt / 300)
      const plump = this.mode === 'sleep' ? 1 : this.fluffs[i] / 2
      p.scale.set(1, 0.22 + plump * 0.08 + Math.sin(b * Math.PI) * 0.06, 0.6)
      if (this.mode === 'bed') {
        const x = i ? 0.4 : -0.4
        p.rotation.set(0.3 * (1 - plump), x * 0.8 * (1 - plump), -x * 0.5 * (1 - plump))
      }
    })
    // Sleep: lamp toggles, stars glow in the dark and twinkle when tapped.
    const on = this.lampOn ? 1 : 0
    this.lamp.intensity = approach(this.lamp.intensity, on * (this.mode === 'sleep' ? 1.2 : 2.2), dt, 200)
    ;(this.lampShade.material as MeshStandardMaterial).emissiveIntensity = on * 0.8
    for (const s of this.stars) {
      const tw = (s.userData.twinkle ?? 0) as number
      s.userData.twinkle = Math.max(0, tw - dt / 800)
      const m = s.material as MeshBasicMaterial
      m.opacity = (this.lampOn ? 0.25 : 0.85) + Math.sin(now / 600 + s.position.x * 5) * 0.08 + tw * 0.4
      s.scale.setScalar(1 + tw * 0.6)
    }
    if (this.mode === 'sleep' && !this.lampOn && Math.random() < dt / 1200) this.zzz.emit(new Vector3(0.5, 1.1, -0.3), new Vector3(0.05, 0.12, 0.05), 0.05)
  }
}

// ── Sofa & TV ───────────────────────────────────────────
const CHANNELS = ['Ocean documentary', 'Panda cam', 'K-pop stage', 'Cooking show', 'Late-night movie', 'Football']

export class LivingStudio extends BaseStudio {
  private screen!: CanvasTexture
  private ctx!: CanvasRenderingContext2D
  private glow!: PointLight
  private popcorn!: InstancedMesh
  private popLeft = 40
  private flying: { m: Mesh; t: number; from: Vector3 }[] = []
  private bowl!: Group
  private channel = 0
  private staticT = 0
  private label = ''

  constructor(env: Texture | null) {
    super(env)
    this.scene.background = new Color('#17121c')
    addLights(this.scene, { intensity: 0.35, dim: true })
    room(this.scene, '#c9b9c9')
    // TV on a console.
    const consoleT = new Mesh(new BoxGeometry(1.6, 0.45, 0.4), new MeshStandardMaterial({ map: tex('floor_wood_diff', 1, true), color: '#8a6a50', roughness: 0.6 }))
    consoleT.position.set(0, 0.225, -0.75)
    const bezel = new Mesh(new BoxGeometry(1.25, 0.74, 0.04), phys({ color: '#0b0b0d', roughness: 0.2, clearcoat: 1 }))
    bezel.position.set(0, 0.9, -0.82)
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 180
    this.ctx = c.getContext('2d')!
    this.screen = new CanvasTexture(c)
    this.screen.colorSpace = SRGBColorSpace
    const screen = new Mesh(new PlaneGeometry(1.2, 0.675), new MeshBasicMaterial({ map: this.screen, toneMapped: false }))
    screen.position.set(0, 0.9, -0.797)
    this.glow = new PointLight('#7fb0ff', 1.5, 4, 2)
    this.glow.position.set(0, 0.9, -0.4)
    this.scene.add(consoleT, bezel, screen, this.glow)
    // Coffee table with a bowl of popcorn, and a lamp.
    const table = new Mesh(new BoxGeometry(0.9, 0.05, 0.5), phys({ color: '#ffffff', roughness: 0.05, transmission: 0.9, thickness: 0.02, transparent: true }))
    table.position.set(0, 0.42, 0.6)
    const legs = new Mesh(new BoxGeometry(0.8, 0.4, 0.4), new MeshStandardMaterial({ color: '#6a4a36', roughness: 0.6 }))
    legs.position.set(0, 0.2, 0.6)
    this.scene.add(table, legs)
    this.bowl = new Group()
    const bowlMesh = new Mesh(new LatheGeometry([new Vector2(0.001, 0), new Vector2(0.07, 0), new Vector2(0.12, 0.09), new Vector2(0.115, 0.09), new Vector2(0.065, 0.006), new Vector2(0.001, 0.006)], 32), new MeshStandardMaterial({ color: '#d8322c', roughness: 0.4 }))
    this.bowl.add(bowlMesh)
    this.popcorn = new InstancedMesh(new IcosahedronGeometry(0.018, 1), new MeshStandardMaterial({ color: '#fff3d0', roughness: 0.9 }), 40)
    const d = new O3()
    const r = rng(2)
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.09
      d.position.set(Math.cos(a) * rr, 0.07 + (1 - rr / 0.09) * 0.04 + r() * 0.02, Math.sin(a) * rr)
      d.scale.set(0.8 + r() * 0.5, 0.7 + r() * 0.4, 0.8 + r() * 0.5)
      d.rotation.set(r() * 6, r() * 6, r() * 6)
      d.updateMatrix()
      this.popcorn.setMatrixAt(i, d.matrix)
    }
    this.bowl.add(this.popcorn)
    this.bowl.position.set(0.15, 0.445, 0.6)
    this.scene.add(this.bowl)
    const lamp = new PointLight('#ffb070', 0.6, 3, 2)
    lamp.position.set(-1.2, 1.2, 0.2)
    this.scene.add(lamp)
    const shade = new Mesh(new CylinderGeometry(0.14, 0.2, 0.25, 20, 1, true), new MeshStandardMaterial({ color: '#f3e3c8', emissive: '#ffbf7a', emissiveIntensity: 0.6, side: DoubleSide }))
    shade.position.copy(lamp.position)
    this.scene.add(shade)
    // Sitting on the sofa: eyes at seated height, looking at the TV over the table.
    this.place(new Vector3(0, 1.05, 1.55), new Vector3(0, 0.78, -0.6), true)
    this.drawChannel(0)
  }

  protected enterStep() {}

  protected tapTargets(): Object3D[] {
    return [this.bowl]
  }

  protected onTap(hit: Object3D | null) {
    if (!hit || this.popLeft <= 0) return false
    // Grab a piece of popcorn and eat it.
    this.popLeft--
    this.popcorn.count = this.popLeft
    const m = new Mesh(new IcosahedronGeometry(0.018, 1), new MeshStandardMaterial({ color: '#fff3d0', roughness: 0.9 }))
    const from = this.bowl.position.clone().add(new Vector3(0, 0.1, 0))
    m.position.copy(from)
    this.scene.add(m)
    this.flying.push({ m, t: 0, from })
    sfx.crack()
    return true
  }

  protected onState(g: GameState, prev: GameState | null) {
    const ch = Math.round(g.progress * 4) % CHANNELS.length
    if (prev && ch !== this.channel) {
      this.channel = ch
      this.staticT = 1
      sfx.shake()
    }
  }

  private drawChannel(t: number) {
    const c = this.ctx
    const W = 320, H = 180
    const s = t / 1000
    switch (this.channel) {
      case 0: { // ocean
        const g = c.createLinearGradient(0, 0, 0, H)
        g.addColorStop(0, '#5fb8e8')
        g.addColorStop(1, '#0a3a6a')
        c.fillStyle = g
        c.fillRect(0, 0, W, H)
        for (let k = 0; k < 6; k++) {
          c.fillStyle = `rgba(255,255,255,${0.08 + k * 0.02})`
          c.beginPath()
          for (let x = 0; x <= W; x += 8) c.lineTo(x, 60 + k * 20 + Math.sin(x / 30 + s * (1 + k * 0.2)) * 6)
          c.lineTo(W, H)
          c.lineTo(0, H)
          c.fill()
        }
        c.fillStyle = '#ffb84a'
        c.beginPath()
        c.ellipse(160 + Math.sin(s / 2) * 80, 120 + Math.sin(s * 2) * 6, 16, 7, 0, 0, Math.PI * 2)
        c.fill()
        break
      }
      case 1: { // panda
        c.fillStyle = '#7fb85a'
        c.fillRect(0, 0, W, H)
        c.fillStyle = '#3f7a2a'
        for (let i = 0; i < 12; i++) c.fillRect(i * 30, 0, 6, H)
        const x = 160 + Math.sin(s / 1.5) * 40, y = 110 + Math.abs(Math.sin(s * 2)) * -6
        c.fillStyle = '#fff'
        c.beginPath(); c.arc(x, y, 34, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(x, y - 44, 26, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#111'
        for (const dx of [-20, 20]) { c.beginPath(); c.arc(x + dx, y - 66, 9, 0, Math.PI * 2); c.fill() }
        for (const dx of [-10, 10]) { c.beginPath(); c.ellipse(x + dx, y - 46, 6, 8, 0, 0, Math.PI * 2); c.fill() }
        break
      }
      case 2: { // k-pop stage
        c.fillStyle = '#12051f'
        c.fillRect(0, 0, W, H)
        for (let i = 0; i < 6; i++) {
          const a = Math.sin(s * 1.5 + i) * 0.6
          c.fillStyle = `hsla(${(i * 60 + s * 80) % 360},90%,60%,0.35)`
          c.beginPath()
          c.moveTo(40 + i * 48, 0)
          c.lineTo(40 + i * 48 + Math.sin(a) * 200 - 30, H)
          c.lineTo(40 + i * 48 + Math.sin(a) * 200 + 30, H)
          c.fill()
        }
        for (let i = 0; i < 5; i++) {
          const x = 70 + i * 45, y = 130 - Math.abs(Math.sin(s * 4 + i)) * 10
          c.fillStyle = '#f5d0e0'
          c.beginPath(); c.arc(x, y - 30, 7, 0, Math.PI * 2); c.fill()
          c.fillStyle = '#222'
          c.fillRect(x - 6, y - 22, 12, 26)
        }
        break
      }
      case 3: { // cooking show
        c.fillStyle = '#f3e3d0'
        c.fillRect(0, 0, W, H)
        c.fillStyle = '#9a7a5a'
        c.fillRect(0, 120, W, 60)
        c.fillStyle = '#333'
        c.beginPath(); c.ellipse(160, 125, 60, 14, 0, 0, Math.PI * 2); c.fill()
        for (let i = 0; i < 14; i++) {
          c.fillStyle = ['#e0402a', '#f5c040', '#3f8a35'][i % 3]
          c.beginPath(); c.arc(130 + (i * 37) % 60, 118 - Math.abs(Math.sin(s * 3 + i)) * 30, 5, 0, Math.PI * 2); c.fill()
        }
        break
      }
      case 4: { // movie
        c.fillStyle = '#0a0a12'
        c.fillRect(0, 0, W, H)
        const g = c.createRadialGradient(160 + Math.sin(s / 3) * 50, 90, 10, 160, 90, 200)
        g.addColorStop(0, '#ffcf8a')
        g.addColorStop(1, '#1a1030')
        c.fillStyle = g
        c.fillRect(0, 20, W, 140)
        c.fillStyle = '#000'
        c.fillRect(0, 0, W, 20)
        c.fillRect(0, 160, W, 20)
        c.fillStyle = '#20142a'
        c.beginPath(); c.arc(110, 160, 40, Math.PI, 0); c.fill()
        c.beginPath(); c.arc(210, 160, 40, Math.PI, 0); c.fill()
        break
      }
      default: { // football
        c.fillStyle = '#2f8a3a'
        c.fillRect(0, 0, W, H)
        c.strokeStyle = 'rgba(255,255,255,0.7)'
        c.lineWidth = 2
        c.strokeRect(10, 10, W - 20, H - 20)
        c.beginPath(); c.arc(160, 90, 30, 0, Math.PI * 2); c.moveTo(160, 10); c.lineTo(160, 170); c.stroke()
        c.fillStyle = '#fff'
        c.beginPath(); c.arc(160 + Math.sin(s) * 120, 90 + Math.sin(s * 1.7) * 60, 4, 0, Math.PI * 2); c.fill()
        break
      }
    }
    if (this.staticT > 0) {
      const img = c.getImageData(0, 0, W, H)
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255
        img.data[i] = img.data[i] * (1 - this.staticT) + v * this.staticT
        img.data[i + 1] = img.data[i + 1] * (1 - this.staticT) + v * this.staticT
        img.data[i + 2] = img.data[i + 2] * (1 - this.staticT) + v * this.staticT
      }
      c.putImageData(img, 0, 0)
    }
    this.label = CHANNELS[this.channel]
    c.fillStyle = 'rgba(0,0,0,0.45)'
    c.fillRect(8, 8, c.measureText(this.label).width + 16, 20)
    c.fillStyle = '#fff'
    c.font = 'bold 12px sans-serif'
    c.fillText(this.label, 16, 22)
    this.screen.needsUpdate = true
  }

  private lastDraw = 0
  protected tick(dt: number, now: number) {
    this.staticT = Math.max(0, this.staticT - dt / 350)
    if (now - this.lastDraw > 50) {
      this.lastDraw = now
      this.drawChannel(now)
      const col = [new Color('#5fb8e8'), new Color('#7fb85a'), new Color('#c060ff'), new Color('#ffd0a0'), new Color('#ffb070'), new Color('#4fcf5a')][this.channel]
      this.glow.color.copy(col)
      this.glow.intensity = 1.2 + Math.sin(now / 300) * 0.2
    }
    for (const f of this.flying) {
      f.t = Math.min(1, f.t + dt / 450)
      f.m.position.lerpVectors(f.from, this.camera.position.clone().add(new Vector3(0, -0.15, 0)), f.t)
      f.m.position.y += Math.sin(f.t * Math.PI) * 0.2
      if (f.t >= 1) this.scene.remove(f.m)
    }
    this.flying = this.flying.filter((f) => f.t < 1)
  }
}
