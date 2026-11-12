// Time of day in Kuala Lumpur drives the sun, the sky and every light in the world.
// Pure maths so it can be tested; the renderer just reads these numbers each frame.

export type RGB = [number, number, number]

export type Daylight = {
  /** 0..24, Kuala Lumpur local time. */
  hour: number
  /** 1 = straight overhead, 0 = on the horizon, negative = below. */
  sunElevation: number
  /** Direction the sun light comes from, normalised, y up. */
  sunDir: [number, number, number]
  sunIntensity: number
  sunColor: RGB
  moonIntensity: number
  /** Ambient/hemisphere light level. */
  ambient: number
  skyTop: RGB
  skyMid: RGB
  skyHorizon: RGB
  /** 0 = city windows dark, 1 = all lit. */
  windowGlow: number
  lampsOn: boolean
  streetLightsOn: boolean
  /** Fog colour follows the horizon. */
  haze: RGB
  /** 0 by day → 1 at night, smooth. */
  night: number
}

/** Hours since midnight in Kuala Lumpur (UTC+8, no daylight saving), fractional. */
export function klClock(now: Date): number {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60
  return (((utcMinutes + 8 * 60) % 1440) + 1440) % 1440 / 60
}

const SUNRISE = 6.9, SUNSET = 19.2 // typical for KL year round
const NIGHT_LEN = 24 - (SUNSET - SUNRISE)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

const SKY = {
  day: { top: [0.33, 0.56, 0.93] as RGB, mid: [0.62, 0.78, 0.97] as RGB, hor: [0.86, 0.91, 0.97] as RGB },
  golden: { top: [0.25, 0.3, 0.6] as RGB, mid: [0.78, 0.46, 0.62] as RGB, hor: [1.0, 0.72, 0.5] as RGB },
  night: { top: [0.02, 0.03, 0.08] as RGB, mid: [0.07, 0.08, 0.18] as RGB, hor: [0.2, 0.17, 0.3] as RGB },
}

export function daylight(hour: number): Daylight {
  const h = ((hour % 24) + 24) % 24
  // Sun elevation: a sine over the daylight hours, slightly negative at night.
  const dayFrac = (h - SUNRISE) / (SUNSET - SUNRISE)
  const nightFrac = (((h - SUNSET) % 24) + 24) % 24 / NIGHT_LEN
  const sunElevation = dayFrac >= 0 && dayFrac <= 1 ? Math.sin(dayFrac * Math.PI) : -0.3 * Math.sin(nightFrac * Math.PI) - 0.02
  // Azimuth sweeps east → west over the day; at night keep it low in the west.
  const az = dayFrac >= 0 && dayFrac <= 1 ? Math.PI * (1 - dayFrac) : Math.PI * 0.05
  const el = Math.max(-0.08, sunElevation)
  const sunDir: [number, number, number] = [Math.cos(az) * Math.cos(el * Math.PI / 2), Math.sin(el * Math.PI / 2), 0.55 * Math.cos(el * Math.PI / 2)]
  const len = Math.hypot(...sunDir)
  sunDir[0] /= len; sunDir[1] /= len; sunDir[2] /= len

  const twilight = smooth(-0.12, 0.25, sunElevation) // 0 at night, 1 in full day
  const golden = Math.exp(-Math.pow((sunElevation - 0.08) / 0.16, 2)) * (sunElevation > -0.1 ? 1 : 0)
  const night = 1 - twilight

  const sunIntensity = 1.9 * smooth(-0.02, 0.35, sunElevation)
  const sunColor: RGB = mix([1, 0.96, 0.9], [1, 0.62, 0.32], golden)
  const skyTop = mix(mix(SKY.night.top, SKY.day.top, twilight), SKY.golden.top, golden * 0.8)
  const skyMid = mix(mix(SKY.night.mid, SKY.day.mid, twilight), SKY.golden.mid, golden)
  const skyHorizon = mix(mix(SKY.night.hor, SKY.day.hor, twilight), SKY.golden.hor, golden)

  const lightsOn = sunElevation < 0.02
  return {
    hour: h,
    sunElevation,
    sunDir,
    sunIntensity,
    sunColor,
    moonIntensity: 0.28 * night,
    ambient: lerp(0.22, 0.5, twilight),
    skyTop,
    skyMid,
    skyHorizon,
    windowGlow: 1 - smooth(0.0, 0.3, sunElevation),
    lampsOn: lightsOn,
    streetLightsOn: lightsOn,
    haze: mix(skyHorizon, [0.72, 0.6, 0.72], golden * 0.4),
    night,
  }
}
