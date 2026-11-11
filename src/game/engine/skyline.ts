// Sunset city skyline seen from a high-rise: painted once on a canvas, mapped inside a big cylinder.
import { DynamicTexture, MeshBuilder, Scene, StandardMaterial, Color3 } from '@babylonjs/core'

/** Deterministic pseudo-random so the skyline looks the same on both phones. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

export function addSkyline(scene: Scene, opts: { lite?: boolean } = {}) {
  const W = opts.lite ? 2048 : 4096, H = opts.lite ? 512 : 1024
  const tex = new DynamicTexture('skyline', { width: W, height: H }, scene, true)
  const ctx = tex.getContext() as CanvasRenderingContext2D
  const horizon = H * 0.62

  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#3b3a78')
  sky.addColorStop(0.45, '#b56aa0')
  sky.addColorStop(0.8, '#ffb38a')
  sky.addColorStop(1, '#ffd9a8')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, horizon)
  const sunX = W * 0.62
  const sun = ctx.createRadialGradient(sunX, horizon - H * 0.05, 4, sunX, horizon - H * 0.05, H * 0.35)
  sun.addColorStop(0, 'rgba(255,240,200,1)')
  sun.addColorStop(0.08, 'rgba(255,214,160,0.9)')
  sun.addColorStop(1, 'rgba(255,180,140,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, W, horizon + H * 0.1)

  const ground = ctx.createLinearGradient(0, horizon, 0, H)
  ground.addColorStop(0, '#7a6a8a')
  ground.addColorStop(1, '#2a2440')
  ctx.fillStyle = ground
  ctx.fillRect(0, horizon, W, H - horizon)

  const rand = rng(28_07)
  // Seen from a high floor: far towers rise just above the horizon, nearer blocks sit below eye level.
  const layers = [
    { color: '#b49ab4', base: 0.0, top: 0.06, n: 220, wMin: 0.003, wMax: 0.009, lit: 0.04 },
    { color: '#8e789f', base: 0.03, top: 0.09, n: 160, wMin: 0.004, wMax: 0.012, lit: 0.1 },
    { color: '#655579', base: 0.08, top: 0.1, n: 120, wMin: 0.006, wMax: 0.016, lit: 0.18 },
    { color: '#463b5c', base: 0.16, top: 0.12, n: 80, wMin: 0.008, wMax: 0.022, lit: 0.28 },
  ]
  for (const L of layers) {
    for (let i = 0; i < L.n; i++) {
      const bw = W * (L.wMin + rand() * (L.wMax - L.wMin))
      const x = rand() * W
      const bh = H * (0.015 + rand() * L.top)
      const y = horizon + H * L.base - bh
      for (const dx of [0, -W]) {
        const bx = x + dx
        ctx.fillStyle = L.color
        ctx.fillRect(bx, y, bw, H - y)
        if (rand() < 0.15) ctx.fillRect(bx + bw * 0.45, y - H * 0.03, Math.max(2, bw * 0.06), H * 0.03)
        const cell = Math.max(2, bw / 7)
        for (let wy = y + cell; wy < H; wy += cell * 1.5) {
          for (let wx = bx + cell * 0.5; wx < bx + bw - cell * 0.5; wx += cell) {
            if (rand() < L.lit) {
              ctx.fillStyle = rand() < 0.7 ? 'rgba(255,214,150,0.7)' : 'rgba(255,240,225,0.55)'
              ctx.fillRect(wx, wy, cell * 0.45, cell * 0.55)
            }
          }
        }
      }
    }
  }
  // Evening haze over the city.
  const haze = ctx.createLinearGradient(0, horizon - H * 0.12, 0, horizon + H * 0.3)
  haze.addColorStop(0, 'rgba(255,190,160,0)')
  haze.addColorStop(0.35, 'rgba(255,190,170,0.28)')
  haze.addColorStop(1, 'rgba(60,45,80,0)')
  ctx.fillStyle = haze
  ctx.fillRect(0, horizon - H * 0.12, W, H * 0.42)
  tex.update()

  // The city far below the window, so looking down never shows an empty void.
  const below = MeshBuilder.CreateDisc('city-below', { radius: 140, tessellation: 48 }, scene)
  below.rotation.x = Math.PI / 2
  below.position.set(6.5, -59, 3.25)
  const belowMat = new StandardMaterial('cityBelowMat', scene)
  belowMat.emissiveColor = Color3.FromHexString('#2a2440')
  belowMat.disableLighting = true
  below.material = belowMat
  below.isPickable = false

  const ring = MeshBuilder.CreateCylinder('skyline', { height: 160, diameter: 260, tessellation: 64, cap: 0, sideOrientation: 1 }, scene)
  ring.position.set(6.5, 20, 3.25)
  const mat = new StandardMaterial('skylineMat', scene)
  mat.emissiveTexture = tex
  mat.diffuseColor = Color3.Black()
  mat.specularColor = Color3.Black()
  mat.disableLighting = true
  mat.backFaceCulling = false
  ring.material = mat
  ring.isPickable = false
  ring.rotation.y = -Math.PI / 2
  return ring
}
