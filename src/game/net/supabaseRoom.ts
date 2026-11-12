// Room over Supabase Realtime: presence for who is where, broadcast for moves, interactions and chat.
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { parseMsg, parsePresence, type NetMsg, type PresenceState } from './protocol'
import { PRESENCE_MIN_INTERVAL, listeners, shouldResubscribe, throttle, type Room } from './room'

export type SupabaseRoomOptions = { joinTimeoutMs?: number; retryDelayMs?: number; maxAttempts?: number; heartbeatMs?: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function createSupabaseRoom(client: SupabaseClient, houseId: string, opts: SupabaseRoomOptions = {}): Room {
  const joinTimeoutMs = opts.joinTimeoutMs ?? 10_000
  const retryDelayMs = opts.retryDelayMs ?? 1500
  const maxAttempts = opts.maxAttempts ?? 5
  const heartbeatMs = opts.heartbeatMs ?? 3000
  const topic = `house:${houseId}`
  const msgs = listeners<NetMsg>()
  const pres = listeners<PresenceState[]>()
  let channel: RealtimeChannel | null = null
  let me: PresenceState | null = null
  let subscribed = false
  let pausedAt = 0
  let beat: ReturnType<typeof setInterval> | null = null

  const track = () => {
    if (channel && me && subscribed) void channel.track(me)
  }
  const sendPresence = throttle(track, PRESENCE_MIN_INTERVAL)

  const emitPresence = () => {
    if (!channel || !me) return
    const state = channel.presenceState() as Record<string, unknown[]>
    const others: PresenceState[] = []
    for (const metas of Object.values(state)) {
      const latest = parsePresence(metas[metas.length - 1])
      if (latest && latest.userId !== me.userId) others.push(latest)
    }
    pres.emit(others)
  }

  /** realtime-js reuses a channel with the same topic; drop any leftover from an earlier room first. */
  const removeStale = async () => {
    for (const ch of client.getChannels()) if (ch.topic === `realtime:${topic}`) await client.removeChannel(ch)
  }

  const attempt = () =>
    new Promise<boolean>((resolve) => {
      const ch = client.channel(topic, { config: { presence: { key: me!.userId }, broadcast: { self: false } } })
      channel = ch
      const timer = setTimeout(() => resolve(false), joinTimeoutMs)
      ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
        const msg = parseMsg(payload)
        if (msg) msgs.emit(msg)
      })
        .on('presence', { event: 'sync' }, emitPresence)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer)
            subscribed = true
            track()
            resolve(true)
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            subscribed = false
            clearTimeout(timer)
            resolve(false)
          }
        })
    })

  const subscribe = async () => {
    for (let i = 0; i < maxAttempts; i++) {
      await removeStale()
      if (await attempt()) {
        // Re-announce regularly so a presence update lost mid-walk is corrected within seconds.
        if (beat) clearInterval(beat)
        beat = setInterval(track, heartbeatMs)
        return
      }
      if (channel) await client.removeChannel(channel)
      channel = null
      await sleep(retryDelayMs * (i + 1))
    }
    throw new Error('Could not connect to our home')
  }

  const unsubscribe = async () => {
    sendPresence.cancel()
    if (beat) clearInterval(beat)
    beat = null
    subscribed = false
    const ch = channel
    channel = null
    if (ch) {
      // Don't wait on untrack: after a long lock the socket may be dead.
      void ch.untrack().catch(() => {})
      await client.removeChannel(ch)
    }
  }

  return {
    async join(state) {
      me = { ...state }
      await subscribe()
    },
    updatePresence(patch) {
      if (!me) return
      me = { ...me, ...patch }
      sendPresence.call()
    },
    send(msg) {
      if (channel && subscribed) void channel.send({ type: 'broadcast', event: 'msg', payload: msg })
    },
    onMessage: msgs.add,
    onPresence: pres.add,
    async leave() {
      await unsubscribe()
    },
    pause() {
      sendPresence.cancel()
      pausedAt = Date.now()
    },
    async resume() {
      if (!me) return
      if (subscribed && !shouldResubscribe(pausedAt, Date.now())) {
        track()
        return
      }
      await unsubscribe()
      await subscribe()
    },
  }
}
