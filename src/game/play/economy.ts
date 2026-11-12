// Coins (shown as RM, in-game only): separate wallets, RM1000/day earning cap, reset at 00:00 Kuala Lumpur.
import type { FurnitureId } from '../world/layout'

export const DAILY_CAP = 1000

export type Wallet = { balance: number; day: string; earnedToday: number }

const KL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Calendar day (YYYY-MM-DD) in Malaysia, whatever the phone's time zone. */
export function klDay(now: Date): string {
  return KL.format(now)
}

/** Add an earning, respecting the daily cap; a new KL day starts the count again. */
export function applyEarning(w: Wallet, amount: number, now: Date): { wallet: Wallet; granted: number } {
  const day = klDay(now)
  const earned = w.day === day ? w.earnedToday : 0
  const granted = Math.max(0, Math.min(Math.floor(amount), DAILY_CAP - earned))
  return { wallet: { balance: w.balance + granted, day, earnedToday: earned + granted }, granted }
}

export type Mission = { id: string; label: string; emoji: string; furniture: FurnitureId; reward: number; cooldownMs: number; durationMs: number }

const MIN = 60_000
/** Daily chores around the home. Each pays once its little animation finishes, then cools down. */
export const MISSIONS: Mission[] = [
  { id: 'cook', label: 'Cook a meal', emoji: '🍳', furniture: 'kitchen', reward: 30, cooldownMs: 5 * MIN, durationMs: 6000 },
  { id: 'dishes', label: 'Wash the dishes', emoji: '🍽️', furniture: 'kitchen', reward: 15, cooldownMs: 5 * MIN, durationMs: 4500 },
  { id: 'water', label: 'Water the plant', emoji: '🪴', furniture: 'plant', reward: 10, cooldownMs: 5 * MIN, durationMs: 3500 },
  { id: 'bed', label: 'Make the bed', emoji: '🛏️', furniture: 'bed', reward: 10, cooldownMs: 10 * MIN, durationMs: 4000 },
  { id: 'bath', label: 'Clean the bathroom', emoji: '🧽', furniture: 'bath', reward: 25, cooldownMs: 10 * MIN, durationMs: 5000 },
]

export function missionReady(m: Mission, lastDone: number | undefined, now: number): boolean {
  return lastDone === undefined || now - lastDone >= m.cooldownMs
}

/** Coins for affection, per the design: she earns per kiss or hug she gives, he per comfort. */
export function affectionReward(role: 'female' | 'male', kind: string): number {
  if (role === 'female' && (kind === 'kiss' || kind === 'hug')) return 1
  if (role === 'male' && kind === 'comfort') return 1
  return 0
}

export const GAME_REWARD = { tttWin: 50, tttDraw: 20, totMatch: 10 }
