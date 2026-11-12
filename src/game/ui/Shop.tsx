import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameController } from '../GameController'
import { CATALOG, type Category } from '../play/decor'
import type { Wallet } from '../play/economy'

const CATS: { id: Category; label: string; emoji: string }[] = [
  { id: 'seating', label: 'Seating', emoji: '🛋️' }, { id: 'tables', label: 'Tables', emoji: '🪵' }, { id: 'lighting', label: 'Lights', emoji: '💡' },
  { id: 'plants', label: 'Plants', emoji: '🌿' }, { id: 'decor', label: 'Decor', emoji: '🧸' }, { id: 'wall', label: 'Wall', emoji: '🖼️' },
]
const pinkBtn = 'rounded-full bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] font-semibold text-white shadow active:scale-95 disabled:opacity-40'
const sheet = 'fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-white/95 px-4 pt-3 shadow-[0_-10px_40px_rgba(90,30,70,0.25)] backdrop-blur-md'

type Mode = { kind: 'shop' } | { kind: 'placing'; itemId: string; price: number; existing: boolean; uid?: string } | { kind: 'decorate' } | null

/** 🛍️ Shop + 🏠 Decorate: buy furniture and decor with coins, then place, move, rotate or sell it back. */
export function Shop({ controller, wallet, onSpend, onRefund, hidden }: {
  controller: GameController | null
  wallet: Wallet | null
  onSpend: (amount: number, reason: string) => Promise<boolean>
  onRefund: (amount: number, reason: string) => void
  hidden?: boolean
}) {
  const [mode, setMode] = useState<Mode>(null)
  const [cat, setCat] = useState<Category>('seating')
  const [, setTick] = useState(0)
  const [picked, setPicked] = useState<{ uid: string; name: string; price: number } | null>(null)

  // Repaint while placing so the Place button follows the ghost's validity.
  useEffect(() => {
    if (mode?.kind !== 'placing') return
    const t = setInterval(() => setTick((n) => n + 1), 120)
    return () => clearInterval(t)
  }, [mode])

  useEffect(() => {
    if (!controller) return
    controller.decorateMode = mode?.kind === 'decorate'
    return controller.onHud((e) => {
      if (e.type === 'decor-pick') {
        const p = controller.decorState.items[e.uid]
        const item = p && CATALOG.find((c) => c.id === p.item)
        if (item) setPicked({ uid: e.uid, name: item.name, price: item.price })
      }
    })
  }, [controller, mode])

  const balance = wallet?.balance ?? 0
  const info = controller?.placingInfo ?? null

  const buy = (itemId: string, price: number) => {
    if (!controller) return
    controller.startPlacing(itemId)
    setMode({ kind: 'placing', itemId, price, existing: false })
  }

  const confirm = async () => {
    if (!controller || mode?.kind !== 'placing') return
    const price = mode.price
    if (!mode.existing && !(await onSpend(price, `Shop: ${mode.itemId}`))) {
      controller.cancelPlacing()
      setMode({ kind: 'shop' })
      return
    }
    const change = controller.confirmPlacing()
    if (!change) {
      // Couldn't fit after all: give the coins back.
      if (!mode.existing) onRefund(price, 'Shop refund')
      return
    }
    setMode(mode.existing ? { kind: 'decorate' } : null)
  }

  return (
    <>
      {!hidden && controller && !mode && (
        <div className="fixed left-3 z-30 flex flex-col gap-2" style={{ top: 'calc(env(safe-area-inset-top) + 106px)' }}>
          <button type="button" aria-label="Shop" className="flex h-10 items-center gap-1 rounded-full bg-white/80 px-3 text-sm font-semibold text-[#7a3653] shadow" onClick={() => setMode({ kind: 'shop' })}>🛍️ Shop</button>
          <button type="button" aria-label="Decorate" className="flex h-10 items-center gap-1 rounded-full bg-white/80 px-3 text-sm font-semibold text-[#7a3653] shadow" onClick={() => setMode({ kind: 'decorate' })}>🏠 Decorate</button>
        </div>
      )}

      <AnimatePresence>
        {mode?.kind === 'shop' && (
          <motion.div key="shop" className={sheet} style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))', maxHeight: '66dvh' }} initial={{ y: 500 }} animate={{ y: 0 }} exit={{ y: 500 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#7a3653]">🛍️ Shop <span className="ml-2 text-sm font-semibold text-[#b07a92]">🪙 RM{balance}</span></h2>
              <button type="button" className={`${pinkBtn} px-5 py-1.5 text-sm`} onClick={() => setMode(null)}>Close</button>
            </div>
            <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4" style={{ scrollbarWidth: 'none' }}>
              {CATS.map((c) => (
                <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${cat === c.id ? 'bg-[#ffe1ec] text-[#7a3653]' : 'bg-[#f8eef2] text-[#b07a92]'}`}>{c.emoji} {c.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto pb-2" style={{ maxHeight: 'calc(66dvh - 130px)' }}>
              {CATALOG.filter((c) => c.category === cat).map((c) => (
                <div key={c.id} className="rounded-2xl bg-[#fbf3f6] p-3">
                  <div className="text-3xl">{c.emoji}</div>
                  <div className="mt-1 text-sm font-semibold text-[#4a2338]">{c.name}</div>
                  <div className="text-xs text-[#b07a92]">RM{c.price}{c.wall ? ' · hangs on a wall' : ''}</div>
                  <button type="button" disabled={balance < c.price} className={`${pinkBtn} mt-2 w-full py-1.5 text-sm`} onClick={() => buy(c.id, c.price)}>
                    {balance < c.price ? 'Need more coins' : 'Buy & place'}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {mode?.kind === 'placing' && (
          <motion.div key="placing" className="fixed inset-x-3 z-40 rounded-3xl bg-white/95 p-3 shadow-2xl" style={{ bottom: 'calc(max(10px, env(safe-area-inset-bottom)) + 12px)' }} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
            <p className="text-center text-sm font-semibold text-[#7a3653]">
              {info ? `${info.item.emoji} ${info.item.name}` : ''} · {info?.ok ? 'drag to move' : info?.item.wall ? 'drag it next to a wall' : "doesn't fit here"}
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="h-11 flex-1 rounded-full bg-[#f3e6ec] font-semibold text-[#9a6a80]" onClick={() => { controller?.cancelPlacing(); setMode(mode.existing ? { kind: 'decorate' } : { kind: 'shop' }) }}>Cancel</button>
              {!info?.item.wall && <button type="button" className="h-11 w-14 rounded-full bg-[#ffe1ec] text-xl font-semibold text-[#7a3653]" aria-label="Rotate" onClick={() => controller?.rotatePlacing()}>⟳</button>}
              <button type="button" disabled={!info?.ok} className={`${pinkBtn} h-11 flex-1`} onClick={() => void confirm()}>{mode.existing ? 'Put down' : `Place · RM${mode.price}`}</button>
            </div>
          </motion.div>
        )}

        {mode?.kind === 'decorate' && (
          <motion.div key="decorate" className="fixed inset-x-3 z-40 rounded-3xl bg-white/95 p-3 shadow-2xl" style={{ bottom: 'calc(max(10px, env(safe-area-inset-bottom)) + 12px)' }} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
            {picked ? (
              <>
                <p className="text-center text-sm font-semibold text-[#7a3653]">{picked.name}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className="h-11 flex-1 rounded-full bg-[#f3e6ec] font-semibold text-[#9a6a80]" onClick={() => { const it = controller?.removeDecor(picked.uid); if (it) onRefund(Math.floor(it.price / 2), `Sold ${it.name}`); setPicked(null) }}>Sell · +RM{Math.floor(picked.price / 2)}</button>
                  <button type="button" className={`${pinkBtn} h-11 flex-1`} onClick={() => { const p = controller?.decorState.items[picked.uid]; if (p) { controller?.startPlacing(p.item, picked.uid); setMode({ kind: 'placing', itemId: p.item, price: 0, existing: true, uid: picked.uid }) } setPicked(null) }}>Move / rotate</button>
                </div>
                <button type="button" className="mt-2 w-full text-center text-xs text-[#b07a92] underline" onClick={() => setPicked(null)}>pick something else</button>
              </>
            ) : (
              <>
                <p className="text-center text-sm font-semibold text-[#7a3653]">🏠 Decorate · tap any item you've placed</p>
                <button type="button" className={`${pinkBtn} mt-2 h-11 w-full`} onClick={() => setMode(null)}>Done</button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
