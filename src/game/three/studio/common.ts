// Shared plumbing for the close-up activity sets: camera framing, finger gestures → mini-game
// inputs, lights, canvas textures and little synthesized sound effects.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, NormalBlending, Points, PointsMaterial,
  CanvasTexture, Color, DirectionalLight, HemisphereLight, MathUtils, Mesh, type Object3D, PerspectiveCamera, PointLight,
  Raycaster, RepeatWrapping, Scene, SRGBColorSpace, type Texture, TextureLoader, Vector2, Vector3,
} from 'three'
import type { GameState, Input, Step } from '../../play/minigame'
import { stepsOf } from '../../play/minigame'

export type Pt = { x: number; y: number; t: number }

export interface Studio {
  scene: Scene
  camera: PerspectiveCamera
  onInput: (i: Input) => void
  /** Timing steps: 0..1 how ready it is (e.g. pancake browning), for the HUD bar. */
  readonly timing: number
  sync(g: GameState): void
  pointer(kind: 'down' | 'move' | 'up', clientX: number, clientY: number): void
  resize(w: number, h: number): void
  update(dt: number, now: number): void
  dispose(): void
}

const texLoader = new TextureLoader()
const texCache = new Map<string, Texture>()
export function tex(name: string, repeat = 1, color = false): Texture {
  const key = `${name}:${repeat}`
  let t = texCache.get(key)
  if (!t) {
    t = texLoader.load(`/assets/tex/${name}.jpg`)
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(repeat, repeat)
    if (color) t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    texCache.set(key, t)
  }
  return t
}

export function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Seeded random so sets look the same every time. */
export function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

/** Warm kitchen-style lighting with a soft shadowed key light. */
export function addLights(scene: Scene, opts: { key?: string; intensity?: number; dim?: boolean } = {}) {
  const key = new DirectionalLight(opts.key ?? '#fff1df', opts.intensity ?? 2.2)
  key.position.set(-1.2, 3, 1.6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 8 })
  key.shadow.bias = -0.0003
  key.shadow.normalBias = 0.01
  key.shadow.radius = 4
  scene.add(key, key.target)
  const hemi = new HemisphereLight('#fff6ee', '#5a4a44', opts.dim ? 0.15 : 0.55)
  scene.add(hemi)
  const fill = new PointLight('#ffd9b8', opts.dim ? 0.4 : 1.2, 6, 2)
  fill.position.set(1.5, 2, 2)
  scene.add(fill)
  return { key, hemi, fill }
}

/** Little synthesized sound effects (no files): chop, crack, sizzle, splash, pop, squeak, ding. */
class Sfx {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  private loops = new Map<string, { gain: GainNode; src: AudioBufferSourceNode }>()
  muted = false

  private ac(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate)
      const d = b.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      this.noise = b
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** Call from a pointer event so iOS lets sound play. */
  unlock() {
    this.ac()
  }

