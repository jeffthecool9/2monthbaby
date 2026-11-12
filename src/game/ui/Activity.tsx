import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameController } from '../GameController'
import { ACTIVITIES, applyInput, isDone, newGame, score, stepOf, type ActivityId, type GameState, type Input } from '../play/minigame'
import { MISSIONS } from '../play/economy'

const CHANNELS = ['🎬 Late-night movie', '🍜 Food travels', '🐼 Panda cam', '🎤 K-pop stage', '🌊 Ocean documentary', '😂 Comedy hour']
const VEG = ['🥕', '🧅', '🍄', '🥦', '🌶️', '🥬']

type Props = { controller: GameController; activity: ActivityId; mission?: string; watching: boolean; onWatch: (watch: boolean) => void; onClose: () => void }

/** Full-screen first-person activity: the hands-on mini-game, with Exit and a 3D-view toggle. */
export function ActivityScreen({ controller, activity, mission, watching, onWatch, onClose }: Props) {
  const def = ACTIVITIES[activity]
  const [game, setGame] = useState<GameState>(() => newGame(activity))
  const [finished, setFinished] = useState<1 | 2 | 3 | null>(null)
  const gameRef = useRef(game)
  gameRef.current = game
  const reward = mission ? MISSIONS.find((m) => m.id === mission)?.reward ?? 0 : 0

  const send = useCallback((input: Input) => {
    setGame((g) => applyInput(g, input))
  }, [])

  // Keep the 3D props in step with the mini-game.
  useEffect(() => {
    const steps = def.steps.length
    controller.setActivityProgress(Math.min(1, (game.step + game.progress) / steps))
    if (isDone(game) && finished === null) {
      const stars = score(game)
      setFinished(stars)
      const t = setTimeout(() => {
        controller.completeChore(stars)
        onClose()
      }, 1600)
      return () => clearTimeout(t)
    }
  }, [game, def.steps.length, controller, finished, onClose])

  const step = stepOf(game)
  const total = def.steps.length

  return (
    <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ touchAction: 'none' }}>
      {/* Top bar: exit arrow, title, view toggle */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
        <button type="button" aria-label="Exit" className="pointer-events-auto flex h-11 items-center gap-1 rounded-full bg-white/90 px-4 text-sm font-bold text-[#7a3653] shadow-lg active:scale-95" onClick={() => { controller.exitActivity(); onClose() }}>
          ← Exit
        </button>
        <div className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-bold text-[#7a3653] shadow">{def.emoji} {def.title}</div>
        <button type="button" aria-label={watching ? 'Play' : '3D view'} className="pointer-events-auto flex h-11 items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-bold text-[#7a3653] shadow-lg active:scale-95" onClick={() => onWatch(!watching)}>
          {watching ? '🎮 Play' : '👀 3D view'}
        </button>
      </div>

      {watching ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-8 rounded-2xl bg-white/85 p-3 text-center text-sm font-semibold text-[#7a3653] shadow-lg">
          Watching {mission ? 'the chore' : 'in 3D'} · tap 🎮 Play to do it yourself
        </div>
      ) : (
        <>
          {mission && (
            <div className="pointer-events-none absolute inset-x-6 top-[calc(env(safe-area-inset-top)+66px)]">
              <div className="mb-1 flex justify-between text-xs font-bold text-white drop-shadow">
                <span>Step {Math.min(game.step + 1, total)}/{total} · {step.title}</span>
                <span>{'⭐'.repeat(score(game))}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/50">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-[#ff8fb3] to-[#ff5f93]" animate={{ width: `${((game.step + game.progress) / total) * 100}%` }} />
              </div>
              <p className="mt-1 text-center text-sm font-semibold text-white drop-shadow">{step.hint}</p>
            </div>
          )}
          {!mission && <p className="pointer-events-none absolute inset-x-6 top-[calc(env(safe-area-inset-top)+66px)] text-center text-sm font-semibold text-white drop-shadow">{step.title} · {step.hint}</p>}
          <div className="absolute inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+128px)]">
            {finished === null && <StepArea key={`${activity}-${game.step}`} game={game} send={send} />}
          </div>
        </>
      )}

      <AnimatePresence>
        {finished !== null && (
          <motion.div className="absolute inset-0 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="rounded-[28px] bg-white px-8 py-6 text-center shadow-2xl" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
              <div className="text-5xl">{def.emoji}</div>
              <div className="mt-2 text-3xl">{'⭐'.repeat(finished)}</div>
              <div className="mt-1 text-lg font-extrabold text-[#d0476f]">+RM{Math.round(reward * (finished === 3 ? 1.5 : finished === 2 ? 1.2 : 1))}</div>
              <div className="text-sm text-[#b07a92]">{finished === 3 ? 'Perfect!' : finished === 2 ? 'Nice one!' : 'Done!'}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** The interactive part for the current step. */
function StepArea({ game, send }: { game: GameState; send: (i: Input) => void }) {
  const step = stepOf(game)
  switch (step.kind) {
    case 'tap': return <TapStep game={game} send={send} />
    case 'stir': return <StirStep game={game} send={send} />
    case 'flip': return <FlipStep send={send} />
    case 'scrub': return <ScrubStep game={game} send={send} />
    case 'pour': return <PourStep game={game} send={send} />
    case 'swipe': return <SwipeStep game={game} send={send} />
    case 'relax': return <RelaxStep game={game} send={send} />
  }
}

/** Items appear on the board; tap them before they fade. Tapping empty space is a miss. */
function TapStep({ game, send }: { game: GameState; send: (i: Input) => void }) {
  const [items, setItems] = useState<{ id: number; x: number; y: number; emoji: string }[]>([])
  const plating = game.activity === 'cook' && game.step === 3
  const pillows = game.activity === 'bed'
  useEffect(() => {
    if (plating) {
      setItems([{ id: 1, x: 0.5, y: 0.5, emoji: '🍽️' }])
      return
    }
    if (pillows) {
      setItems([0, 1, 2, 3].map((i) => ({ id: i, x: 0.25 + (i % 2) * 0.5, y: 0.35 + Math.floor(i / 2) * 0.3, emoji: '🛏️' })))
      return
    }
    let id = 0
    const spawn = () => setItems((l) => [...l.slice(-3), { id: ++id, x: 0.15 + Math.random() * 0.7, y: 0.2 + Math.random() * 0.6, emoji: VEG[id % VEG.length] }])
    spawn()
    const t = setInterval(spawn, 650)
    return () => clearInterval(t)
  }, [plating, pillows])
  return (
    <div className="relative h-full w-full" onPointerDown={() => send({ type: 'tap', hit: false })}>
      <div className="pointer-events-none absolute inset-x-8 bottom-10 top-6 rounded-[32px] bg-[#d9b27a]/70 shadow-inner" />
      <AnimatePresence>
        {items.map((it) => (
          <motion.button
            key={it.id}
            type="button"
            className="absolute -translate-x-1/2 -translate-y-1/2 text-5xl drop-shadow-lg"
            style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%` }}
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.6 }}
            onPointerDown={(e) => {
              e.stopPropagation()
              setItems((l) => l.filter((x) => x.id !== it.id))
              send({ type: 'tap', hit: true })
            }}
          >
            {it.emoji}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Draw clockwise circles over the pan. */
function StirStep({ game, send }: { game: GameState; send: (i: Input) => void }) {
  const last = useRef<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const angleOf = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
  }
  return (
    <div
      ref={box}
      className="relative h-full w-full"
      onPointerDown={(e) => (last.current = angleOf(e))}
      onPointerMove={(e) => {
        if (last.current === null) return
        const a = angleOf(e)
        let d = a - last.current
        if (d > Math.PI) d -= Math.PI * 2
        if (d < -Math.PI) d += Math.PI * 2
        last.current = a
        if (d > 0) send({ type: 'stir', radians: d })
      }}
      onPointerUp={() => (last.current = null)}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-72 w-72 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#2b2b2f] shadow-2xl ring-8 ring-[#44444a]">
        <motion.div className="text-8xl" animate={{ rotate: game.progress * 1440 }} transition={{ type: 'tween', duration: 0.15 }}>🥘</motion.div>
        <motion.div className="absolute text-5xl" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }} style={{ transformOrigin: '50% 140%' }}>🥄</motion.div>
      </div>
      <div className="pointer-events-none absolute inset-x-10 bottom-10 text-center text-sm font-semibold text-white drop-shadow">↻ keep circling clockwise</div>
    </div>
  )
}

/** A ring pulses; swipe up while it's green. */
function FlipStep({ send }: { send: (i: Input) => void }) {
  const [phase, setPhase] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      setPhase(((performance.now() - t0) / 1300) % 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const green = phase > 0.32 && phase < 0.58
  return (
    <div
      className="relative h-full w-full"
      onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        if (start.current && start.current.y - e.clientY > 50) send({ type: 'swipe', inWindow: green })
        start.current = null
      }}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`flex h-64 w-64 items-center justify-center rounded-full border-[14px] transition-colors ${green ? 'border-[#5fe08a] shadow-[0_0_40px_#5fe08a]' : 'border-white/60'}`} style={{ transform: `scale(${0.75 + Math.sin(phase * Math.PI) * 0.3})` }}>
          <span className="text-7xl">🍳</span>
        </div>
        <div className="mt-4 text-center text-lg font-extrabold text-white drop-shadow">{green ? 'NOW! swipe up ⬆️' : 'wait for green…'}</div>
      </div>
    </div>
  )
}

/** Rub over every dirty spot. */
function ScrubStep({ game, send }: { game: GameState; send: (i: Input) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const targets = stepOf(game).targets ?? []
  const move = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    setPos({ x, y })
    send({ type: 'scrub', x, y })
  }
  const plates = game.activity === 'dishes'
  return (
    <div ref={box} className="relative h-full w-full" onPointerDown={move} onPointerMove={(e) => e.buttons && move(e)} onPointerUp={() => setPos(null)}>
      <div className={`pointer-events-none absolute inset-x-6 bottom-8 top-4 rounded-[32px] ${plates ? 'bg-white/85' : 'bg-[#e8f1f5]/85'} shadow-inner`} style={plates ? {} : { backgroundImage: 'linear-gradient(#cfdde5 1px, transparent 1px), linear-gradient(90deg, #cfdde5 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      {targets.map((t, i) => (
        <AnimatePresence key={i}>
          {!game.cleared[i] && (
            <motion.div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-4xl" style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }} exit={{ scale: 1.6, opacity: 0 }}>
              {plates ? '🟤' : '🟫'}
            </motion.div>
          )}
        </AnimatePresence>
      ))}
      {pos && <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-5xl" style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}>🧽</div>}
    </div>
  )
}

/** Hold to pour; let go inside the green zone. */
function PourStep({ game, send }: { game: GameState; send: (i: Input) => void }) {
  const holding = useRef(false)
  useEffect(() => {
    let raf = 0, last = performance.now()
    const loop = () => {
      const now = performance.now()
      if (holding.current) send({ type: 'hold', dt: now - last })
      last = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [send])
  const [lo, hi] = stepOf(game).window ?? [0.5, 0.8]
  return (
    <div className="relative h-full w-full" onPointerDown={() => (holding.current = true)} onPointerUp={() => { holding.current = false; send({ type: 'release' }) }} onPointerCancel={() => (holding.current = false)}>
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-end gap-8">
        <div className="relative h-72 w-16 overflow-hidden rounded-full bg-white/40 ring-4 ring-white/70">
          <div className="absolute inset-x-0 bg-[#5fe08a]/60" style={{ bottom: `${lo * 100}%`, height: `${(hi - lo) * 100}%` }} />
          <motion.div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#4aa3ff] to-[#9fd4ff]" animate={{ height: `${game.gauge * 100}%` }} transition={{ type: 'tween', duration: 0.05 }} />
        </div>
        <motion.div className="text-8xl" animate={{ rotate: holding.current ? -35 : 0 }}>🪣</motion.div>
        <div className="text-7xl">🪴</div>
      </div>
      <div className="pointer-events-none absolute inset-x-10 bottom-10 text-center text-sm font-semibold text-white drop-shadow">hold anywhere to pour · release in the green</div>
    </div>
  )
}

/** Swipe across to smooth the duvet. */
function SwipeStep({ game, send }: { game: GameState; send: (i: Input) => void }) {
  const start = useRef<number | null>(null)
  return (
    <div className="relative h-full w-full" onPointerDown={(e) => (start.current = e.clientX)} onPointerUp={(e) => { if (start.current !== null && Math.abs(e.clientX - start.current) > 80) send({ type: 'swipe' }); start.current = null }}>
      <div className="pointer-events-none absolute inset-x-6 bottom-10 top-6 rounded-[32px] bg-[#f6cdd8]/90 shadow-inner">
        {[0, 1, 2, 3].map((i) => (
          <motion.div key={i} className="absolute left-[12%] right-[12%] h-6 rounded-full bg-[#e9a9bd]" style={{ top: `${18 + i * 20}%` }} animate={{ scaleY: i < game.progress * 4 ? 0 : 1, opacity: i < game.progress * 4 ? 0 : 1 }} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-10 bottom-12 text-center text-2xl text-white drop-shadow">⟷ swipe across</div>
    </div>
  )
}

/** TV channels, bath bubbles, the view, or the night sky. */
function RelaxStep({ game, send }: { game: GameState; send: (i: Input) => void }) {
  const start = useRef<number | null>(null)
  const [bubbles, setBubbles] = useState(() => Array.from({ length: 10 }, (_, i) => ({ id: i, x: 0.1 + Math.random() * 0.8, y: 0.3 + Math.random() * 0.5, s: 0.7 + Math.random() * 0.8 })))
  if (game.activity === 'tv') {
    const ch = Math.round(game.progress * 4) % CHANNELS.length
    return (
      <div className="relative h-full w-full" onPointerDown={(e) => (start.current = e.clientX)} onPointerUp={(e) => { if (start.current !== null && Math.abs(e.clientX - start.current) > 60) send({ type: 'swipe' }); start.current = null }}>
        <div className="pointer-events-none absolute inset-x-6 bottom-10 rounded-2xl bg-black/55 p-4 text-center text-white backdrop-blur">
          <div className="text-xs uppercase tracking-widest opacity-70">Now playing</div>
          <div className="text-lg font-bold">{CHANNELS[ch]}</div>
          <div className="text-xs opacity-70">⟷ swipe to change channel</div>
        </div>
      </div>
    )
  }
  if (game.activity === 'bath') {
    return (
      <div className="relative h-full w-full">
        {bubbles.map((b) => (
          <motion.button
            key={b.id}
            type="button"
            className="absolute -translate-x-1/2 -translate-y-1/2 text-5xl"
            style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, scale: b.s }}
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 2 + b.s }}
            whileTap={{ scale: 1.6, opacity: 0 }}
            onPointerDown={() => {
              send({ type: 'tap', hit: true })
              setBubbles((l) => l.map((x) => (x.id === b.id ? { ...x, x: 0.1 + Math.random() * 0.8, y: 0.3 + Math.random() * 0.5 } : x)))
            }}
          >
            🫧
          </motion.button>
        ))}
        <div className="pointer-events-none absolute inset-x-10 bottom-10 text-center text-sm font-semibold text-white drop-shadow">{game.taps} bubbles popped ✨</div>
      </div>
    )
  }
  if (game.activity === 'sleep') {
    return (
      <div className="pointer-events-none absolute inset-0 bg-[#0a0718]/70">
        <div className="absolute inset-x-10 bottom-12 text-center text-sm font-semibold text-white/80">🌙 Sweet dreams · tap ← Exit to wake up</div>
      </div>
    )
  }
  return <div className="pointer-events-none absolute inset-x-10 bottom-12 text-center text-sm font-semibold text-white drop-shadow">🌇 drag to look around</div>
}
