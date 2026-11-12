import { describe, expect, test } from 'vitest'
import { DAILY_CAP, MISSIONS, applyEarning, klDay, missionReady, type Wallet } from '../../src/game/play/economy'
import { newBoard, place, winner } from '../../src/game/play/tictactoe'
import { QUESTIONS, answerTot, newTot } from '../../src/game/play/thisOrThat'

const wallet = (p: Partial<Wallet> = {}): Wallet => ({ balance: 0, day: '2026-11-12', earnedToday: 0, ...p })

describe('economy', () => {
  test('Malaysia day boundary is midnight KL time', () => {
    expect(klDay(new Date('2026-11-17T15:59:59Z'))).toBe('2026-11-17')
    expect(klDay(new Date('2026-11-17T16:00:00Z'))).toBe('2026-11-18')
  })

  test('earning adds to balance and today', () => {
    const { wallet: w, granted } = applyEarning(wallet(), 30, new Date('2026-11-12T05:00:00Z'))
    expect(granted).toBe(30)
    expect(w).toEqual({ balance: 30, day: '2026-11-12', earnedToday: 30 })
  })

  test('daily earning is capped at RM1000', () => {
    expect(DAILY_CAP).toBe(1000)
    const { wallet: w, granted } = applyEarning(wallet({ balance: 5000, earnedToday: 990 }), 30, new Date('2026-11-12T05:00:00Z'))
    expect(granted).toBe(10)
    expect(w.earnedToday).toBe(1000)
    expect(w.balance).toBe(5010)
    expect(applyEarning(w, 5, new Date('2026-11-12T06:00:00Z')).granted).toBe(0)
  })

  test('the cap resets after midnight in Kuala Lumpur', () => {
    const w = wallet({ balance: 1000, earnedToday: 1000, day: '2026-11-12' })
    const { wallet: next, granted } = applyEarning(w, 50, new Date('2026-11-12T16:30:00Z'))
    expect(granted).toBe(50)
    expect(next).toEqual({ balance: 1050, day: '2026-11-13', earnedToday: 50 })
  })

  test('missions have a reward and a real-time cooldown', () => {
    const cook = MISSIONS.find((m) => m.id === 'cook')!
    expect(cook.reward).toBeGreaterThan(0)
    expect(cook.cooldownMs).toBe(5 * 60_000)
    expect(missionReady(cook, undefined, 0)).toBe(true)
    expect(missionReady(cook, 1000, 1000 + 4 * 60_000)).toBe(false)
    expect(missionReady(cook, 1000, 1000 + 5 * 60_000)).toBe(true)
  })
})

describe('tic-tac-toe', () => {
  test('X wins a row', () => {
    let b = newBoard()
    for (const [i, m] of [[0, 'X'], [3, 'O'], [1, 'X'], [4, 'O'], [2, 'X']] as const) b = place(b, i, m)!
    expect(winner(b)).toBe('X')
  })
  test('cannot play on a taken square or out of turn', () => {
    const b = place(newBoard(), 4, 'X')!
    expect(place(b, 4, 'O')).toBeNull()
    expect(place(b, 0, 'X')).toBeNull()
  })
  test('full board with no line is a draw', () => {
    let b = newBoard()
    for (const [i, m] of [[0, 'X'], [1, 'O'], [2, 'X'], [4, 'O'], [3, 'X'], [5, 'O'], [7, 'X'], [6, 'O'], [8, 'X']] as const) b = place(b, i, m)!
    expect(winner(b)).toBe('draw')
  })
})

describe('this or that', () => {
  test('has plenty of questions', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(20)
  })
  test('a round reveals once both have answered, counting matches', () => {
    let s = newTot(['me', 'you'], 3)
    s = answerTot(s, 'me', 0)
    expect(s.revealed).toBe(false)
    s = answerTot(s, 'you', 0)
    expect(s.revealed).toBe(true)
    expect(s.matches).toBe(1)
  })
  test('different answers do not match; answering twice is ignored', () => {
    let s = newTot(['me', 'you'], 3)
    s = answerTot(s, 'me', 0)
    s = answerTot(s, 'me', 1)
    expect(s.answers.me).toBe(0)
    s = answerTot(s, 'you', 1)
    expect(s.matches).toBe(0)
  })
})
