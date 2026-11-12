// Glue between the pure sim, the Room (network) and three.js (rendering + input).
import { Raycaster, Spherical, Vector2, Vector3, type Object3D } from 'three'
import type { CharacterLook } from './character/look'
import { blendPose, sampleClip, type Pose } from './character/poses'
import { createStage, type Stage } from './three/stage'
import { buildApartment, type Apartment } from './three/apartment'
import { buildCity, type City } from './three/city'
import { Avatar, PLACEHOLDER_AVATAR } from './three/avatar'
import { addBirthdayDecor } from './three/decor'
import { choreProps, type ChoreProps } from './three/props'
import { ACTIVITIES, type ActivityId } from './play/minigame'
import { MISSIONS } from './play/economy'
import { FURNITURE } from './world/layout'
import { CATALOG, applyDecor, canPlace, emptyDecor, nearestWall, type CatalogItem, type DecorChange, type DecorState } from './play/decor'
import { buildDecor, type DecorModel } from './three/decorModels'
import { Color, Group, Plane, MeshStandardMaterial, type Mesh } from 'three'
import { daylight, klClock } from './world/daylight'
import { classifyGesture, type PointerSample } from './input/gesture'
import { cleanChat, type GameId, type GameOp, type PresenceState } from './net/protocol'
import type { Room } from './net/room'
import { PAIR_RANGE, createSim, step, type Avatar as SimAvatar, type HudEvent, type Identity, type SimEvent, type SimState } from './sim/sim'
import type { FurnitureAction, FurnitureId } from './world/layout'
import type { ActionKind, EmoteKind, InteractionKind, UserId } from './types'

