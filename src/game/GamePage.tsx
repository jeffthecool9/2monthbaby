import { useEffect, useRef } from 'react'
import { GameController } from './GameController'
import { defaultLook } from './character/look'
import { createLocalRoom } from './net/localRoom'
import type { PresenceState } from './net/protocol'
import type { Identity } from './sim/sim'
import { SPAWN } from './world/layout'

const LOCAL_PEOPLE: Record<'her' | 'him', Identity> = {
  her: { userId: 'local-her', name: 'Her', role: 'female', look: defaultLook('female') },
  him: { userId: 'local-him', name: 'Him', role: 'male', look: defaultLook('male') },
}

export default function GamePage() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const as = params.get('as') === 'him' ? 'him' : 'her'
    const me = LOCAL_PEOPLE[as], partner = LOCAL_PEOPLE[as === 'her' ? 'him' : 'her']
    const start = { x: SPAWN.x + (as === 'her' ? -0.6 : 0.6), z: SPAWN.z }
    const presence: PresenceState = { ...me, pos: start, facing: Math.PI, activity: 'idle' }
    const game = new GameController(ref.current!, createLocalRoom('local-house'), presence, partner)
    void game.start()
    if (import.meta.env.DEV) (window as unknown as { __game: GameController }).__game = game
    return () => game.dispose()
  }, [])
  return <canvas ref={ref} style={{ width: '100vw', height: '100dvh', display: 'block', touchAction: 'none' }} />
}
