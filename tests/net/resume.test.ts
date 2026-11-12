import { afterEach, expect, test } from 'vitest'
import { shouldResubscribe, type Room } from '../../src/game/net/room'
import { createLocalRoom } from '../../src/game/net/localRoom'
import { defaultLook } from '../../src/game/character/look'
import type { PresenceState } from '../../src/game/net/protocol'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const me = (userId: string, role: 'female' | 'male'): PresenceState => ({
  userId, name: userId, role, look: defaultLook(role), pos: { x: 4.5, z: 4.2 }, facing: 0, activity: 'idle',
})
const rooms: Room[] = []
afterEach(async () => {
  await Promise.all(rooms.splice(0).map((r) => r.leave()))
})

test('resubscribe only after being hidden at least 10 s', () => {
  expect(shouldResubscribe(0, 9_999)).toBe(false)
  expect(shouldResubscribe(0, 10_000)).toBe(true)
})

test('after the phone sleeps and wakes, the partner sees me again within 2 s', async () => {
  const opts = { heartbeatMs: 100, expireMs: 400 }
  const id = `resume-${Date.now()}`
  const a = createLocalRoom(id, opts), b = createLocalRoom(id, opts)
  rooms.push(a, b)
  await a.join(me('her', 'female'))
  await b.join(me('him', 'male'))
  let latest: PresenceState[] = []
  b.onPresence((o) => (latest = o))
  await sleep(250)
  expect(latest.map((p) => p.userId)).toEqual(['her'])

  // Phone locked: iOS suspends the page, so A goes silent and B expires her.
  a.pause()
  await sleep(opts.expireMs + 250)
  expect(latest).toEqual([])

  // Phone unlocked.
  const woke = Date.now()
  await a.resume()
  while (!latest.length && Date.now() - woke < 2000) await sleep(50)
  expect(latest.map((p) => p.userId)).toEqual(['her'])
})
