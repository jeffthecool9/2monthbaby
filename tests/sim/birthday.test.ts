import { expect, test } from 'vitest'
import { HER_BIRTHDAY, isBirthdayKL } from '../../src/game/sim/birthday'

const isHers = (iso: string) => isBirthdayKL(new Date(iso), HER_BIRTHDAY.month, HER_BIRTHDAY.day)

test('starts at midnight 18 Nov in Kuala Lumpur', () => {
  expect(isHers('2026-11-17T16:00:00Z')).toBe(true)
})

test('not yet one second before KL midnight', () => {
  expect(isHers('2026-11-17T15:59:59Z')).toBe(false)
})

test('still on in the last second of 18 Nov KL time', () => {
  expect(isHers('2026-11-18T15:59:59Z')).toBe(true)
})

test('over at midnight 19 Nov KL time', () => {
  expect(isHers('2026-11-18T16:00:00Z')).toBe(false)
})
