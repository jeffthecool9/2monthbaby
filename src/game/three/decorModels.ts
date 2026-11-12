// Procedural 3D models for every shop item. Built on demand per placement.
import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, PlaneGeometry, PointLight, SphereGeometry, SRGBColorSpace, TorusGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CATALOG, type CatalogItem } from '../play/decor'

const std = (color: string, roughness = 0.6, metalness = 0) => new MeshStandardMaterial({ color: new Color(color), roughness, metalness })
const soft = (color: string) => new MeshPhysicalMaterial({ color: new Color(color), roughness: 0.95, sheen: 0.6, sheenColor: new Color('#ffffff') })
const wood = () => std('#b88b62', 0.55)
const brass = () => std('#c9a46a', 0.3, 1)

function rbox(g: Group, w: number, h: number, d: number, r: number, m: MeshStandardMaterial, x: number, y: number, z: number) {
  const mesh = new Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), m)
  mesh.position.set(x, y, z)
  g.add(mesh)
  return mesh
}
function cyl(g: Group, rt: number, rb: number, h: number, m: MeshStandardMaterial, x: number, y: number, z: number, segs = 24) {
  const mesh = new Mesh(new CylinderGeometry(rt, rb, h, segs), m)
  mesh.position.set(x, y, z)
  g.add(mesh)
  return mesh
}
function ball(g: Group, r: number, m: MeshStandardMaterial, x: number, y: number, z: number, sy = 1) {
  const mesh = new Mesh(new SphereGeometry(r, 20, 14), m)
  mesh.position.set(x, y, z)
  mesh.scale.y = sy
  g.add(mesh)
  return mesh
}

function picture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void): Mesh {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = Math.round((512 * h) / w)
  const ctx = c.getContext('2d')!
  draw(ctx, c.width, c.height)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: tex, roughness: 0.85 }))
}

function framed(g: Group, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void, frameColor = '#2a2622') {
  rbox(g, w + 0.08, h + 0.08, 0.035, 0.01, std(frameColor, 0.4), 0, 0, 0)
  const pic = picture(w, h, draw)
  pic.position.z = 0.02
  g.add(pic)
}

/** Model + a per-frame animator for the lively ones (lights flicker, fish swim, records spin). */
export type DecorModel = { group: Group; update?: (t: number) => void; light?: PointLight }

