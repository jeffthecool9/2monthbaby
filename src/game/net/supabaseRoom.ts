// Room over Supabase Realtime: presence for who is where, broadcast for moves, interactions and chat.
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { parseMsg, parsePresence, type NetMsg, type PresenceState } from './protocol'
import { PRESENCE_MIN_INTERVAL, listeners, shouldResubscribe, throttle, type Room } from './room'

export function createSupabaseRoom(client: SupabaseClient, houseId: string): Room {
  const msgs = listeners<NetMsg>()
  const pres = listeners<PresenceState[]>()
  let channel: RealtimeChannel | null = null
  let me: PresenceState | null = null
  let subscribed = false
  let pausedAt = 0

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

  const subscribe = () =>
    new Promise<void>((resolve) => {
      if (!me) return resolve()
      channel = client.channel(`house:${houseId}`, {
        config: { presence: { key: me.userId }, broadcast: { self: false } },
      })
      channel
        .on('broadcast', { event: 'msg' }, ({ payload }) => {
          const msg = parseMsg(payload)
          if (msg) msgs.emit(msg)
        })
        .on('presence', { event: 'sync' }, emitPresence)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            subscribed = true
            track()
            resolve()
          }
        })
    })

  const unsubscribe = async () => {
    sendPresence.cancel()
    subscribed = false
    if (channel) {
      await channel.untrack().catch(() => {})
      await client.removeChannel(channel)
    }
    channel = null
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
