import { describe, expect, test } from 'vitest'
import { MAX_CHAT, cleanChat, parseMsg } from '../../src/game/net/protocol'
import { defaultLook } from '../../src/game/character/look'

const valid = [
  { t: 'move', from: 'a', path: [{ x: 1, z: 2 }, { x: 1.25, z: 2 }], at: 1 },
  { t: 'interact', id: 'i1', from: 'a', to: 'b', kind: 'hug', at: 1 },
  { t: 'interact-request', id: 'i1', from: 'a', to: 'b', kind: 'kiss', at: 1 },
  { t: 'interact-accept', id: 'i1', from: 'b' },
  { t: 'interact-cancel', id: 'i1', from: 'a' },
  { t: 'chat', id: 'c1', from: 'a', text: 'hi', at: 1 },
  { t: 'emote', from: 'a', emote: 'shy', at: 1 },
  { t: 'look', from: 'a', look: defaultLook('male') },
]

describe('parseMsg', () => {
  test.each(valid.map((m) => [m.t, m]))('accepts a valid %s', (_, m) => {
    expect(parseMsg(m)).toEqual(m)
  })

  test('rejects an unknown type', () => {
    expect(parseMsg({ t: 'nuke', from: 'a' })).toBeNull()
  })

  test('rejects missing fields', () => {
    expect(parseMsg({ t: 'interact', id: 'i', from: 'a', kind: 'hug', at: 1 })).toBeNull()
    expect(parseMsg({ t: 'chat', from: 'a', text: 'x', at: 1 })).toBeNull()
  })

  test('rejects an unknown interaction kind', () => {
    expect(parseMsg({ t: 'interact', id: 'i', from: 'a', to: 'b', kind: 'slap', at: 1 })).toBeNull()
  })

  test('rejects non-finite coordinates', () => {
    expect(parseMsg({ t: 'move', from: 'a', path: [{ x: NaN, z: 1 }], at: 1 })).toBeNull()
    expect(parseMsg({ t: 'move', from: 'a', path: [{ x: 1, z: Infinity }], at: 1 })).toBeNull()
  })

  test('rejects a path longer than 400 points', () => {
    const path = Array.from({ length: 401 }, (_, i) => ({ x: i * 0.01, z: 1 }))
    expect(parseMsg({ t: 'move', from: 'a', path, at: 1 })).toBeNull()
  })

  test('rejects non-objects', () => {
    expect(parseMsg(null)).toBeNull()
    expect(parseMsg('move')).toBeNull()
  })
})

describe('cleanChat', () => {
  test('whitespace-only is rejected', () => {
    expect(cleanChat('   ')).toBeNull()
  })
  test('long text is cut to MAX_CHAT', () => {
    expect(MAX_CHAT).toBe(200)
    expect(cleanChat('a'.repeat(250))!.length).toBe(200)
  })
  test('text is trimmed', () => {
    expect(cleanChat('  hi  ')).toBe('hi')
  })
})