export function buildDecor(itemId: string, lite = false): DecorModel {
  const item = CATALOG.find((c) => c.id === itemId) as CatalogItem
  const g = new Group()
  let update: ((t: number) => void) | undefined
  let light: PointLight | undefined
  const c = item.color
  switch (item.id) {
    case 'armchair': {
      const f = soft(c)
      rbox(g, 0.7, 0.22, 0.7, 0.06, f, 0, 0.26, 0)
      rbox(g, 0.62, 0.14, 0.56, 0.06, f, 0, 0.44, 0.04)
      rbox(g, 0.7, 0.5, 0.18, 0.08, f, 0, 0.55, -0.26)
      for (const sx of [-1, 1]) rbox(g, 0.14, 0.4, 0.66, 0.07, f, sx * 0.29, 0.44, 0)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.02, 0.016, 0.16, wood(), sx * 0.28, 0.08, sz * 0.28, 10)
      break
    }
    case 'beanbag': {
      ball(g, 0.42, soft(c), 0, 0.3, 0, 0.72)
      ball(g, 0.3, soft(c), 0, 0.5, -0.1, 0.5)
      break
    }
    case 'stool': {
      cyl(g, 0.18, 0.18, 0.05, wood(), 0, 0.46, 0, 24)
      for (let i = 0; i < 3; i++) {
        const leg = cyl(g, 0.018, 0.014, 0.46, wood(), Math.cos((i / 3) * Math.PI * 2) * 0.12, 0.23, Math.sin((i / 3) * Math.PI * 2) * 0.12, 8)
        leg.rotation.z = Math.cos((i / 3) * Math.PI * 2) * 0.15
        leg.rotation.x = -Math.sin((i / 3) * Math.PI * 2) * 0.15
      }
      break
    }
    case 'loveseat': {
      const v = soft(c)
      rbox(g, 1.3, 0.24, 0.7, 0.06, v, 0, 0.26, 0)
      for (const sx of [-0.32, 0.32]) rbox(g, 0.6, 0.14, 0.56, 0.06, v, sx, 0.44, 0.04)
      rbox(g, 1.3, 0.48, 0.18, 0.1, v, 0, 0.56, -0.26)
      for (const sx of [-1, 1]) rbox(g, 0.12, 0.42, 0.66, 0.06, v, sx * 0.6, 0.45, 0)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.02, 0.016, 0.16, brass(), sx * 0.58, 0.08, sz * 0.28, 10)
      break
    }
    case 'side-table': {
      cyl(g, 0.22, 0.22, 0.03, std('#ffffff', 0.2), 0, 0.5, 0, 32)
      cyl(g, 0.02, 0.02, 0.5, brass(), 0, 0.25, 0, 8)
      cyl(g, 0.14, 0.14, 0.02, brass(), 0, 0.01, 0, 24)
      break
    }
    case 'desk': {
      rbox(g, 1.2, 0.04, 0.6, 0.01, std('#e9e2d9', 0.5), 0, 0.74, 0)
      for (const sx of [-1, 1]) rbox(g, 0.04, 0.72, 0.5, 0.01, std('#2b2b33', 0.4, 0.5), sx * 0.56, 0.36, 0)
      rbox(g, 0.5, 0.32, 0.03, 0.01, std('#111114', 0.3, 0.5), 0.15, 0.93, -0.15)
      const screen = new Mesh(new PlaneGeometry(0.46, 0.27), new MeshBasicMaterial({ color: '#6fb3ff', toneMapped: false }))
      screen.position.set(0.15, 0.93, -0.13)
      g.add(screen)
      update = (t) => ((screen.material as MeshBasicMaterial).color.setHSL(0.58 + Math.sin(t / 2000) * 0.05, 0.7, 0.6))
      break
    }
    case 'bookshelf': {
      rbox(g, 0.9, 1.8, 0.35, 0.01, std(c, 0.6), 0, 0.9, 0)
      const books = ['#c75b7a', '#5c8f4a', '#4a6fb0', '#f2c14e', '#e9e2d9', '#2b2b33']
      for (let s = 0; s < 4; s++) {
        rbox(g, 0.86, 0.02, 0.33, 0.005, std('#8a6a4a'), 0, 0.36 + s * 0.42, 0)
        for (let b = 0; b < 9; b++) rbox(g, 0.06, 0.26 + (b % 3) * 0.03, 0.22, 0.005, std(books[(b + s) % books.length], 0.7), -0.36 + b * 0.09, 0.52 + s * 0.42, 0.02)
      }
      break
    }
    case 'bar-cart': {
      for (const y of [0.3, 0.75]) rbox(g, 0.7, 0.02, 0.4, 0.005, brass(), 0, y, 0)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.01, 0.01, 0.78, brass(), sx * 0.33, 0.39, sz * 0.18, 8)
      for (let i = 0; i < 3; i++) cyl(g, 0.03, 0.03, 0.22, new MeshPhysicalMaterial({ color: ['#6b2d3f', '#b8d9a0', '#ffd27a'][i], roughness: 0.1, transmission: 0.5, transparent: true }), -0.2 + i * 0.18, 0.88, 0, 12)
      break
    }
    case 'floor-lamp': {
      cyl(g, 0.14, 0.16, 0.03, brass(), 0, 0.015, 0, 24)
      const arm = cyl(g, 0.012, 0.012, 1.9, brass(), 0.4, 1.0, 0, 8)
      arm.rotation.z = -0.45
      const shade = new Mesh(new SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: '#fff6e8', emissive: '#ffcf95', emissiveIntensity: 0.9, side: DoubleSide }))
      shade.rotation.x = Math.PI
      shade.position.set(0.78, 1.75, 0)
      g.add(shade)
      if (!lite) {
        light = new PointLight('#ffc48a', 2.2, 4, 2)
        light.position.set(0.78, 1.6, 0)
        g.add(light)
      }
      break
    }
    case 'table-lamp': {
      cyl(g, 0.05, 0.07, 0.22, std('#fff2dc', 0.5), 0, 0.11, 0, 16)
      const cap = ball(g, 0.15, new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.6 }), 0, 0.26, 0, 0.7)
      cap.scale.y = 0.6
      if (!lite) {
        light = new PointLight('#ffb3cd', 1.2, 2.5, 2)
        light.position.y = 0.2
        g.add(light)
      }
      break
    }
    case 'neon-heart': {
      const heart = new Mesh(new TorusGeometry(0.22, 0.018, 12, 48), new MeshBasicMaterial({ color: new Color(c).multiplyScalar(2.5), toneMapped: false }))
      heart.scale.set(1, 0.9, 1)
      g.add(heart)
      const heart2 = heart.clone()
      heart2.position.set(0.18, 0.12, 0)
      heart2.scale.setScalar(0.6)
      g.add(heart2)
      if (!lite) {
        light = new PointLight(c, 1.6, 3, 2)
        light.position.z = 0.15
        g.add(light)
      }
      update = (t) => {
        const k = 0.75 + Math.sin(t / 500) * 0.25
        ;(heart.material as MeshBasicMaterial).color.set(c).multiplyScalar(2 + k)
        if (light) light.intensity = 1.2 + k
      }
      break
    }
    case 'candles': {
      const flames: Mesh[] = []
      for (let i = 0; i < 3; i++) {
        const h = 0.08 + i * 0.04
        cyl(g, 0.025, 0.025, h, std(c, 0.7), -0.08 + i * 0.08, h / 2, 0, 12)
        const f = ball(g, 0.012, new MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }) as never, -0.08 + i * 0.08, h + 0.02, 0, 1.6)
        flames.push(f)
      }
      if (!lite) {
        light = new PointLight('#ffb35c', 0.8, 1.6, 2)
        light.position.y = 0.25
        g.add(light)
      }
      update = (t) => flames.forEach((f, i) => f.scale.set(1 + Math.sin(t / 60 + i) * 0.15, 1.6 + Math.sin(t / 47 + i) * 0.3, 1))
      break
    }
    case 'monstera': {
      cyl(g, 0.2, 0.16, 0.3, std('#d9a07a', 0.9), 0, 0.15, 0, 20)
      const leaf = std(c, 0.7)
      for (let i = 0; i < 7; i++) {
        const l = ball(g, 0.2, leaf, Math.cos(i * 0.9) * 0.22, 0.55 + (i % 3) * 0.18, Math.sin(i * 0.9) * 0.22, 0.25)
        l.rotation.set(0.6, i * 0.9, 0.3)
        cyl(g, 0.008, 0.01, 0.4, std('#5c8f4a'), Math.cos(i * 0.9) * 0.1, 0.45 + (i % 3) * 0.1, Math.sin(i * 0.9) * 0.1, 6).rotation.set(0.4, 0, Math.cos(i * 0.9) * 0.6)
      }
      break
    }
    case 'cactus': {
      cyl(g, 0.12, 0.1, 0.14, std('#d9a07a', 0.9), 0, 0.07, 0, 16)
      cyl(g, 0.06, 0.07, 0.34, std(c, 0.8), 0, 0.3, 0, 12)
      const arm = cyl(g, 0.035, 0.035, 0.16, std(c, 0.8), 0.1, 0.36, 0, 10)
      arm.rotation.z = 0.5
      ball(g, 0.03, std('#ff8fa8', 0.6), 0, 0.49, 0)
      break
    }
    case 'bonsai': {
      rbox(g, 0.36, 0.1, 0.24, 0.02, std('#3b4f8a', 0.4), 0, 0.05, 0)
      const trunk = cyl(g, 0.02, 0.035, 0.28, std('#5a3a2e', 0.9), 0, 0.24, 0, 8)
      trunk.rotation.z = 0.25
      for (let i = 0; i < 4; i++) ball(g, 0.1, std(c, 0.8), -0.1 + i * 0.07, 0.38 + (i % 2) * 0.07, (i % 2) * 0.05 - 0.02, 0.5)
      break
    }
    case 'flowers': {
      cyl(g, 0.05, 0.04, 0.2, new MeshPhysicalMaterial({ color: '#dff3ff', roughness: 0.05, transmission: 0.7, transparent: true }), 0, 0.1, 0, 16)
      for (let i = 0; i < 5; i++) {
        cyl(g, 0.004, 0.004, 0.22, std('#5c8f4a'), (i - 2) * 0.02, 0.28, 0, 6)
        ball(g, 0.03, std(['#ff8fa8', '#ffd27a', '#ff6f9c', '#ffb3cd', '#ff8fa8'][i], 0.6), (i - 2) * 0.03, 0.41, 0, 1.3)
      }
      break
    }
    case 'rug-round': {
      const rug = new Mesh(new CylinderGeometry(0.8, 0.8, 0.012, 48), std(c, 1))
      rug.position.y = 0.006
      g.add(rug)
      const ring = new Mesh(new TorusGeometry(0.6, 0.02, 6, 48), std('#d9a7b5', 1))
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.013
      g.add(ring)
      break
    }
    case 'teddy': {
      const fur = std(c, 1)
      ball(g, 0.26, fur, 0, 0.28, 0, 0.9)
      ball(g, 0.2, fur, 0, 0.62, 0)
      for (const sx of [-1, 1]) {
        ball(g, 0.07, fur, sx * 0.16, 0.78, 0)
        ball(g, 0.09, fur, sx * 0.3, 0.3, 0.05)
        ball(g, 0.1, fur, sx * 0.16, 0.08, 0.16)
      }
      ball(g, 0.07, std('#e8c6a8', 1), 0, 0.57, 0.17, 0.8)
      ball(g, 0.03, std('#2a1d1a', 0.4), 0, 0.6, 0.22)
      for (const sx of [-1, 1]) ball(g, 0.02, std('#2a1d1a', 0.4), sx * 0.07, 0.67, 0.18)
      break
    }
    case 'cat-tree': {
      rbox(g, 0.6, 0.04, 0.6, 0.01, std(c, 1), 0, 0.02, 0)
      cyl(g, 0.05, 0.05, 1.3, std('#d9c4a0', 1), 0.15, 0.65, 0.15, 12)
      rbox(g, 0.45, 0.04, 0.45, 0.01, std(c, 1), 0.15, 0.7, 0.15)
      rbox(g, 0.4, 0.04, 0.4, 0.01, std(c, 1), -0.05, 1.3, 0.05)
      const cat = ball(g, 0.12, std('#f2a65a', 1), -0.05, 1.4, 0.05, 0.7)
      cat.scale.z = 1.5
      ball(g, 0.08, std('#f2a65a', 1), -0.05, 1.47, 0.22)
      update = (t) => (cat.scale.y = 0.7 + Math.sin(t / 900) * 0.03)
      break
    }
    case 'record-player': {
      rbox(g, 0.5, 0.1, 0.4, 0.02, std(c, 0.5), 0, 0.05, 0)
      const disc = cyl(g, 0.15, 0.15, 0.006, std('#111114', 0.3), -0.05, 0.105, 0, 48)
      cyl(g, 0.05, 0.05, 0.008, std('#c75b7a', 0.5), -0.05, 0.11, 0, 24)
      const arm = cyl(g, 0.006, 0.006, 0.18, brass(), 0.14, 0.13, -0.1, 6)
      arm.rotation.set(1.3, 0, 0.5)
      update = (t) => (disc.rotation.y = t / 1800)
      break
    }
    case 'aquarium': {
      rbox(g, 0.8, 0.5, 0.4, 0.01, std('#2b2b33', 0.4), 0, 0.03, 0)
      const glass = new Mesh(new BoxGeometry(0.76, 0.46, 0.36), new MeshPhysicalMaterial({ color: c, roughness: 0.05, transmission: 0.7, transparent: true, opacity: 0.6 }))
      glass.position.y = 0.3
      g.add(glass)
      const fish: Mesh[] = []
      for (let i = 0; i < 4; i++) {
        const f = ball(g, 0.03, std(['#ff8c42', '#ffd27a', '#ff4f6a', '#6fb3ff'][i], 0.5), 0, 0.3, 0, 0.6)
        f.scale.x = 1.5
        fish.push(f)
      }
      ball(g, 0.1, std('#5c8f4a', 0.9), 0.25, 0.12, 0, 1.5)
      if (!lite) {
        light = new PointLight('#8fd3ff', 0.8, 1.5, 2)
        light.position.y = 0.45
        g.add(light)
      }
      update = (t) => fish.forEach((f, i) => {
        f.position.set(Math.sin(t / 1400 + i * 1.6) * 0.3, 0.2 + ((i * 0.07) % 0.2) + Math.sin(t / 900 + i) * 0.03, Math.cos(t / 1700 + i) * 0.1)
        f.rotation.y = Math.cos(t / 1400 + i * 1.6) > 0 ? 0 : Math.PI
      })
      break
    }
    case 'poster-sunset':
      framed(g, 0.7, 0.9, (ctx, W, H) => {
        const gr = ctx.createLinearGradient(0, 0, 0, H)
        gr.addColorStop(0, '#5a3d8a'); gr.addColorStop(0.5, '#ff8c6b'); gr.addColorStop(1, '#ffd27a')
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff1c2'; ctx.beginPath(); ctx.arc(W / 2, H * 0.55, W * 0.18, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#2b1f3a'; ctx.fillRect(0, H * 0.7, W, H * 0.3)
        for (let i = 0; i < 9; i++) ctx.fillRect(i * (W / 9), H * 0.7 - 30 - (i % 3) * 40, W / 12, 200)
      }, '#f1e7df')
      break
    case 'poster-moon':
      framed(g, 0.55, 0.75, (ctx, W, H) => {
        ctx.fillStyle = '#0d1030'; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.arc(W * 0.55, H * 0.4, W * 0.22, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#0d1030'; ctx.beginPath(); ctx.arc(W * 0.65, H * 0.36, W * 0.19, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#ffffff'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % H, 3, 3)
      })
      break
    case 'photo-wall':
      for (let i = 0; i < 6; i++) {
        const sub = new Group()
        framed(sub, 0.28, 0.22, (ctx, W, H) => {
          ctx.fillStyle = ['#ffd6e7', '#c9e4ff', '#ffe8c2', '#d6f5d6', '#f3d9ff', '#ffe1ec'][i]; ctx.fillRect(0, 0, W, H)
          ctx.font = `${H * 0.6}px serif`; ctx.textAlign = 'center'; ctx.fillText(['💑', '🌅', '🍜', '🎡', '💐', '🐾'][i], W / 2, H * 0.72)
        }, '#ffffff')
        sub.position.set(-0.4 + (i % 3) * 0.4, 0.14 - Math.floor(i / 3) * 0.28, 0)
        sub.rotation.z = (i % 2 ? 1 : -1) * 0.03
        g.add(sub)
      }
      break
    case 'mirror': {
      const ring = new Mesh(new TorusGeometry(0.33, 0.025, 12, 48), brass())
      g.add(ring)
      const face = new Mesh(new CylinderGeometry(0.32, 0.32, 0.01, 48), new MeshStandardMaterial({ color: '#eef3f8', roughness: 0.02, metalness: 1, envMapIntensity: 2 }))
      face.rotation.x = Math.PI / 2
      g.add(face)
      break
    }
    case 'clock': {
      const face = cyl(g, 0.2, 0.2, 0.03, std('#f6f1ea', 0.5), 0, 0, 0, 40)
      face.rotation.x = Math.PI / 2
      const rim = new Mesh(new TorusGeometry(0.2, 0.015, 8, 48), std(c, 0.4))
      g.add(rim)
      const hour = rbox(g, 0.02, 0.1, 0.01, 0.005, std(c, 0.4), 0, 0.05, 0.02)
      const minute = rbox(g, 0.014, 0.15, 0.01, 0.005, std(c, 0.4), 0, 0.075, 0.025)
      update = () => {
        const d = new Date()
        const kl = (d.getUTCHours() + 8) % 24 + d.getUTCMinutes() / 60
        hour.rotation.z = -((kl % 12) / 12) * Math.PI * 2
        hour.position.set(Math.sin(hour.rotation.z) * -0.05, Math.cos(hour.rotation.z) * 0.05, 0.02)
        minute.rotation.z = -(d.getUTCMinutes() / 60) * Math.PI * 2
        minute.position.set(Math.sin(minute.rotation.z) * -0.075, Math.cos(minute.rotation.z) * 0.075, 0.025)
      }
      break
    }
  }
  g.traverse((o) => {
    const m = o as Mesh
    if (m.isMesh) {
      m.castShadow = !item.wall
      m.receiveShadow = true
    }
  })
  return { group: g, update, light }
}
