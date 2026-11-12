// Things you can see while a chore happens: the pan and the food, the plates and bubbles, the
// watering can, the duvet smoothing out, sparkles on scrubbed tiles, bubbles in the bath.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial,
  MeshStandardMaterial, Points, PointsMaterial, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3,
} from 'three'
import type { ActivityId } from '../play/minigame'
import { FURNITURE } from '../world/layout'

const f = (id: string) => FURNITURE.find((x) => x.id === id)!
const KITCHEN_X = 12.5

function sprite(color: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Rising particles (steam, bubbles, sparkles) in a small box above `origin`. */
function fountain(origin: Vector3, n: number, color: string, size: number, spread: number, rise: number, opacity = 0.7) {
  const geo = new BufferGeometry()
  const p = new Float32Array(n * 3), life = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    life[i] = Math.random()
    p.set([origin.x + (Math.random() - 0.5) * spread, origin.y + life[i] * rise, origin.z + (Math.random() - 0.5) * spread], i * 3)
  }
  geo.setAttribute('position', new BufferAttribute(p, 3))
  const points = new Points(geo, new PointsMaterial({ size, map: sprite(color), transparent: true, opacity, depthWrite: false, blending: AdditiveBlending }))
  const update = (dt: number) => {
    for (let i = 0; i < n; i++) {
      life[i] += dt / 1800
      if (life[i] > 1) {
        life[i] = 0
        p[i * 3] = origin.x + (Math.random() - 0.5) * spread
        p[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread
      }
      p[i * 3 + 1] = origin.y + life[i] * rise
      p[i * 3] += Math.sin(life[i] * 9 + i) * 0.0008
    }
    geo.attributes.position.needsUpdate = true
  }
  return { points, update }
}

export type ChoreProps = {
  root: Group
  /** 0..1 how far along the chore is; drives food appearing, plates stacking, duvet flattening. */
  setProgress(p: number): void
  update(dt: number, t: number): void
  dispose(): void
}

const steel = new MeshStandardMaterial({ color: '#cfd3d8', roughness: 0.25, metalness: 0.9 })
const dark = new MeshStandardMaterial({ color: '#2b2b2f', roughness: 0.5, metalness: 0.6 })
const porcelain = new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.1, clearcoat: 1 })

