import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MAX_CHAT, QUICK_MESSAGES } from '../net/protocol'
import type { EmoteKind } from '../types'

const EMOTES: { id: EmoteKind; emoji: string }[] = [
  { id: 'happy', emoji: '😄' }, { id: 'shy', emoji: '😳' }, { id: 'love', emoji: '🥰' },
  { id: 'crying', emoji: '😭' }, { id: 'angry', emoji: '😤' }, { id: 'sleepy', emoji: '😪' },
]

export function ChatBar({ onSend, onEmote, onToggleLog }: { onSend: (text: string) => void; onEmote: (e: EmoteKind) => void; onToggleLog?: () => void }) {
  const [text, setText] = useState('')
  const [emotes, setEmotes] = useState(false)
  const send = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-20" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
      <AnimatePresence>
        {emotes && (
          <motion.div className="mx-3 mb-2 grid grid-cols-6 gap-2 rounded-2xl bg-white/85 p-2 shadow-lg backdrop-blur" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
            {EMOTES.map((e) => (
              <button key={e.id} type="button" className="h-11 rounded-xl text-2xl active:scale-90" onClick={() => { onEmote(e.id); setEmotes(false) }} aria-label={e.id}>
                {e.emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex gap-2 overflow-x-auto px-3 pb-2" style={{ scrollbarWidth: 'none' }}>
        {QUICK_MESSAGES.map((q) => (
          <button key={q} type="button" className="shrink-0 rounded-full bg-white/85 px-3 py-1.5 text-sm font-medium text-[#7a3653] shadow active:scale-95" onClick={() => onSend(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="mx-3 flex items-center gap-2 rounded-full bg-white/90 p-1.5 shadow-lg backdrop-blur">
        <button type="button" className="h-10 w-10 shrink-0 rounded-full bg-[#ffe1ec] text-xl" onClick={() => setEmotes((v) => !v)} aria-label="Emotes">😊</button>
        {onToggleLog && <button type="button" className="h-10 w-10 shrink-0 rounded-full bg-[#ffe1ec] text-lg" onClick={onToggleLog} aria-label="Chat history">💬</button>}
        <input
          className="min-w-0 flex-1 bg-transparent px-2 text-[16px] text-[#4a2338] outline-none placeholder:text-[#c38aa2]"
          value={text}
          maxLength={MAX_CHAT}
          placeholder="Say something sweet…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          enterKeyHint="send"
        />
        <button type="button" className="h-10 shrink-0 rounded-full bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={!text.trim()} onClick={send}>
          Send
        </button>
      </div>
    </div>
  )
}
