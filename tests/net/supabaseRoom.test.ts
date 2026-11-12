import { describe, expect, test } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseRoom } from '../../src/game/net/supabaseRoom'
import { defaultLook } from '../../src/game/character/look'
import type { PresenceState } from '../../src/game/net/protocol'

const me: PresenceState = { userId: 'her', name: 'Her', role: 'female', look: defaultLook('female'), pos: { x: 1, z: 1 }, facing: 0, activity: 'idle' }

/** Minimal fake of the realtime client: each subscribe() answers with the next scripted status. */
function fakeClient(statuses: (string | null)[]) {
  const log: string[] = []
  const channels: { topic: string; removed: boolean }[] = []
  const client = {
    getChannels: () => channels.filter((c) => !c.removed),
    removeChannel: async (ch: { topic: string; removed: boolean }) => {
      ch.removed = true
      log.push(`remove ${ch.topic}`)
      return 'ok'
    },
    channel(topic: string) {
      const ch = {
        topic: `realtime:${topic}`,
        removed: false,
        on() { return ch },
        subscribe(cb: (s: string) => void) {
          const s = statuses.shift()
          log.push(`subscribe ${s}`)
          if (s) setTimeout(() => cb(s), 5)
          return ch
        },
        track: async () => { log.push('track'); return 'ok' },
        untrack: async () => 'ok',
        presenceState: () => ({}),
        send: async () => 'ok',
      }
      channels.push(ch)
      return ch
    },
  }
  return { client: client as unknown as SupabaseClient, log, channels }
}

describe('I3: Supabase room join', () => {
  test('retries after a channel error instead of hanging', async () => {
    const { client, log } = fakeClient(['CHANNEL_ERROR', 'SUBSCRIBED'])
    const room = createSupabaseRoom(client, 'h1', { joinTimeoutMs: 200, retryDelayMs: 10 })
    await room.join(me)
    expect(log.filter((l) => l.startsWith('subscribe'))).toEqual(['subscribe CHANNEL_ERROR', 'subscribe SUBSCRIBED'])
    expect(log).toContain('track')
  })

  test('gives up with an error when the server never answers', async () => {
    const { client } = fakeClient([null, null, null])
    const room = createSupabaseRoom(client, 'h1', { joinTimeoutMs: 50, retryDelayMs: 5, maxAttempts: 3 })
    await expect(room.join(me)).rejects.toThrow()
  })
})

describe('C1: a stale channel for the same house is removed before joining', () => {
  test('leftover channel from a previous room is removed first', async () => {
    const { client, log } = fakeClient(['SUBSCRIBED', 'SUBSCRIBED'])
    // A previous room that was never cleanly left.
    ;(client as unknown as { channel: (t: string) => unknown }).channel('house:h1')
    const room = createSupabaseRoom(client, 'h1', { joinTimeoutMs: 200 })
    await room.join(me)
    expect(log[0]).toBe('remove realtime:house:h1')
  })
})
