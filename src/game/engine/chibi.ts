// Procedural chibi character (style A): big round head, small body, stubby limbs.
// Rig: root (position/facing) → lean (lying/tipping, bob) → hips → torso → head / arms; hips → legs.
import {
  Color3, type DynamicTexture, type Mesh, MeshBuilder, type Observer, PBRMaterial, type Scene, type ShadowGenerator,
  TransformNode, Vector3,
} from '@babylonjs/core'
import type { CharacterLook } from '../character/look'
import type { Pose } from '../character/poses'
import type { EmoteKind, UserId, Vec2 } from '../types'
import { createFaceTexture, drawFace, type Expression } from './faceTexture'

const HEAD_R = 0.29
const HIP_Y = 0.24
const TORSO_H = 0.26
const BODY_SCALE: Record<CharacterLook['body'], number> = { petite: 0.9, regular: 1, chubby: 1.22 }
const SHOE_COLOR: Record<CharacterLook['shoes'], string> = { sneakers: '#ffffff', slippers: '#ffc6d9', boots: '#7a4b2e' }

export class Chibi {
  readonly root: TransformNode
  private scene: Scene
  private shadows: ShadowGenerator
  private lean: TransformNode
  private hips!: TransformNode
  private torso!: TransformNode
  private head!: TransformNode
  private armL!: TransformNode
  private armR!: TransformNode
  private legL!: TransformNode
  private legR!: TransformNode
  private parts: TransformNode
  private face: DynamicTexture
  private look: CharacterLook
  private userId: UserId = ''
  private expression: Expression = 'neutral'
  private blinkObs: Observer<Scene> | null = null
  private nextBlink = 0
  private blinkUntil = 0

  constructor(scene: Scene, look: CharacterLook, shadows: ShadowGenerator) {
    this.scene = scene
    this.shadows = shadows
    this.look = look
    this.root = new TransformNode('chibi', scene)
    this.lean = new TransformNode('chibi-lean', scene)
    this.lean.parent = this.root
    this.parts = new TransformNode('chibi-parts', scene)
    this.parts.parent = this.lean
    this.face = createFaceTexture(scene)
    this.build()
    this.blinkObs = scene.onBeforeRenderObservable.add(() => this.tickBlink())
  }

  setUserId(id: UserId) {
    this.userId = id
    this.tagMeshes()
  }

  setLook(look: CharacterLook) {
    this.look = look
    for (const child of this.parts.getChildren()) child.dispose(false, true)
    this.build()
    this.tagMeshes()
  }

  setPose(p: Pose) {
    // Lying down: roll onto the back rather than face-first.
    const lying = p.lean > 1
    this.lean.position.y = p.rootY + (lying ? 0.12 : 0)
    this.lean.rotation.x = lying ? -p.lean : p.lean
    this.torso.rotation.set(p.body.x, p.body.y, p.body.z)
    this.head.rotation.set(p.head.x, p.head.y, p.head.z)
    this.armR.rotation.set(p.armR.x, p.armR.y, p.armR.z)
    this.armL.rotation.set(p.armL.x, -p.armL.y, -p.armL.z)
    this.legL.rotation.set(p.legL.x, p.legL.y, p.legL.z)
    this.legR.rotation.set(p.legR.x, p.legR.y, p.legR.z)
  }

  setExpression(e: EmoteKind | 'neutral' | 'blink') {
    this.expression = e
    this.redrawFace()
  }

  setPosition(p: Vec2, facing: number, y = 0) {
    this.root.position.set(p.x, y, p.z)
    this.root.rotation.y = facing
  }

  dispose() {
    if (this.blinkObs) this.scene.onBeforeRenderObservable.remove(this.blinkObs)
    this.root.dispose(false, true)
    this.face.dispose()
  }

  private tickBlink() {
    const now = performance.now()
    if (this.expression !== 'neutral') return
    if (this.blinkUntil && now > this.blinkUntil) {
      this.blinkUntil = 0
      this.redrawFace()
    } else if (!this.blinkUntil && now > this.nextBlink) {
      this.blinkUntil = now + 140
      this.nextBlink = now + 3000 + Math.random() * 2000
      drawFace(this.face, this.look.eyeShape, this.look.eyeColor, 'blink')
    }
  }

