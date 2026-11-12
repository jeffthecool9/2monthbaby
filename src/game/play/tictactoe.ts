export type Mark = 'X' | 'O'
export type Board = (Mark | null)[]

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

export const newBoard = (): Board => Array(9).fill(null)

/** Whose turn it is: X always starts. */
export const turn = (b: Board): Mark => (b.filter(Boolean).length % 2 === 0 ? 'X' : 'O')

/** Returns the new board, or null if the move is not allowed. */
export function place(b: Board, i: number, m: Mark): Board | null {
  if (i < 0 || i > 8 || b[i] || winner(b) || turn(b) !== m) return null
  const next = [...b]
  next[i] = m
  return next
}

export function winner(b: Board): Mark | 'draw' | null {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
  return b.every(Boolean) ? 'draw' : null
}

export function winningLine(b: Board): number[] | null {
  return LINES.find(([a, c, d]) => b[a] && b[a] === b[c] && b[a] === b[d]) ?? null
}
