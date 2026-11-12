// Street level ~28 floors below: roads with lane markings and moving cars, pavements, street lights,
// a park with trees and a pond, low-rise shops, and the plaza around our tower.
import {
  BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PlaneGeometry, RepeatWrapping, SphereGeometry, SRGBColorSpace,
} from 'three'
import { UNIT } from '../world/layout'
import type { Daylight } from '../world/daylight'
import { lowRise } from './buildings'

export const GROUND_Y = -84
const CX = UNIT.width / 2, CZ = UNIT.depth / 2

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function roadTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#2d2a35'
  ctx.fillRect(0, 0, 256, 256)
  // Asphalt grain
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
  ctx.fillStyle = '#f2e6c9'
  for (let y = 0; y < 256; y += 64) ctx.fillRect(124, y + 8, 8, 34) // centre dashes
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillRect(14, 0, 4, 256)
  ctx.fillRect(238, 0, 4, 256)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

type Road = { axis: 'x' | 'z'; at: number; from: number; to: number }
// Roads around our block: one runs right below the window (north), the others frame the area.
const ROADS: Road[] = [
  { axis: 'x', at: CZ + 34, from: CX - 420, to: CX + 420 },
  { axis: 'x', at: CZ - 40, from: CX - 420, to: CX + 420 },
  { axis: 'x', at: CZ + 150, from: CX - 420, to: CX + 420 },
  { axis: 'z', at: CX - 45, from: CZ - 420, to: CZ + 420 },
  { axis: 'z', at: CX + 55, from: CZ - 420, to: CZ + 420 },
  { axis: 'z', at: CX + 170, from: CZ - 420, to: CZ + 420 },
  { axis: 'z', at: CX - 165, from: CZ - 420, to: CZ + 420 },
]
const ROAD_W = 16

export type Streets = { root: Group; update(dt: number, t: number): void; setDaylight(d: Daylight): void }

