import { motion } from 'framer-motion'
import { LOOK_OPTIONS, type CharacterLook } from '../character/look'

const ROWS: { key: keyof CharacterLook; label: string; color?: boolean }[] = [
  { key: 'hairStyle', label: 'Hair' },
  { key: 'hairColor', label: 'Hair colour', color: true },
  { key: 'eyeShape', label: 'Eyes' },
  { key: 'eyeColor', label: 'Eye colour', color: true },
  { key: 'skinTone', label: 'Skin', color: true },
  { key: 'body', label: 'Body' },
  { key: 'top', label: 'Top' },
  { key: 'topColor', label: 'Top colour', color: true },
  { key: 'bottom', label: 'Bottom' },
  { key: 'bottomColor', label: 'Bottom colour', color: true },
  { key: 'shoes', label: 'Shoes' },
  { key: 'accessory', label: 'Accessory' },
]

/** Bottom sheet to change your look; every change applies live. */
export function WardrobePanel({ look, onChange, onClose }: { look: CharacterLook; onChange: (look: CharacterLook) => void; onClose: () => void }) {
  const set = (key: keyof CharacterLook, value: string) => onChange({ ...look, [key]: value } as CharacterLook)
  const cycle = (key: keyof CharacterLook, dir: 1 | -1) => {
    const opts = LOOK_OPTIONS[key]
    const i = opts.indexOf(look[key])
    set(key, opts[(i + dir + opts.length) % opts.length])
  }
  return (
    <motion.div className="fixed inset-0 z-40 flex items-end bg-black/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="max-h-[70dvh] w-full overflow-y-auto rounded-t-3xl bg-white/95 px-4 pt-3 shadow-2xl"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        exit={{ y: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[#f0c9d8]" />
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#7a3653]">👗 Wardrobe</h2>
          <button type="button" className="rounded-full bg-[#ffe1ec] px-4 py-1.5 text-sm font-semibold text-[#7a3653]" onClick={onClose}>Done</button>
        </div>
        {ROWS.map((row) => (
          <div key={row.key} className="border-t border-[#f6e3ea] py-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#b07a92]">{row.label}</div>
            {row.color ? (
              <div className="flex flex-wrap gap-2">
                {LOOK_OPTIONS[row.key].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    className="h-8 w-8 rounded-full"
                    style={{ background: c, boxShadow: look[row.key] === c ? '0 0 0 3px #fff, 0 0 0 5px #ff6f9c' : 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}
                    onClick={() => set(row.key, c)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" className="h-10 w-10 rounded-full bg-[#ffe1ec] text-lg text-[#7a3653]" onClick={() => cycle(row.key, -1)} aria-label="Previous">‹</button>
                <div className="flex-1 text-center font-semibold capitalize text-[#4a2338]">{look[row.key]}</div>
                <button type="button" className="h-10 w-10 rounded-full bg-[#ffe1ec] text-lg text-[#7a3653]" onClick={() => cycle(row.key, 1)} aria-label="Next">›</button>
              </div>
            )}
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}
