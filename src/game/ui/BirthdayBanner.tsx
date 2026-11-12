import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const CONFETTI = ['🎉', '💖', '🎈', '✨', '🎂', '💕', '🌸']

/** "Happy Birthday" card with confetti, shown once per day per phone. */
export function BirthdayBanner({ name, isHer }: { name: string; isHer: boolean }) {
  const key = `bday-seen-${new Date().toISOString().slice(0, 10)}`
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(key)
    } catch {
      return true
    }
  })
  useEffect(() => {
    if (!open) return
    try {
      localStorage.setItem(key, '1')
    } catch {
      /* private mode: show every time, harmless */
    }
  }, [open, key])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          {Array.from({ length: 28 }, (_, i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute text-2xl"
              style={{ left: `${(i * 37) % 100}%`, top: -40 }}
              animate={{ y: ['0vh', '110vh'], rotate: [0, (i % 2 ? 1 : -1) * 360] }}
              transition={{ duration: 3 + (i % 5) * 0.5, delay: (i % 7) * 0.25, ease: 'easeIn' }}
            >
              {CONFETTI[i % CONFETTI.length]}
            </motion.span>
          ))}
          <motion.div className="relative w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl" initial={{ scale: 0.6, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            <div className="text-6xl">🎂</div>
            <h2 className="mt-3 text-2xl font-bold text-[#d0476f]">Happy Birthday, {name}!</h2>
            <p className="mt-2 text-[15px] text-[#8a5a70]">{isHer ? 'Your home got dressed up just for you 💕 Go find the cake!' : `It’s ${name}’s birthday today 🎈 Go give her a hug!`}</p>
            <button type="button" className="mt-5 h-12 w-full rounded-full bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] font-bold text-white">Let’s celebrate 🎉</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
