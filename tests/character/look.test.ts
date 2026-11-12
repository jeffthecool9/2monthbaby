import { describe, expect, test } from 'vitest'
import { CLOTH_COLORS, EYE_COLORS, HAIR_COLORS, SKIN_TONES, defaultLook, sanitizeLook } from '../../src/game/character/look'

describe('look options', () => {
  test.each([
    ['HAIR_COLORS', HAIR_COLORS],
    ['EYE_COLORS', EYE_COLORS],
    ['SKIN_TONES', SKIN_TONES],
    ['CLOTH_COLORS', CLOTH_COLORS],
  ])('%s has at least 10 unique hex colours', (_, list) => {
    expect(list.length).toBeGreaterThanOrEqual(10)
    expect(new Set(list).size).toBe(list.length)
    for (const c of list) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('defaultLook', () => {
  test('female default has long hair, male default has short hair', () => {
    expect(defaultLook('female').hairStyle).toBe('long')
    expect(defaultLook('male').hairStyle).toBe('short')
  })
})

describe('sanitizeLook', () => {
  test('invalid hairStyle falls back to the default', () => {
    expect(sanitizeLook({ hairStyle: 'mohawk' }, 'male')).toEqual(defaultLook('male'))
  })

  test('valid fields are kept', () => {
    const look = sanitizeLook({ hairStyle: 'bun', hairColor: HAIR_COLORS[3] }, 'male')
    expect(look.hairStyle).toBe('bun')
    expect(look.hairColor).toBe(HAIR_COLORS[3])
    expect(look.top).toBe(defaultLook('male').top)
  })

  test('null gives the default look', () => {
    expect(sanitizeLook(null, 'female')).toEqual(defaultLook('female'))
  })

  test('colours outside the lists are replaced', () => {
    expect(sanitizeLook({ skinTone: '#123456', topColor: 'red' }, 'female')).toEqual(defaultLook('female'))
  })
})
