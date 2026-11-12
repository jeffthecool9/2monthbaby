// Where the shared decoration is kept: Supabase house_items (both phones), or this phone's storage
// in test mode / before migration 0004 has been run.
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyDecor, emptyDecor, type DecorChange, type DecorState } from '../play/decor'

const key = (houseId: string) => `sweet-paradise-decor:${houseId}`

export type DecorStore = { load(): Promise<DecorState>; save(change: DecorChange, houseId: string): Promise<void> }

export function createDecorStore(houseId: string, client: SupabaseClient | null): DecorStore {
  let remote = !!client
  let local: DecorState = emptyDecor()
  try {
    const raw = localStorage.getItem(key(houseId))
    if (raw) local = JSON.parse(raw) as DecorState
  } catch {
    /* storage blocked */
  }
  const persistLocal = (s: DecorState) => {
    local = s
    try {
      localStorage.setItem(key(houseId), JSON.stringify(s))
    } catch {
      /* storage blocked */
    }
  }
  return {
    async load() {
      if (!remote || !client) return local
      const { data, error } = await client.from('house_items').select('uid, item, x, z, rot, owner, seq')
      if (error) {
        remote = false
        return local
      }
      const items: DecorState['items'] = {}
      let seq = 0
      for (const r of data ?? []) {
        items[r.uid] = { uid: r.uid, item: r.item, x: r.x, z: r.z, rot: r.rot, owner: r.owner }
        seq = Math.max(seq, Number(r.seq))
      }
      return { items, seq }
    },
    async save(change, house) {
      persistLocal(applyDecor(local, change))
      if (!remote || !client) return
      let error
      if (change.op === 'place') ({ error } = await client.from('house_items').insert({ uid: change.uid, house_id: house, item: change.item, x: change.x, z: change.z, rot: change.rot, owner: change.owner, seq: change.seq }))
      else if (change.op === 'move') ({ error } = await client.from('house_items').update({ x: change.x, z: change.z, rot: change.rot, seq: change.seq, updated_at: new Date().toISOString() }).eq('uid', change.uid))
      else ({ error } = await client.from('house_items').delete().eq('uid', change.uid))
      if (error) console.warn('decor save failed', error)
    },
  }
}