export function buildStreets(opts: { lite?: boolean } = {}): Streets {
  const root = new Group()
  const r = rng(77)
  const movers: ((dt: number, t: number) => void)[] = []
  const dummy = new Object3D()
  const y0 = GROUND_Y

  // Ground: pavement everywhere, roads on top.
  const ground = new Mesh(new PlaneGeometry(900, 900), new MeshStandardMaterial({ color: '#8f8794', roughness: 0.95 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(CX, y0 - 0.05, CZ)
  ground.receiveShadow = true
  root.add(ground)

  const roadTex = roadTexture()
  for (const rd of ROADS) {
    const len = rd.to - rd.from
    const tex = roadTex.clone()
    tex.repeat.set(1, len / 16)
    tex.needsUpdate = true
    const m = new Mesh(new PlaneGeometry(ROAD_W, len), new MeshStandardMaterial({ map: tex, roughness: 0.8 }))
    m.rotation.x = -Math.PI / 2
    if (rd.axis === 'x') m.rotation.z = Math.PI / 2
    m.position.set(rd.axis === 'x' ? (rd.from + rd.to) / 2 : rd.at, y0 + 0.02, rd.axis === 'x' ? rd.at : (rd.from + rd.to) / 2)
    m.receiveShadow = true
    root.add(m)
  }

  // Park right below the window: lawn, winding path, pond, trees.
  const lawn = new Mesh(new PlaneGeometry(96, 100), new MeshStandardMaterial({ color: '#6f9a5f', roughness: 1 }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.set(CX + 5, y0 + 0.03, CZ + 92)
  const pond = new Mesh(new CylinderGeometry(14, 14, 0.2, 48), new MeshStandardMaterial({ color: '#5d8fb0', roughness: 0.05, metalness: 0.3, envMapIntensity: 1.5 }))
  pond.scale.z = 0.6
  pond.position.set(CX + 12, y0 + 0.08, CZ + 95)
  const path = new Mesh(new PlaneGeometry(4, 100), new MeshStandardMaterial({ color: '#d9cdb8', roughness: 1 }))
  path.rotation.x = -Math.PI / 2
  path.rotation.z = 0.35
  path.position.set(CX - 6, y0 + 0.05, CZ + 92)
  root.add(lawn, pond, path)

  // Plaza around our tower.
  const plaza = new Mesh(new PlaneGeometry(70, 60), new MeshStandardMaterial({ color: '#c9bfb6', roughness: 0.9 }))
  plaza.rotation.x = -Math.PI / 2
  plaza.position.set(CX, y0 + 0.03, CZ)
  root.add(plaza)

  // Trees: park, plaza edge and along the roads.
  const treeSpots: [number, number, number][] = []
  for (let i = 0; i < 70; i++) treeSpots.push([CX - 40 + r() * 90, CZ + 45 + r() * 95, 0.8 + r() * 0.6])
  for (const rd of ROADS) for (let s = rd.from + 10; s < rd.to; s += 22) {
    const off = ROAD_W / 2 + 3
    treeSpots.push(rd.axis === 'x' ? [s, rd.at + off, 0.7] : [rd.at + off, s, 0.7])
  }
  const n = opts.lite ? Math.min(140, treeSpots.length) : treeSpots.length
  const trunks = new InstancedMesh(new CylinderGeometry(0.35, 0.5, 4, 6), new MeshStandardMaterial({ color: '#6b4c3b', roughness: 1 }), n)
  const crowns = new InstancedMesh(new SphereGeometry(3.2, 10, 8), new MeshStandardMaterial({ color: '#5f8f4e', roughness: 0.9 }), n)
  const leaf = new Color()
  treeSpots.slice(0, n).forEach(([x, z, s], i) => {
    dummy.position.set(x, y0 + 2 * s, z)
    dummy.scale.setScalar(s)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    trunks.setMatrixAt(i, dummy.matrix)
    dummy.position.y = y0 + 5.6 * s
    dummy.scale.set(s, s * (0.9 + r() * 0.4), s)
    dummy.updateMatrix()
    crowns.setMatrixAt(i, dummy.matrix)
    crowns.setColorAt(i, leaf.setHSL(0.27 + r() * 0.06, 0.35 + r() * 0.15, 0.32 + r() * 0.12))
  })
  root.add(trunks, crowns)

  // Street lights with warm glowing heads.
  const lampSpots: [number, number][] = []
  for (const rd of ROADS) for (let s = rd.from + 5; s < rd.to; s += 30) {
    const off = ROAD_W / 2 + 1
    lampSpots.push(rd.axis === 'x' ? [s, rd.at - off] : [rd.at - off, s])
  }
  const poles = new InstancedMesh(new CylinderGeometry(0.12, 0.15, 7, 6), new MeshStandardMaterial({ color: '#3a3842', roughness: 0.5, metalness: 0.6 }), lampSpots.length)
  const headMat = new MeshBasicMaterial({ color: new Color('#ffd08a').multiplyScalar(2.2), toneMapped: false })
  const heads = new InstancedMesh(new SphereGeometry(0.45, 8, 6), headMat, lampSpots.length)
  lampSpots.forEach(([x, z], i) => {
    dummy.scale.setScalar(1)
    dummy.position.set(x, y0 + 3.5, z)
    dummy.updateMatrix()
    poles.setMatrixAt(i, dummy.matrix)
    dummy.position.y = y0 + 7.1
    dummy.updateMatrix()
    heads.setMatrixAt(i, dummy.matrix)
  })
  root.add(poles, heads)

  // Shophouses along the roads: the low-rise design with awnings and rooftop tanks, lit storefronts.
  const shopCount = opts.lite ? 50 : 110
  const shopDesign = lowRise()
  const shopFacade = new MeshStandardMaterial({ color: '#e8e2dc', roughness: 0.6, metalness: 0.15 })
  const shopSolid = new MeshStandardMaterial({ roughness: 0.85 })
  const shops = new InstancedMesh(shopDesign.facade, shopFacade, shopCount)
  const shopBodies = new InstancedMesh(shopDesign.solid, shopSolid, shopCount)
  const frontMat = new MeshBasicMaterial({ toneMapped: false })
  const fronts = new InstancedMesh(new BoxGeometry(1, 1, 1), frontMat, shopCount)
  const col = new Color()
  let placed = 0
  while (placed < shopCount) {
    const rd = ROADS[Math.floor(r() * ROADS.length)]
    const s = rd.from + 20 + r() * (rd.to - rd.from - 40)
    const side = r() < 0.5 ? -1 : 1
    const scale = 0.7 + r() * 0.5
    const depth = 14 * scale, w = 24 * scale
    const off = ROAD_W / 2 + 3 + depth / 2
    const x = rd.axis === 'x' ? s : rd.at + side * off, z = rd.axis === 'x' ? rd.at + side * off : s
    // Keep the park, the plaza and the space right under our window clear.
    if (Math.abs(x - CX) < 45 && z > CZ - 35 && z < CZ + 145) continue
    // Face the road: the awning is on the design's +z side.
    const yaw = rd.axis === 'x' ? (side > 0 ? Math.PI : 0) : side > 0 ? Math.PI / 2 : -Math.PI / 2
    dummy.position.set(x, y0, z)
    dummy.rotation.set(0, yaw, 0)
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    shops.setMatrixAt(placed, dummy.matrix)
    shopBodies.setMatrixAt(placed, dummy.matrix)
    shopBodies.setColorAt(placed, col.setHSL(0.05 + r() * 0.9, 0.2 + r() * 0.25, 0.55 + r() * 0.25))
    // Glowing ground-floor window strip facing the road.
    const fx = rd.axis === 'x' ? x : rd.at + side * (ROAD_W / 2 + 2.9), fz = rd.axis === 'x' ? rd.at + side * (ROAD_W / 2 + 2.9) : z
    dummy.position.set(fx, y0 + 1.6, fz)
    dummy.scale.set(rd.axis === 'x' ? w * 0.85 : 0.2, 2.2, rd.axis === 'x' ? 0.2 : w * 0.85)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    fronts.setMatrixAt(placed, dummy.matrix)
    fronts.setColorAt(placed, col.setHSL(0.08 + r() * 0.08, 0.7, 0.62 + r() * 0.2).multiplyScalar(1.4))
    placed++
  }
  root.add(shops, shopBodies, fronts)

  // Cars driving both ways on every road, with head- and tail-lights.
  const perRoad = opts.lite ? 6 : 12
  const carN = ROADS.length * perRoad
  const bodies = new InstancedMesh(new BoxGeometry(2, 1.5, 4.4), new MeshStandardMaterial({ roughness: 0.25, metalness: 0.6 }), carN)
  const cabins = new InstancedMesh(new BoxGeometry(1.8, 0.9, 2.2), new MeshStandardMaterial({ color: '#1d2230', roughness: 0.1, metalness: 0.8 }), carN)
  const carLightMat = new MeshBasicMaterial({ toneMapped: false })
  const lights = new InstancedMesh(new BoxGeometry(1.9, 0.3, 0.12), carLightMat, carN * 2)
  const carState = Array.from({ length: carN }, (_, i) => {
    const rd = ROADS[Math.floor(i / perRoad)]
    return { rd, s: rd.from + r() * (rd.to - rd.from), dir: i % 2 ? 1 : -1, speed: 9 + r() * 7 }
  })
  const palette = ['#e9e4dc', '#1e1e24', '#c23b4a', '#3e6fb0', '#f2c14e', '#8a8f99', '#ffffff', '#2f5d50']
  carState.forEach((_, i) => bodies.setColorAt(i, col.set(palette[i % palette.length])))
  const head = new Color('#fff4d8').multiplyScalar(3), tail = new Color('#ff3b3b').multiplyScalar(2.5)
  for (let i = 0; i < carN; i++) {
    lights.setColorAt(i * 2, head)
    lights.setColorAt(i * 2 + 1, tail)
  }
  root.add(bodies, cabins, lights)
  movers.push((dt) => {
    for (let i = 0; i < carN; i++) {
      const c = carState[i]
      c.s += c.dir * c.speed * dt / 1000
      if (c.s > c.rd.to) c.s = c.rd.from
      if (c.s < c.rd.from) c.s = c.rd.to
      const lane = c.dir * ROAD_W * 0.22
      const x = c.rd.axis === 'x' ? c.s : c.rd.at + lane
      const z = c.rd.axis === 'x' ? c.rd.at - lane : c.s
      const yaw = c.rd.axis === 'x' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : c.dir > 0 ? 0 : Math.PI
      dummy.rotation.set(0, yaw, 0)
      dummy.scale.setScalar(1)
      dummy.position.set(x, y0 + 0.85, z)
      dummy.updateMatrix()
      bodies.setMatrixAt(i, dummy.matrix)
      dummy.position.y = y0 + 1.9
      dummy.translateZ(-0.3)
      dummy.updateMatrix()
      cabins.setMatrixAt(i, dummy.matrix)
      dummy.position.set(x, y0 + 0.9, z)
      dummy.translateZ(2.22)
      dummy.updateMatrix()
      lights.setMatrixAt(i * 2, dummy.matrix)
      dummy.translateZ(-4.44)
      dummy.updateMatrix()
      lights.setMatrixAt(i * 2 + 1, dummy.matrix)
    }
    bodies.instanceMatrix.needsUpdate = true
    cabins.instanceMatrix.needsUpdate = true
    lights.instanceMatrix.needsUpdate = true
  })

  // A fountain in the plaza that pulses.
  const fountain = new Mesh(new ConeGeometry(1.2, 4, 16, 1, true), new MeshBasicMaterial({ color: '#cfeaff', transparent: true, opacity: 0.6 }))
  fountain.position.set(CX + 18, y0 + 2, CZ + 14)
  const basin = new Mesh(new CylinderGeometry(4, 4.2, 0.8, 32), new MeshStandardMaterial({ color: '#d8d2cb', roughness: 0.6 }))
  basin.position.set(CX + 18, y0 + 0.4, CZ + 14)
  root.add(fountain, basin)
  movers.push((_dt, t) => (fountain.scale.y = 0.85 + Math.sin(t / 300) * 0.15))

  const setDaylight = (d: Daylight) => {
    const on = d.streetLightsOn
    headMat.color.set('#ffd08a').multiplyScalar(on ? 2.2 : 0.35)
    frontMat.color.setScalar(on ? 1 : 0.22)
    carLightMat.color.setScalar(on ? 1 : 0.6)
    pond.material.envMapIntensity = 0.6 + d.night
  }
  return { root, update: (dt, t) => movers.forEach((m) => m(dt, t)), setDaylight }
}
