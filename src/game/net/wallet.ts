// Wallet storage: Supabase (server enforces the daily cap) with a local fallback for test mode
// or before migration 0003 has been run.
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyEarning, klDay, type Wallet } from '../play/economy'

const localKey = (userId: string) => `sweet-paradise-wallet:${userId}`

function readLocal(userId: string): Wallet {
  try {
    const raw = localStorage.getItem(localKey(userId))
    if (raw) return JSON.parse(raw) as Wallet
  } catch {
    /* storage blocked: start fresh */
  }
  return { balance: 0, day: klDay(new Date()), earnedToday: 0 }
}

function writeLocal(userId: string, w: Wallet) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(w))
  } catch {
    /* storage blocked: keep in memory only */
  }
}

const fromRow = (r: { balance: number; day: string; earned_today: number }): Wallet => ({ balance: r.balance, day: r.day, earnedToday: r.earned_today })

export type WalletStore = {
  load(): Promise<Wallet>
  award(amount: number, reason: string): Promise<{ wallet: Wallet; granted: number }>
  /** Pay for something; resolves false (and changes nothing) when I can't afford it. */
  spend(amount: number, reason: string): Promise<{ wallet: Wallet; ok: boolean }>
}

export function createWalletStore(userId: string, client: SupabaseClient | null): WalletStore {
  let remote = !!client
  let current = readLocal(userId)
  const local = (amount: number) => {
    const r = applyEarning(current, amount, new Date())
    current = r.wallet
    writeLocal(userId, current)
    return r
  }
  return {
    async load() {
      if (!remote || !client) return current
      const { data, error } = await client.rpc('award_coins', { amount: 0, reason: 'load' })
      if (error) {
        remote = false // migration not run yet: keep playing with a local wallet
        return current
      }
      current = fromRow(data as never)
      return current
    },
    async award(amount, reason) {
      if (!remote || !client) return local(amount)
      const before = current
      const { data, error } = await client.rpc('award_coins', { amount, reason })
      if (error) {
        remote = false
        return local(amount)
      }
      current = fromRow(data as never)
      return { wallet: current, granted: current.balance - before.balance }
    },
    async spend(amount, reason) {
      if (current.balance < amount) return { wallet: current, ok: false }
      if (remote && client) {
        const { data, error } = await client.rpc('spend_coins', { amount, reason })
        if (!error) {
          current = fromRow(data as never)
          return { wallet: current, ok: true }
        }
        if (!/not enough/.test(error.message)) remote = false
        else return { wallet: current, ok: false }
      }
      current = { ...current, balance: current.balance - amount }
      writeLocal(userId, current)
      return { wallet: current, ok: true }
    },
  }
}
