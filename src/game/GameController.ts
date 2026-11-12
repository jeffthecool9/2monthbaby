// Glue between the pure sim, the Room (network) and three.js (rendering + input).
import { Raycaster, Spherical, Vector2, Vector3, type Object3D } from 'three'
import type { CharacterLook } from './character/look'
import { sampleClip } from './character/poses'
import { createStage, type Stage } from './three/stage'
import { buildApartment, type Apartment } from './three/apartment'
import { buildCity, type City } from './three/city'
import { Avatar, PLACEHOLDER_AVATAR } from './three/avatar'
import { addBirthdayDecor } from './three/decor'
import { classifyGesture, type PointerSample } from './input/gesture'
import { cleanChat, type PresenceState } from './net/protocol'
import type { Room } from './net/room'
import { createSim, step, type Avatar as SimAvatar, type HudEvent, type Identity, type SimEvent, type SimState } from './sim/sim'
import type { FurnitureAction, FurnitureId } from './world/layout'
import type { EmoteKind, InteractionKind, UserId } from './types'

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export type GameOptions = {
  lite?: boolean
  birthdayName?: string | null
  /** VRoid (.vrm) URL per user; falls back to the bundled placeholders. */
  avatarUrls?: Partial<Record<UserId, string>>
}

type CamGoal = { radius: number; phi: number; y: number; offsetY: number; release?: boolean }

export class GameController {
  private canvas: HTMLCanvasElement
  private room: Room
  private meStart: PresenceState
  private opts: GameOptions
  private stage: Stage | null = null
  private apt: Apartment | null = null
  private city: City | null = null
  private birthday: ReturnType<typeof addBirthdayDecor> | null = null
  private sim: SimState
  private avatars = new Map<UserId, { avatar: Avatar; expr: string }>()
  private hudListeners = new Set<(e: HudEvent) => void>()
  private unsubs: (() => void)[] = []
  private lastPresenceKey = ''
  private lastFrame = 0
  private down: PointerSample | null = null
  private maxPointers = 0
  private activePointers = new Set<number>()
  private disposed = false
  private raycaster = new Raycaster()
  private camGoal: CamGoal | null = null
  private savedCam: { radius: number; phi: number } | null = null
  private lastHop = 0

  constructor(canvas: HTMLCanvasElement, room: Room, me: PresenceState, partnerHint: Identity | null, opts: GameOptions = {}) {
    this.canvas = canvas
    this.room = room
    this.meStart = me
    this.opts = opts
    this.sim = createSim({ userId: me.userId, name: me.name, role: me.role, look: me.look }, me.pos, partnerHint)
  }

