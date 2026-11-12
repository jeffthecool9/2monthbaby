// A VRoid / VRM character: loads the model, drives its humanoid bones from our Pose,
// blinks, shows expressions, and lets hair and clothes swing (spring bones).
import { Group, Quaternion, type Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM, VRMExpressionPresetName } from '@pixiv/three-vrm'
import type { Pose } from '../character/poses'
import type { EmoteKind, UserId, Vec2 } from '../types'
import { poseToBones, type BoneName } from './rig'

export type Expression = EmoteKind | 'neutral' | 'blink' | 'kiss'

/** Bundled placeholder characters (VRM 1.0 samples, free to use; see public/assets/CREDITS.md). */
export const PLACEHOLDER_AVATAR = { female: '/assets/avatars/her.vrm', male: '/assets/avatars/him.vrm' } as const

const EXPRESSIONS: Record<Exclude<Expression, 'neutral' | 'blink'>, [string, number][]> = {
  happy: [[VRMExpressionPresetName.Happy, 1]],
  love: [[VRMExpressionPresetName.Happy, 0.8], [VRMExpressionPresetName.Relaxed, 0.4]],
  shy: [[VRMExpressionPresetName.Relaxed, 0.9]],
  angry: [[VRMExpressionPresetName.Angry, 1]],
  crying: [[VRMExpressionPresetName.Sad, 1]],
  sleepy: [[VRMExpressionPresetName.Blink, 1]],
  kiss: [[VRMExpressionPresetName.Ou, 0.8], [VRMExpressionPresetName.Blink, 0.9]],
}

const PROP_PATTERN = /robo|backpack|armgear|anim_logo|green_emit/i

const loader = new GLTFLoader()
loader.register((parser) => new VRMLoaderPlugin(parser))

export class Avatar {
  /** Position + facing in the room. */
  readonly root = new Group()
  /** Tipping (lying down) and bob. */
  private lean = new Group()
  private vrm: VRM | null = null
  private userId: UserId = ''
  private expression: Expression = 'neutral'
  private nextBlink = 0
  private blinkUntil = 0
  private url = ''
  private tmp = new Quaternion()
  /** Height of the top of the head above the root, for speech bubbles. */
  headHeight = 1.6
  onReady: (() => void) | null = null

  constructor(url: string) {
    this.root.add(this.lean)
    void this.load(url)
  }

  setUserId(id: UserId) {
    this.userId = id
    this.tag()
  }

  async load(url: string) {
    if (url === this.url) return
    this.url = url
    try {
      const gltf = await loader.loadAsync(url)
      if (this.url !== url) return
      const vrm = gltf.userData.vrm as VRM
      VRMUtils.removeUnnecessaryVertices(gltf.scene)
      VRMUtils.combineSkeletons(gltf.scene)
      VRMUtils.rotateVRM0(vrm)
      vrm.scene.traverse((o: Object3D) => {
        o.frustumCulled = false
        if ((o as { isMesh?: boolean }).isMesh) {
          o.castShadow = true
          o.receiveShadow = true
          // The Seed-san sample wears a robot arm and backpack; hide sci-fi props on placeholders.
          const matName = ((o as Mesh).material as { name?: string } | undefined)?.name ?? ''
          if (PROP_PATTERN.test(o.name) || PROP_PATTERN.test(matName)) o.visible = false
        }
      })
      if (this.vrm) {
        this.lean.remove(this.vrm.scene)
        VRMUtils.deepDispose(this.vrm.scene)
      }
      this.vrm = vrm
      this.lean.add(vrm.scene)
      const head = vrm.humanoid.getNormalizedBoneNode('head')
      if (head) {
        vrm.scene.updateMatrixWorld(true)
        this.headHeight = head.getWorldPosition(head.position.clone()).y - this.root.position.y + 0.28
      }
      this.tag()
      this.applyExpression()
      this.onReady?.()
    } catch (err) {
      console.warn('avatar failed to load', url, err)
    }
  }

  setPose(p: Pose) {
    const lying = p.lean > 1
    this.lean.position.y = p.rootY + (lying ? 0.12 : 0)
    this.lean.rotation.x = lying ? -p.lean : p.lean * 0.6
    const h = this.vrm?.humanoid
    if (!h) return
    const bones = poseToBones(p)
    for (const [name, q] of Object.entries(bones) as [BoneName, [number, number, number, number]][]) {
      const node = h.getNormalizedBoneNode(name)
      if (node) node.quaternion.copy(this.tmp.set(q[0], q[1], q[2], q[3]))
    }
    // Lean the upper body a little into walks and hugs.
    const spine = h.getNormalizedBoneNode('chest')
    if (spine && !lying) spine.rotation.x = p.lean * 0.4
  }

  setExpression(e: Expression) {
    this.expression = e
    this.applyExpression()
  }

  setPosition(pos: Vec2, facing: number, y = 0) {
    this.root.position.set(pos.x, y, pos.z)
    this.root.rotation.y = facing
  }

  /** Spring bones (hair, skirt), look-at and automatic blinking. */
  update(dtMs: number) {
    const vrm = this.vrm
    if (!vrm) return
    const now = performance.now()
    const em = vrm.expressionManager
    if (em && this.expression === 'neutral') {
      if (!this.blinkUntil && now > this.nextBlink) {
        this.blinkUntil = now + 130
        this.nextBlink = now + 2500 + Math.random() * 3000
      }
      const blinking = this.blinkUntil && now < this.blinkUntil
      if (this.blinkUntil && now >= this.blinkUntil) this.blinkUntil = 0
      em.setValue(VRMExpressionPresetName.Blink, blinking ? 1 : 0)
    }
    vrm.update(Math.min(dtMs, 50) / 1000)
  }

  dispose() {
    this.url = ''
    if (this.vrm) VRMUtils.deepDispose(this.vrm.scene)
    this.root.removeFromParent()
  }

  private applyExpression() {
    const em = this.vrm?.expressionManager
    if (!em) return
    for (const name of Object.values(VRMExpressionPresetName)) em.setValue(name, 0)
    if (this.expression === 'neutral') return
    if (this.expression === 'blink') {
      em.setValue(VRMExpressionPresetName.Blink, 1)
      return
    }
    for (const [name, v] of EXPRESSIONS[this.expression]) em.setValue(name, v)
  }

  private tag() {
    // Merge, don't replace: three-vrm keeps spring-bone caches in userData.
    this.root.traverse((o) => Object.assign(o.userData, { kind: 'character', userId: this.userId }))
  }
}
