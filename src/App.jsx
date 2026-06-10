import { useState, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'

const PARTICLES = [
  { x: 4,  delay: 0,   sym: '♡',  sz: '1.1rem', dur: 7   },
  { x: 10, delay: 2.1, sym: '✦',  sz: '0.75rem',dur: 8.5 },
  { x: 17, delay: 0.7, sym: '🤍', sz: '1rem',   dur: 6.5 },
  { x: 24, delay: 3.4, sym: '♡',  sz: '0.85rem',dur: 9   },
  { x: 31, delay: 1.3, sym: '·',  sz: '1.4rem', dur: 5.5 },
  { x: 38, delay: 4.0, sym: '🩵', sz: '0.95rem',dur: 7.5 },
  { x: 45, delay: 0.4, sym: '♡',  sz: '1.2rem', dur: 8   },
  { x: 52, delay: 2.8, sym: '✦',  sz: '0.7rem', dur: 6   },
  { x: 59, delay: 1.6, sym: '🤍', sz: '0.9rem', dur: 9.5 },
  { x: 66, delay: 3.9, sym: '♡',  sz: '1rem',   dur: 7   },
  { x: 73, delay: 0.9, sym: '✦',  sz: '0.8rem', dur: 8   },
  { x: 80, delay: 2.4, sym: '🩵', sz: '1rem',   dur: 6   },
  { x: 87, delay: 1.1, sym: '♡',  sz: '1.3rem', dur: 7.5 },
  { x: 93, delay: 3.2, sym: '·',  sz: '1.2rem', dur: 5   },
  { x: 97, delay: 0.5, sym: '✦',  sz: '0.7rem', dur: 8.5 },
]

function Particle({ x, delay, sym, sz, dur }) {
  return (
    <motion.div
      className="particle"
      style={{ left: `${x}%`, fontSize: sz }}
      initial={{ y: '105vh', opacity: 0 }}
      animate={{ y: '-15vh', opacity: [0, 0.75, 0.75, 0] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeOut', times: [0, 0.15, 0.85, 1] }}
    >
      {sym}
    </motion.div>
  )
}

function LetterPara({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.p
      ref={ref}
      className={`letter-para ${className}`}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.p>
  )
}

export default function App() {
  const [musicOpen, setMusicOpen] = useState(false)

  const openMusic = () => setMusicOpen(true)
  const closeMusic = () => setMusicOpen(false)

  return (
    <div className="page-root">
      {/* Ambient glow layers */}
      <div className="bg-glow glow-1" />
      <div className="bg-glow glow-2" />
      <div className="bg-glow glow-3" />

      {/* Floating particles */}
      <div className="particles-layer" aria-hidden="true">
        {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}
      </div>

      {/* ── HERO ─────────────────────────────── */}
      <section className="hero">
        <motion.div
          className="hero-inner"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="month-pill"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8, type: 'spring' }}
          >
            🤍 两个月纪念日 🩵
          </motion.div>

          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            两个月快乐
          </motion.h1>

          <motion.h2
            className="hero-subtitle"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            我的伊莎贝拉
          </motion.h2>

          <motion.div
            className="scroll-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 1 }}
          >
            <motion.span
              animate={{ y: [0, 6, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              ↓ 读我写给你的话 ↓
            </motion.span>
          </motion.div>
        </motion.div>

        {/* Decorative divider */}
        <div className="hero-divider">
          <span>❧</span>
        </div>
      </section>

      {/* ── LETTER ───────────────────────────── */}
      <section className="letter-section">
        <div className="letter-card">
          <div className="letter-deco-top">· · ♡ · ·</div>

          <div className="letter-body">
            {/* Para 1 — contains 70岁 */}
            <LetterPara delay={0}>
              两个月快乐我的伊莎贝拉🤍🩵🤍🩵 其实bb我想跟你过很多个月，很多年hehehehe 到了{' '}
              <button
                className="seventy-wrap"
                onClick={openMusic}
                aria-label="点击播放 Thinking Out Loud"
              >
                <motion.span
                  className="seventy-text"
                  animate={{
                    textShadow: [
                      '0 0 10px rgba(245,200,66,0.5), 0 0 25px rgba(245,200,66,0.25)',
                      '0 0 22px rgba(245,200,66,1),   0 0 55px rgba(245,200,66,0.55)',
                      '0 0 10px rgba(245,200,66,0.5), 0 0 25px rgba(245,200,66,0.25)',
                    ],
                    scale: [1, 1.06, 1],
                  }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.96 }}
                >
                  70岁
                </motion.span>
                <motion.span
                  className="seventy-hint"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                >
                  ♪ 点我听歌
                </motion.span>
              </button>
              {' '}你就推我吧bb🥰这段时间确实不是很顺利，也遇到了很多事情but我跟bb的感情越来越好了！我也想知道bb的想法hehehhe😘
            </LetterPara>

            <div className="para-divider">· · ·</div>

            {/* Para 2 */}
            <LetterPara delay={0.1}>
              bb还是要跟你说声对不起，这段时间对我而言会有点煎熬，无论如何都会影响到你和我们的感情。我有很多不稳定的因素，但你还是那么的爱我。我并没有你想象的那么有自信，你出现了后我反而觉得自信是有了，但同时自卑也出现。我也和你一样会去想其他人的条件都不差，比我好的人存在得多，而且我们吵架后总会有很多负面情绪，我也担心你会找别人之类的……
            </LetterPara>

            <div className="para-divider">· · ·</div>

            {/* Para 3 */}
            <LetterPara delay={0.2}>
              但是bb你不用担心，我会慢慢去学怎么不多想，大多数的原因都是我本身的问题，都不关你的事哈哈哈哈哈。我也会给bb 满满的安全感🤍🤍 不是因为你缺乏安全感我才会给，而是因为我爱你我才要保护你🩵🩵 所以我需要变得更强大，更自信，才能保护你😔
            </LetterPara>
          </div>

          <motion.div
            className="letter-sign"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <span className="sign-hearts">🤍🩵</span>
            <span className="sign-text">爱你的 bb</span>
            <span className="sign-hearts">🩵🤍</span>
          </motion.div>

          <div className="letter-deco-bottom">· · ♡ · ·</div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────── */}
      <footer className="page-footer">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          viewport={{ once: true }}
        >
          <p className="footer-quote">"到了70岁，还是爱你"</p>
          <p className="footer-hearts">🤍 🩵 🤍 🩵 🤍</p>
        </motion.div>
      </footer>

      {/* ── MUSIC MODAL ──────────────────────── */}
      <AnimatePresence>
        {musicOpen && (
          <motion.div
            className="music-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={closeMusic}
          >
            <motion.div
              className="music-card"
              initial={{ opacity: 0, y: 60, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="music-header">
                <div className="music-info">
                  <p className="music-label">♪ 我们的歌</p>
                  <h3 className="music-title">Thinking Out Loud</h3>
                  <p className="music-artist">Ed Sheeran</p>
                </div>
                <button className="music-close" onClick={closeMusic} aria-label="关闭">✕</button>
              </div>

              <div className="music-embed">
                <iframe
                  width="100%"
                  height="215"
                  src="https://www.youtube.com/embed/lp-EO5I60KA?autoplay=1&rel=0&modestbranding=1"
                  title="Thinking Out Loud – Ed Sheeran"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <motion.p
                className="music-note"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                到了70岁，还是爱你 🩵
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
