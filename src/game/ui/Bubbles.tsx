import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameController } from '../GameController'
import type { InteractionKind, UserId } from '../types'

const BUBBLE_MS = 5000
const REQUEST_MS = 15000
const KIND_LABEL: Record<InteractionKind, string> = { kiss: 'kiss 😘', hug: 'hug 🤗', highfive: 'high five ✋', comfort: 'cuddle 🫂', wave: 'wave 👋' }

type Bubble = { userId: UserId; text: string; until: number; key: number }
type Request = { id: string; from: string; kind: InteractionKind }

/** Speech bubbles that follow each character, plus the "wants a hug" card. */
export function Bubbles({ controller }: { controller: GameController | null }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [request, setRequest] = useState<Request | null>(null)
  const nodes = useRef(new Map<UserId, HTMLDivElement>())
  const seq = useRef(0)

  useEffect(() => {
    if (!controller) return
    return controller.onHud((e) => {
      if (e.type === 'bubble') {
        const b: Bubble = { userId: e.userId, text: e.text, until: Date.now() + BUBBLE_MS, key: ++seq.current }
        setBubbles((list) => [...list.filter((x) => x.userId !== e.userId), b])
      } else if (e.type === 'request') setRequest({ id: e.id, from: e.from, kind: e.kind })
    })
  }, [controller])

  // Keep bubbles glued above heads every frame; drop expired ones.
  useEffect(() => {
    if (!controller) return
    let raf = 0
    const loop = () => {
      for (const [userId, el] of nodes.current) {
        const p = controller.screenPosOf(userId)
        if (p) {
          el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`
          el.style.visibility = 'visible'
        } else el.style.visibility = 'hidden'
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const timer = setInterval(() => setBubbles((list) => list.filter((b) => b.until > Date.now())), 500)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(timer)
    }
  }, [controller])

  useEffect(() => {
    if (!request) return
    const t = setTimeout(() => setRequest(null), REQUEST_MS)
    return () => clearTimeout(t)
  }, [request])

  return (
    <>
      {bubbles.map((b) => (
        <div
          key={b.key}
          ref={(el) => {
            if (el) nodes.current.set(b.userId, el)
            else if (nodes.current.get(b.userId)?.isConnected === false) nodes.current.delete(b.userId)
          }}
          className="pointer-events-none fixed left-0 top-0 z-10"
          style={{ visibility: 'hidden' }}
        >
          <motion.div
            className="relative mb-2 max-w-[220px] whitespace-pre-wrap break-words rounded-2xl bg-white px-3 py-2 text-sm font-medium text-[#4a2338] shadow-lg"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
          >
            {b.text}
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-white" />
          </motion.div>
        </div>
      ))}
      <AnimatePresence>
        {request && (
          <motion.div
            key={request.id}
            className="fixed inset-x-4 top-4 z-40 rounded-3xl bg-white/95 p-4 shadow-2xl"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
          >
            <p className="text-center text-base font-semibold text-[#7a3653]">💌 {request.from} wants a {KIND_LABEL[request.kind]}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="h-11 flex-1 rounded-full bg-[#f3e6ec] font-semibold text-[#9a6a80]" onClick={() => setRequest(null)}>Later</button>
              <button
                type="button"
                className="h-11 flex-1 rounded-full bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] font-semibold text-white"
                onClick={() => {
                  controller?.acceptRequest(request.id)
                  setRequest(null)
                }}
              >
                Yes 💕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
