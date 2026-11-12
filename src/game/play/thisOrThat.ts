// "This or That": both pick one of two options at the same time; matching answers win hearts.
export const QUESTIONS: [string, string, string][] = [
  ['🏖️', 'Beach', 'Mountains'], ['🍜', 'Nasi lemak', 'Ramen'], ['🎬', 'Movie night', 'Game night'], ['☕', 'Coffee', 'Bubble tea'],
  ['🌅', 'Sunrise', 'Sunset'], ['🐶', 'Dogs', 'Cats'], ['🍕', 'Pizza', 'Sushi'], ['🏙️', 'City trip', 'Nature trip'],
  ['🎤', 'Karaoke', 'Concert'], ['🛋️', 'Stay in', 'Go out'], ['🍦', 'Ice cream', 'Cake'], ['📸', 'Take photos', 'Be in photos'],
  ['🌧️', 'Rainy day', 'Sunny day'], ['🎁', 'Give gifts', 'Get gifts'], ['🚗', 'Road trip', 'Flight'], ['🌶️', 'Spicy', 'Sweet'],
  ['🌙', 'Night owl', 'Early bird'], ['💌', 'Love letter', 'Surprise date'], ['🍳', 'Cook together', 'Eat out'], ['🎮', 'Play games', 'Watch series'],
  ['❄️', 'Japan in winter', 'Bali in summer'], ['🧸', 'Cuddles', 'Kisses'], ['🍓', 'Strawberry', 'Chocolate'], ['🎢', 'Theme park', 'Spa day'],
  ['📚', 'Read together', 'Nap together'], ['🌸', 'Flowers', 'Chocolates'], ['🛍️', 'Shopping', 'Cafe hopping'], ['🏠', 'Big house', 'Cosy flat'],
]

export type TotState = {
  order: number[]
  round: number
  players: [string, string]
  answers: Record<string, 0 | 1 | undefined>
  revealed: boolean
  matches: number
}

/** Seeded so both phones pick the same questions. */
export function newTot(players: [string, string], seed: number, rounds = 8): TotState {
  let s = seed >>> 0
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const idx = QUESTIONS.map((_, i) => i).sort(() => rnd() - 0.5)
  return { order: idx.slice(0, rounds), round: 0, players, answers: {}, revealed: false, matches: 0 }
}

export function answerTot(s: TotState, who: string, choice: 0 | 1): TotState {
  if (s.revealed || s.answers[who] !== undefined || !s.players.includes(who)) return s
  const answers = { ...s.answers, [who]: choice }
  const both = s.players.every((p) => answers[p] !== undefined)
  const match = both && answers[s.players[0]] === answers[s.players[1]]
  return { ...s, answers, revealed: both, matches: s.matches + (match ? 1 : 0) }
}

export function nextTot(s: TotState): TotState {
  return { ...s, round: s.round + 1, answers: {}, revealed: false }
}

export const totDone = (s: TotState) => s.round >= s.order.length
