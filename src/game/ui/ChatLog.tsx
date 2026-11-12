import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { UserId } from '../types'

export type LogLine = { id: string; sender: UserId; text: string }

/** Collapsible chat history above the chat bar. */
export function ChatLog({ lines, myId, names, onClose }: { lines: LogLine[]; myId: UserId; names: Record<UserId, string>; onClose: () => void }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [lines.length])
  return (
    <motion.div
      className="fixed inset-x-3 z-20 max-h-[40dvh] overflow-y-auto rounded-3xl bg-white/90 p-3 shadow-xl backdrop-blur"
      style={{ bottom: 'calc(max(10px, env(safe-area-inset-bottom)) + 66px)' }}
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0 }}
      onClick={onClose}
    >
      {lines.length === 0 && <p className="py-4 text-center text-sm text-[#b07a92]">No messages yet. Say hi! 👋</p>}
      {lines.map((l) => {
        const mine = l.sender === myId
        return (
          <div key={l.id} className={`mb-1.5 flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-sm ${mine ? 'bg-[#ff8fb3] text-white' : 'bg-[#f6e3ea] text-[#4a2338]'}`}>
              {!mine && <div className="text-[10px] font-semibold opacity-70">{names[l.sender] ?? ''}</div>}
              <span className="whitespace-pre-wrap break-words">{l.text}</span>
            </div>
          </div>
        )
      })}
      <div ref={end} />
    </motion.div>
  )
}
