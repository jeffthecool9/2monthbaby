import { useState } from 'react'
import { motion } from 'framer-motion'
import { LOOK_OPTIONS, type CharacterLook } from '../character/look'

/** Characters are VRoid models now; the colour/style tabs only applied to the old chibi models. */
const VRM_ONLY = true

type Row = { key: keyof CharacterLook; label: string; color?: boolean }
const TABS: { id: string; label: string; emoji: string; rows: Row[] }[] = [
  { id: 'hair', label: 'Hair', emoji: '💇', rows: [{ key: 'hairStyle', label: 'Style' }, { key: 'hairColor', label: 'Colour', color: true }] },
  { id: 'face', label: 'Face', emoji: '👀', rows: [{ key: 'eyeShape', label: 'Eyes' }, { key: 'eyeColor', label: 'Eye colour', color: true }, { key: 'skinTone', label: 'Skin', color: true }] },
  { id: 'outfit', label: 'Outfit', emoji: '👗', rows: [{ key: 'top', label: 'Top' }, { key: 'topColor', label: 'Top colour', color: true }, { key: 'bottom', label: 'Bottom' }, { key: 'bottomColor', label: 'Bottom colour', color: true }] },
  { id: 'extras', label: 'Extras', emoji: '🎀', rows: [{ key: 'body', label: 'Body' }, { key: 'shoes', label: 'Shoes' }, { key: 'accessory', label: 'Accessory' }] },
]

/**
 * Compact wardrobe that leaves the top of the screen free: the camera zooms onto your
 * character there, so every tap shows on you immediately.
 */
export function WardrobePanel({ look, onChange, onClose, onUploadAvatar }: {
  look: CharacterLook
  onChange: (look: CharacterLook) => void
  onClose: () => void
  onUploadAvatar?: (file: File) => Promise<void>
}) {
  const [tab, setTab] = useState(VRM_ONLY || onUploadAvatar ? "vroid" : TABS[0].id)
  const [upload, setUpload] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; msg?: string }>({ state: 'idle' })
  const pickFile = async (file: File | undefined) => {
    if (!file || !onUploadAvatar) return
    setUpload({ state: 'busy' })
    try {
      await onUploadAvatar(file)
      setUpload({ state: 'done' })
    } catch (err) {
      setUpload({ state: 'error', msg: err instanceof Error ? err.message : 'Upload failed, try again.' })
    }
  }
  // VRoid characters are customised in VRoid Studio, so the panel is the upload screen.
  if (VRM_ONLY || (tab === 'vroid' && onUploadAvatar)) {
    return (
      <motion.div
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-white/95 px-4 pt-3 shadow-[0_-10px_40px_rgba(90,30,70,0.25)] backdrop-blur-md"
        style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
        initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#7a3653]">✨ Your character</h2>
          <button type="button" className="rounded-full bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] px-5 py-1.5 text-sm font-semibold text-white shadow" onClick={onClose}>Done</button>
        </div>
        <p className="text-sm text-[#8a5a70]">Design yourself in the free <b>VRoid Studio</b> app, export a <b>.vrm</b> file, and upload it here. Your partner sees it right away.</p>
        {onUploadAvatar ? (
          <label className={`mt-3 flex h-12 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed font-semibold ${upload.state === 'busy' ? 'border-[#e8c5d3] text-[#c69ab0]' : 'border-[#ff8fb3] text-[#d0476f]'}`}>
            {upload.state === 'busy' ? 'Uploading… 💗' : '📁 Upload my VRoid (.vrm)'}
            <input type="file" accept=".vrm" className="hidden" disabled={upload.state === 'busy'} onChange={(e) => void pickFile(e.target.files?.[0])} />
          </label>
        ) : (
          <p className="mt-3 rounded-2xl bg-[#f8eef2] p-3 text-center text-sm text-[#8a5a70]">Log in to upload your character.</p>
        )}
        {upload.state === 'done' && <p className="mt-2 text-center text-sm text-[#3e8a43]">Uploaded! Say hi to the new you ✨</p>}
        {upload.state === 'error' && <p className="mt-2 text-center text-sm text-[#d0476f]">{upload.msg}</p>}
        <a href="https://vroid.com/en/studio" target="_blank" rel="noreferrer" className="mt-3 block text-center text-sm font-semibold text-[#b07a92] underline">Get VRoid Studio (free)</a>
      </motion.div>
    )
  }
  const set = (key: keyof CharacterLook, value: string) => onChange({ ...look, [key]: value } as CharacterLook)
  const rows = TABS.find((t) => t.id === tab)!.rows
  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-white/95 px-4 pt-3 shadow-[0_-10px_40px_rgba(90,30,70,0.25)] backdrop-blur-md"
      style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))', maxHeight: '46dvh' }}
      initial={{ y: 400 }}
      animate={{ y: 0 }}
      exit={{ y: 400 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#7a3653]">✨ Dress up</h2>
        <button type="button" className="rounded-full bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] px-5 py-1.5 text-sm font-semibold text-white shadow" onClick={onClose}>Done</button>
      </div>
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center rounded-2xl py-1.5 text-xs font-semibold transition ${tab === t.id ? 'bg-[#ffe1ec] text-[#7a3653] shadow-inner' : 'text-[#b07a92]'}`}
          >
            <span className="text-lg leading-none">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(46dvh - 120px)' }}>
        {rows.map((row) => (
          <div key={row.key} className="py-1.5">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#b07a92]">{row.label}</div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
              {LOOK_OPTIONS[row.key].map((v) =>
                row.color ? (
                  <button
                    key={v}
                    type="button"
                    aria-label={v}
                    onClick={() => set(row.key, v)}
                    className="h-9 w-9 shrink-0 rounded-full transition active:scale-90"
                    style={{ background: v, boxShadow: look[row.key] === v ? '0 0 0 3px #fff, 0 0 0 5px #ff6f9c' : 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}
                  />
                ) : (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set(row.key, v)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold capitalize transition active:scale-95 ${look[row.key] === v ? 'bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] text-white shadow' : 'bg-[#f8eef2] text-[#7a3653]'}`}
                  >
                    {v}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
