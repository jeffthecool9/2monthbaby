// The city outside the window: sunset sky, 3D towers with lit windows, moving traffic, clouds, a plane, birds.
import {
  AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, InstancedMesh,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Points,
  PointsMaterial, RepeatWrapping, ShaderMaterial, SphereGeometry, SRGBColorSpace, Sprite, SpriteMaterial, Vector3,
} from 'three'
import { UNIT } from '../world/layout'
import type { Daylight } from '../world/daylight'

import { GROUND_Y, buildStreets } from './streets'
const CENTRE = new Vector3(UNIT.width / 2, 0, UNIT.depth / 2)

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Facade texture: glass/concrete bands with randomly lit warm windows (emissive map). */
function facadeTextures(seed: number) {
  const r = rng(seed)
  const W = 256, H = 512, cols = 8, rows = 24
  const lit: [number, number][] = []
  const base = canvasTex(W, H, (ctx) => {
    ctx.fillStyle = '#4a4560'
    ctx.fillRect(0, 0, W, H)
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = 70 + Math.floor(r() * 30)
      ctx.fillStyle = `rgb(${v * 0.75},${v * 0.8},${v * 1.05})`
      ctx.fillRect(x * (W / cols) + 3, y * (H / rows) + 4, W / cols - 6, H / rows - 8)
      if (r() < 0.32) lit.push([x, y])
    }
  })
  const emissive = canvasTex(W, H, (ctx) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    for (const [x, y] of lit) {
      ctx.fillStyle = r() < 0.75 ? '#ffc477' : '#fff1d6'
      ctx.globalAlpha = 0.5 + r() * 0.5
      ctx.fillRect(x * (W / cols) + 4, y * (H / rows) + 5, W / cols - 8, H / rows - 10)
    }
  })
  for (const t of [base, emissive]) t.wrapS = t.wrapT = RepeatWrapping
  return { base, emissive }
}

export type City = { root: Group; update(dt: number, t: number): void; setDaylight(d: Daylight): void }

