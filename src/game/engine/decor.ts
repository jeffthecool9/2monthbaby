// Birthday decorations: balloons over the sofa, a cake on the coffee table, a banner on the window.
import { Color3, DynamicTexture, MeshBuilder, PBRMaterial, type Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import { FURNITURE, UNIT } from '../world/layout'

const BALLOON_COLORS = ['#ff9ec4', '#ffd166', '#a0d8ff', '#c8b6ff', '#ffb3a7', '#b8f2c9']

export function addBirthdayDecor(scene: Scene, name: string) {
  const sofa = FURNITURE.find((f) => f.id === 'sofa')!
  const table = FURNITURE.find((f) => f.id === 'coffeeTable')!

  // Balloons tied above the sofa, gently bobbing.
  const balloons = BALLOON_COLORS.map((hex, i) => {
    const m = new PBRMaterial(`balloon-${i}`, scene)
    m.albedoColor = Color3.FromHexString(hex).toLinearSpace()
    m.metallic = 0
    m.roughness = 0.25
    m.clearCoat.isEnabled = true
    m.clearCoat.intensity = 0.6
    const b = MeshBuilder.CreateSphere(`balloon-${i}`, { diameterX: 0.3, diameterY: 0.36, diameterZ: 0.3, segments: 16 }, scene)
    const x = sofa.pos.x + 0.15 * Math.cos(i * 2.1), z = sofa.pos.z - 0.9 + i * 0.36
    b.position = new Vector3(x, 1.75 + (i % 2) * 0.18, z)
    b.material = m
    b.isPickable = false
    const string = MeshBuilder.CreateCylinder(`string-${i}`, { height: b.position.y - 0.85, diameter: 0.006 }, scene)
    string.position = new Vector3(x, (b.position.y + 0.85) / 2, z)
    string.isPickable = false
    return { b, string, phase: i * 0.9, y: b.position.y }
  })
  scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000
    for (const { b, phase, y } of balloons) b.position.y = y + Math.sin(t * 1.3 + phase) * 0.04
  })

  // Cake with a glowing candle.
  const cakeMat = new PBRMaterial('cake', scene)
  cakeMat.albedoColor = Color3.FromHexString('#fff1f5').toLinearSpace()
  cakeMat.roughness = 0.7
  const icing = new PBRMaterial('icing', scene)
  icing.albedoColor = Color3.FromHexString('#ff8fb3').toLinearSpace()
  icing.roughness = 0.4
  const top = 0.47
  const cake = MeshBuilder.CreateCylinder('cake', { height: 0.14, diameter: 0.28, tessellation: 32 }, scene)
  cake.position = new Vector3(table.pos.x, top + 0.07, table.pos.z)
  cake.material = cakeMat
  const drip = MeshBuilder.CreateCylinder('icing', { height: 0.03, diameter: 0.29, tessellation: 32 }, scene)
  drip.position = new Vector3(table.pos.x, top + 0.14, table.pos.z)
  drip.material = icing
  const candle = MeshBuilder.CreateCylinder('candle', { height: 0.08, diameter: 0.015 }, scene)
  candle.position = new Vector3(table.pos.x, top + 0.2, table.pos.z)
  const flame = MeshBuilder.CreateSphere('flame', { diameterX: 0.025, diameterY: 0.045, diameterZ: 0.025 }, scene)
  flame.position = new Vector3(table.pos.x, top + 0.26, table.pos.z)
  const flameMat = new StandardMaterial('flame', scene)
  flameMat.emissiveColor = new Color3(1, 0.75, 0.3)
  flameMat.disableLighting = true
  flame.material = flameMat
  for (const m of [cake, drip, candle, flame]) m.isPickable = false

  // Banner hanging inside the window wall.
  const tex = new DynamicTexture('banner', { width: 1024, height: 192 }, scene, true)
  const ctx = tex.getContext() as CanvasRenderingContext2D
  const flags = ['#ff9ec4', '#ffd166', '#a0d8ff', '#c8b6ff']
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = flags[i % flags.length]
    ctx.beginPath()
    ctx.moveTo(i * 64, 0)
    ctx.lineTo(i * 64 + 64, 0)
    ctx.lineTo(i * 64 + 32, 60)
    ctx.fill()
  }
  ctx.fillStyle = '#ff6f9c'
  ctx.font = 'bold 72px Inter, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`Happy Birthday ${name}!`, 512, 150)
  tex.hasAlpha = true
  tex.update()
  const banner = MeshBuilder.CreatePlane('banner', { width: 3.4, height: 0.64 }, scene)
  banner.position = new Vector3(3.4, UNIT.wallHeight - 0.45, UNIT.depth - 0.08)
  const bannerMat = new StandardMaterial('banner', scene)
  bannerMat.diffuseTexture = tex
  bannerMat.useAlphaFromDiffuseTexture = true
  bannerMat.emissiveColor = new Color3(0.5, 0.45, 0.45)
  bannerMat.backFaceCulling = false
  banner.material = bannerMat
  banner.isPickable = false
}
