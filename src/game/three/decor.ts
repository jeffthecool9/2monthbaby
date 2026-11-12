// Birthday decorations: balloons over the sofa, a cake with a flickering candle, a bunting banner.
import { CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, PointLight, SphereGeometry, SRGBColorSpace, TubeGeometry, CatmullRomCurve3, Vector3 } from 'three'
import { FURNITURE, UNIT } from '../world/layout'

const BALLOONS = ['#ff9ec4', '#ffd166', '#a0d8ff', '#c8b6ff', '#ffb3a7', '#b8f2c9', '#ff9ec4']

export function addBirthdayDecor(name: string): { root: Group; update(t: number): void } {
  const root = new Group()
  const sofa = FURNITURE.find((f) => f.id === 'sofa')!
  const table = FURNITURE.find((f) => f.id === 'coffeeTable')!

  const balloons = BALLOONS.map((hex, i) => {
    const m = new MeshPhysicalMaterial({ color: new Color(hex), roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.3 })
    const b = new Mesh(new SphereGeometry(0.16, 32, 24), m)
    b.scale.y = 1.18
    b.castShadow = true
    const x = sofa.pos.x + 0.15 * Math.cos(i * 2.1), z = sofa.pos.z - 0.95 + i * 0.32, y = 1.7 + (i % 2) * 0.2
    b.position.set(x, y, z)
    const string = new Mesh(new TubeGeometry(new CatmullRomCurve3([new Vector3(x, y - 0.18, z), new Vector3(x + 0.05, (y + 0.85) / 2, z), new Vector3(sofa.pos.x, 0.85, sofa.pos.z)]), 12, 0.003, 4), new MeshStandardMaterial({ color: '#ffffff' }))
    root.add(b, string)
    return { b, y, phase: i * 0.9 }
  })

  const top = 0.45
  const cake = new Group()
  const sponge = new Mesh(new CylinderGeometry(0.15, 0.15, 0.14, 48), new MeshStandardMaterial({ color: '#fff4f6', roughness: 0.7 }))
  sponge.position.y = 0.07
  const icing = new Mesh(new CylinderGeometry(0.155, 0.155, 0.035, 48), new MeshPhysicalMaterial({ color: '#ff8fb3', roughness: 0.3, clearcoat: 0.6 }))
  icing.position.y = 0.145
  const candle = new Mesh(new CylinderGeometry(0.008, 0.008, 0.08, 12), new MeshStandardMaterial({ color: '#a0d8ff' }))
  candle.position.y = 0.2
  const flame = new Mesh(new SphereGeometry(0.014, 12, 8), new MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }))
  flame.scale.y = 1.8
  flame.position.y = 0.26
  const glow = new PointLight('#ffb35c', 0.8, 1.5, 2)
  glow.position.y = 0.3
  cake.add(sponge, icing, candle, flame, glow)
  cake.position.set(table.pos.x, top, table.pos.z)
  cake.traverse((o) => ((o as Mesh).castShadow = true))
  root.add(cake)

  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 200
  const ctx = c.getContext('2d')!
  const flags = ['#ff9ec4', '#ffd166', '#a0d8ff', '#c8b6ff']
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = flags[i % 4]
    ctx.beginPath()
    ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64 + 64, 0); ctx.lineTo(i * 64 + 32, 62)
    ctx.fill()
  }
  ctx.fillStyle = '#ff5f93'
  ctx.font = 'bold 74px Inter, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`Happy Birthday ${name}!`, 512, 158)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  const banner = new Mesh(new PlaneGeometry(3.4, 0.66), new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide }))
  banner.position.set(3.4, UNIT.wallHeight - 0.5, UNIT.depth - 0.3)
  banner.rotation.y = Math.PI
  root.add(banner)

  return {
    root,
    update(t: number) {
      for (const { b, y, phase } of balloons) {
        b.position.y = y + Math.sin(t / 900 + phase) * 0.04
        b.rotation.z = Math.sin(t / 1300 + phase) * 0.08
      }
      flame.scale.set(1 + Math.sin(t / 60) * 0.12, 1.8 + Math.sin(t / 47) * 0.25, 1)
      glow.intensity = 0.7 + Math.sin(t / 80) * 0.15
    },
  }
}
