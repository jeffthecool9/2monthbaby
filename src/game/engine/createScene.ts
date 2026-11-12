import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HDRCubeTexture, HemisphericLight,
  ImageProcessingConfiguration, Scene, ShadowGenerator, Vector3,
} from '@babylonjs/core'
import { SPAWN } from '../world/layout'
import { addSkyline } from './skyline'

export type SceneBundle = { engine: Engine; scene: Scene; camera: ArcRotateCamera; shadows: ShadowGenerator }

export function createScene(canvas: HTMLCanvasElement, opts: { lite?: boolean } = {}): SceneBundle {
  const engine = new Engine(canvas, !opts.lite, { stencil: true, adaptToDeviceRatio: false, powerPreference: 'high-performance' }, false)
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
  engine.setHardwareScalingLevel(opts.lite ? 1 : 1 / Math.min(dpr, 2))

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.08, 0.05, 0.1, 1)

  const camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.95, 8, new Vector3(SPAWN.x, 0.6, SPAWN.z), scene)
  camera.lowerBetaLimit = 0.6
  camera.upperBetaLimit = 1.2
  camera.lowerRadiusLimit = 4
  camera.upperRadiusLimit = 12
  camera.panningSensibility = 0
  camera.wheelDeltaPercentage = 0.01
  camera.pinchDeltaPercentage = 0.004
  camera.angularSensibilityX = 1500
  camera.angularSensibilityY = 1500
  camera.minZ = 0.1
  camera.maxZ = 500
  // Portrait phones get a taller view so the room still fits side to side.
  const fitFov = () => {
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight())
    camera.fov = aspect < 1 ? 1.15 : 0.8
  }
  fitFov()
  engine.onResizeObservable.add(fitFov)
  camera.attachControl(canvas, true)

  // Sunset HDRI lights the room (IBL); the view out of the window is the painted high-rise skyline.
  const sky = new HDRCubeTexture('/assets/env/sky.hdr', scene, opts.lite ? 128 : 256, false, true, false, true)
  scene.environmentTexture = sky
  scene.environmentIntensity = 1.15
  addSkyline(scene, opts)

  // Warm evening sun coming in low through the window wall.
  const sun = new DirectionalLight('sun', new Vector3(0.35, -0.55, -0.75), scene)
  sun.position = new Vector3(4, 8, 14)
  sun.intensity = 2.2
  sun.diffuse = new Color3(1, 0.82, 0.62)
  const fill = new HemisphericLight('fill', new Vector3(0, 1, 0), scene)
  fill.intensity = 0.25
  fill.groundColor = new Color3(0.35, 0.28, 0.3)

  const shadows = new ShadowGenerator(opts.lite ? 512 : 1024, sun)
  shadows.usePercentageCloserFiltering = true
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
  shadows.bias = 0.002
  shadows.normalBias = 0.02

  const ip = scene.imageProcessingConfiguration
  ip.toneMappingEnabled = true
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
  ip.exposure = 1.05
  ip.contrast = 1.1

  return { engine, scene, camera, shadows }
}