  private redrawFace() {
    drawFace(this.face, this.look.eyeShape, this.look.eyeColor, this.expression)
  }

  private tagMeshes() {
    for (const m of this.root.getChildMeshes(false)) {
      m.metadata = { kind: 'character', userId: this.userId }
      m.isPickable = true
    }
  }

  private mat(name: string, hex: string, roughness = 0.55, sheen = 0.25): PBRMaterial {
    const m = new PBRMaterial(`chibi-${name}`, this.scene)
    m.albedoColor = Color3.FromHexString(hex).toLinearSpace()
    m.roughness = roughness
    m.metallic = 0
    if (sheen > 0) {
      m.sheen.isEnabled = true
      m.sheen.intensity = sheen
    }
    return m
  }

  private node(name: string, parent: TransformNode, x: number, y: number, z: number) {
    const n = new TransformNode(name, this.scene)
    n.parent = parent
    n.position.set(x, y, z)
    return n
  }

  private add(mesh: Mesh, parent: TransformNode, material: PBRMaterial) {
    mesh.parent = parent
    mesh.material = material
    this.shadows.addShadowCaster(mesh)
    return mesh
  }

  private build() {
    const L = this.look
    const s = this.scene
    const bs = BODY_SCALE[L.body]
    const skin = this.mat('skin', L.skinTone, 0.6, 0.35)
    const hair = this.mat('hair', L.hairColor, 0.45, 0.6)
    const top = this.mat('top', L.topColor, 0.8)
    const bottom = this.mat('bottom', L.bottomColor, 0.8)
    const shoe = this.mat('shoe', SHOE_COLOR[L.shoes], 0.5)

    this.hips = this.node('hips', this.parts, 0, HIP_Y, 0)
    this.torso = this.node('torso', this.hips, 0, 0, 0)

    // Torso (the top garment). Dresses flare down over the legs.
    const torsoMesh = MeshBuilder.CreateCapsule('torso', { radius: 0.14, height: TORSO_H + 0.1, tessellation: 16 }, s)
    torsoMesh.scaling.set(bs, 1, 0.85 * bs)
    torsoMesh.position.y = TORSO_H / 2
    this.add(torsoMesh, this.torso, top)
    if (L.top === 'dress') {
      const skirt = MeshBuilder.CreateCylinder('dress', { height: 0.2, diameterTop: 0.26 * bs, diameterBottom: 0.42 * bs, tessellation: 20 }, s)
      skirt.position.y = -0.04
      this.add(skirt, this.torso, top)
    }
    if (L.top === 'hoodie') {
      const hood = MeshBuilder.CreateTorus('hood', { diameter: 0.26, thickness: 0.07, tessellation: 18 }, s)
      hood.position.set(0, TORSO_H + 0.02, -0.04)
      hood.rotation.x = 0.3
      this.add(hood, this.torso, top)
    }
    if (L.top === 'shirt') {
      const collar = MeshBuilder.CreateTorus('collar', { diameter: 0.17, thickness: 0.035, tessellation: 18 }, s)
      collar.position.y = TORSO_H + 0.01
      this.add(collar, this.torso, this.mat('collar', '#ffffff', 0.6))
    }

    // Arms: pivots at the shoulders, arms hang down.
    const armMat = L.top === 'dress' ? skin : top
    for (const side of [-1, 1] as const) {
      const pivot = this.node(side < 0 ? 'armL' : 'armR', this.torso, side * (0.15 * bs + 0.02), TORSO_H - 0.03, 0)
      const arm = MeshBuilder.CreateCapsule('arm', { radius: 0.045, height: 0.22, tessellation: 10 }, s)
      arm.position.y = -0.09
      this.add(arm, pivot, armMat)
      const hand = MeshBuilder.CreateSphere('hand', { diameter: 0.09, segments: 10 }, s)
      hand.position.y = -0.2
      this.add(hand, pivot, skin)
      if (side < 0) this.armL = pivot
      else this.armR = pivot
    }

    // Legs: pivots at the hips.
    for (const side of [-1, 1] as const) {
      const pivot = this.node(side < 0 ? 'legL' : 'legR', this.hips, side * 0.065 * bs, 0, 0)
      const fullLegs = L.bottom === 'jeans' || L.bottom === 'pajama'
      const leg = MeshBuilder.CreateCapsule('leg', { radius: 0.055, height: 0.22, tessellation: 10 }, s)
      leg.position.y = -0.1
      this.add(leg, pivot, fullLegs ? bottom : skin)
      if (L.bottom === 'shorts') {
        const short = MeshBuilder.CreateCylinder('shorts', { height: 0.09, diameter: 0.13, tessellation: 12 }, s)
        short.position.y = -0.03
        this.add(short, pivot, bottom)
      }
      const foot = MeshBuilder.CreateSphere('shoe', { diameterX: 0.11, diameterY: L.shoes === 'boots' ? 0.12 : 0.07, diameterZ: 0.16, segments: 10 }, s)
      foot.position.set(0, -0.215, 0.025)
      this.add(foot, pivot, shoe)
      if (side < 0) this.legL = pivot
      else this.legR = pivot
    }
    if (L.bottom === 'skirt' && L.top !== 'dress') {
      const skirt = MeshBuilder.CreateCylinder('skirt', { height: 0.12, diameterTop: 0.27 * bs, diameterBottom: 0.38 * bs, tessellation: 20 }, s)
      skirt.position.y = -0.02
      this.add(skirt, this.hips, bottom)
    }

    // Head with drawn face.
    this.head = this.node('head', this.torso, 0, TORSO_H + 0.03, 0)
    const headMesh = MeshBuilder.CreateSphere('head', { diameter: HEAD_R * 2, segments: 24 }, s)
    headMesh.scaling.set(1.06, 0.96, 1)
    headMesh.position.y = HEAD_R * 0.92
    this.add(headMesh, this.head, skin)
    const facePlane = MeshBuilder.CreatePlane('face', { size: 0.48 }, s)
    facePlane.position.set(0, HEAD_R * 0.8, HEAD_R + 0.006)
    facePlane.rotation.y = Math.PI
    const faceMat = new PBRMaterial('chibi-face', s)
    faceMat.albedoTexture = this.face
    faceMat.useAlphaFromAlbedoTexture = true
    faceMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST
    faceMat.alphaCutOff = 0.3
    faceMat.roughness = 0.6
    faceMat.metallic = 0
    facePlane.material = faceMat
    facePlane.parent = this.head
    this.redrawFace()

    this.buildHair(hair)
    this.buildAccessory()
  }

