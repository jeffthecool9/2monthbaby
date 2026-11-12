import type { NetMsg, PresenceState } from './protocol'

/** Real-time link between the two players in one house. */
export interface Room {
  join(me: PresenceState): Promise<void>
  /** Merged into my presence; sent at most 4 times per second. */
  updatePresence(patch: Partial<PresenceState>): void
  send(msg: NetMsg): void
  onMessage(cb: (m: NetMsg) => void): () => void
  /** Called with everyone except me whenever that list changes. */
  onPresence(cb: (others: PresenceState[]) => void): () => void
  leave(): Promise<void>
  /** Page hidden (phone locked / app switched): stop sending. */
  pause(): void
  /** Page visible again: reconnect and re-announce presence. */
  resume(): Promise<void>
}

export const PRESENCE_MIN_INTERVAL = 250
const RESUBSCRIBE_AFTER_MS = 10_000

/** iOS drops sockets for backgrounded pages; after a long absence reconnect from scratch. */
export function shouldResubscribe(hiddenAt: number, now: number): boolean {
  return now - hiddenAt >= RESUBSCRIBE_AFTER_MS
}

/** Small listener set helper shared by Room implementations. */
export function listeners<T>() {
  const set = new Set<(v: T) => void>()
  return {
    add(cb: (v: T) => void) {
      set.add(cb)
      return () => void set.delete(cb)
    },
    emit(v: T) {
      for (const cb of [...set]) cb(v)
    },
  }
}

/** Trailing throttle: runs `fn` at most once per `ms`, always delivering the latest call. */
export function throttle(fn: () => void, ms: number) {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const run = () => {
    timer = null
    last = Date.now()
    fn()
  }
  return {
    call() {
      if (timer) return
      const wait = last + ms - Date.now()
      if (wait <= 0) run()
      else timer = setTimeout(run, wait)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}