  async start(): Promise<void> {
    const stage = createStage(this.canvas, { lite: this.opts.lite })
    this.stage = stage
    this.city = buildCity({ lite: this.opts.lite })
    stage.scene.add(this.city.root)
    this.apt = await buildApartment({ lite: this.opts.lite })
    if (this.disposed) return
    stage.scene.add(this.apt.root)
    if (this.opts.birthdayName) {
      this.birthday = addBirthdayDecor(this.opts.birthdayName)
      stage.scene.add(this.birthday.root)
    }
    this.unsubs.push(this.room.onMessage((msg) => this.dispatch({ type: 'net', msg })))
    this.unsubs.push(this.room.onPresence((others) => this.dispatch({ type: 'presence', others })))

    // Show the home right away; connecting happens alongside (and retries on bad 4G).
    const onDown = (e: PointerEvent) => this.onPointer('down', e)
    const onUp = (e: PointerEvent) => this.onPointer('up', e)
    this.canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    const onResize = () => stage.resize()
    window.addEventListener('resize', onResize)
    this.unsubs.push(() => {
      this.canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('resize', onResize)
    })
    this.lastFrame = Date.now()
    stage.renderer.setAnimationLoop(() => this.frame())
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
        stage.renderer.setAnimationLoop(null)
        this.room.pause()
      } else {
        void this.room.resume()
        this.lastFrame = Date.now()
        stage.renderer.setAnimationLoop(() => this.frame())
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    this.unsubs.push(() => document.removeEventListener('visibilitychange', onVisibility))

    // iOS can drop the WebGL context under memory pressure; three restores it on its own.
    const onLost = () => this.emitHud({ type: 'toast', text: 'Reconnecting…' })
    this.canvas.addEventListener('webglcontextlost', onLost)
    this.unsubs.push(() => this.canvas.removeEventListener('webglcontextlost', onLost))
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

  /** Swap a character's VRoid model (e.g. after uploading a new .vrm). */
  setAvatarUrl(userId: UserId, url: string) {
    this.opts.avatarUrls = { ...this.opts.avatarUrls, [userId]: url }
    void this.avatars.get(userId)?.avatar.load(url)
  }

  /** Wardrobe close-up: zoom onto my character, who turns to face the camera. */
  focusOnMe(on: boolean) {
    const stage = this.stage
    if (!stage) return
    const { camera, controls } = stage
    const sph = new Spherical().setFromVector3(camera.position.clone().sub(controls.target))
    if (on) {
      this.savedCam = { radius: sph.radius, phi: sph.phi }
      controls.minDistance = 1.2
      controls.maxPolarAngle = 1.55
      // Turn to face the camera: direction from me to the camera on the floor plane.
      const toCam = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z)
      this.dispatch({ type: 'face', facing: toCam })
      this.camGoal = { radius: 2.3, phi: 1.42, y: 1.0, offsetY: -0.22 }
    } else {
      const s = this.savedCam ?? { radius: 7, phi: 0.95 }
      this.camGoal = { radius: s.radius, phi: s.phi, y: 0.9, offsetY: 0, release: true }
    }
  }

  /** CSS-pixel position just above a character's head, for speech bubbles and wheels. */
  screenPosOf(userId: UserId): { x: number; y: number } | null {
    const entry = this.avatars.get(userId)
    const stage = this.stage
    if (!entry || !stage) return null
    const p = new Vector3(0, entry.avatar.headHeight, 0).add(entry.avatar.root.position).project(stage.camera)
    if (p.z < -1 || p.z > 1) return null
    return { x: ((p.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - p.y) / 2) * this.canvas.clientHeight }
  }

  dispose() {
    this.disposed = true
    for (const u of this.unsubs) u()
    void this.room.leave()
    for (const { avatar } of this.avatars.values()) avatar.dispose()
    this.stage?.renderer.setAnimationLoop(null)
    this.stage?.dispose()
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
    const presence = this.presenceNow()
    const key = JSON.stringify(presence)
    if (key !== this.lastPresenceKey) {
      this.lastPresenceKey = key
      this.room.updatePresence(presence)
    }
  }

  private frame() {
    const stage = this.stage!
    const now = Date.now()
    const dt = Math.min(100, now - this.lastFrame)
    this.lastFrame = now
    this.dispatch({ type: 'tick', dt })
    this.renderAvatar(this.sim.me, now, dt)
    if (this.sim.partner) this.renderAvatar(this.sim.partner, now, dt)

    const { camera, controls } = stage
    const me = this.sim.me
    const k = Math.min(1, dt / 250)
    // Follow me smoothly: move target and camera together so the orbit is kept.
    const dx = (me.pos.x - controls.target.x) * k, dz = (me.pos.z - controls.target.z) * k
    controls.target.x += dx
    controls.target.z += dz
    camera.position.x += dx
    camera.position.z += dz

    const goal = this.camGoal
    if (goal) {
      const e = Math.min(1, dt / 220)
      const offset = camera.position.clone().sub(controls.target)
      const sph = new Spherical().setFromVector3(offset)
      sph.radius += (goal.radius - sph.radius) * e
      sph.phi += (goal.phi - sph.phi) * e
      controls.target.y += (goal.y - controls.target.y) * e
      camera.position.copy(controls.target).add(new Vector3().setFromSpherical(sph))
      stage.screenOffset.y += (goal.offsetY - stage.screenOffset.y) * e
      if (goal.release && Math.abs(goal.radius - sph.radius) < 0.03) {
        controls.minDistance = 3
        controls.maxPolarAngle = 1.25
        stage.screenOffset.y = 0
        this.camGoal = null
      }
    }

    this.apt?.updateCutaway({ x: camera.position.x, z: camera.position.z }, me.pos)
    this.apt?.update(dt, now)
    this.city?.update(dt, now)
    this.birthday?.update(now)
    stage.render()
  }

