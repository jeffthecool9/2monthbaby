// Room over BroadcastChannel: two tabs of the same browser play together. For development and tests.
import { parseMsg, parsePresence, type NetMsg, type PresenceState } from './protocol'
import { PRESENCE_MIN_INTERVAL, listeners, throttle, type Room } from './room'

type Wire =
  | { k: 'presence'; state: PresenceState }
  | { k: 'hello' }
  | { k: 'bye'; userId: string }
  | { k: 'msg'; msg: NetMsg }

export function createLocalRoom(houseId: string, opts: { heartbeatMs?: number; expireMs?: number } = {}): Room {
  const heartbeatMs = opts.heartbeatMs ?? 1000
  const expireMs = opts.expireMs ?? 5000
  const msgs = listeners<NetMsg>()
  const pres = listeners<PresenceState[]>()
  const peers = new Map<string, { state: PresenceState; seen: number }>()
  let channel: BroadcastChannel | null = null
  let me: PresenceState | null = null
  let beat: ReturnType<typeof setInterval> | null = null
  let lastKey = ''

  const post = (w: Wire) => channel?.postMessage(w)
  const publish = () => me && post({ k: 'presence', state: me })
  const sendPresence = throttle(publish, PRESENCE_MIN_INTERVAL)

  const emitPresence = (force = false) => {
    const list = [...peers.values()].map((p) => p.state).sort((a, b) => a.userId.localeCompare(b.userId))
    const key = JSON.stringify(list)
    if (!force && key === lastKey) return
    lastKey = key
    pres.emit(list)
  }

  const onWire = (ev: MessageEvent) => {
    const w = ev.data as Wire
    if (!w || typeof w !== 'object' || !me) return
    switch (w.k) {
      case 'presence': {
        const state = parsePresence(w.state)
        if (!state || state.userId === me.userId) return
        peers.set(state.userId, { state, seen: Date.now() })
        emitPresence()
        break
      }
      case 'hello':
        publish()
        break
      case 'bye':
        if (typeof w.userId === 'string' && peers.delete(w.userId)) emitPresence()
        break
      case 'msg': {
        const msg = parseMsg(w.msg)
        if (msg) msgs.emit(msg)
        break
      }
    }
  }

  return {
    async join(state) {
      me = { ...state }
      channel = new BroadcastChannel(`house:${houseId}`)
      channel.onmessage = onWire
      publish()
      post({ k: 'hello' })
      beat = setInterval(() => {
        publish()
        const now = Date.now()
        let changed = false
        for (const [id, p] of peers) if (now - p.seen > expireMs) changed = peers.delete(id) || changed
        if (changed) emitPresence()
      }, heartbeatMs)
    },
    updatePresence(patch) {
      if (!me) return
      me = { ...me, ...patch }
      sendPresence.call()
    },
    send(msg) {
      post({ k: 'msg', msg })
    },
    onMessage: msgs.add,
    onPresence: pres.add,
    async leave() {
      if (!channel || !me) return
      sendPresence.cancel()
      if (beat) clearInterval(beat)
      post({ k: 'bye', userId: me.userId })
      channel.close()
      channel = null
      peers.clear()
    },
  }
}