  private burst(freq: number, q: number, dur: number, vol: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ac()
    if (!ctx || !this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    const t = ctx.currentTime
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(f).connect(g).connect(ctx.destination)
    src.start(t, Math.random())
    src.stop(t + dur + 0.05)
  }

  private tone(freq: number, to: number, dur: number, vol: number, type: OscillatorType = 'sine') {
    const ctx = this.ac()
    if (!ctx) return
    const o = ctx.createOscillator()
    o.type = type
    const g = ctx.createGain()
    const t = ctx.currentTime
    o.frequency.setValueAtTime(freq, t)
    o.frequency.exponentialRampToValueAtTime(to, t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  chop() { this.burst(1800, 1.2, 0.09, 0.5); this.tone(180, 90, 0.08, 0.35) }
  crack() { this.burst(3200, 2, 0.06, 0.6); this.burst(1400, 3, 0.05, 0.4) }
  tap() { this.tone(900, 600, 0.06, 0.15, 'triangle') }
  pop() { this.tone(500 + Math.random() * 400, 1400, 0.07, 0.2) }
  shake() { this.burst(5200, 0.8, 0.12, 0.25, 'highpass') }
  plop() { this.tone(260, 120, 0.15, 0.35); this.burst(900, 1, 0.12, 0.2) }
  squeak() { this.tone(1300, 1900, 0.12, 0.2, 'square'); setTimeout(() => this.tone(1900, 1200, 0.1, 0.15, 'square'), 110) }
  ding() { this.tone(1320, 1318, 0.6, 0.18); setTimeout(() => this.tone(1760, 1758, 0.7, 0.15), 120) }
  miss() { this.tone(220, 150, 0.18, 0.2, 'sawtooth') }

  /** Continuous sound (sizzle, running water) at a level 0..1. */
  loop(name: 'sizzle' | 'water', level: number) {
    let l = this.loops.get(name)
    if (!l && level <= 0.01) return
    const ctx = this.ac()
    if (!ctx || !this.noise) return
    if (!l) {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = name === 'sizzle' ? 'highpass' : 'bandpass'
      f.frequency.value = name === 'sizzle' ? 3500 : 700
      f.Q.value = name === 'sizzle' ? 0.7 : 0.6
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(f).connect(gain).connect(ctx.destination)
      src.start()
      l = { gain, src }
      this.loops.set(name, l)
    }
    l.gain.gain.setTargetAtTime(level * (name === 'sizzle' ? 0.22 : 0.3), ctx.currentTime, 0.08)
  }

  stopAll() {
    for (const l of this.loops.values()) {
      try { l.src.stop() } catch { /* already stopped */ }
    }
    this.loops.clear()
  }
}
export const sfx = new Sfx()

type CamPose = { pos: Vector3; look: Vector3 }

/**
 * A close-up set. Subclasses build the 3D scene, pick what each step looks like in `enterStep`,
 * draw progress in `tick`, and answer a few hit-test hooks; gestures are turned into inputs here.
 */
export abstract class BaseStudio implements Studio {
  scene = new Scene()
  camera = new PerspectiveCamera(50, 1, 0.02, 40)
  onInput: (i: Input) => void = () => {}
  protected game: GameState | null = null
  protected step: Step | null = null
  protected stepIndex = -1
  protected size = { w: 1, h: 1 }
  protected ray = new Raycaster()
  private cam: CamPose = { pos: new Vector3(0, 1.6, 1), look: new Vector3(0, 0.9, 0) }
  private camGoal: CamPose | null = null
  private framing: { focus: Vector3; width: number; pitch: number; yaw: number; height: number } | null = null
  private start: Pt | null = null
  private last: Pt | null = null
  private holding = false
  private angle: number | null = null
  private shake = { dir: 0, travel: 0 }
  private sway = 0

  constructor(env: Texture | null) {
    this.scene.environment = env
    this.scene.environmentIntensity = 0.6
    this.scene.background = new Color('#2a1d24')
  }

  get timing() {
    return 0
  }

  /** Point the camera at `focus` so `width` metres fit across the screen, looking down at `pitch` radians. */
  protected frame(focus: Vector3, width: number, pitch = 0.95, yaw = 0, instant = false, height = 0) {
    this.framing = { focus: focus.clone(), width, pitch, yaw, height }
    const pose = this.poseFor(this.framing)
    if (instant) {
      this.cam = pose
      this.camGoal = null
    } else this.camGoal = pose
  }

  /** Put the eye exactly at `pos` looking at `look` (first-person views like lying in the bath). */
  protected place(pos: Vector3, look: Vector3, instant = false) {
    this.framing = null
    const pose = { pos: pos.clone(), look: look.clone() }
    if (instant) {
      this.cam = pose
      this.camGoal = null
    } else this.camGoal = pose
  }

  private poseFor(f: { focus: Vector3; width: number; pitch: number; yaw: number; height: number }): CamPose {
    const vfov = MathUtils.degToRad(this.camera.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect)
    const dist = Math.max((f.width / 2) / Math.tan(hfov / 2), (f.height / 2) / Math.tan(vfov / 2), 0.15)
    const dir = new Vector3(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch))
    return { pos: f.focus.clone().addScaledVector(dir, dist), look: f.focus.clone() }
  }

  sync(g: GameState) {
    const prev = this.game
    this.game = g
    const steps = stepsOf(g)
    if (!steps.length) return
    const i = Math.min(g.step, steps.length - 1)
    // Show the effect of the input first (the last chop, the egg dropping in) while `step` is still
    // the step it was played on, then move on.
    if (prev && this.step && prev.dish === g.dish) this.onState(g, prev)
    if (g.step !== this.stepIndex) {
      const finished = g.step >= steps.length
      this.stepIndex = g.step
      this.step = steps[i]
      this.holding = false
      if (finished) this.onFinish()
      else this.enterStep(steps[i], i, prev)
    }
  }

  /** New step: move the camera and bring out the right tools. */
  protected abstract enterStep(step: Step, index: number, prev: GameState | null): void
  /**
   * Every state change (progress, gauge, misses, taps), called before moving to a new step, so
   * `this.step` is the step the input was made on and `g.step !== prev.step` means it just finished.
   */
  protected onState(_g: GameState, _prev: GameState | null) {}
  /** All steps done: show off the result. */
  protected onFinish() {}
  /** Per-frame animation. */
  protected abstract tick(dt: number, now: number): void

  // ── Hit-test hooks ──
  protected tapTargets(): Object3D[] {
    return []
  }
  protected circleCenter(): Vector3 {
    return this.cam.look
  }
  protected scrubSurface(): Mesh | null {
    return null
  }
  /** Count steps: which gesture plays them. */
  protected gesture(): 'tap' | 'chop' | 'shake' | 'swipe' {
    return 'tap'
  }
  protected onTap(_hit: Object3D | null, _ndc: Vector2) {
    return false
  }
  protected onChop(_start: Vector2, _end: Vector2): boolean {
    return true
  }
  protected onSwipe(_start: Vector2, _end: Vector2): boolean {
    return true
  }
  protected onDrag(_ndc: Vector2, _down: boolean) {}
  protected onScrubAt(_point: Vector3 | null) {}
  protected timingOk(): boolean {
    return false
  }

  // ── Gestures ──
  protected ndc(p: { x: number; y: number }) {
    return new Vector2((p.x / this.size.w) * 2 - 1, -(p.y / this.size.h) * 2 + 1)
  }

  protected pick(p: { x: number; y: number }, objects: Object3D[]) {
    this.ray.setFromCamera(this.ndc(p), this.camera)
    return this.ray.intersectObjects(objects, true)[0] ?? null
  }

  /** Like pick, but a fingertip near a small thing (within `px`) still counts. */
  protected pickNear(p: { x: number; y: number }, objects: Object3D[], px = 44): { object: Object3D } | null {
    const hit = this.pick(p, objects)
    if (hit) return hit
    let best: Object3D | null = null, bestD = px
    for (const o of objects) {
      const s = this.screenOf(o.getWorldPosition(new Vector3()))
      const d = Math.hypot(s.x - p.x, s.y - p.y)
      if (d < bestD) {
        bestD = d
        best = o
      }
    }
    return best ? { object: best } : null
  }

  protected screenOf(v: Vector3) {
    const p = v.clone().project(this.camera)
    return { x: (p.x + 1) / 2 * this.size.w, y: (1 - p.y) / 2 * this.size.h }
  }

  private emit(i: Input) {
    this.onInput(i)
  }

  pointer(kind: 'down' | 'move' | 'up', x: number, y: number) {
    const p: Pt = { x, y, t: performance.now() }
    const step = this.step
    if (kind === 'down') {
      sfx.unlock()
      this.start = p
      this.last = p
      this.shake = { dir: 0, travel: 0 }
      const c = this.screenOf(this.circleCenter())
      this.angle = Math.atan2(y - c.y, x - c.x)
    }
    if (!step) return
    const down = kind !== 'up' && !!this.start
    this.onDrag(this.ndc(p), down)

    switch (step.mechanic) {
      case 'gauge':
        if (kind === 'down') this.holding = true
        if (kind === 'up' && this.holding) {
          this.holding = false
          this.emit({ type: 'release' })
        }
        break
      case 'circle':
        if (kind === 'move' && this.angle !== null && this.start) {
          const c = this.screenOf(this.circleCenter())
          const a = Math.atan2(y - c.y, x - c.x)
          let d = a - this.angle
          if (d > Math.PI) d -= Math.PI * 2
          if (d < -Math.PI) d += Math.PI * 2
          this.angle = a
          if (d > 0 && Math.hypot(x - c.x, y - c.y) > 12) this.emit({ type: 'circle', radians: Math.min(d, 0.6) })
          this.sway = d
        }
        break
      case 'scrub':
        if (down) {
          const surf = this.scrubSurface()
          const hit = surf && this.pick(p, [surf])
          this.onScrubAt(hit ? hit.point : null)
          if (hit?.uv) this.emit({ type: 'scrub', x: hit.uv.x, y: 1 - hit.uv.y })
        } else this.onScrubAt(null)
        break
      case 'count':
        if (this.gesture() === 'shake' && kind === 'move' && this.last) {
          const dy = y - this.last.y
          const dir = Math.sign(dy)
          if (dir !== 0 && dir !== this.shake.dir) {
            if (this.shake.travel > 38) this.emit({ type: 'hit' })
            this.shake = { dir, travel: 0 }
          }
          this.shake.travel += Math.abs(dy)
        }
        break
    }

    if (kind === 'up' && this.start) {
      const s = this.start
      const dx = x - s.x, dy = y - s.y
      const tap = Math.hypot(dx, dy) < 16 && p.t - s.t < 500
      const sN = this.ndc(s), eN = this.ndc(p)
      if (step.mechanic === 'count') {
        const g = this.gesture()
        if (g === 'tap' && tap) {
          const hit = this.pickNear(p, this.tapTargets())
          if (!this.onTap(hit?.object ?? null, eN)) this.emit(hit ? { type: 'hit' } : { type: 'miss' })
        } else if (g === 'chop' && dy > 45 && Math.abs(dx) < dy * 0.8) {
          this.emit(this.onChop(sN, eN) ? { type: 'hit' } : { type: 'miss' })
        } else if (g === 'swipe' && Math.abs(dx) > 70) {
          if (this.onSwipe(sN, eN)) this.emit({ type: 'hit' })
        }
      } else if (step.mechanic === 'timing' && dy < -50) {
        this.emit({ type: 'swipe', inWindow: this.timingOk() })
      } else if (step.mechanic === 'relax') {
        if (tap) {
          const hit = this.pickNear(p, this.tapTargets())
          if (this.onTap(hit?.object ?? null, eN)) this.emit({ type: 'hit' })
        } else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) this.emit({ type: 'swipe' })
      }
      this.start = null
      this.angle = null
    }
    this.last = p
  }

  /** Whether the finger is held down on a gauge step. */
  protected get isHolding() {
    return this.holding
  }
  /** Signed angle (radians) of the last circle gesture move, for tools that follow the finger. */
  protected get stirSway() {
    return this.sway
  }

  resize(w: number, h: number) {
    this.size = { w, h }
    this.camera.aspect = w / h
    this.camera.fov = this.camera.aspect < 1 ? 52 : 40
    this.camera.updateProjectionMatrix()
    if (this.framing) {
      this.cam = this.poseFor(this.framing)
      this.camGoal = null
    }
  }

  update(dt: number, now: number) {
    if (this.holding) this.emit({ type: 'hold', dt })
    if (this.camGoal) {
      const e = 1 - Math.exp(-dt / 220)
      this.cam.pos.lerp(this.camGoal.pos, e)
      this.cam.look.lerp(this.camGoal.look, e)
      if (this.cam.pos.distanceTo(this.camGoal.pos) < 0.001) this.camGoal = null
    }
    this.sway *= 0.9
    // A tiny breathing drift keeps the close-up from feeling frozen.
    const b = Math.sin(now / 1400) * 0.003
    this.camera.position.set(this.cam.pos.x + b, this.cam.pos.y + b * 0.5, this.cam.pos.z)
    this.camera.lookAt(this.cam.look)
    this.tick(dt, now)
  }

  dispose() {
    sfx.stopAll()
    this.scene.traverse((o) => {
      const m = o as Mesh
      m.geometry?.dispose()
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v && typeof v === 'object' && 'isTexture' in v && !texCacheHas(v as Texture)) (v as Texture).dispose()
        mat.dispose()
      }
    })
  }
}

