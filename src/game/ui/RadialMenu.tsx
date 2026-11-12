import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ActionKind } from '../types'

export type RadialItem = { id: ActionKind; label: string; emoji: string }

export const ACTION_ITEMS: RadialItem[] = [
  { id: 'kiss', label: 'Kiss', emoji: '😘' },
  { id: 'hug', label: 'Hug', emoji: '🤗' },
  { id: 'highfive', label: 'High five', emoji: '✋' },
  { id: 'comfort', label: 'Comfort', emoji: '🫂' },
  { id: 'wave', label: 'Wave', emoji: '👋' },
  { id: 'dance', label: 'Dance', emoji: '💃' },
]

const R_OUT = 150, R_IN = 62
const polar = (r: number, a: number) => [Math.cos(a) * r, Math.sin(a) * r] as const

function sectorPath(i: number, n: number) {
  const gap = 0.03
  const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2 - Math.PI / n + gap
  const a1 = a0 + (Math.PI * 2) / n - gap * 2
  const [x0, y0] = polar(R_OUT, a0), [x1, y1] = polar(R_OUT, a1)
  const [x2, y2] = polar(R_IN, a1), [x3, y3] = polar(R_IN, a0)
  return `M${x0},${y0} A${R_OUT},${R_OUT} 0 0 1 ${x1},${y1} L${x2},${y2} A${R_IN},${R_IN} 0 0 0 ${x3},${y3} Z`
}

/**
 * GTA-style action wheel. Hold the button and slide toward an action, release to do it;
 * or tap to open, then tap an action. Hint text says whether it will be done together or alone.
 */
export function RadialMenu({ open, hint, onPick, onClose, pointer, onHot }: {
  open: boolean
  /** Tells the holder which action is highlighted, so releasing the finger can pick it. */
  onHot?: (id: ActionKind | null) => void
  hint: string
  onPick: (id: ActionKind) => void
  onClose: () => void
  /** Live pointer position while the button is held (CSS px); null when not dragging. */
  pointer: { x: number; y: number } | null
}) {
  const [hot, setHot] = useState<number | null>(null)
  const centre = useRef({ x: 0, y: 0 })
  const n = ACTION_ITEMS.length

  useEffect(() => {
    centre.current = { x: window.innerWidth / 2, y: window.innerHeight * 0.45 }
    if (!open) setHot(null)
  }, [open])

  // While dragging from the button, highlight the sector the finger points toward.
  useEffect(() => {
    if (!open || !pointer) return
    const dx = pointer.x - centre.current.x, dy = pointer.y - centre.current.y
    if (Math.hypot(dx, dy) < R_IN * 0.8) return setHot(null)
    const a = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / n
    setHot(((Math.floor((a / (Math.PI * 2)) * n) % n) + n) % n)
  }, [pointer, open, n])

  useEffect(() => {
    onHot?.(hot !== null ? ACTION_ITEMS[hot].id : null)
  }, [hot, onHot])

  const item = hot !== null ? ACTION_ITEMS[hot] : null
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40"
          style={{ background: 'radial-gradient(circle at 50% 45%, rgba(40,15,40,0.35), rgba(20,8,25,0.6))', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
          data-hot={hot ?? ''}
        >
          <motion.svg
            width={R_OUT * 2 + 20}
            height={R_OUT * 2 + 20}
            viewBox={`${-R_OUT - 10} ${-R_OUT - 10} ${R_OUT * 2 + 20} ${R_OUT * 2 + 20}`}
            className="absolute"
            style={{ left: '50%', top: '45%', translateX: '-50%', translateY: '-50%' }}
            initial={{ scale: 0.6, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            <defs>
              <linearGradient id="seg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="rgba(255,255,255,0.92)" />
                <stop offset="1" stopColor="rgba(255,228,238,0.88)" />
              </linearGradient>
              <linearGradient id="segHot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ff9cbf" />
                <stop offset="1" stopColor="#ff5f93" />
              </linearGradient>
            </defs>
            {ACTION_ITEMS.map((it, i) => {
              const a = -Math.PI / 2 + (i / n) * Math.PI * 2
              const [lx, ly] = polar((R_OUT + R_IN) / 2, a)
              const isHot = hot === i
              return (
                <g
                  key={it.id}
                  role="button"
                  aria-label={it.label}
                  style={{ cursor: 'pointer' }}
                  onPointerEnter={() => setHot(i)}
                  onClick={() => {
                    onPick(it.id)
                    onClose()
                  }}
                >
                  <path d={sectorPath(i, n)} fill={isHot ? 'url(#segHot)' : 'url(#seg)'} stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} style={{ filter: isHot ? 'drop-shadow(0 0 10px rgba(255,111,156,0.8))' : 'none', transition: 'fill 120ms' }} />
                  <text x={lx} y={ly - 4} textAnchor="middle" fontSize={isHot ? 30 : 26} style={{ transition: 'font-size 120ms' }}>{it.emoji}</text>
                  <text x={lx} y={ly + 20} textAnchor="middle" fontSize={11} fontWeight={700} fill={isHot ? '#fff' : '#7a3653'}>{it.label}</text>
                </g>
              )
            })}
            <circle r={R_IN - 6} fill="rgba(255,255,255,0.95)" />
            <text y={-4} textAnchor="middle" fontSize={15} fontWeight={800} fill="#d0476f">{item ? item.label : 'Actions'}</text>
            <text y={14} textAnchor="middle" fontSize={9.5} fill="#a5718a">{item ? (item.id === 'dance' ? 'just me' : hint) : 'slide or tap'}</text>
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
