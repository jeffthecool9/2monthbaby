import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameController } from '../GameController'
import { DAILY_CAP, GAME_REWARD, MISSIONS, missionReady, type Wallet } from '../play/economy'
import { newBoard, place, turn, winner, winningLine, type Board, type Mark } from '../play/tictactoe'
import { QUESTIONS, answerTot, newTot, nextTot, totDone, type TotState } from '../play/thisOrThat'
import type { GameId, NetMsg } from '../net/protocol'

type GameMsg = Extract<NetMsg, { t: 'game' }>
type Session =
  | { game: 'ttt'; id: string; mine: Mark; board: Board; rewarded?: boolean }
  | { game: 'tot'; id: string; host: boolean; state: TotState; rewarded?: boolean }

const sheet = 'fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-white/95 px-4 pt-3 shadow-[0_-10px_40px_rgba(90,30,70,0.25)] backdrop-blur-md'
const pinkBtn = 'rounded-full bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] font-semibold text-white shadow active:scale-95 disabled:opacity-40'

/** RM balance and today's progress toward the daily cap, with a "+RM" pop when coins arrive. */
export function CoinPill({ wallet, lastGain }: { wallet: Wallet | null; lastGain: { amount: number; key: number } | null }) {
  if (!wallet) return null
  return (
    <div className="pointer-events-none fixed right-16 z-30" style={{ top: 'calc(env(safe-area-inset-top) + 14px)' }}>
      <div className="flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-sm font-bold text-[#7a3653] shadow">
        <span>🪙 RM{wallet.balance}</span>
        <span className="text-[11px] font-semibold text-[#b07a92]">today {wallet.earnedToday}/{DAILY_CAP}</span>
      </div>
      <AnimatePresence>
        {lastGain && lastGain.amount > 0 && (
          <motion.div key={lastGain.key} className="absolute left-1/2 top-full -translate-x-1/2 text-base font-extrabold text-[#e2457a]" initial={{ y: 0, opacity: 0 }} animate={{ y: 18, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.6 }}>
            +RM{lastGain.amount}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** 🎮 button: daily missions and couple games, plus the game screens themselves. */
export function Games({ controller, onEarn, hidden }: { controller: GameController | null; onEarn: (amount: number, reason: string) => void; hidden?: boolean }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'missions' | 'play'>('missions')
  const [invite, setInvite] = useState<GameMsg | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [waiting, setWaiting] = useState<{ game: GameId; id: string } | null>(null)
  const [, setTick] = useState(0)
  const sessionRef = useRef(session)
  sessionRef.current = session

  // Refresh cooldown timers while the sheet is open.
  useEffect(() => {
    if (!open) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [open])

  useEffect(() => {
    if (!controller) return
    return controller.onHud((e) => {
      if (e.type !== 'game') return
      const m = e.msg, s = sessionRef.current
      if (m.op === 'invite') setInvite(m)
      else if (m.op === 'accept') {
        setWaiting((w) => {
          if (w?.id === m.id) startSession(m.game, m.id, true, m.value ?? 1)
          return null
        })
      } else if (m.op === 'decline') {
        setWaiting(null)
        controller.toast('Maybe later 💗')
      } else if (m.op === 'quit') {
        if (s?.id === m.id) setSession(null)
        setInvite((i) => (i?.id === m.id ? null : i))
      } else if (s && s.id === m.id) {
        if (s.game === 'ttt' && m.op === 'move' && m.value !== undefined) {
          const next = place(s.board, m.value, s.mine === 'X' ? 'O' : 'X')
          if (next) setSession({ ...s, board: next })
        } else if (s.game === 'tot' && m.op === 'move' && (m.value === 0 || m.value === 1)) {
          setSession({ ...s, state: answerTot(s.state, m.from, m.value) })
        } else if (s.game === 'tot' && m.op === 'next') {
          setSession({ ...s, state: nextTot(s.state) })
        }
      }
    })
  }, [controller]) // eslint-disable-line react-hooks/exhaustive-deps

  const me = controller?.state.me.userId ?? ''
  const partner = controller?.state.partner
  const partnerOnline = !!partner?.online

  function startSession(game: GameId, id: string, host: boolean, seed: number) {
    setOpen(false)
    if (game === 'ttt') setSession({ game: 'ttt', id, mine: host ? 'X' : 'O', board: newBoard() })
    else {
      const players: [string, string] = host ? [me, partner!.userId] : [partner!.userId, me]
      setSession({ game: 'tot', id, host, state: newTot(players, seed) })
    }
  }

  const sendInvite = (game: GameId) => {
    const id = `${game}-${Date.now()}`
    controller?.sendGame({ game, op: 'invite', id })
    setWaiting({ game, id })
    setOpen(false)
  }

  const quit = () => {
    if (session) controller?.sendGame({ game: session.game, op: 'quit', id: session.id })
    setSession(null)
  }

  // Rewards when a game ends (each phone pays its own player).
  useEffect(() => {
    if (!session || session.rewarded) return
    if (session.game === 'ttt') {
      const w = winner(session.board)
      if (!w) return
      if (w === 'draw') onEarn(GAME_REWARD.tttDraw, 'Tic-tac-toe draw')
      else if (w === session.mine) onEarn(GAME_REWARD.tttWin, 'Tic-tac-toe win')
      setSession({ ...session, rewarded: true })
    } else if (totDone(session.state)) {
      if (session.state.matches) onEarn(session.state.matches * GAME_REWARD.totMatch, 'This or That')
      setSession({ ...session, rewarded: true })
    }
  }, [session, onEarn])

  const now = Date.now()
  return (
    <>
      {!hidden && controller && (
        <button
          type="button"
          aria-label="Play"
          className="fixed left-3 z-30 flex h-10 items-center gap-1 rounded-full bg-white/80 px-3 text-sm font-semibold text-[#7a3653] shadow"
          style={{ top: 'calc(env(safe-area-inset-top) + 58px)' }}
          onClick={() => setOpen(true)}
        >
          🎮 Play
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div key="games" className={sheet} style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))', maxHeight: '62dvh' }} initial={{ y: 500 }} animate={{ y: 0 }} exit={{ y: 500 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#7a3653]">🎮 Play</h2>
              <button type="button" className={`${pinkBtn} px-5 py-1.5 text-sm`} onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {(['missions', 'play'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-2xl py-2 text-sm font-semibold ${tab === t ? 'bg-[#ffe1ec] text-[#7a3653]' : 'text-[#b07a92]'}`}>
                  {t === 'missions' ? '📋 Daily missions' : '💞 Play together'}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(62dvh - 120px)' }}>
              {tab === 'missions' ? (
                MISSIONS.map((m) => {
                  const last = controller?.state.missionsDone[m.id]
                  const ready = missionReady(m, last, now)
                  const left = last ? Math.max(0, m.cooldownMs - (now - last)) : 0
                  return (
                    <div key={m.id} className="mb-2 flex items-center gap-3 rounded-2xl bg-[#fbf3f6] p-3">
                      <span className="text-2xl">{m.emoji}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-[#4a2338]">{m.label}</div>
                        <div className="text-xs text-[#b07a92]">+RM{m.reward} · every {m.cooldownMs / 60000} min</div>
                      </div>
                      <button type="button" disabled={!ready} className={`${pinkBtn} px-4 py-2 text-sm`} onClick={() => { controller?.mission(m.id); setOpen(false) }}>
                        {ready ? 'Go' : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`}
                      </button>
                    </div>
                  )
                })
              ) : (
                <>
                  {!partnerOnline && <p className="mb-2 rounded-2xl bg-[#f8eef2] p-3 text-center text-sm text-[#8a5a70]">Couple games start when {partner?.name ?? 'your partner'} is online 💗</p>}
                  {[
                    { id: 'ttt' as const, emoji: '⭕', name: 'Tic-tac-toe', desc: `Win +RM${GAME_REWARD.tttWin}, draw +RM${GAME_REWARD.tttDraw}` },
                    { id: 'tot' as const, emoji: '💭', name: 'This or That', desc: `Pick the same answer: +RM${GAME_REWARD.totMatch} per match` },
                  ].map((g) => (
                    <div key={g.id} className="mb-2 flex items-center gap-3 rounded-2xl bg-[#fbf3f6] p-3">
                      <span className="text-2xl">{g.emoji}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-[#4a2338]">{g.name}</div>
                        <div className="text-xs text-[#b07a92]">{g.desc}</div>
                      </div>
                      <button type="button" disabled={!partnerOnline} className={`${pinkBtn} px-4 py-2 text-sm`} onClick={() => sendInvite(g.id)}>Invite</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {waiting && (
          <motion.div key="wait" className="fixed inset-x-4 top-24 z-40 rounded-3xl bg-white/95 p-4 text-center shadow-2xl" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
            <p className="font-semibold text-[#7a3653]">Waiting for {partner?.name ?? 'your partner'} to join… 💌</p>
            <button type="button" className="mt-2 text-sm text-[#b07a92] underline" onClick={() => { controller?.sendGame({ game: waiting.game, op: 'quit', id: waiting.id }); setWaiting(null) }}>Cancel</button>
          </motion.div>
        )}
        {invite && (
          <motion.div key="invite" className="fixed inset-x-4 top-24 z-40 rounded-3xl bg-white/95 p-4 shadow-2xl" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
            <p className="text-center font-semibold text-[#7a3653]">🎮 {partner?.name ?? 'Your partner'} wants to play {invite.game === 'ttt' ? 'Tic-tac-toe' : 'This or That'}!</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="h-11 flex-1 rounded-full bg-[#f3e6ec] font-semibold text-[#9a6a80]" onClick={() => { controller?.sendGame({ game: invite.game, op: 'decline', id: invite.id }); setInvite(null) }}>Later</button>
              <button type="button" className={`${pinkBtn} h-11 flex-1`} onClick={() => {
                const seed = Math.floor(Math.random() * 1e9)
                controller?.sendGame({ game: invite.game, op: 'accept', id: invite.id, value: seed })
                startSession(invite.game, invite.id, false, seed)
                setInvite(null)
              }}>Play 💕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {session?.game === 'ttt' && <TicTacToe key={session.id} session={session} partnerName={partner?.name ?? 'Partner'} onMove={(i) => {
          const next = place(session.board, i, session.mine)
          if (!next) return
          setSession({ ...session, board: next })
          controller?.sendGame({ game: 'ttt', op: 'move', id: session.id, value: i })
        }} onClose={quit} />}
        {session?.game === 'tot' && <ThisOrThat key={session.id} session={session} me={me} partnerName={partner?.name ?? 'Partner'} onPick={(c) => {
          setSession({ ...session, state: answerTot(session.state, me, c) })
          controller?.sendGame({ game: 'tot', op: 'move', id: session.id, value: c })
        }} onNext={() => {
          setSession({ ...session, state: nextTot(session.state) })
          controller?.sendGame({ game: 'tot', op: 'next', id: session.id })
        }} onClose={quit} />}
      </AnimatePresence>
    </>
  )
}

function GameCard({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,10,30,0.45)] px-5 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-2xl" initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#7a3653]">{title}</h3>
          <button type="button" className="rounded-full bg-[#f3e6ec] px-3 py-1 text-sm font-semibold text-[#9a6a80]" onClick={onClose}>Leave</button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

function TicTacToe({ session, partnerName, onMove, onClose }: { session: Extract<Session, { game: 'ttt' }>; partnerName: string; onMove: (i: number) => void; onClose: () => void }) {
  const w = winner(session.board), line = winningLine(session.board) ?? []
  const myTurn = !w && turn(session.board) === session.mine
  const status = w ? (w === 'draw' ? `Draw! +RM${GAME_REWARD.tttDraw} each` : w === session.mine ? `You win! +RM${GAME_REWARD.tttWin} 🎉` : `${partnerName} wins 💕`) : myTurn ? 'Your turn' : `${partnerName}'s turn…`
  return (
    <GameCard title="⭕ Tic-tac-toe" onClose={onClose}>
      <p className="mb-3 text-center text-sm font-semibold text-[#b07a92]">You are {session.mine === 'X' ? '💗' : '💙'} · {status}</p>
      <div className="grid grid-cols-3 gap-2">
        {session.board.map((c, i) => (
          <motion.button
            key={i}
            type="button"
            disabled={!myTurn || !!c}
            onClick={() => onMove(i)}
            className={`flex aspect-square items-center justify-center rounded-2xl text-4xl ${line.includes(i) ? 'bg-[#ffd3e2]' : 'bg-[#fbf3f6]'} active:scale-95`}
            whileTap={{ scale: 0.92 }}
          >
            <AnimatePresence>{c && <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}>{c === 'X' ? '💗' : '💙'}</motion.span>}</AnimatePresence>
          </motion.button>
        ))}
      </div>
    </GameCard>
  )
}

function ThisOrThat({ session, me, partnerName, onPick, onNext, onClose }: { session: Extract<Session, { game: 'tot' }>; me: string; partnerName: string; onPick: (c: 0 | 1) => void; onNext: () => void; onClose: () => void }) {
  const s = session.state
  if (totDone(s)) {
    return (
      <GameCard title="💭 This or That" onClose={onClose}>
        <p className="text-center text-5xl">{s.matches >= s.order.length * 0.6 ? '💞' : '💗'}</p>
        <p className="mt-2 text-center text-lg font-bold text-[#7a3653]">{s.matches} / {s.order.length} matches</p>
        <p className="mt-1 text-center text-sm text-[#b07a92]">+RM{s.matches * GAME_REWARD.totMatch} for you both</p>
      </GameCard>
    )
  }
  const [emoji, a, b] = QUESTIONS[s.order[s.round]]
  const mine = s.answers[me], partnerId = s.players.find((p) => p !== me)!, theirs = s.answers[partnerId]
  return (
    <GameCard title={`💭 This or That · ${s.round + 1}/${s.order.length}`} onClose={onClose}>
      <p className="mb-3 text-center text-4xl">{emoji}</p>
      <div className="grid grid-cols-2 gap-2">
        {[a, b].map((label, i) => {
          const picked = mine === i, partnerPicked = s.revealed && theirs === i
          return (
            <motion.button key={label} type="button" disabled={mine !== undefined} onClick={() => onPick(i as 0 | 1)} whileTap={{ scale: 0.95 }}
              className={`relative rounded-2xl px-2 py-5 text-base font-bold ${picked ? 'bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] text-white' : 'bg-[#fbf3f6] text-[#7a3653]'}`}>
              {label}
              {partnerPicked && <span className="absolute -right-1 -top-2 rounded-full bg-white px-2 text-xs text-[#d0476f] shadow">{partnerName}</span>}
            </motion.button>
          )
        })}
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-[#b07a92]">
        {!s.revealed ? (mine === undefined ? 'Pick one!' : `Waiting for ${partnerName}…`) : mine === theirs ? 'Match! 💞' : 'Opposites attract 😆'} · {s.matches} matches
      </p>
      {s.revealed && session.host && <button type="button" className={`${pinkBtn} mt-3 h-11 w-full`} onClick={onNext}>Next question</button>}
      {s.revealed && !session.host && <p className="mt-3 text-center text-xs text-[#c69ab0]">{partnerName} will tap next</p>}
    </GameCard>
  )
}
