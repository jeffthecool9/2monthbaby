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

const LITE_KEY = 'couple-home-lite'

export function liteGraphics(): boolean {
  try {
    return localStorage.getItem(LITE_KEY) === '1'
  } catch {
    return false
  }
}

/** ⚙️ menu with the lite-graphics switch for older phones (reloads to apply). */
function SettingsButton() {
  const [open, setOpen] = useState(false)
  const lite = liteGraphics()
  const toggle = () => {
    try {
      localStorage.setItem(LITE_KEY, lite ? '0' : '1')
    } catch {
      return
    }
    location.reload()
  }
  return (
    <div className="fixed right-3 z-30" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
      <button type="button" aria-label="Settings" className="h-10 w-10 rounded-full bg-white/80 text-lg shadow" onClick={() => setOpen((v) => !v)}>⚙️</button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white/95 p-3 text-sm text-[#4a2338] shadow-xl">
          <button type="button" className="flex w-full items-center justify-between rounded-xl px-2 py-2 active:bg-[#ffe1ec]" onClick={toggle}>
            <span>Lite graphics</span>
            <span className={`h-6 w-11 rounded-full p-0.5 transition ${lite ? 'bg-[#ff6f9c]' : 'bg-[#e8d5dd]'}`}>
              <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${lite ? 'translate-x-5' : ''}`} />
            </span>
          </button>
          <p className="px-2 pt-1 text-xs text-[#b07a92]">Smoother on older phones. Reloads the page.</p>
        </div>
      )}
    </div>
  )
}

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
      } else if (e.type === 'wardrobe') {
        setWardrobe(controller.state.me.look)
        controller.focusOnMe(true)
      }
      else if (e.type === 'partner-online') setToast(e.online ? `${e.name} is home 🏠` : `${e.name} went to sleep 😴`)
      else if (e.type === 'toast') setToast(e.text)
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
      <SettingsButton />
      {!wardrobe && controller && (
        <button
          type="button"
          aria-label="Dress up"
          className="fixed left-3 z-30 flex h-10 items-center gap-1 rounded-full bg-white/80 px-3 text-sm font-semibold text-[#7a3653] shadow"
          style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
          onClick={() => {
            setWardrobe(controller.state.me.look)
            controller.focusOnMe(true)
          }}
        >
          👗 Dress up
        </button>
      )}
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
            onClose={() => {
              setWardrobe(null)
              controller?.focusOnMe(false)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
