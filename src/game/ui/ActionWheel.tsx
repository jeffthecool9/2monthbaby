import { AnimatePresence, motion } from 'framer-motion'

export type WheelItem = { id: string; label: string; emoji: string }

const RADIUS = 90
const BTN = 56

/** Radial pop-up menu around a tapped character or piece of furniture. */
export function ActionWheel({ at, items, onPick, onClose }: {
  at: { x: number; y: number } | null
  items: WheelItem[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  const margin = RADIUS + BTN / 2 + 8
  const cx = at ? Math.min(Math.max(at.x, margin), window.innerWidth - margin) : 0
  const cy = at ? Math.min(Math.max(at.y, margin + 40), window.innerHeight - margin - 140) : 0
  return (
    <AnimatePresence>
      {at && (
        <motion.div key="wheel" className="fixed inset-0 z-30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={onClose}>
          <div className="absolute rounded-full" style={{ left: cx - 18, top: cy - 18, width: 36, height: 36, background: 'rgba(255,255,255,0.35)', boxShadow: '0 0 24px rgba(255,180,210,0.8)' }} />
          {items.map((item, i) => {
            const a = -Math.PI / 2 + (i / items.length) * Math.PI * 2
            return (
              <motion.button
                key={item.id}
                type="button"
                className="absolute flex flex-col items-center justify-center rounded-full text-[11px] font-semibold text-[#7a3653] shadow-lg"
                style={{ width: BTN, height: BTN, left: cx - BTN / 2, top: cy - BTN / 2, background: 'linear-gradient(160deg,#fff,#ffe1ec)', border: '2px solid #ffc2d6' }}
                initial={{ x: 0, y: 0, scale: 0.3 }}
                animate={{ x: Math.cos(a) * RADIUS, y: Math.sin(a) * RADIUS, scale: 1 }}
                exit={{ x: 0, y: 0, scale: 0.3 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26, delay: i * 0.025 }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onPick(item.id)
                  onClose()
                }}
              >
                <span className="text-xl leading-none">{item.emoji}</span>
                <span className="mt-0.5 leading-none">{item.label}</span>
              </motion.button>
            )
          })}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
