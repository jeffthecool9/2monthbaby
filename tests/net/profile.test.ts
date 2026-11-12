import { expect, test } from 'vitest'
import { rowToProfile } from '../../src/game/net/profile'
import { defaultLook } from '../../src/game/character/look'

test('a database row becomes a profile with a cleaned look', () => {
  const p = rowToProfile({ id: 'u1', display_name: 'Jeff', role: 'male', house_id: 'h', look: { hairStyle: 'bun' } })
  expect(p.id).toBe('u1')
  expect(p.name).toBe('Jeff')
  expect(p.role).toBe('male')
  expect(p.houseId).toBe('h')
  expect(p.look).toEqual({ ...defaultLook('male'), hairStyle: 'bun' })
})

test('an invalid role is rejected', () => {
  expect(() => rowToProfile({ id: 'u1', display_name: 'X', role: 'cat', house_id: 'h', look: {} })).toThrow()
})

test('a missing look falls back to the default for the role', () => {
  expect(rowToProfile({ id: 'u2', display_name: 'Her', role: 'female', house_id: 'h', look: null }).look).toEqual(defaultLook('female'))
})
