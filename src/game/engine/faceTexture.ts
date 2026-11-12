// Draws the chibi face (style A: big dark eyes with highlights, pink blush, small mouth) onto a canvas texture.
import { DynamicTexture, type Scene } from '@babylonjs/core'
import type { EyeShape } from '../character/look'
import type { EmoteKind } from '../types'

export type Expression = EmoteKind | 'neutral' | 'blink'
const S = 512

export function createFaceTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture('face', { width: S, height: S }, scene, true)
  tex.hasAlpha = true
  return tex
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.9)
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45)
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9)
  ctx.fill()
}

function arc(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, up: boolean, width = 10) {
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#2a1d1a'
  ctx.beginPath()
  if (up) ctx.arc(x, y + w * 0.4, w, Math.PI * 1.15, Math.PI * 1.85)
  else ctx.arc(x, y - w * 0.4, w, Math.PI * 0.15, Math.PI * 0.85)
  ctx.stroke()
}

function openEye(ctx: CanvasRenderingContext2D, x: number, y: number, shape: EyeShape, iris: string) {
  const rx = shape === 'sleepy' ? 42 : 48
  const ry = shape === 'sleepy' ? 38 : shape === 'round' ? 56 : 64
  ctx.fillStyle = '#1e1414'
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = iris
  ctx.beginPath()
  ctx.ellipse(x, y + ry * 0.25, rx * 0.72, ry * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(x - rx * 0.35, y - ry * 0.35, rx * 0.32, ry * 0.26, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + rx * 0.3, y + ry * 0.3, rx * 0.13, 0, Math.PI * 2)
  ctx.fill()
  if (shape === 'sparkle') {
    ctx.beginPath()
    ctx.arc(x + rx * 0.35, y - ry * 0.5, rx * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  if (shape === 'sleepy') {
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.strokeStyle = '#1e1414'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(x - rx - 4, y - ry * 0.55)
    ctx.lineTo(x + rx + 4, y - ry * 0.55)
    ctx.stroke()
  }
}

export function drawFace(tex: DynamicTexture, shape: EyeShape, eyeColor: string, expr: Expression) {
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.clearRect(0, 0, S, S)
  const ey = 250, lx = 168, rx = 344

  // Blush
  const blushAlpha = expr === 'shy' || expr === 'love' ? 0.75 : 0.45
  ctx.fillStyle = `rgba(255,140,170,${blushAlpha})`
  for (const x of [lx - 30, rx + 30]) {
    ctx.beginPath()
    ctx.ellipse(x, ey + 78, 46, 24, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (expr === 'shy') {
    ctx.strokeStyle = 'rgba(230,90,130,0.8)'
    ctx.lineWidth = 5
    for (const x of [lx - 30, rx + 30]) for (const d of [-18, 0, 18]) {
      ctx.beginPath()
      ctx.moveTo(x + d - 6, ey + 70)
      ctx.lineTo(x + d + 6, ey + 86)
      ctx.stroke()
    }
  }

  // Eyes
  for (const x of [lx, rx]) {
    if (expr === 'blink' || expr === 'sleepy') arc(ctx, x, ey + 10, 30, false)
    else if (expr === 'happy' || shape === 'happy') arc(ctx, x, ey + 10, 32, true, 12)
    else if (expr === 'love') heart(ctx, x, ey, 40, '#ff4f7a')
    else openEye(ctx, x, ey, shape, eyeColor)
  }

  // Brows
  if (expr === 'angry') {
    ctx.strokeStyle = '#2a1d1a'
    ctx.lineWidth = 12
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(lx - 40, ey - 80); ctx.lineTo(lx + 30, ey - 58)
    ctx.moveTo(rx + 40, ey - 80); ctx.lineTo(rx - 30, ey - 58)
    ctx.stroke()
  }

  // Tears
  if (expr === 'crying') {
    ctx.fillStyle = 'rgba(120,190,255,0.9)'
    for (const x of [lx, rx]) {
      ctx.beginPath()
      ctx.ellipse(x + 10, ey + 80, 12, 30, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Mouth
  const my = ey + 105
  ctx.strokeStyle = '#a0524a'
  ctx.fillStyle = '#d9606e'
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (expr === 'happy' || expr === 'love') {
    ctx.arc(256, my - 6, 22, 0, Math.PI)
    ctx.fill()
  } else if (expr === 'angry' || expr === 'crying') {
    ctx.arc(256, my + 18, 18, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
  } else if (expr === 'sleepy') {
    ctx.ellipse(256, my, 10, 13, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.arc(256, my - 12, 18, Math.PI * 0.2, Math.PI * 0.8)
    ctx.stroke()
  }
  tex.update()
}
