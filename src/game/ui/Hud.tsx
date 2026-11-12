import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameController } from '../GameController'
import type { CharacterLook } from '../character/look'
import { FURNITURE, type FurnitureAction, type FurnitureId } from '../world/layout'
import type { ActionKind } from '../types'
import { RadialMenu } from './RadialMenu'
import { CoinPill, Games } from './Games'
import { MISSIONS, type Wallet } from '../play/economy'
import { ActionWheel, type WheelItem } from './ActionWheel'
import { Bubbles } from './Bubbles'
import { ChatBar } from './ChatBar'
import { ChatLog, type LogLine } from './ChatLog'
import { WardrobePanel } from './WardrobePanel'

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

export function Hud({ controller, onLookChange, onSay, onUploadAvatar, onEarn, wallet = null, lastGain = null, history = [], extra }: {
  controller: GameController | null
  onLookChange?: (look: CharacterLook) => void
  /** Upload a VRoid .vrm as my character (only when connected to Supabase). */
  onUploadAvatar?: (file: File) => Promise<void>
  /** Coins earned (missions, affection, games). */
  onEarn?: (amount: number, reason: string) => void
  wallet?: Wallet | null
  lastGain?: { amount: number; key: number } | null
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
  const onEarnRef = useRef(onEarn)
  onEarnRef.current = onEarn
  const earn = useCallback((amount: number, reason: string) => onEarnRef.current?.(amount, reason), [])
  // GTA-style action wheel: hold the 💞 button and slide, or tap to open and tap.
  const [radial, setRadial] = useState(false)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const hot = useRef<ActionKind | null>(null)
  const pressStart = useRef(0)
  const onHot = useCallback((id: ActionKind | null) => {
    hot.current = id
  }, [])

  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => setDrag({ x: e.clientX, y: e.clientY })
    const up = () => {
      const held = Date.now() - pressStart.current > 250
      if (held && hot.current && controller) {
        controller.action(hot.current)
        setRadial(false)
      }
      // A quick tap leaves the wheel open for tapping an action.
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [drag !== null, controller]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setLog(history), [history])

  useEffect(() => {
    if (!controller) return
    return controller.onHud((e) => {
      if (e.type === 'bubble') setLog((l) => [...l.slice(-199), { id: `${Date.now()}-${l.length}`, sender: e.userId, text: e.text }])
      else if (e.type === 'wheel-partner') setRadial(true)
      else if (e.type === 'wheel-furniture') {
        const f = FURNITURE.find((x) => x.id === e.id)
        const chores = MISSIONS.filter((m) => m.furniture === e.id).map((m) => ({ id: `mission:${m.id}`, label: m.label.split(' ').slice(0, 2).join(' '), emoji: m.emoji }))
        const items = [...(f?.actions ?? []).map((a) => ACTION_ITEM[a]), ...chores]
        if (items.length) setWheel({ at: e.screen, items, furniture: e.id })
      } else if (e.type === 'wardrobe') {
        setWardrobe(controller.state.me.look)
        controller.focusOnMe(true)
      }
      else if (e.type === 'partner-online') setToast(e.online ? `${e.name} is home 🏠` : `${e.name} went to sleep 😴`)
      else if (e.type === 'toast') setToast(e.text)
      else if (e.type === 'earn') onEarnRef.current?.(e.amount, e.reason)
    })
  }, [controller])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const pick = (id: string) => {
    if (!controller || !wheel) return
    if (id.startsWith('mission:')) controller.mission(id.slice(8))
    else if (wheel.furniture) controller.useFurniture(wheel.furniture, id as FurnitureAction)
  }

  return (
    <>
      <Bubbles controller={controller} />
      <SettingsButton />
      <CoinPill wallet={wallet} lastGain={lastGain} />
      <Games controller={controller} onEarn={earn} hidden={!!wardrobe} />
      {!wardrobe && controller && (
        <button
          type="button"
          aria-label="My character"
          className="fixed left-3 z-30 flex h-10 items-center gap-1 rounded-full bg-white/80 px-3 text-sm font-semibold text-[#7a3653] shadow"
          style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
          onClick={() => {
            setWardrobe(controller.state.me.look)
            controller.focusOnMe(true)
          }}
        >
          ✨ My character
        </button>
      )}
      <ActionWheel at={wheel?.at ?? null} items={wheel?.items ?? []} onPick={pick} onClose={() => setWheel(null)} />
      <RadialMenu
        open={radial}
        hint={controller?.partnerNear() ? 'together 💞' : 'on my own'}
        pointer={drag}
        onHot={onHot}
        onPick={(id) => controller?.action(id)}
        onClose={() => setRadial(false)}
      />
      {!wardrobe && controller && (
        <motion.button
          type="button"
          aria-label="Actions"
          className="fixed right-3 z-30 flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white shadow-[0_8px_24px_rgba(255,95,147,0.55)]"
          style={{ bottom: 'calc(max(10px, env(safe-area-inset-bottom)) + 72px)', background: 'radial-gradient(circle at 35% 30%, #ffb3cd, #ff5f93)', touchAction: 'none' }}
          whileTap={{ scale: 0.9 }}
          animate={{ boxShadow: ['0 8px 24px rgba(255,95,147,0.45)', '0 8px 32px rgba(255,95,147,0.8)', '0 8px 24px rgba(255,95,147,0.45)'] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          onPointerDown={(e) => {
            e.preventDefault()
            pressStart.current = Date.now()
            hot.current = null
            setRadial(true)
            setDrag({ x: e.clientX, y: e.clientY })
          }}
        >
          💞
        </motion.button>
      )}
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
            onUploadAvatar={onUploadAvatar}
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
