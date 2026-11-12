// Glue between the pure sim, the Room (network) and Babylon (rendering + input).
import { Matrix, Vector3, type PointerInfo, PointerEventTypes } from '@babylonjs/core'
import type { CharacterLook } from './character/look'
import { sampleClip } from './character/poses'
import { createScene, type SceneBundle } from './engine/createScene'
import { buildApartment, type Apartment } from './engine/apartment'
import { CHIBI_TOP, Chibi } from './engine/chibi'
import { addBirthdayDecor } from './engine/decor'
import { classifyGesture, type PointerSample } from './input/gesture'
import { cleanChat, type PresenceState } from './net/protocol'
import type { Room } from './net/room'
import { createSim, step, type Avatar, type HudEvent, type Identity, type SimEvent, type SimState } from './sim/sim'
import type { FurnitureAction, FurnitureId } from './world/layout'
import type { EmoteKind, InteractionKind, UserId } from './types'

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export class GameController {
  private canvas: HTMLCanvasElement
  private room: Room
  private meStart: PresenceState
  private partnerHint: Identity | null
  private bundle: SceneBundle | null = null
  private apt: Apartment | null = null
  private sim: SimState
  private chibis = new Map<UserId, { chibi: Chibi; lookKey: string; expr: string }>()
  private hudListeners = new Set<(e: HudEvent) => void>()
  private unsubs: (() => void)[] = []
  private lastPresenceKey = ''
  private lastFrame = 0
  private down: PointerSample | null = null
  private maxPointers = 0
  private activePointers = new Set<number>()
  private lite: boolean
  private disposed = false

  private birthdayName: string | null

  constructor(canvas: HTMLCanvasElement, room: Room, me: PresenceState, partnerHint: Identity | null, opts: { lite?: boolean; birthdayName?: string | null } = {}) {
    this.canvas = canvas
    this.room = room
    this.meStart = me
    this.partnerHint = partnerHint
    this.lite = !!opts.lite
    this.birthdayName = opts.birthdayName ?? null
    this.sim = createSim({ userId: me.userId, name: me.name, role: me.role, look: me.look }, me.pos, partnerHint)
  }

  async start(): Promise<void> {
    const bundle = createScene(this.canvas, { lite: this.lite })
    this.bundle = bundle
    this.apt = await buildApartment(bundle.scene, bundle.shadows)
    if (this.disposed) return
    if (this.birthdayName) addBirthdayDecor(bundle.scene, this.birthdayName)
    this.unsubs.push(this.room.onMessage((msg) => this.dispatch({ type: 'net', msg })))
    this.unsubs.push(this.room.onPresence((others) => this.dispatch({ type: 'presence', others })))
    // Show the home right away; connecting happens alongside (and retries on bad 4G).
    bundle.scene.onPointerObservable.add((info) => this.onPointer(info))
    this.lastFrame = Date.now()
    bundle.engine.runRenderLoop(() => this.frame())
    const onResize = () => bundle.engine.resize()
    window.addEventListener('resize', onResize)
    this.unsubs.push(() => window.removeEventListener('resize', onResize))
    void this.connect()

    // Closing the tab or swiping the app away: tell the partner straight away.
    const onPageHide = () => void this.room.leave()
    const onPageShow = (e: PageTransitionEvent) => e.persisted && void this.connect()
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    this.unsubs.push(() => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    })

    // iPhone: locking the phone or switching apps suspends the page. Stop rendering and
    // reconnect on return so we reappear for each other without a reload.
    const onVisibility = () => {
      if (document.hidden) {
        bundle.engine.stopRenderLoop()
        this.room.pause()
      } else {
        void this.room.resume()
        this.lastFrame = Date.now()
        bundle.engine.stopRenderLoop()
        bundle.engine.runRenderLoop(() => this.frame())
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    this.unsubs.push(() => document.removeEventListener('visibilitychange', onVisibility))

    // iOS can drop the WebGL context under memory pressure; Babylon rebuilds it, we redraw faces.
    bundle.engine.onContextLostObservable.add(() => this.emitHud({ type: 'toast', text: 'Reconnecting…' }))
    bundle.engine.onContextRestoredObservable.add(() => {
      for (const entry of this.chibis.values()) entry.expr = ''
    })
  }

  private async connect() {
    while (!this.disposed) {
      try {
        await this.room.join({ ...this.meStart, ...this.presenceNow() })
        if (this.disposed) void this.room.leave()
        return
      } catch {
        if (this.disposed) return
        this.emitHud({ type: 'toast', text: 'Can’t reach our home… retrying 💗' })
        await new Promise((r) => setTimeout(r, 5000))
      }
    }
  }

  private presenceNow(): Partial<PresenceState> {
    const me = this.sim.me
    return { pos: me.pos, facing: me.facing, activity: me.activity, look: me.look, furniture: me.furniture }
  }

  onHud(cb: (e: HudEvent) => void): () => void {
    this.hudListeners.add(cb)
    return () => void this.hudListeners.delete(cb)
  }

  get state(): SimState {
    return this.sim
  }

  interact(kind: InteractionKind) {
    this.dispatch({ type: 'interact', kind, id: newId() })
  }

  acceptRequest(id: string) {
    this.dispatch({ type: 'accept', id })
  }

  useFurniture(id: FurnitureId, action: FurnitureAction) {
    this.dispatch({ type: 'use-furniture', id, action })
  }

  say(text: string): string | null {
    const clean = cleanChat(text)
    if (clean) this.dispatch({ type: 'say', text: clean, id: newId() })
    return clean
  }

  emote(e: EmoteKind) {
    this.dispatch({ type: 'emote', emote: e })
  }

  setMyLook(look: CharacterLook) {
    this.dispatch({ type: 'look', look })
    // A happy little hop so each pick feels alive (at most once a second).
    const now = Date.now()
    if (now - this.lastHop > 1000) {
      this.lastHop = now
      this.dispatch({ type: 'emote', emote: 'happy' })
    }
  }

  private camGoal: { radius: number; beta: number; y: number; offsetY: number; alpha?: number; release?: boolean } | null = null
  private savedCam: { radius: number; beta: number; alpha: number } | null = null
  private lastHop = 0

  /** Wardrobe close-up: zoom onto my character, who turns to face the camera. */
  focusOnMe(on: boolean) {
    const cam = this.bundle?.camera
    if (!cam) return
    if (on) {
      this.savedCam = { radius: cam.radius, beta: cam.beta, alpha: cam.alpha }
      cam.lowerRadiusLimit = 1.2
      cam.upperBetaLimit = 1.5
      // Character faces the camera: camera sits at angle alpha around the target.
      const toCam = Math.atan2(Math.cos(cam.alpha), Math.sin(cam.alpha))
      this.dispatch({ type: 'face', facing: toCam })
      this.camGoal = { radius: 1.9, beta: 1.36, y: 0.55, offsetY: -0.45 }
    } else {
      const s = this.savedCam ?? { radius: 8, beta: 0.95, alpha: cam.alpha }
      this.camGoal = { radius: s.radius, beta: s.beta, y: 0.6, offsetY: 0, release: true }
    }
  }

  /** CSS-pixel position just above a character's head, for speech bubbles and wheels. */
  screenPosOf(userId: UserId): { x: number; y: number } | null {
    const entry = this.chibis.get(userId)
    const b = this.bundle
    if (!entry || !b) return null
    const world = entry.chibi.root.position.add(CHIBI_TOP)
    const w = b.engine.getRenderWidth(), h = b.engine.getRenderHeight()
    const p = Vector3.Project(world, Matrix.Identity(), b.scene.getTransformMatrix(), b.camera.viewport.toGlobal(w, h))
    if (p.z < 0 || p.z > 1) return null
    const sx = this.canvas.clientWidth / w, sy = this.canvas.clientHeight / h
    return { x: p.x * sx, y: p.y * sy }
  }

  dispose() {
    this.disposed = true
    for (const u of this.unsubs) u()
    void this.room.leave()
    for (const { chibi } of this.chibis.values()) chibi.dispose()
    this.bundle?.engine.dispose()
  }

  private dispatch(e: SimEvent) {
    this.sim = step(this.sim, e, Date.now())
    this.flush()
  }

  private flush() {
    const { outbox, hud } = this.sim
    if (outbox.length || hud.length) this.sim = { ...this.sim, outbox: [], hud: [] }
    for (const m of outbox) this.room.send(m)
    for (const h of hud) for (const cb of this.hudListeners) cb(h)
    const me = this.sim.me
    const presence: Partial<PresenceState> = { pos: me.pos, facing: me.facing, activity: me.activity, look: me.look, furniture: me.furniture }
    const key = JSON.stringify(presence)
    if (key !== this.lastPresenceKey) {
      this.lastPresenceKey = key
      this.room.updatePresence(presence)
    }
  }

  private frame() {
    const b = this.bundle!
    const now = Date.now()
    const dt = Math.min(100, now - this.lastFrame)
    this.lastFrame = now
    this.dispatch({ type: 'tick', dt })
    this.render(this.sim.me, now)
    if (this.sim.partner) this.render(this.sim.partner, now)
    const me = this.sim.me
    const cam = b.camera
    const target = cam.target
    const k = Math.min(1, dt / 250)
    target.x += (me.pos.x - target.x) * k
    target.z += (me.pos.z - target.z) * k
    // Ease the camera toward the wardrobe close-up (or back to the saved view).
    const goal = this.camGoal
    if (goal) {
      const e = Math.min(1, dt / 220)
      cam.radius += (goal.radius - cam.radius) * e
      cam.beta += (goal.beta - cam.beta) * e
      target.y += (goal.y - target.y) * e
      cam.targetScreenOffset.y += (goal.offsetY - cam.targetScreenOffset.y) * e
      if (goal.alpha !== undefined) cam.alpha += (goal.alpha - cam.alpha) * e
      if (goal.release && Math.abs(goal.radius - cam.radius) < 0.02) {
        cam.lowerRadiusLimit = 4
        cam.upperBetaLimit = 1.2
        this.camGoal = null
      }
    }
    this.apt?.updateCutaway({ x: cam.position.x, z: cam.position.z }, me.pos)
    b.scene.render()
  }

  private render(a: Avatar, now: number) {
    const b = this.bundle!
    let entry = this.chibis.get(a.userId)
    const lookKey = JSON.stringify(a.look)
    if (!entry) {
      const chibi = new Chibi(b.scene, a.look, b.shadows)
      chibi.setUserId(a.userId)
      entry = { chibi, lookKey, expr: '' }
      this.chibis.set(a.userId, entry)
    } else if (entry.lookKey !== lookKey) {
      entry.chibi.setLook(a.look)
      entry.lookKey = lookKey
    }
    // On the mattress when asleep, on the cushion when sitting.
    const y = a.activity === 'sleeping' ? 0.5 : a.activity === 'sitting' ? (a.furniture === 'sofa' ? 0.22 : 0.2) : 0
    entry.chibi.setPosition(a.pos, a.facing, y)
    entry.chibi.setPose(sampleClip(a.clip, now - a.clipStart))
    const expr = a.activity === 'sleeping' ? 'sleepy' : a.expression
    if (expr !== entry.expr) {
      entry.chibi.setExpression(expr)
      entry.expr = expr
    }
  }

  private onPointer(info: PointerInfo) {
    const ev = info.event as PointerEvent
    if (info.type === PointerEventTypes.POINTERDOWN) {
      this.activePointers.add(ev.pointerId)
      if (this.activePointers.size === 1) {
        this.down = { x: ev.clientX, y: ev.clientY, t: performance.now() }
        this.maxPointers = 1
      } else this.maxPointers = Math.max(this.maxPointers, this.activePointers.size)
    } else if (info.type === PointerEventTypes.POINTERUP) {
      this.activePointers.delete(ev.pointerId)
      const down = this.down
      if (!down || this.activePointers.size) return
      this.down = null
      const kind = classifyGesture(down, { x: ev.clientX, y: ev.clientY, t: performance.now() }, this.maxPointers)
      if (kind === 'tap') this.onTap(ev)
    }
  }

  private onTap(ev: PointerEvent) {
    const b = this.bundle!
    const rect = this.canvas.getBoundingClientRect()
    // scene.pick takes CSS pixels; Babylon applies the hardware scaling (retina) itself.
    const pick = b.scene.pick(ev.clientX - rect.left, ev.clientY - rect.top, (m) => m.isPickable && !!m.metadata?.kind)
    const meta = pick?.pickedMesh?.metadata as { kind?: string; id?: FurnitureId; userId?: UserId } | undefined
    if (!pick?.hit || !meta) return
    const screen = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
    if (meta.kind === 'floor' && pick.pickedPoint) this.dispatch({ type: 'tap-floor', point: { x: pick.pickedPoint.x, z: pick.pickedPoint.z } })
    else if (meta.kind === 'character' && meta.userId && meta.userId !== this.sim.me.userId) this.dispatch({ type: 'tap-partner', screen })
    else if (meta.kind === 'furniture' && meta.id) this.emitHud({ type: 'wheel-furniture', id: meta.id, screen })
  }

  private emitHud(e: HudEvent) {
    for (const cb of this.hudListeners) cb(e)
  }
}
