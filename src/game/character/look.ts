import type { Role } from '../types'

export const HAIR_STYLES = ['short', 'bob', 'long', 'ponytail', 'bun', 'pigtails'] as const
export const EYE_SHAPES = ['round', 'sparkle', 'sleepy', 'happy'] as const
export const BODY_SHAPES = ['petite', 'regular', 'chubby'] as const
export const TOPS = ['tee', 'hoodie', 'dress', 'shirt'] as const
export const BOTTOMS = ['shorts', 'jeans', 'skirt', 'pajama'] as const
export const SHOES = ['sneakers', 'slippers', 'boots'] as const
export const ACCESSORIES = ['none', 'glasses', 'bow', 'cap'] as const

export const HAIR_COLORS = [
  '#1c1514', '#3b2a22', '#5a3a2a', '#7a4b2e', '#a0673a', '#c99a5b',
  '#e8cf9a', '#b0b4ba', '#e7a1b8', '#8e6bd1', '#5b8fd6', '#c0392b',
] as const
export const EYE_COLORS = [
  '#2a1d1a', '#4a2f22', '#6b4a2b', '#8a6a3a', '#3d6b4a', '#4f8f6f',
  '#3a5f9a', '#6aa5e0', '#7a5cb8', '#b55a8a', '#8a8f99', '#c48a2a',
] as const
export const SKIN_TONES = [
  '#fff1e6', '#ffe4d2', '#ffd8bf', '#f5c9a8', '#ecb98f', '#dca57a',
  '#c98d60', '#b4774c', '#9a623d', '#7f4f31', '#643c25', '#4a2c1b',
] as const
export const CLOTH_COLORS = [
  '#ffffff', '#2b2b33', '#f4a3c0', '#ffd1dc', '#7fa8e8', '#bcd8ff',
  '#9ed8a0', '#ffe08a', '#ffb27a', '#c8b6ff', '#e74c5c', '#8b6f5a',
] as const

export type HairStyle = (typeof HAIR_STYLES)[number]
export type EyeShape = (typeof EYE_SHAPES)[number]
export type BodyShape = (typeof BODY_SHAPES)[number]
export type TopStyle = (typeof TOPS)[number]
export type BottomStyle = (typeof BOTTOMS)[number]
export type ShoeStyle = (typeof SHOES)[number]
export type Accessory = (typeof ACCESSORIES)[number]

export type CharacterLook = {
  hairStyle: HairStyle
  hairColor: string
  eyeShape: EyeShape
  eyeColor: string
  skinTone: string
  body: BodyShape
  top: TopStyle
  topColor: string
  bottom: BottomStyle
  bottomColor: string
  shoes: ShoeStyle
  accessory: Accessory
}

export function defaultLook(role: Role): CharacterLook {
  return role === 'female'
    ? {
        hairStyle: 'long', hairColor: '#3b2a22', eyeShape: 'sparkle', eyeColor: '#4a2f22', skinTone: '#ffe4d2',
        body: 'petite', top: 'dress', topColor: '#f4a3c0', bottom: 'skirt', bottomColor: '#ffd1dc',
        shoes: 'slippers', accessory: 'bow',
      }
    : {
        hairStyle: 'short', hairColor: '#1c1514', eyeShape: 'round', eyeColor: '#2a1d1a', skinTone: '#ffd8bf',
        body: 'regular', top: 'tee', topColor: '#7fa8e8', bottom: 'jeans', bottomColor: '#2b2b33',
        shoes: 'sneakers', accessory: 'none',
      }
}

/** Option list for every look field, used for validation and by the wardrobe UI. */
export const LOOK_OPTIONS: { [K in keyof CharacterLook]: readonly string[] } = {
  hairStyle: HAIR_STYLES,
  hairColor: HAIR_COLORS,
  eyeShape: EYE_SHAPES,
  eyeColor: EYE_COLORS,
  skinTone: SKIN_TONES,
  body: BODY_SHAPES,
  top: TOPS,
  topColor: CLOTH_COLORS,
  bottom: BOTTOMS,
  bottomColor: CLOTH_COLORS,
  shoes: SHOES,
  accessory: ACCESSORIES,
}

export function sanitizeLook(x: unknown, role: Role): CharacterLook {
  const look = defaultLook(role)
  if (!x || typeof x !== 'object') return look
  const src = x as Record<string, unknown>
  for (const key of Object.keys(LOOK_OPTIONS) as (keyof CharacterLook)[]) {
    const v = src[key]
    if (typeof v === 'string' && LOOK_OPTIONS[key].includes(v)) (look as Record<string, string>)[key] = v
  }
  return look
}