  private buildHair(hair: PBRMaterial) {
    const s = this.scene
    const L = this.look
    const cy = HEAD_R * 0.92
    const cap = MeshBuilder.CreateSphere('hair-cap', { diameter: HEAD_R * 2 + 0.03, segments: 20, slice: 0.5 }, s)
    cap.scaling.set(1.07, 1, 1.04)
    cap.position.y = cy
    cap.rotation.x = -0.3
    this.add(cap, this.head, hair)
    // Soft side-swept fringe.
    const fringe = MeshBuilder.CreateSphere('fringe', { diameterX: 0.42, diameterY: 0.12, diameterZ: 0.1, segments: 14 }, s)
    fringe.position.set(0.03, cy + 0.2, HEAD_R * 0.8)
    fringe.rotation.set(-0.55, 0, -0.12)
    this.add(fringe, this.head, hair)
    const sideLocks = (length: number) => {
      for (const side of [-1, 1]) {
        const lock = MeshBuilder.CreateCapsule('side-lock', { radius: 0.055, height: length, tessellation: 10 }, s)
        lock.position.set(side * (HEAD_R - 0.01), cy + 0.06 - length / 2, 0.08)
        lock.rotation.z = side * 0.08
        this.add(lock, this.head, hair)
      }
    }
    const backShell = (lowness: number) => {
      const shell = MeshBuilder.CreateSphere('hair-back', { diameter: HEAD_R * 2 + 0.05, segments: 20, slice: 0.5 }, s)
      shell.scaling.set(1.08, 1.05 + lowness, 1.05)
      shell.position.set(0, cy - 0.02, -0.02)
      shell.rotation.x = -Math.PI / 2 - 0.15
      this.add(shell, this.head, hair)
    }
    switch (L.hairStyle) {
      case 'short':
        break
      case 'bob':
        backShell(0.15)
        sideLocks(0.22)
        break
      case 'long': {
        backShell(0.2)
        sideLocks(0.42)
        const back = MeshBuilder.CreateCapsule('hair-long', { radius: 0.17, height: 0.5, tessellation: 14 }, s)
        back.scaling.set(1.3, 1, 0.5)
        back.position.set(0, cy - 0.28, -0.16)
        this.add(back, this.head, hair)
        break
      }
      case 'ponytail': {
        const tie = MeshBuilder.CreateSphere('tie', { diameter: 0.08, segments: 8 }, s)
        tie.position.set(0, cy + 0.12, -HEAD_R - 0.01)
        this.add(tie, this.head, this.mat('tie', '#f4a3c0'))
        const tail = MeshBuilder.CreateCapsule('ponytail', { radius: 0.07, height: 0.32, tessellation: 12 }, s)
        tail.position.set(0, cy - 0.06, -HEAD_R - 0.07)
        tail.rotation.x = 0.35
        this.add(tail, this.head, hair)
        break
      }
      case 'bun': {
        const bun = MeshBuilder.CreateSphere('bun', { diameter: 0.2, segments: 14 }, s)
        bun.position.set(0, cy + HEAD_R + 0.02, -0.05)
        this.add(bun, this.head, hair)
        break
      }
      case 'pigtails':
        for (const side of [-1, 1]) {
          const tail = MeshBuilder.CreateCapsule('pigtail', { radius: 0.065, height: 0.28, tessellation: 12 }, s)
          tail.position.set(side * (HEAD_R + 0.05), cy - 0.05, -0.04)
          tail.rotation.z = side * 0.35
          this.add(tail, this.head, hair)
        }
        break
    }
  }

