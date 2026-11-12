// Renderer, camera, lights and post-processing for the apartment (three.js).
import {
  ACESFilmicToneMapping, Color, DirectionalLight, FogExp2, HemisphereLight, PCFSoftShadowMap, PerspectiveCamera,
  PMREMGenerator, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { SPAWN, UNIT } from '../world/layout'
import type { Daylight } from '../world/daylight'

export type Stage = {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  controls: OrbitControls
  sun: DirectionalLight
  /** Shift the framed point up/down on screen (fraction of view height), e.g. for the wardrobe sheet. */
  screenOffset: Vector2
  /** Feed the frame time (ms) so quality can drop automatically on slow phones. */
  adapt(dt: number): void
  /** Apply the Kuala Lumpur time of day to sun, sky light, fog and exposure. */
  setDaylight(d: Daylight): void
  render(): void
  resize(): void
  dispose(): void
}

export const HAZE = new Color('#c99ab8')

export function createStage(canvas: HTMLCanvasElement, opts: { lite?: boolean } = {}): Stage {
  const lite = !!opts.lite
  const renderer = new WebGLRenderer({ canvas, antialias: lite, powerPreference: 'high-performance', stencil: false })
  renderer.setPixelRatio(lite ? 1 : Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  const scene = new Scene()
  scene.background = new Color('#2b2340')
  scene.fog = new FogExp2(HAZE, 0.0028)

  const camera = new PerspectiveCamera(50, 1, 0.05, 900)
  const controls = new OrbitControls(camera, canvas)
  controls.target.set(SPAWN.x, 0.9, SPAWN.z)
  camera.position.set(SPAWN.x, 6, SPAWN.z - 6.5)
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 3
  controls.maxDistance = 11
  controls.minPolarAngle = 0.55
  controls.maxPolarAngle = 1.25
  controls.rotateSpeed = 0.6
  controls.zoomSpeed = 0.8

  // Evening city HDRI: soft, believable reflections and fill light on every surface.
  const pmrem = new PMREMGenerator(renderer)
  new HDRLoader().load('/assets/env/sky.hdr', (hdr) => {
    scene.environment = pmrem.fromEquirectangular(hdr).texture
    scene.environmentIntensity = 0.75
    hdr.dispose()
  })

  // Low golden sun through the window wall, with soft shadows.
  const sun = new DirectionalLight('#ffd2a1', 2.6)
  sun.position.set(UNIT.width / 2 + 4, 9, UNIT.depth + 9)
  sun.target.position.set(UNIT.width / 2, 0, UNIT.depth / 2)
  sun.castShadow = true
  sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048)
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7, near: 1, far: 40 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.025
  scene.add(sun, sun.target)
  const hemi = new HemisphereLight('#ffe9f2', '#3b2a3a', 0.35)
  scene.add(hemi)
  const moon = new DirectionalLight('#9fb4ff', 0)
  moon.position.set(UNIT.width / 2 - 6, 10, UNIT.depth + 8)
  moon.target.position.set(UNIT.width / 2, 0, UNIT.depth / 2)
  scene.add(moon, moon.target)

  let composer: EffectComposer | null = null
  let gtao: GTAOPass | null = null
  let bloom: UnrealBloomPass | null = null
  if (!lite) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    gtao = new GTAOPass(scene, camera, 1, 1)
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.2, scale: 1.1 })
    gtao.blendIntensity = 0.85
    composer.addPass(gtao)
    bloom = new UnrealBloomPass(new Vector2(1, 1), 0.22, 0.5, 0.92)
    composer.addPass(bloom)
    composer.addPass(new SMAAPass())
    composer.addPass(new OutputPass())
  }

  // Adaptive quality: if frames run slow for a couple of seconds, step down one notch
  // (resolution → ambient occlusion → bloom/shadow resolution) so motion stays smooth.
  let avgMs = 16, slowFor = 0, level = 0, warm = 0
  const steps: (() => void)[] = [
    () => renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)),
    () => gtao && (gtao.enabled = false),
    () => {
      renderer.setPixelRatio(1)
      bloom && (bloom.enabled = false)
      sun.shadow.mapSize.set(1024, 1024)
      sun.shadow.map?.dispose()
      sun.shadow.map = null as never
    },
  ]
  const adapt = (dt: number) => {
    warm += dt
    avgMs += (dt - avgMs) * 0.05
    if (warm < 3000 || level >= steps.length) return
    slowFor = avgMs > 24 ? slowFor + dt : 0
    if (slowFor > 2000) {
      steps[level++]()
      slowFor = 0
      avgMs = 16
      resize()
    }
  }

  const setDaylight = (d: Daylight) => {
    const r = 30
    sun.position.set(UNIT.width / 2 + d.sunDir[0] * r, Math.max(1.5, d.sunDir[1] * r), UNIT.depth / 2 + d.sunDir[2] * r)
    sun.intensity = d.sunIntensity
    sun.color.setRGB(d.sunColor[0], d.sunColor[1], d.sunColor[2])
    moon.intensity = d.moonIntensity
    hemi.intensity = d.ambient
    hemi.color.setRGB(d.skyMid[0], d.skyMid[1], d.skyMid[2])
    hemi.groundColor.setRGB(0.25 + 0.1 * (1 - d.night), 0.2, 0.25)
    ;(scene.fog as FogExp2).color.setRGB(d.haze[0], d.haze[1], d.haze[2])
    scene.environmentIntensity = 0.25 + 0.4 * (1 - d.night)
    renderer.toneMappingExposure = 0.92 - 0.05 * d.night
    if (bloom) bloom.threshold = 0.92 + 0.3 * (1 - d.night)
  }

  const screenOffset = new Vector2(0, 0)
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    composer?.setSize(w, h)
    camera.aspect = w / h
    // Portrait phones get a taller view so the room still fits side to side.
    camera.fov = camera.aspect < 1 ? 62 : 45
    camera.updateProjectionMatrix()
  }
  resize()

  const render = () => {
    controls.update()
    if (screenOffset.y !== 0) {
      const h = canvas.clientHeight || window.innerHeight, w = canvas.clientWidth || window.innerWidth
      camera.setViewOffset(w, h, 0, -screenOffset.y * h, w, h)
    } else if (camera.view) camera.clearViewOffset()
    if (composer) composer.render()
    else renderer.render(scene, camera)
  }

  return {
    renderer, scene, camera, controls, sun, screenOffset, adapt, setDaylight, render, resize,
    dispose() {
      controls.dispose()
      composer?.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}

export const tmpV = new Vector3()
