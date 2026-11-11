import { afterEach, describe, expect, test } from 'vitest'
import { createLocalRoom } from '../../src/game/net/localRoom'
import { defaultLook } from '../../src/game/character/look'
import type { NetMsg, PresenceState } from '../../src/game/net/protocol'
import type { Room } from '../../src/game/net/room'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const opts = { heartbeatMs: 100, expireMs: 400 }
const me = (userId: string, role: 'female' | 'male'): PresenceState => ({
  userId, name: userId, role, look: defaultLook(role), pos: { x: 4.5, z: 4.2 }, facing: 0, activity: 'idle',
})

let rooms: Room[] = []
afterEach(async () => {
  await Promise.all(rooms.map((r) => r.leave()))
  rooms = []
})
let n = 0
const house = () => `test-${Date.now()}-${n++}`

describe('LocalRoom', () => {
  test('late joiner sees the other player where they actually stand', async () => {
    const id = house()
    const a = createLocalRoom(id, opts)
    rooms.push(a)
    await a.join(me('her', 'female'))
    a.updatePresence({ pos: { x: 5, z: 5 } })
    await sleep(300)
    const b = createLocalRoom(id, opts)
    rooms.push(b)
    const first = new Promise<PresenceState[]>((resolve) => b.onPresence(resolve))
    await b.join(me('him', 'male'))
    const others = await first
    expect(others).toHaveLength(1)
    expect(others[0].userId).toBe('her')
    expect(others[0].pos).toEqual({ x: 5, z: 5 })
  })

  test('a sent message reaches the other room exactly once and not the sender', async () => {
    const id = house()
    const a = createLocalRoom(id, opts), b = createLocalRoom(id, opts)
    rooms.push(a, b)
    await a.join(me('her', 'female'))
    await b.join(me('him', 'male'))
    const gotA: NetMsg[] = [], gotB: NetMsg[] = []
    a.onMessage((m) => gotA.push(m))
    b.onMessage((m) => gotB.push(m))
    a.send({ t: 'chat', id: 'c1', from: 'her', text: 'hi', at: 1 })
    await sleep(100)
    expect(gotB).toEqual([{ t: 'chat', id: 'c1', from: 'her', text: 'hi', at: 1 }])
    expect(gotA).toEqual([])
  })

  test('malformed messages are ignored', async () => {
    const id = house()
    const b = createLocalRoom(id, opts)
    rooms.push(b)
    await b.join(me('him', 'male'))
    const got: NetMsg[] = []
    b.onMessage((m) => got.push(m))
    const raw = new BroadcastChannel(`house:${id}`)
    raw.postMessage({ k: 'msg', msg: { t: 'nuke' } })
    raw.postMessage('garbage')
    raw.postMessage({ k: 'presence', state: { userId: 5 } })
    await sleep(100)
    raw.close()
    expect(got).toEqual([])
  })

  test('a player who leaves drops out of presence', async () => {
    const id = house()
    const a = createLocalRoom(id, opts), b = createLocalRoom(id, opts)
    rooms.push(b)
    await a.join(me('her', 'female'))
    await b.join(me('him', 'male'))
    let latest: PresenceState[] = []
    b.onPresence((o) => (latest = o))
    await sleep(250)
    expect(latest.map((p) => p.userId)).toEqual(['her'])
    await a.leave()
    await sleep(opts.expireMs + 200)
    expect(latest).toEqual([])
  })

  test('a player who goes silent expires', async () => {
    const id = house()
    const b = createLocalRoom(id, opts)
    rooms.push(b)
    await b.join(me('him', 'male'))
    let latest: PresenceState[] = []
    b.onPresence((o) => (latest = o))
    const raw = new BroadcastChannel(`house:${id}`)
    raw.postMessage({ k: 'presence', state: me('her', 'female') })
    await sleep(100)
    expect(latest.map((p) => p.userId)).toEqual(['her'])
    raw.close()
    await sleep(opts.expireMs + 250)
    expect(latest).toEqual([])
  })
})