const texCacheHas = (t: Texture) => [...texCache.values()].includes(t)

/** Soft round sprite for particles. */
export const softDot = (inner = 'rgba(255,255,255,1)') =>
  canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, inner)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
  })

/** A small pool of particles: steam, smoke, water drops, foam, salt. */
export class Particles {
  points: Points
  private pos: Float32Array
  private vel: Float32Array
  private life: Float32Array
  private next = 0
  private opts: { gravity: number; lifeMs: number }

  constructor(private n: number, opts: { color: string; size: number; opacity?: number; gravity?: number; lifeMs?: number; additive?: boolean }) {
    const geo = new BufferGeometry()
    this.pos = new Float32Array(n * 3).fill(-99)
    this.vel = new Float32Array(n * 3)
    this.life = new Float32Array(n).fill(1)
    geo.setAttribute('position', new BufferAttribute(this.pos, 3))
    this.points = new Points(geo, new PointsMaterial({ color: opts.color, size: opts.size, map: softDot(), transparent: true, opacity: opts.opacity ?? 0.8, depthWrite: false, blending: opts.additive ? AdditiveBlending : NormalBlending }))
    this.points.frustumCulled = false
    this.opts = { gravity: opts.gravity ?? 0, lifeMs: opts.lifeMs ?? 1200 }
  }

