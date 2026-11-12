// The dishes you can cook, each with its own fixed procedure from chopping board to plate.
import type { Step } from './minigame'

export type DishId = 'friedrice' | 'tomatoegg' | 'pancakes' | 'meegoreng'

export type Dish = { title: string; emoji: string; blurb: string; minutes: string; steps: Step[] }

const chop = (item: string, name: string, slices: number): Step => ({ action: 'chop', mechanic: 'count', title: `Slice the ${name}`, hint: 'Swipe down along each dotted line', amount: slices, item })
const crack = (eggs: number): Step => ({ action: 'crack', mechanic: 'count', title: eggs > 1 ? `Crack ${eggs} eggs` : 'Crack an egg', hint: 'Tap the egg to knock it on the rim, tap again to open', amount: eggs * 2, item: 'egg' })
const whisk = (turns: number, title = 'Whisk it up'): Step => ({ action: 'whisk', mechanic: 'circle', title, hint: 'Draw circles in the bowl, clockwise', amount: turns * Math.PI * 2, item: 'bowl' })
const heat = (title = 'Heat the oil', hint = 'Hold the knob · let go when the oil shimmers'): Step => ({ action: 'heat', mechanic: 'gauge', title, hint, window: [0.55, 0.8], seconds: 2.6 })
const add = (items: string[], title: string): Step => ({ action: 'add', mechanic: 'count', title, hint: 'Tap each one to tip it in', amount: items.length, items })
const stir = (turns: number, title: string): Step => ({ action: 'stir', mechanic: 'circle', title, hint: 'Circle the spatula · don’t stop or it burns!', amount: turns * Math.PI * 2 })
const season = (item: string, title: string, shakes: number): Step => ({ action: 'season', mechanic: 'count', title, hint: 'Shake it — swipe up and down', amount: shakes, item })
const plate = (title = 'Serve it up'): Step => ({ action: 'plate', mechanic: 'count', title, hint: 'Tap the pan to slide it onto the plate', amount: 1 })

export const DISHES: Record<DishId, Dish> = {
  friedrice: {
    title: 'Nasi Goreng Kampung', emoji: '🍛', minutes: '≈2 min', blurb: 'Shallots, chili, egg and rice tossed in kicap',
    steps: [
      chop('shallot', 'shallots', 4),
      chop('chili', 'chilies', 4),
      crack(1),
      whisk(2, 'Beat the egg'),
      heat(),
      add(['shallot', 'chili'], 'Into the wok'),
      stir(2, 'Fry until fragrant'),
      add(['egg', 'rice'], 'Egg, then rice'),
      stir(3, 'Toss it all together'),
      season('soy', 'A splash of kicap', 4),
      plate(),
    ],
  },
  tomatoegg: {
    title: 'Tomato & Egg Stir-fry', emoji: '🍅', minutes: '≈2 min', blurb: 'Silky scrambled eggs with juicy tomato',
    steps: [
      { action: 'wash', mechanic: 'scrub', title: 'Wash the tomato', hint: 'Rub it clean under the tap', targets: [{ x: 0.38, y: 0.3 }, { x: 0.62, y: 0.34 }, { x: 0.46, y: 0.5 }, { x: 0.58, y: 0.56 }], item: 'tomato' },
      chop('tomato', 'tomato', 5),
      crack(2),
      whisk(2, 'Beat the eggs'),
      heat(),
      { action: 'pour', mechanic: 'gauge', title: 'Pour in the eggs', hint: 'Hold to pour · let go when the bowl is empty', window: [0.75, 1], seconds: 2, item: 'eggs' },
      stir(2, 'Scramble gently'),
      add(['tomato'], 'Add the tomato'),
      stir(2, 'Let it get saucy'),
      season('salt', 'Pinch of salt', 3),
      plate(),
    ],
  },
  pancakes: {
    title: 'Fluffy Pancakes', emoji: '🥞', minutes: '≈2 min', blurb: 'Golden stack with maple syrup',
    steps: [
      crack(1),
      { action: 'pour', mechanic: 'gauge', title: 'Pour the milk', hint: 'Hold to pour · let go at the line', window: [0.55, 0.75], seconds: 2.4, item: 'milk' },
      add(['flour'], 'Add the flour'),
      whisk(3, 'Whisk a smooth batter'),
      heat('Heat the pan', 'Hold the knob · let go when the butter foams'),
      { action: 'pour', mechanic: 'gauge', title: 'Pour a pancake', hint: 'Hold to pour · let go when it’s round', window: [0.5, 0.72], seconds: 2, item: 'batter' },
      { action: 'flip', mechanic: 'timing', title: 'Flip it!', hint: 'Swipe up when the edge turns golden', amount: 1, window: [0.55, 0.8] },
      plate('Onto the plate'),
      { action: 'pour', mechanic: 'gauge', title: 'Drizzle the syrup', hint: 'Hold to drizzle · don’t drown it', window: [0.4, 0.75], seconds: 2, item: 'syrup' },
    ],
  },
  meegoreng: {
    title: 'Mee Goreng Mamak', emoji: '🍜', minutes: '≈2 min', blurb: 'Yellow noodles, choy sum and garlic, wok-fried',
    steps: [
      chop('garlic', 'garlic', 3),
      chop('choysum', 'choy sum', 4),
      heat(),
      add(['garlic'], 'Garlic first'),
      stir(1.5, 'Until golden'),
      add(['noodles', 'choysum'], 'Noodles and greens'),
      stir(3, 'Toss the noodles'),
      season('soy', 'Kicap manis', 4),
      plate(),
    ],
  },
}

export const DISH_IDS = Object.keys(DISHES) as DishId[]