const BLEND_MS = 260

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export type GameOptions = {
  lite?: boolean
  birthdayName?: string | null
  /** Turns a stored avatar path into a loadable (signed) URL; without it, placeholders are used. */
  resolveAvatar?: (path: string) => Promise<string>
  /** Called with every decoration change I make, so it can be saved. */
  onDecor?: (change: DecorChange) => void
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
  private avatars = new Map<UserId, {
    avatar: Avatar
    expr: string
    path?: string
    shown?: { x: number; z: number; y: number; facing: number }
    clip?: string
    lastPose?: Pose
    blend?: { from: Pose; start: number }
  }>()
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
  private lastDaylight = 0
  /** Hands-on activity in progress (cooking, bath, TV…). */
  private fp: { activity: ActivityId; furniture: FurnitureId; mission?: string; yaw: number; pitch: number; progress: number } | null = null
  private props: ChoreProps | null = null
  /** True = watch my character in 3D instead of first person. */
  private watching = false
  private fpDrag: { x: number; y: number } | null = null
  private savedOffset: Vector3 | null = null
  /** Shared decoration: what's placed where, and the models for it. */
  private decor: DecorState = emptyDecor()
  private decorModels = new Map<string, DecorModel>()
  /** An item being placed or moved: a ghost that follows the finger. */
  private placing: { item: CatalogItem; uid: string; x: number; z: number; rot: number; ok: boolean; ghost: Group; existing: boolean; owner: string } | null = null
  private floorPlane = new Plane(new Vector3(0, 1, 0), 0)
  /** Decorate mode: tapping a placed item picks it up instead of walking. */
  decorateMode = false

  constructor(canvas: HTMLCanvasElement, room: Room, me: PresenceState, partnerHint: Identity | null, opts: GameOptions = {}) {
    this.canvas = canvas
    this.room = room
    this.meStart = me
    this.opts = opts
    this.sim = createSim({ userId: me.userId, name: me.name, role: me.role, look: me.look, avatar: me.avatar }, me.pos, partnerHint)
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
    return { pos: me.pos, facing: me.facing, activity: me.activity, look: me.look, furniture: me.furniture, avatar: me.avatar }
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

  /** Action wheel: together if my partner is close, otherwise on my own. */
  action(kind: ActionKind) {
    this.dispatch({ type: 'action', kind, id: newId() })
  }

  /** Start a daily chore (walks there, works, then pays). */
  mission(id: string) {
    this.dispatch({ type: 'mission', id })
  }

  /** Couple game messages (invites, moves) go straight to my partner. */
  sendGame(msg: { game: GameId; op: GameOp; id: string; value?: number }) {
    this.room.send({ t: 'game', from: this.sim.me.userId, at: Date.now(), ...msg })
  }

  toast(text: string) {
    this.emitHud({ type: 'toast', text })
  }

  /** Is my partner close enough for actions to become couple interactions? */
  partnerNear(): boolean {
    const p = this.sim.partner, me = this.sim.me
    return !!p?.online && Math.hypot(p.pos.x - me.pos.x, p.pos.z - me.pos.z) <= PAIR_RANGE
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

  /** After uploading a new .vrm: show it on me and tell my partner through presence. */
  setMyAvatar(path: string) {
    this.dispatch({ type: 'set-avatar', avatar: path })
  }

  private beginActivity(activity: ActivityId, furniture: FurnitureId, mission?: string) {
    this.endActivity()
    this.fp = { activity, furniture, mission, yaw: 0, pitch: 0, progress: 0 }
    const stage = this.stage
    if (stage) {
      this.props?.dispose()
      this.props = choreProps(activity)
      if (this.props) stage.scene.add(this.props.root)
    }
    this.setView(this.watching ? 'third' : 'first')
  }

  private endActivity() {
    if (!this.fp) return
    this.fp = null
    this.props?.dispose()
    this.props = null
    const stage = this.stage
    if (stage) {
      stage.controls.enabled = true
      stage.screenOffset.y = 0
      const me = this.avatars.get(this.sim.me.userId)
      if (me) me.avatar.root.visible = true
      // Back to exactly the view we had before.
      const p = this.sim.me.pos
      stage.controls.target.set(p.x, 0.9, p.z)
      stage.camera.position.copy(stage.controls.target).add(this.savedOffset ?? new Vector3(0, 5, -5))
      stage.controls.update()
      this.camGoal = null
      this.savedOffset = null
    }
  }

  /** First person = play it hands-on; third = watch my character do it. */
  setView(view: 'first' | 'third') {
    this.watching = view === 'third'
    const stage = this.stage
    if (!stage || !this.fp) return
    const me = this.avatars.get(this.sim.me.userId)
    if (!this.savedOffset) this.savedOffset = stage.camera.position.clone().sub(stage.controls.target)
    this.dispatch({ type: 'chore-mode', hands: view === 'first' })
    if (view === 'first') {
      stage.controls.enabled = false
      this.camGoal = null
      if (me) me.avatar.root.visible = false
    } else {
      // Third person: step back to a close view of my character at work.
      const p = this.sim.me.pos
      stage.controls.target.set(p.x, 0.9, p.z)
      const back = this.savedOffset.clone().setY(0).normalize().multiplyScalar(2.6)
      stage.camera.position.set(p.x + back.x, 2.2, p.z + back.z)
      stage.controls.enabled = true
      stage.controls.update()
      if (me) me.avatar.root.visible = true
    }
  }

  get activity() {
    return this.fp ? { activity: this.fp.activity, furniture: this.fp.furniture, mission: this.fp.mission, watching: this.watching } : null
  }

  /** The mini-game reports how far along it is, so the 3D props (food, plates…) keep up. */
  setActivityProgress(p: number) {
    if (this.fp) this.fp.progress = p
  }

  completeChore(stars: 1 | 2 | 3) {
    this.dispatch({ type: 'complete-chore', stars })
  }

  exitActivity() {
    this.dispatch({ type: 'exit-activity' })
  }

  /** Eye position and look target for the current activity, in world space. */
  private firstPersonPose(): { eye: Vector3; look: Vector3 } | null {
    const fp = this.fp
    if (!fp) return null
    const def = ACTIVITIES[fp.activity]
    const furn = FURNITURE.find((x) => x.id === fp.furniture)!
    const me = this.sim.me
    const toward = new Vector3(furn.pos.x - me.pos.x, 0, furn.pos.z - me.pos.z)
    const seated = me.activity === 'sitting' || me.activity === 'sleeping'
    const dir = seated ? new Vector3(Math.sin(furn.rotY), 0, Math.cos(furn.rotY)) : toward.lengthSq() > 1e-4 ? toward.normalize() : new Vector3(0, 0, 1)
    const eye = new Vector3(me.pos.x, 0, me.pos.z).add(dir.clone().multiplyScalar(def.eye[2])).add(new Vector3(0, def.eye[1], 0))
    let look: Vector3
    if (fp.activity === 'tv') {
      const tv = FURNITURE.find((x) => x.id === 'tv')!
      look = new Vector3(tv.pos.x, 1.0, tv.pos.z)
    } else if (seated) look = eye.clone().add(dir.multiplyScalar(4)).add(new Vector3(0, def.look[1] - def.eye[1], 0))
    else look = new Vector3(furn.pos.x, def.look[1], furn.pos.z)
    // Look around a little with a drag.
    const off = look.clone().sub(eye)
    const yawed = new Vector3(off.x * Math.cos(fp.yaw) - off.z * Math.sin(fp.yaw), off.y + fp.pitch * off.length() * 0.6, off.x * Math.sin(fp.yaw) + off.z * Math.cos(fp.yaw))
    return { eye, look: eye.clone().add(yawed) }
  }

  // ── Shop & decorate ──────────────────────────────────────
  loadDecor(state: DecorState) {
    this.decor = state
    for (const p of Object.values(state.items)) this.showDecor(p.uid)
  }

  get decorState(): DecorState {
    return this.decor
  }

  private applyDecorChange(change: DecorChange) {
    const before = this.decor
    this.decor = applyDecor(this.decor, change)
    if (this.decor === before) return
    if (change.op === 'remove') this.hideDecor(change.uid)
    else this.showDecor(change.uid)
  }

  private showDecor(uid: string) {
    const p = this.decor.items[uid]
    const stage = this.stage
    if (!p || !stage) return
    let m = this.decorModels.get(uid)
    if (!m) {
      m = buildDecor(p.item, this.opts.lite)
      this.decorModels.set(uid, m)
      stage.scene.add(m.group)
      m.group.traverse((o) => Object.assign(o.userData, { kind: 'decor', uid }))
    }
    const item = CATALOG.find((c) => c.id === p.item)!
    m.group.position.set(p.x, item.wall ? 1.55 : 0, p.z)
    m.group.rotation.y = p.rot
  }

  private hideDecor(uid: string) {
    const m = this.decorModels.get(uid)
    if (!m) return
    m.group.removeFromParent()
    this.decorModels.delete(uid)
  }

  private nextSeq() {
    return Math.max(this.decor.seq, Date.now()) + 1
  }

  private commitDecor(change: DecorChange) {
    this.applyDecorChange(change)
    this.room.send({ t: 'decor', from: this.sim.me.userId, change, at: Date.now() })
    this.opts.onDecor?.(change)
  }

  /** Start placing a bought item (or moving an existing one). The ghost appears in front of me. */
  startPlacing(itemId: string, existingUid?: string) {
    const stage = this.stage
    const item = CATALOG.find((c) => c.id === itemId)
    if (!stage || !item) return
    this.cancelPlacing()
    const prev = existingUid ? this.decor.items[existingUid] : null
    if (prev) this.hideDecor(existingUid!)
    const me = this.sim.me
    const ahead = { x: me.pos.x + Math.sin(me.facing) * 1.1, z: me.pos.z + Math.cos(me.facing) * 1.1 }
    const ghost = buildDecor(item.id, true).group
    ghost.traverse((o) => {
      const mesh = o as Mesh
      if (mesh.isMesh) {
        const mat = (mesh.material as MeshStandardMaterial).clone()
        mat.transparent = true
        mat.opacity = 0.75
        mesh.material = mat
        mesh.castShadow = false
      }
    })
    stage.scene.add(ghost)
    this.placing = { item, uid: existingUid ?? `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, x: prev?.x ?? ahead.x, z: prev?.z ?? ahead.z, rot: prev?.rot ?? 0, ok: false, ghost, existing: !!prev, owner: prev?.owner ?? me.userId }
    this.movePlacing(this.placing.x, this.placing.z)
    // New item: start it on the nearest free spot around me rather than inside a wall.
    if (!prev && !this.placing.ok) {
      const placed = Object.values(this.decor.items)
      outer: for (let r = 0.6; r <= 3; r += 0.4) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
          const x = me.pos.x + Math.sin(a) * r, z = me.pos.z + Math.cos(a) * r
          const spot = item.wall ? nearestWall({ x, z }) : { x, z }
          if (spot && canPlace(item, spot, placed)) {
            this.movePlacing(x, z)
            break outer
          }
        }
      }
    }
  }

  get placingInfo() {
    return this.placing ? { item: this.placing.item, ok: this.placing.ok, existing: this.placing.existing } : null
  }

  private movePlacing(x: number, z: number) {
    const p = this.placing
    if (!p) return
    if (p.item.wall) {
      const w = nearestWall({ x, z })
      if (w) {
        p.x = w.x; p.z = w.z; p.rot = w.rot
      } else {
        p.x = x; p.z = z
      }
    } else {
      p.x = x; p.z = z
    }
    p.ok = canPlace(p.item, { x: p.x, z: p.z }, Object.values(this.decor.items), p.uid)
    p.ghost.position.set(p.x, p.item.wall ? 1.55 : 0.02, p.z)
    p.ghost.rotation.y = p.rot
    const tint = p.ok ? new Color('#9fe8b0') : new Color('#ff8a8a')
    p.ghost.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined
      if (m && 'emissive' in m) {
        m.emissive.copy(tint)
        m.emissiveIntensity = 0.45
      }
    })
  }

  rotatePlacing() {
    const p = this.placing
    if (!p || p.item.wall) return
    p.rot += Math.PI / 4
    this.movePlacing(p.x, p.z)
  }

  /** Put it down. Returns the change made, or null if it doesn't fit there. */
  confirmPlacing(): DecorChange | null {
    const p = this.placing
    if (!p || !p.ok) return null
    const change: DecorChange = p.existing
      ? { op: 'move', uid: p.uid, x: p.x, z: p.z, rot: p.rot, seq: this.nextSeq() }
      : { op: 'place', uid: p.uid, item: p.item.id, x: p.x, z: p.z, rot: p.rot, owner: p.owner, seq: this.nextSeq() }
    p.ghost.removeFromParent()
    this.placing = null
    this.commitDecor(change)
    return change
  }

  cancelPlacing() {
    const p = this.placing
    if (!p) return
    p.ghost.removeFromParent()
    this.placing = null
    if (p.existing) this.showDecor(p.uid)
  }

  /** Sell an item back (the shop refunds half). */
  removeDecor(uid: string): CatalogItem | null {
    const p = this.decor.items[uid]
    if (!p) return null
    if (this.placing?.uid === uid) {
      this.placing.ghost.removeFromParent()
      this.placing = null
    }
    this.commitDecor({ op: 'remove', uid, seq: this.nextSeq() })
    return CATALOG.find((c) => c.id === p.item) ?? null
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
    this.props?.dispose()
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
    for (const h of hud) {
      if (h.type === 'activity') this.beginActivity(h.activity, h.furniture, h.mission)
      if (h.type === 'decor') this.applyDecorChange(h.change)
      for (const cb of this.hudListeners) cb(h)
    }
    // Standing up (exit, finish, walking away) ends the hands-on view.
    if (this.fp && !this.sim.me.chore && this.sim.me.activity !== 'sitting' && this.sim.me.activity !== 'sleeping') this.endActivity()
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

    if (this.fp && !this.watching) {
      const pose = this.firstPersonPose()
      if (pose) {
        // Gentle breathing sway so it feels alive.
        pose.eye.y += Math.sin(now / 900) * 0.008
        camera.position.lerp(pose.eye, Math.min(1, dt / 160))
        controls.target.copy(pose.look)
        camera.lookAt(pose.look)
      }
    }
    if (this.fp && this.props) {
      const chore = this.sim.me.chore
      const m = chore && MISSIONS.find((x) => x.id === chore.id)
      const timed = m && chore ? 1 - Math.max(0, chore.until - now) / m.durationMs : 0
      this.props.setProgress(Math.max(timed, this.fp.progress))
      this.props.update(dt, now)
    }
    this.apt?.updateCutaway({ x: camera.position.x, z: camera.position.z }, me.pos)
    // Real Malaysia time (dev: ?hour=21.5 to preview). Recomputed every half second.
    if (now - this.lastDaylight > 500) {
      this.lastDaylight = now
      const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get('hour') : null
      const d = daylight(forced ? Number(forced) : klClock(new Date()))
      stage.setDaylight(d)
      this.city?.setDaylight(d)
      this.apt?.setDaylight(d)
    }
    for (const m of this.decorModels.values()) m.update?.(now)
    this.apt?.update(dt, now)
    this.city?.update(dt, now)
    this.birthday?.update(now)
    stage.adapt(dt)
    stage.render()
  }

  private renderAvatar(a: SimAvatar, now: number, dt: number) {
    const stage = this.stage!
    let entry = this.avatars.get(a.userId)
    if (!entry) {
      const avatar = new Avatar(PLACEHOLDER_AVATAR[a.role])
      avatar.setUserId(a.userId)
      stage.scene.add(avatar.root)
      entry = { avatar, expr: '' }
      this.avatars.set(a.userId, entry)
    }
    // Custom VRoid character: resolve its private URL and swap the model in.
    if (a.avatar && a.avatar !== entry.path && this.opts.resolveAvatar) {
      entry.path = a.avatar
      const target = entry
      void this.opts.resolveAvatar(a.avatar).then((url) => {
        if (target.path === a.avatar) void target.avatar.load(url)
      }).catch(console.warn)
    }
    // Seat height on the sofa/chairs, mattress height when asleep.
    const y = a.activity === 'sleeping' ? 0.48 : a.activity === 'sitting' ? -0.12 : 0
    // Glide toward the simulated spot instead of jumping (network corrections, seating, waking up).
    const s = entry.shown ?? (entry.shown = { x: a.pos.x, z: a.pos.z, y, facing: a.facing })
    const k = Math.min(1, dt / 90)
    const far = Math.hypot(a.pos.x - s.x, a.pos.z - s.z) > 2.5
    s.x = far ? a.pos.x : s.x + (a.pos.x - s.x) * k
    s.z = far ? a.pos.z : s.z + (a.pos.z - s.z) * k
    s.y += (y - s.y) * Math.min(1, dt / 160)
    const turn = Math.atan2(Math.sin(a.facing - s.facing), Math.cos(a.facing - s.facing))
    s.facing += turn * Math.min(1, dt / 110)
    entry.avatar.setPosition(s, s.facing, s.y)

    // Dev-only: /home?local=1&pose=hug&t=1500 freezes everyone in a clip for checking animations.
    const preview = import.meta.env.DEV ? new URLSearchParams(location.search) : null
    const forced = preview?.get('pose') as Parameters<typeof sampleClip>[0] | null
    let pose = forced ? sampleClip(forced, Number(preview!.get('t') ?? 750)) : sampleClip(a.clip, now - a.clipStart)
    // Cross-fade for a quarter second whenever the clip changes, so motions flow into each other.
    if (entry.clip !== a.clip) {
      if (entry.lastPose) entry.blend = { from: entry.lastPose, start: now }
      entry.clip = a.clip
    }
    if (entry.blend) {
      const t = (now - entry.blend.start) / BLEND_MS
      if (t >= 1) entry.blend = undefined
      else pose = blendPose(entry.blend.from, pose, t * t * (3 - 2 * t))
    }
    entry.lastPose = pose
    entry.avatar.setPose(pose)
    const expr = a.activity === 'sleeping' ? 'sleepy' : a.clip === 'kiss' ? 'kiss' : a.expression
    if (expr !== entry.expr) {
      entry.avatar.setExpression(expr as never)
      entry.expr = expr
    }
    entry.avatar.update(dt)
  }

  private floorPoint(ev: PointerEvent): { x: number; z: number } | null {
    const stage = this.stage
    if (!stage) return null
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, stage.camera)
    const hit = new Vector3()
    return this.raycaster.ray.intersectPlane(this.floorPlane, hit) ? { x: hit.x, z: hit.z } : null
  }

  private onPointer(kind: 'down' | 'up', ev: PointerEvent) {
    // Placing: the ghost follows the finger while it's down.
    if (this.placing) {
      if (kind === 'down') {
        const stage = this.stage!
        stage.controls.enabled = false
        const move = (e: PointerEvent) => {
          const f = this.floorPoint(e)
          if (f) this.movePlacing(f.x, f.z)
        }
        const up = () => {
          stage.controls.enabled = true
          window.removeEventListener('pointermove', move)
        }
        move(ev)
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up, { once: true })
      }
      return
    }
    if (this.fp && !this.watching) {
      if (kind === 'down') {
        this.fpDrag = { x: ev.clientX, y: ev.clientY }
        const move = (e: PointerEvent) => {
          if (!this.fpDrag || !this.fp) return
          this.fp.yaw = Math.max(-0.7, Math.min(0.7, this.fp.yaw - (e.clientX - this.fpDrag.x) * 0.004))
          this.fp.pitch = Math.max(-0.4, Math.min(0.4, this.fp.pitch - (e.clientY - this.fpDrag.y) * 0.003))
          this.fpDrag = { x: e.clientX, y: e.clientY }
        }
        const up = () => {
          this.fpDrag = null
          window.removeEventListener('pointermove', move)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up, { once: true })
      }
      return
    }
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
    const targets: Object3D[] = [...(this.apt ? [this.apt.root] : []), ...[...this.avatars.values()].map((e) => e.avatar.root), ...[...this.decorModels.values()].map((m) => m.group)]
    const hit = this.raycaster.intersectObjects(targets, true).find((h) => h.object.visible && h.object.userData.kind)
    if (!hit) return
    const meta = hit.object.userData as { kind: string; id?: FurnitureId; userId?: UserId; uid?: string }
    const screen = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
    if (meta.kind === 'decor' && meta.uid) {
      if (this.decorateMode) this.emitHud({ type: 'decor-pick', uid: meta.uid, screen })
      return
    }
    if (this.decorateMode) return
    if (meta.kind === 'floor') this.dispatch({ type: 'tap-floor', point: { x: hit.point.x, z: hit.point.z } })
    else if (meta.kind === 'character' && meta.userId && meta.userId !== this.sim.me.userId) this.dispatch({ type: 'tap-partner', screen })
    else if (meta.kind === 'furniture' && meta.id) this.emitHud({ type: 'wheel-furniture', id: meta.id, screen })
  }

  private emitHud(e: HudEvent) {
    for (const cb of this.hudListeners) cb(e)
  }
}
