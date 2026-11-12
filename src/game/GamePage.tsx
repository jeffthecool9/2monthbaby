import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { GameController } from './GameController'
import { defaultLook, type CharacterLook } from './character/look'
import { createLocalRoom } from './net/localRoom'
import { createSupabaseRoom } from './net/supabaseRoom'
import { supabase } from './net/supabase'
import { insertChat, loadMyProfile, loadPartner, loadRecentChat, saveLook, type Profile } from './net/profile'
import type { PresenceState } from './net/protocol'
import type { Room } from './net/room'
import type { Identity } from './sim/sim'
import { SPAWN } from './world/layout'
import { Hud } from './ui/Hud'
import { LoginScreen } from './ui/LoginScreen'
import type { LogLine } from './ui/ChatLog'
import { BirthdayBanner } from './ui/BirthdayBanner'
import { HER_BIRTHDAY, isBirthdayKL } from './sim/birthday'

const LOCAL_PEOPLE: Record<'her' | 'him', Identity> = {
  her: { userId: 'local-her', name: 'Her', role: 'female', look: defaultLook('female') },
  him: { userId: 'local-him', name: 'Him', role: 'male', look: defaultLook('male') },
}

type Setup = { room: Room; me: Identity; partner: Identity | null; houseId?: string; history: LogLine[] }

const GAME_FONT = "Inter, ui-rounded, -apple-system, 'Segoe UI', sans-serif"

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center px-8 text-center text-[#ffd6e7]" style={{ minHeight: '100dvh', background: '#1a0f1f', fontFamily: GAME_FONT }}>
      <div>{children}</div>
    </div>
  )
}

/** Canvas + HUD for a ready game setup. */
function Game({ setup }: { setup: Setup }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const her = setup.me.role === 'female' ? setup.me : setup.partner?.role === 'female' ? setup.partner : null
  const birthdayName = useMemo(() => {
    const forced = new URLSearchParams(location.search).has('bday')
    return her && (forced || isBirthdayKL(new Date(), HER_BIRTHDAY.month, HER_BIRTHDAY.day)) ? her.name : null
  }, [her])
  const [game, setGame] = useState<GameController | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const start = { x: SPAWN.x + (setup.me.role === 'female' ? -0.6 : 0.6), z: SPAWN.z }
    const presence: PresenceState = { ...setup.me, pos: start, facing: Math.PI, activity: 'idle' }
    const g = new GameController(ref.current!, setup.room, presence, setup.partner, { birthdayName })
    void g.start().then(() => setGame(g))
    if (import.meta.env.DEV) (window as unknown as { __game: GameController }).__game = g
    return () => {
      setGame(null)
      g.dispose()
    }
  }, [setup])

  const onLookChange = (look: CharacterLook) => {
    if (!supabase || !setup.houseId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveLook(supabase!, look).catch(console.warn), 1000)
  }
  const onSay = (text: string) => {
    if (supabase && setup.houseId) void insertChat(supabase, setup.houseId, text).catch(console.warn)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1a0f1f]" style={{ height: '100dvh', fontFamily: GAME_FONT }}>
      <canvas ref={ref} className="block h-full w-full" style={{ touchAction: 'none' }} />
      <Hud controller={game} onLookChange={onLookChange} onSay={onSay} history={setup.history} />
      {birthdayName && game && <BirthdayBanner name={birthdayName} isHer={setup.me.role === 'female'} />}
    </div>
  )
}

const toIdentity = (p: Profile): Identity => ({ userId: p.id, name: p.name, role: p.role, look: p.look })

export default function GamePage() {
  const params = useMemo(() => new URLSearchParams(location.search), [])
  const local = params.has('local') || (import.meta.env.DEV && !supabase && params.has('as'))
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [setup, setSetup] = useState<Setup | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Local tab-to-tab mode: no accounts needed.
  useEffect(() => {
    if (!local) return
    const as = params.get('as') === 'him' ? 'him' : 'her'
    setSetup({ room: createLocalRoom('local-house'), me: LOCAL_PEOPLE[as], partner: LOCAL_PEOPLE[as === 'her' ? 'him' : 'her'], history: [] })
  }, [local, params])

  useEffect(() => {
    if (local || !supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [local])

  useEffect(() => {
    if (local || !supabase || !session) return
    let cancelled = false
    ;(async () => {
      try {
        const me = await loadMyProfile(supabase)
        const [partner, chat] = await Promise.all([loadPartner(supabase, me), loadRecentChat(supabase, me.houseId)])
        if (cancelled) return
        setSetup({
          room: createSupabaseRoom(supabase, me.houseId),
          me: toIdentity(me),
          partner: partner ? toIdentity(partner) : null,
          houseId: me.houseId,
          history: chat.map((c) => ({ id: c.id, sender: c.sender, text: c.text })),
        })
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('Your account isn’t linked to a home yet. Run the seed step in docs/SETUP-couple-home.md.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [local, session])

  if (setup) return <Game setup={setup} />
  if (local) return <Screen>Loading our home…</Screen>
  if (!supabase) return <Screen><p className="text-lg font-semibold">Our home isn’t connected yet 🏗️</p><p className="mt-2 text-sm opacity-80">Follow docs/SETUP-couple-home.md to connect Supabase.</p></Screen>
  if (error) return <Screen><p>{error}</p></Screen>
  if (session === undefined) return <Screen>Loading our home…</Screen>
  if (!session) return <div style={{ fontFamily: GAME_FONT }}><LoginScreen client={supabase} /></div>
  return <Screen>Loading our home…</Screen>
}