  emit(at: Vector3, vel: Vector3, spread = 0.01, count = 1) {
    for (let k = 0; k < count; k++) {
      const i = this.next
      this.next = (this.next + 1) % this.n
      this.pos.set([at.x + (Math.random() - 0.5) * spread, at.y + (Math.random() - 0.5) * spread, at.z + (Math.random() - 0.5) * spread], i * 3)
      this.vel.set([vel.x * (0.7 + Math.random() * 0.6), vel.y * (0.7 + Math.random() * 0.6), vel.z * (0.7 + Math.random() * 0.6)], i * 3)
      this.life[i] = 0
    }
  }

  update(dt: number) {
    const s = dt / 1000
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] >= 1) continue
      this.life[i] += dt / this.opts.lifeMs
      if (this.life[i] >= 1) {
        this.pos[i * 3 + 1] = -99
        continue
      }
      this.vel[i * 3 + 1] -= this.opts.gravity * s
      this.pos[i * 3] += this.vel[i * 3] * s
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * s
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * s
    }
    this.points.geometry.attributes.position.needsUpdate = true
  }
}

/** Redrawable "dirt" texture: a base drawing with blotches at the scrub targets that vanish when cleared. */
export function dirtTexture(base: (c: CanvasRenderingContext2D) => void, spot: string, targets: { x: number; y: number }[], size = 0.09) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  const r = rng(targets.length * 13 + 5)
  const blobs = targets.map(() => Array.from({ length: 7 }, () => ({ dx: (r() - 0.5) * size * 256, dy: (r() - 0.5) * size * 256, s: (0.25 + r() * 0.45) * size * 256, a: r() * 3 })))
  const draw = (cleared: boolean[]) => {
    base(ctx)
    targets.forEach((p, i) => {
      if (cleared[i]) return
      ctx.fillStyle = spot
      for (const b of blobs[i]) {
        ctx.beginPath()
        ctx.ellipse(p.x * 256 + b.dx, p.y * 256 + b.dy, b.s, b.s * 0.65, b.a, 0, Math.PI * 2)
        ctx.fill()
      }
    })
    t.needsUpdate = true
  }
  draw([])
  return { texture: t, draw }
}

/** Ease toward a target, frame-rate independent. */
export const approach = (v: number, target: number, dt: number, ms = 200) => v + (target - v) * (1 - Math.exp(-dt / ms))