export function choreProps(activity: ActivityId): ChoreProps | null {
  const root = new Group()
  const movers: ((dt: number, t: number) => void)[] = []
  let setProgress: (p: number) => void = () => {}

  switch (activity) {
    case 'cook': {
      const k = f('kitchen')
      const base = new Vector3(KITCHEN_X, 0.92, k.pos.z + 0.35)
      const pan = new Mesh(new CylinderGeometry(0.17, 0.15, 0.06, 32, 1, true), dark)
      pan.position.copy(base).add(new Vector3(0, 0.03, 0))
      const panBottom = new Mesh(new CylinderGeometry(0.15, 0.15, 0.01, 32), dark)
      panBottom.position.copy(base)
      const handle = new Mesh(new CylinderGeometry(0.012, 0.012, 0.2, 8), dark)
      handle.rotation.z = Math.PI / 2
      handle.position.copy(base).add(new Vector3(-0.26, 0.03, 0))
      const flame = new Mesh(new TorusGeometry(0.1, 0.012, 8, 24), new MeshStandardMaterial({ color: '#4ea1ff', emissive: '#3c8dff', emissiveIntensity: 2 }))
      flame.rotation.x = Math.PI / 2
      flame.position.copy(base).add(new Vector3(0, -0.015, 0))
      // Food: rice mound + veg pieces + an egg, revealed as the chore progresses.
      const food = new Group()
      const rice = new Mesh(new SphereGeometry(0.11, 20, 12), new MeshStandardMaterial({ color: '#fff6e6', roughness: 0.95 }))
      rice.scale.y = 0.45
      food.add(rice)
      const vegColors = ['#5fbf5a', '#ff8c42', '#ff4f6a', '#f6d55c']
      for (let i = 0; i < 8; i++) {
        const v = new Mesh(new SphereGeometry(0.018, 8, 6), new MeshStandardMaterial({ color: vegColors[i % 4], roughness: 0.6 }))
        v.position.set(Math.cos(i * 0.8) * 0.07, 0.04, Math.sin(i * 0.8) * 0.07)
        food.add(v)
      }
      const egg = new Mesh(new SphereGeometry(0.035, 12, 8), new MeshStandardMaterial({ color: '#ffb400', roughness: 0.4 }))
      egg.scale.y = 0.5
      egg.position.set(0.02, 0.05, -0.02)
      food.add(egg)
      food.position.copy(base).add(new Vector3(0, 0.02, 0))
      food.scale.setScalar(0.01)
      const steam = fountain(base.clone().add(new Vector3(0, 0.08, 0)), 40, 'rgba(255,255,255,0.55)', 0.05, 0.16, 0.35, 0.5)
      root.add(pan, panBottom, handle, flame, food, steam.points)
      movers.push((dt, t) => {
        steam.update(dt)
        flame.scale.setScalar(1 + Math.sin(t / 60) * 0.06)
        food.rotation.y += dt / 2500
      })
      setProgress = (p) => {
        food.scale.setScalar(0.01 + Math.min(1, p * 1.3) * 0.99)
        steam.points.visible = p > 0.1
      }
      break
    }
    case 'dishes': {
      const k = f('kitchen')
      const base = new Vector3(KITCHEN_X, 0.9, k.pos.z - 0.55)
      const sink = new Mesh(new CylinderGeometry(0.22, 0.2, 0.16, 24, 1, true), steel)
      sink.position.copy(base).add(new Vector3(0, -0.07, 0))
      const water = new Mesh(new CylinderGeometry(0.2, 0.2, 0.01, 24), new MeshPhysicalMaterial({ color: '#bfe6f2', roughness: 0.02, transmission: 0.5, transparent: true, opacity: 0.8 }))
      water.position.copy(base).add(new Vector3(0, -0.03, 0))
      const stack = new Group()
      const plates: Mesh[] = []
      for (let i = 0; i < 5; i++) {
        const plate = new Mesh(new CylinderGeometry(0.12, 0.1, 0.012, 32), porcelain)
        plate.position.set(0.32, 0.012 * i + 0.006, 0)
        plate.visible = false
        plates.push(plate)
        stack.add(plate)
      }
      stack.position.copy(base)
      const bubbles = fountain(base.clone(), 30, 'rgba(230,245,255,0.9)', 0.035, 0.3, 0.25, 0.8)
      root.add(sink, water, stack, bubbles.points)
      movers.push((dt) => bubbles.update(dt))
      setProgress = (p) => plates.forEach((pl, i) => (pl.visible = p > (i + 1) / 5.5))
      break
    }
    case 'water': {
      const pl = f('plant')
      const can = new Group()
      const body = new Mesh(new CylinderGeometry(0.08, 0.09, 0.16, 16), new MeshStandardMaterial({ color: '#7fb2d9', roughness: 0.4, metalness: 0.3 }))
      const spout = new Mesh(new CylinderGeometry(0.012, 0.02, 0.22, 8), body.material)
      spout.rotation.z = -1.1
      spout.position.set(0.14, 0.05, 0)
      can.add(body, spout)
      can.position.set(pl.pos.x - 0.35, 0.95, pl.pos.z - 0.25)
      can.rotation.z = -0.35
      const drops = fountain(new Vector3(pl.pos.x - 0.14, 0.6, pl.pos.z - 0.2), 24, 'rgba(170,215,255,0.95)', 0.03, 0.08, -0.5, 0.9)
      root.add(can, drops.points)
      movers.push((dt, t) => {
        drops.update(dt)
        can.rotation.z = -0.35 - Math.sin(t / 900) * 0.15
      })
      setProgress = (p) => (drops.points.visible = p > 0.05 && p < 0.95)
      break
    }
    case 'bed': {
      const b = f('bed')
      // A rumpled duvet that smooths out: scale its wrinkle bumps down with progress.
      const bumps: Mesh[] = []
      const mat = new MeshStandardMaterial({ color: '#f6cdd8', roughness: 0.96 })
      for (let i = 0; i < 6; i++) {
        const m = new Mesh(new SphereGeometry(0.16, 12, 8), mat)
        m.scale.set(1.4, 0.35, 1)
        m.position.set(b.pos.x + ((i % 3) - 1) * 0.42, 0.6, b.pos.z + 0.25 + Math.floor(i / 3) * 0.5)
        bumps.push(m)
        root.add(m)
      }
      setProgress = (p) => bumps.forEach((m, i) => m.scale.setScalar(Math.max(0.001, 1 - Math.max(0, p * 6 - i)) * 1).multiply(new Vector3(1.4, 0.35, 1)))
      break
    }
    case 'cleanbath': {
      const bt = f('bath')
      const sparkle = fountain(new Vector3(bt.pos.x + 0.5, 0.7, bt.pos.z), 36, 'rgba(255,250,220,1)', 0.05, 0.9, 0.5, 0.9)
      const sponge = new Mesh(new SphereGeometry(0.06, 10, 8), new MeshStandardMaterial({ color: '#ffd84d', roughness: 1 }))
      sponge.scale.set(1.3, 0.7, 1)
      sponge.position.set(bt.pos.x + 0.3, 0.75, bt.pos.z)
      root.add(sparkle.points, sponge)
      movers.push((dt, t) => {
        sparkle.update(dt)
        sponge.position.x = bt.pos.x + 0.3 + Math.sin(t / 350) * 0.2
        sponge.position.z = bt.pos.z + Math.cos(t / 500) * 0.4
      })
      break
    }
    case 'bath': {
      const bt = f('bath')
      const foam = new Group()
      const mat = new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, transmission: 0.2, transparent: true, opacity: 0.9, clearcoat: 1 })
      for (let i = 0; i < 40; i++) {
        const s = new Mesh(new SphereGeometry(0.04 + Math.random() * 0.05, 10, 8), mat)
        s.position.set(bt.pos.x + (Math.random() - 0.5) * 0.6, 0.52, bt.pos.z + (Math.random() - 0.5) * 1.4)
        foam.add(s)
      }
      const rising = fountain(new Vector3(bt.pos.x, 0.6, bt.pos.z), 30, 'rgba(220,240,255,0.9)', 0.05, 0.5, 0.8, 0.8)
      root.add(foam, rising.points)
      movers.push((dt, t) => {
        rising.update(dt)
        foam.children.forEach((c, i) => (c.position.y = 0.52 + Math.sin(t / 700 + i) * 0.01))
      })
      break
    }
    default:
      return null
  }
  return {
    root,
    setProgress,
    update: (dt, t) => movers.forEach((m) => m(dt, t)),
    dispose() {
      root.removeFromParent()
      root.traverse((o) => {
        const m = o as Mesh
        if (m.geometry) m.geometry.dispose()
      })
    },
  }
}

export const propColor = new Color()
