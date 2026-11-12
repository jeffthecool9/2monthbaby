// Picks the close-up 3D set for a first-person activity.
import type { Texture } from 'three'
import type { ActivityId } from '../../play/minigame'
import type { Studio } from './common'
import { KitchenStudio } from './kitchen'
import { BathroomStudio } from './bathroom'
import { BedStudio, LivingStudio, PlantStudio } from './rooms'

export type { Studio } from './common'

export function createStudio(activity: ActivityId, env: Texture | null): Studio | null {
  switch (activity) {
    case 'cook': return new KitchenStudio(env, 'cook')
    case 'dishes': return new KitchenStudio(env, 'dishes')
    case 'bath': return new BathroomStudio(env, 'bath')
    case 'cleanbath': return new BathroomStudio(env, 'clean')
    case 'water': return new PlantStudio(env)
    case 'bed': return new BedStudio(env, 'bed')
    case 'sleep': return new BedStudio(env, 'sleep')
    case 'tv': return new LivingStudio(env)
    default: return null
  }
}
