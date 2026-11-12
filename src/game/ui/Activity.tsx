import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameController } from '../GameController'
import { ACTIVITIES, applyInput, isDone, newGame, score, stepOf, stepsOf, type ActivityId, type GameState } from '../play/minigame'
import { DISHES, DISH_IDS, type DishId } from '../play/recipes'
import { MISSIONS } from '../play/economy'

type Props = { controller: GameController; activity: ActivityId; mission?: string; watching: boolean; onWatch: (watch: boolean) => void; onClose: () => void }

/**
 * Full-screen first-person activity. The 3D close-up set (three/studio) draws everything and turns
 * touches into inputs; this overlay holds the rules state, the step card, gauges and the result.
 */
export function ActivityScreen({ controller, activity, mission, watching, onWatch, onClose }: Props) {
  const def = ACTIVITIES[activity]
  const [dish, setDish] = useState<DishId | null>(null)
  const [game, setGame] = useState<GameState>(() => newGame(activity))
  const [finished, setFinished] = useState<1 | 2 | 3 | null>(null)
  const [flash, setFlash] = useState<{ text: string; good: boolean; key: number } | null>(null)
  const [timing, setTiming] = useState(0)
  const prev = useRef(game)
  const studio = controller.studio
  const hasSet = !!studio
  const reward = mission ? MISSIONS.find((m) => m.id === mission)?.reward ?? 0 : 0
  const picking = activity === 'cook' && !dish

  // Touches and gestures in the 3D set become inputs to the rules.
  useEffect(() => {
    if (!studio) return
    studio.onInput = (i) => setGame((g) => applyInput(g, i))
    return () => {
      studio.onInput = () => {}
    }
  }, [studio])

  // Every state change goes back to the 3D set, and to the props my partner sees.
  useEffect(() => {
    studio?.sync(game)
    const steps = stepsOf(game).length
    if (steps) controller.setActivityProgress(Math.min(1, (game.step + game.progress) / steps))
    const p = prev.current
    prev.current = game
    if (p.activity === game.activity && p.dish === game.dish) {
      if (game.misses > p.misses) setFlash({ text: missText(stepOf(p).action), good: false, key: Date.now() })
      else if (game.step > p.step && !isDone(game)) setFlash({ text: ['Nice!', 'Great!', 'Perfect!', 'Lovely!'][game.step % 4], good: true, key: Date.now() })
    }
    if (isDone(game) && finished === null) {
      const stars = score(game)
      setFinished(stars)
      const t = setTimeout(() => {
        controller.completeChore(stars)
        onClose()
      }, 2600)
      return () => clearTimeout(t)
    }
  }, [game, studio, controller, finished, onClose])

  // Timing steps (flip): poll how ready it is for the bar.
  const step = stepsOf(game).length ? stepOf(game) : null
  useEffect(() => {
    if (step?.mechanic !== 'timing' || !studio) return
    let raf = 0
    const loop = () => {
      setTiming(studio.timing)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [step?.mechanic, studio])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 900)
    return () => clearTimeout(t)
  }, [flash])

  const choose = (d: DishId) => {
    setDish(d)
    setGame(newGame('cook', d))
  }

  const total = stepsOf(game).length
  const title = dish ? `${DISHES[dish].emoji} ${DISHES[dish].title}` : `${def.emoji} ${def.title}`
  const send = (kind: 'down' | 'move' | 'up', e: React.PointerEvent) => {
    if (kind === 'down') (e.target as Element).setPointerCapture?.(e.pointerId)
    if (kind === 'move' && e.pointerType === 'mouse' && e.buttons === 0) return
    studio?.pointer(kind, e.clientX, e.clientY)
  }

  return (
    <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ touchAction: 'none' }}>
      {/* The whole screen is the play area (under the bars). */}
      {!watching && hasSet && !picking && finished === null && (
        <div
          className="absolute inset-0"
          onPointerDown={(e) => send('down', e)}
          onPointerMove={(e) => send('move', e)}
          onPointerUp={(e) => send('up', e)}
          onPointerCancel={(e) => send('up', e)}
        />
      )}

      {/* Top bar: exit arrow, title, view toggle */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
        <button type="button" aria-label="Exit" className="pointer-events-auto flex h-11 shrink-0 items-center gap-1 rounded-full bg-white/90 px-4 text-sm font-bold text-[#7a3653] shadow-lg active:scale-95" onClick={() => { controller.exitActivity(); onClose() }}>
          ← Exit
        </button>
        <div className="min-w-0 truncate rounded-full bg-white/80 px-3 py-1.5 text-sm font-bold text-[#7a3653] shadow">{title}</div>
        {hasSet ? (
          <button type="button" aria-label={watching ? 'Play' : '3D view'} className="pointer-events-auto flex h-11 shrink-0 items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-bold text-[#7a3653] shadow-lg active:scale-95" onClick={() => onWatch(!watching)}>
            {watching ? '🎮 Play' : '👀 3D view'}
          </button>
        ) : <span className="w-11" />}
      </div>

      {finished !== null ? null : watching || !hasSet ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-8 rounded-2xl bg-white/85 p-3 text-center text-sm font-semibold text-[#7a3653] shadow-lg">
          {hasSet ? <>Watching in 3D · tap 🎮 Play to do it yourself</> : <>{def.steps[0]?.title} · tap ← Exit to get up</>}
        </div>
      ) : picking ? (
        <RecipePicker onPick={choose} />
      ) : step && finished === null ? (
        <>
          <div className="pointer-events-none absolute inset-x-4 top-[calc(env(safe-area-inset-top)+64px)] rounded-2xl bg-black/35 px-3 py-2 backdrop-blur-sm">
            {mission ? (
              <>
                <div className="mb-1 flex justify-between text-xs font-bold text-white">
                  <span className="truncate">Step {Math.min(game.step + 1, total)}/{total} · {step.title}</span>
                  <span className="shrink-0 pl-2">{'⭐'.repeat(score(game))}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/30">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-[#ff8fb3] to-[#ff5f93]" animate={{ width: `${((game.step + game.progress) / total) * 100}%` }} />
                </div>
              </>
            ) : (
              <div className="text-center text-sm font-bold text-white">{step.title}</div>
            )}
            <p className="mt-1 text-center text-[13px] font-semibold text-white/95">{step.hint}</p>
          </div>

          {step.mechanic === 'gauge' && <Gauge value={game.gauge} window={step.window ?? [0.5, 0.8]} label={gaugeLabel(step.action)} />}
          {step.mechanic === 'timing' && <Gauge value={timing} window={step.window ?? [0.55, 0.8]} label="Golden?" timing />}
          {step.mechanic === 'circle' && <Ring progress={game.progress} />}
          {step.mechanic === 'relax' && activity === 'bath' && <Counter text={`${game.taps} 🫧 popped`} />}
        </>
      ) : null}

      <AnimatePresence>
        {flash && (
          <motion.div key={flash.key} className="pointer-events-none absolute inset-x-0 top-[40%] text-center" initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <span className={`rounded-full px-5 py-2 text-2xl font-extrabold shadow-xl ${flash.good ? 'bg-white text-[#d0476f]' : 'bg-[#2b1b22]/80 text-[#ffb0b0]'}`}>{flash.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {finished !== null && (
          <motion.div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
            <motion.div className="rounded-[28px] bg-white/95 px-8 py-5 text-center shadow-2xl" initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: 'spring', stiffness: 300, damping: 18 }}>
              <div className="text-sm font-bold text-[#b07a92]">{dish ? DISHES[dish].title : def.title}</div>
              <div className="mt-1 text-3xl">{'⭐'.repeat(finished)}</div>
              <div className="mt-1 text-lg font-extrabold text-[#d0476f]">+RM{Math.round(reward * (finished === 3 ? 1.5 : finished === 2 ? 1.2 : 1))}</div>
              <div className="text-sm text-[#b07a92]">{finished === 3 ? 'Perfect!' : finished === 2 ? 'Nice one!' : 'Done!'}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const missText = (action: string) =>
  action === 'chop' ? 'Follow the line!' : action === 'stir' ? 'It’s burning! 🔥' : action === 'flip' ? 'Not yet… or too late!' : action === 'heat' ? 'Too hot! 💨' : ['pour', 'fill', 'rinse', 'warm'].includes(action) ? 'Oops — try again' : 'Missed!'

const gaugeLabel = (action: string) =>
  action === 'heat' ? 'Heat' : action === 'fill' ? 'Water' : action === 'warm' ? 'Warmth' : action === 'rinse' ? 'Rinse' : 'Pour'

/** Choose what to cook. */
function RecipePicker({ onPick }: { onPick: (d: DishId) => void }) {
  return (
    <motion.div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white/95 px-4 pt-4 shadow-2xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }} initial={{ y: 300 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      <div className="mb-3 text-center text-base font-extrabold text-[#7a3653]">What shall we cook? 👩‍🍳</div>
      <div className="grid grid-cols-2 gap-2.5">
        {DISH_IDS.map((id) => {
          const d = DISHES[id]
          return (
            <button key={id} type="button" onClick={() => onPick(id)} className="rounded-2xl border border-[#f3d6e1] bg-gradient-to-b from-white to-[#fff3f7] p-3 text-left shadow-sm active:scale-95">
              <div className="text-3xl">{d.emoji}</div>
              <div className="mt-1 text-sm font-extrabold leading-tight text-[#7a3653]">{d.title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-[#b07a92]">{d.blurb}</div>
              <div className="mt-1.5 text-[11px] font-bold text-[#d0476f]">{d.steps.length} steps · {d.minutes}</div>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

/** Vertical meter with a green zone, for hold-and-release and timing steps. */
function Gauge({ value, window: [lo, hi], label, timing }: { value: number; window: [number, number]; label: string; timing?: boolean }) {
  const inZone = value >= lo && value <= hi
  return (
    <div className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1">
      <div className="relative h-56 w-7 overflow-hidden rounded-full bg-black/35 ring-2 ring-white/70">
        <div className="absolute inset-x-0 bg-[#5fe08a]/70" style={{ bottom: `${lo * 100}%`, height: `${(hi - lo) * 100}%` }} />
        <div className={`absolute inset-x-0 bottom-0 ${timing ? 'bg-gradient-to-t from-[#ffe6a0] via-[#e8a040] to-[#8a4a10]' : 'bg-gradient-to-t from-[#ffd36b] to-[#ff7a59]'}`} style={{ height: `${Math.min(1, value) * 100}%`, opacity: 0.9 }} />
        <div className="absolute inset-x-[-4px] h-1 rounded bg-white shadow" style={{ bottom: `calc(${Math.min(1, value) * 100}% - 2px)` }} />
      </div>
      <div className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${inZone ? 'bg-[#5fe08a] text-[#0d3a1d]' : 'bg-white/85 text-[#7a3653]'}`}>{inZone ? (timing ? 'NOW!' : 'Let go!') : label}</div>
    </div>
  )
}

/** Shows how much stirring is left. */
function Ring({ progress }: { progress: number }) {
  const r = 22, c = 2 * Math.PI * r
  return (
    <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] left-1/2 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full bg-black/35 py-1.5 pl-1.5 pr-4 backdrop-blur-sm">
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r={r} stroke="rgba(255,255,255,0.3)" strokeWidth="5" fill="none" />
          <circle cx="26" cy="26" r={r} stroke="#ff8fb3" strokeWidth="5" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} strokeLinecap="round" transform="rotate(-90 26 26)" />
          <text x="26" y="31" textAnchor="middle" fontSize="16" fill="white">↻</text>
        </svg>
        <span className="text-sm font-bold text-white">Keep circling</span>
      </div>
    </div>
  )
}

function Counter({ text }: { text: string }) {
  return <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+28px)] text-center text-sm font-bold text-white drop-shadow">{text}</div>
}