  private buildAccessory() {
    const s = this.scene
    const cy = HEAD_R * 0.92
    switch (this.look.accessory) {
      case 'glasses': {
        const frame = this.mat('glasses', '#2b2b33', 0.3)
        for (const side of [-1, 1]) {
          const ring = MeshBuilder.CreateTorus('lens', { diameter: 0.12, thickness: 0.012, tessellation: 20 }, s)
          ring.rotation.x = Math.PI / 2
          ring.position.set(side * 0.095, cy - 0.015, HEAD_R + 0.02)
          this.add(ring, this.head, frame)
        }
        break
      }
      case 'bow': {
        const pink = this.mat('bow', '#ff6f9c', 0.5)
        for (const side of [-1, 1]) {
          const wing = MeshBuilder.CreateCylinder('bow', { height: 0.1, diameterTop: 0, diameterBottom: 0.1, tessellation: 12 }, s)
          wing.rotation.z = (side * Math.PI) / 2
          wing.position.set(0.16 + side * 0.05, cy + 0.24, 0.05)
          this.add(wing, this.head, pink)
        }
        break
      }
      case 'cap': {
        const capMat = this.mat('cap', this.look.topColor, 0.7)
        const dome = MeshBuilder.CreateSphere('cap', { diameter: HEAD_R * 2 + 0.06, segments: 16, slice: 0.45 }, s)
        dome.position.y = cy + 0.02
        this.add(dome, this.head, capMat)
        const brim = MeshBuilder.CreateCylinder('brim', { height: 0.015, diameter: 0.3, tessellation: 20 }, s)
        brim.scaling.z = 0.7
        brim.position.set(0, cy + 0.08, HEAD_R * 0.75)
        this.add(brim, this.head, capMat)
        break
      }
    }
  }
}

export const CHIBI_EYE_HEIGHT = HIP_Y + TORSO_H + HEAD_R
export const CHIBI_TOP = new Vector3(0, HIP_Y + TORSO_H + 0.03 + HEAD_R * 1.9 + 0.05, 0)