export function buildCity(opts: { lite?: boolean } = {}): City {
  const root = new Group()
  const movers: ((dt: number, t: number) => void)[] = []
  const r = rng(2807)

  // Sky dome: deep blue → violet → peach at the horizon, with a soft sun glow.
  const sky = new Mesh(
    new SphereGeometry(600, 48, 24),
    new ShaderMaterial({
      side: BackSide, depthWrite: false, fog: false,
      uniforms: {
        sunDir: { value: new Vector3(0.25, 0.08, 1).normalize() },
        top: { value: new Vector3(0.16, 0.17, 0.42) }, mid: { value: new Vector3(0.62, 0.38, 0.62) }, hor: { value: new Vector3(1.0, 0.72, 0.55) },
        sunStrength: { value: 1 }, night: { value: 0 },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vDir; uniform vec3 sunDir, top, mid, hor; uniform float sunStrength, night;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          vec3 below = mix(hor, vec3(0.1,0.09,0.14), 0.5);
          vec3 c = h > 0.0 ? mix(hor, mix(mid, top, smoothstep(0.15,0.75,h)), smoothstep(0.0,0.25,h)) : mix(hor, below, smoothstep(0.0,0.2,-h));
          float s = max(dot(d, sunDir), 0.0);
          c += (vec3(1.0,0.75,0.45) * pow(s, 18.0) * 0.9 + vec3(1.0,0.85,0.6) * pow(s, 400.0) * 2.5) * sunStrength;
          // Stars fade in at night.
          vec3 cell = floor(d * 140.0);
          float star = step(0.9985, hash(cell)) * smoothstep(0.05, 0.4, d.y);
          c += vec3(star) * night * 0.9;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  )
  sky.position.copy(CENTRE)
  root.add(sky)

  // Street level: roads, cars, park, shops and lights.
  const streets = buildStreets(opts)
  root.add(streets.root)
  movers.push(streets.update)

  // Towers: instanced boxes in rings around us, three facade styles.
  const styles = [0, 1, 2].map((i) => facadeTextures(100 + i))
  const count = opts.lite ? 70 : 150
  const perStyle = Math.ceil(count / styles.length)
  const dummy = new Object3D()
  const tint = new Color()
  const facadeMats: MeshStandardMaterial[] = []
  styles.forEach((tx, si) => {
    const m = new MeshStandardMaterial({ map: tx.base, emissiveMap: tx.emissive, emissive: new Color('#ffffff'), emissiveIntensity: 1.25, roughness: 0.35, metalness: 0.4 })
    facadeMats.push(m)
    const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), m, perStyle)
    let i = 0
    while (i < perStyle) {
      const ang = r() * Math.PI * 2
      const dist = 190 + Math.pow(r(), 0.8) * 260
      const x = CENTRE.x + Math.cos(ang) * dist, z = CENTRE.z + Math.sin(ang) * dist
      const w = 10 + r() * 18, d = 10 + r() * 18
      // From our floor (~84 m up) nearby blocks sit below eye level; only far towers rise into the sky,
      // so the window shows a skyline with the sunset above it.
      const t = Math.min(1, (dist - 190) / 260)
      const maxTop = -10 + t * 90 + (r() < 0.1 ? 35 : 0)
      const h = Math.max(12, -GROUND_Y + maxTop * (0.45 + r() * 0.55))
      dummy.position.set(x, GROUND_Y + h / 2, z)
      dummy.scale.set(w, h, d)
      dummy.rotation.y = r() * Math.PI
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, tint.setHSL(0.68 + r() * 0.12, 0.15 + r() * 0.15, 0.62 + r() * 0.25))
      i++
    }
    // Repeat the facade over the height of each tower.
    mesh.geometry.attributes.uv.array.forEach((_, k, arr) => ((arr as Float32Array)[k] *= k % 2 ? 4 : 2))
    root.add(mesh)
    // Windows switch on and off over time.
    let acc = 0
    movers.push((dt) => {
      acc += dt
      if (acc < 2600 + si * 700) return
      acc = 0
      tx.emissive.offset.y = (tx.emissive.offset.y + 1 / 24) % 1
      tx.base.offset.y = tx.emissive.offset.y
    })
  })

  // Rooftop red beacons that blink.
  {
    const n = 40, geo = new BufferGeometry(), p = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const ang = r() * Math.PI * 2, dist = 90 + r() * 220
      p.set([CENTRE.x + Math.cos(ang) * dist, GROUND_Y + 120 + r() * 80, CENTRE.z + Math.sin(ang) * dist], i * 3)
    }
    geo.setAttribute('position', new BufferAttribute(p, 3))
    const m = new PointsMaterial({ color: '#ff4a5a', size: 2.2, transparent: true, depthWrite: false, blending: AdditiveBlending })
    root.add(new Points(geo, m))
    movers.push((_dt, t) => (m.opacity = 0.25 + 0.75 * (Math.sin(t / 600) > 0.3 ? 1 : 0.2)))
  }

  // Soft clouds drifting across the sunset.
  {
    const cloudTex = canvasTex(256, 128, (ctx) => {
      for (let i = 0; i < 26; i++) {
        const g = ctx.createRadialGradient(40 + Math.random() * 176, 50 + Math.random() * 40, 0, 40 + Math.random() * 176, 64, 30 + Math.random() * 30)
        g.addColorStop(0, 'rgba(255,225,230,0.5)')
        g.addColorStop(1, 'rgba(255,225,230,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 256, 128)
      }
    })
    for (let i = 0; i < (opts.lite ? 6 : 12); i++) {
      const sp = new Sprite(new SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.55 + r() * 0.35, color: new Color().setHSL(0.95, 0.5, 0.82 + r() * 0.1) }))
      const ang = r() * Math.PI * 2, dist = 260 + r() * 200
      sp.position.set(CENTRE.x + Math.cos(ang) * dist, 60 + r() * 90, CENTRE.z + Math.sin(ang) * dist)
      sp.scale.set(120 + r() * 120, 40 + r() * 30, 1)
      root.add(sp)
      const speed = 0.6 + r() * 0.8
      movers.push((dt) => {
        const a = Math.atan2(sp.position.z - CENTRE.z, sp.position.x - CENTRE.x) + (speed * dt) / 1000 / dist
        sp.position.x = CENTRE.x + Math.cos(a) * dist
        sp.position.z = CENTRE.z + Math.sin(a) * dist
      })
    }
  }

  // A plane crossing the sky with blinking navigation lights.
  {
    const plane = new Group()
    const red = new Mesh(new SphereGeometry(0.9, 8, 6), new MeshBasicMaterial({ color: '#ff3b4a', toneMapped: false }))
    const green = new Mesh(new SphereGeometry(0.9, 8, 6), new MeshBasicMaterial({ color: '#4dff8a', toneMapped: false }))
    const strobe = new Mesh(new SphereGeometry(1.1, 8, 6), new MeshBasicMaterial({ color: '#ffffff', toneMapped: false }))
    red.position.x = -6
    green.position.x = 6
    plane.add(red, green, strobe)
    root.add(plane)
    let u = 0
    movers.push((dt, t) => {
      u = (u + dt / 70000) % 1
      const a = -0.6 + u * 2.4
      plane.position.set(CENTRE.x + Math.cos(a) * 380, 170 + Math.sin(u * Math.PI) * 25, CENTRE.z + 160 + Math.sin(a) * 200)
      strobe.visible = Math.sin(t / 220) > 0.85
    })
  }

  // Birds: a small flock gliding past now and then.
  if (!opts.lite) {
    const n = 9, geo = new BufferGeometry(), p = new Float32Array(n * 12)
    geo.setAttribute('position', new BufferAttribute(p, 3))
    const birds = new LineSegments(geo, new LineBasicMaterial({ color: '#3a2a3f' }))
    root.add(birds)
    let u = 0
    movers.push((dt, t) => {
      u = (u + dt / 30000) % 1
      const cx = CENTRE.x - 60 + u * 120, cy = 14 + Math.sin(u * 6) * 2, cz = CENTRE.z + 38
      for (let i = 0; i < n; i++) {
        const ox = cx - (i % 3) * 1.6 - Math.floor(i / 3) * 0.8, oy = cy + Math.floor(i / 3) * 0.7, oz = cz + (i % 3) * 1.2
        const flap = Math.sin(t / 120 + i) * 0.35
        p.set([ox - 0.45, oy + flap, oz, ox, oy, oz, ox, oy, oz, ox + 0.45, oy + flap, oz], i * 12)
      }
      geo.attributes.position.needsUpdate = true
    })
  }

  const skyMat = sky.material as ShaderMaterial
  const setDaylight = (d: Daylight) => {
    skyMat.uniforms.sunDir.value.set(d.sunDir[0], d.sunDir[1], d.sunDir[2])
    skyMat.uniforms.top.value.set(...d.skyTop)
    skyMat.uniforms.mid.value.set(...d.skyMid)
    skyMat.uniforms.hor.value.set(...d.skyHorizon)
    skyMat.uniforms.sunStrength.value = d.sunElevation > -0.1 ? 1 : 0
    skyMat.uniforms.night.value = d.night
    for (const m of facadeMats) m.emissiveIntensity = 0.05 + 1.3 * d.windowGlow
    streets.setDaylight(d)
  }
  return { root, update: (dt, t) => movers.forEach((m) => m(dt, t)), setDaylight }
}
