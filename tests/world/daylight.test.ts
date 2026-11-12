import { describe, expect, test } from 'vitest'
import { daylight, klClock } from '../../src/game/world/daylight'

const at = (utc: string) => daylight(klClock(new Date(utc)))

describe('Malaysia clock', () => {
  test('converts UTC to Kuala Lumpur hours (UTC+8)', () => {
    expect(klClock(new Date('2026-11-12T04:30:00Z'))).toBeCloseTo(12.5, 5)
    expect(klClock(new Date('2026-11-12T18:00:00Z'))).toBeCloseTo(2, 5)
  })
})

describe('daylight', () => {
  test('midday: bright sun high in the sky, no lamps', () => {
    const d = at('2026-11-12T05:00:00Z') // 13:00 KL
    expect(d.sunElevation).toBeGreaterThan(0.8)
    expect(d.sunIntensity).toBeGreaterThan(1.5)
    expect(d.lampsOn).toBe(false)
    expect(d.streetLightsOn).toBe(false)
    expect(d.windowGlow).toBeLessThan(0.15)
  })

  test('midnight: dark sky, every light on, city windows glowing', () => {
    const d = at('2026-11-12T16:00:00Z') // 00:00 KL
    expect(d.sunElevation).toBeLessThan(0)
    expect(d.sunIntensity).toBeLessThan(0.2)
    expect(d.lampsOn).toBe(true)
    expect(d.streetLightsOn).toBe(true)
    expect(d.windowGlow).toBeGreaterThan(0.8)
    expect(d.moonIntensity).toBeGreaterThan(0.1)
  })

  test('sunset (19:15 KL) is golden and low, with lights just coming on', () => {
    const d = at('2026-11-12T11:15:00Z')
    expect(d.sunElevation).toBeLessThan(0.15)
    expect(d.sunElevation).toBeGreaterThan(-0.05)
    expect(d.sunColor[0]).toBeGreaterThan(d.sunColor[2]) // warm: more red than blue
    expect(d.streetLightsOn).toBe(true)
  })

  test('sunrise (07:00 KL) is warm with lights switching off', () => {
    const d = at('2026-11-11T23:00:00Z')
    expect(d.sunElevation).toBeLessThan(0.2)
    expect(d.sunElevation).toBeGreaterThan(-0.1)
    expect(d.streetLightsOn).toBe(false)
  })

  test('values change smoothly between hours', () => {
    const a = daylight(14.0), b = daylight(14.01)
    expect(Math.abs(a.sunIntensity - b.sunIntensity)).toBeLessThan(0.05)
    expect(Math.abs(a.skyTop[0] - b.skyTop[0])).toBeLessThan(0.01)
  })
})
