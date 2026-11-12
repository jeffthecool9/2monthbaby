import { describe, expect, test } from 'vitest'
import { createSim, step } from '../../src/game/sim/sim'
import { parsePresence, type PresenceState } from '../../src/game/net/protocol'
import { defaultLook } from '../../src/game/character/look'

const her = { userId: 'her', name: 'Her', role: 'female' as const, look: defaultLook('female') }
const him = { userId: 'him', name: 'Him', role: 'male' as const, look: defaultLook('male') }
const pres = (patch: Partial<PresenceState> = {}): PresenceState => ({
  userId: 'her', name: 'Her', role: 'female', look: defaultLook('female'), pos: { x: 2, z: 5 }, facing: 0, activity: 'idle', ...patch,
})

describe('custom VRoid characters', () => {
  test('presence carries the avatar file path', () => {
    expect(parsePresence(pres({ avatar: 'her/avatar.vrm?v=2' }))?.avatar).toBe('her/avatar.vrm?v=2')
  })

  test('an over-long or non-string avatar path is dropped', () => {
    expect(parsePresence(pres({ avatar: 'x'.repeat(300) }))?.avatar).toBeUndefined()
    expect(parsePresence({ ...pres(), avatar: 5 })?.avatar).toBeUndefined()
  })

  test("my partner's new character arrives through presence", () => {
    let s = createSim(him, { x: 4, z: 4 }, her)
    s = step(s, { type: 'presence', others: [pres({ avatar: 'her/avatar.vrm?v=1' })] }, 0)
    expect(s.partner!.avatar).toBe('her/avatar.vrm?v=1')
    s = step(s, { type: 'presence', others: [pres({ avatar: 'her/avatar.vrm?v=2' })] }, 1)
    expect(s.partner!.avatar).toBe('her/avatar.vrm?v=2')
  })

  test('uploading sets my own avatar', () => {
    const s = step(createSim(him, { x: 4, z: 4 }, her), { type: 'set-avatar', avatar: 'him/avatar.vrm?v=9' }, 0)
    expect(s.me.avatar).toBe('him/avatar.vrm?v=9')
  })
})
