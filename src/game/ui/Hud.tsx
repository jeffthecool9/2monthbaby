import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameController } from '../GameController'
import type { CharacterLook } from '../character/look'
import { FURNITURE, type FurnitureAction, type FurnitureId } from '../world/layout'
import type { InteractionKind } from '../types'
import { ActionWheel, type WheelItem } from './ActionWheel'
import { Bubbles } from './Bubbles'
import { ChatBar } from './ChatBar'
import { ChatLog, type LogLine } from './ChatLog'
import { WardrobePanel } from './WardrobePanel'

const PARTNER_ITEMS: WheelItem[] = [
  { id: 'kiss', label: 'Kiss', emoji: '😘' },
  { id: 'hug', label: 'Hug', emoji: '🤗' },
  { id: 'highfive', label: 'High five', emoji: '✋' },
  { id: 'comfort', label: 'Comfort', emoji: '🫂' },
  { id: 'wave', label: 'Wave', emoji: '👋' },
]
const ACTION_ITEM: Record<FurnitureAction, WheelItem> = {
  sit: { id: 'sit', label: 'Sit', emoji: '🪑' },
  sleep: { id: 'sleep', label: 'Sleep', emoji: '😴' },
  wardrobe: { id: 'wardrobe', label: 'Change look', emoji: '👗' },
}

type Wheel = { at: { x: number; y: number }; items: WheelItem[]; furniture?: FurnitureId }

export function Hud({ controller, onLookChange, onSay, history = [], extra }: {
  controller: GameController | null
  onLookChange?: (look: CharacterLook) => void
  /** Called with each chat message I send (after cleaning), e.g. to save it. */
  onSay?: (text: string) => void
  /** Saved chat loaded at start. */
  history?: LogLine[]
  extra?: React.ReactNode
}) {
  const [wheel, setWheel] = useState<Wheel | null>(null)
  const [wardrobe, setWardrobe] = useState<CharacterLook | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [log, setLog] = useState<LogLine[]>(history)
  const [logOpen, setLogOpen] = useState(false)

  useEffect(() => setLog(history), [history])

  useEffect(() => {
    if (!controller) return
    return controller.onHud((e) => {
      if (e.type === 'bubble') setLog((l) => [...l.slice(-199), { id: `${Date.now()}-${l.length}`, sender: e.userId, text: e.text }])
      else if (e.type === 'wheel-partner') setWheel({ at: e.screen, items: PARTNER_ITEMS })
      else if (e.type === 'wheel-furniture') {
        const f = FURNITURE.find((x) => x.id === e.id)
        if (f?.actions.length) setWheel({ at: e.screen, items: f.actions.map((a) => ACTION_ITEM[a]), furniture: e.id })
      } else if (e.type === 'wardrobe') setWardrobe(controller.state.me.look)
      else if (e.type === 'partner-online') setToast(e.online ? `${e.name} is home 🏠` : `${e.name} went to sleep 😴`)
    })
  }, [controller])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const pick = (id: string) => {
    if (!controller || !wheel) return
    if (wheel.furniture) controller.useFurniture(wheel.furniture, id as FurnitureAction)
    else controller.interact(id as InteractionKind)
  }

  return (
    <>
      <Bubbles controller={controller} />
      <ActionWheel at={wheel?.at ?? null} items={wheel?.items ?? []} onPick={pick} onClose={() => setWheel(null)} />
      {extra}
      <ChatBar
        onSend={(t) => {
          const sent = controller?.say(t)
          if (sent) onSay?.(sent)
        }}
        onEmote={(e) => controller?.emote(e)}
        onToggleLog={() => setLogOpen((v) => !v)}
      />
      <AnimatePresence>
        {logOpen && controller && (
          <ChatLog
            key="log"
            lines={log}
            myId={controller.state.me.userId}
            names={{ [controller.state.me.userId]: controller.state.me.name, ...(controller.state.partner ? { [controller.state.partner.userId]: controller.state.partner.name } : {}) }}
            onClose={() => setLogOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
            style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
          >
            <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#7a3653] shadow-lg">{toast}</div>
          </motion.div>
        )}
        {wardrobe && (
          <WardrobePanel
            key="wardrobe"
            look={wardrobe}
            onChange={(look) => {
              setWardrobe(look)
              controller?.setMyLook(look)
              onLookChange?.(look)
            }}
            onClose={() => setWardrobe(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