  private renderAvatar(a: SimAvatar, now: number, dt: number) {
    const stage = this.stage!
    let entry = this.avatars.get(a.userId)
    if (!entry) {
      const url = this.opts.avatarUrls?.[a.userId] ?? PLACEHOLDER_AVATAR[a.role]
      const avatar = new Avatar(url)
      avatar.setUserId(a.userId)
      stage.scene.add(avatar.root)
      entry = { avatar, expr: '' }
      this.avatars.set(a.userId, entry)
    }
    // Seat height on the sofa/chairs, mattress height when asleep.
    const y = a.activity === 'sleeping' ? 0.48 : a.activity === 'sitting' ? -0.12 : 0
    entry.avatar.setPosition(a.pos, a.facing, y)
    // Dev-only: /home?local=1&pose=hug&t=1500 freezes everyone in a clip for checking animations.
    const preview = import.meta.env.DEV ? new URLSearchParams(location.search) : null
    const forced = preview?.get('pose') as Parameters<typeof sampleClip>[0] | null
    entry.avatar.setPose(forced ? sampleClip(forced, Number(preview!.get('t') ?? 750)) : sampleClip(a.clip, now - a.clipStart))
    const expr = a.activity === 'sleeping' ? 'sleepy' : a.clip === 'kiss' ? 'kiss' : a.expression
    if (expr !== entry.expr) {
      entry.avatar.setExpression(expr as never)
      entry.expr = expr
    }
    entry.avatar.update(dt)
  }

  private onPointer(kind: 'down' | 'up', ev: PointerEvent) {
    if (kind === 'down') {
      this.activePointers.add(ev.pointerId)
      if (this.activePointers.size === 1) {
        this.down = { x: ev.clientX, y: ev.clientY, t: performance.now() }
        this.maxPointers = 1
      } else this.maxPointers = Math.max(this.maxPointers, this.activePointers.size)
      return
    }
    if (!this.activePointers.delete(ev.pointerId)) return
    const down = this.down
    if (!down || this.activePointers.size) return
    this.down = null
    if (classifyGesture(down, { x: ev.clientX, y: ev.clientY, t: performance.now() }, this.maxPointers) === 'tap') this.onTap(ev)
  }

  private onTap(ev: PointerEvent) {
    const stage = this.stage!
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, stage.camera)
    const targets: Object3D[] = [...(this.apt ? [this.apt.root] : []), ...[...this.avatars.values()].map((e) => e.avatar.root)]
    const hit = this.raycaster.intersectObjects(targets, true).find((h) => h.object.visible && h.object.userData.kind)
    if (!hit) return
    const meta = hit.object.userData as { kind: string; id?: FurnitureId; userId?: UserId }
    const screen = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
    if (meta.kind === 'floor') this.dispatch({ type: 'tap-floor', point: { x: hit.point.x, z: hit.point.z } })
    else if (meta.kind === 'character' && meta.userId && meta.userId !== this.sim.me.userId) this.dispatch({ type: 'tap-partner', screen })
    else if (meta.kind === 'furniture' && meta.id) this.emitHud({ type: 'wheel-furniture', id: meta.id, screen })
  }

  private emitHud(e: HudEvent) {
    for (const cb of this.hudListeners) cb(e)
  }
}
