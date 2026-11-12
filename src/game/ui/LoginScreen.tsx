import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function LoginScreen({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      const m = error.message.toLowerCase()
      if (m.includes('not confirmed')) setError('This account isn’t confirmed yet. In Supabase → Authentication → Users, confirm it (or re-create it with “Auto Confirm User” ticked).')
      else if (m.includes('invalid login')) setError('That email or password doesn’t match. Try again 💗')
      else setError(`Couldn’t log in: ${error.message}`)
    }
  }

  return (
    <div className="flex items-center justify-center px-6" style={{ minHeight: '100dvh', background: 'radial-gradient(circle at 50% 20%, #ffd6e7 0%, #c9a7e8 45%, #3b2a55 100%)' }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] bg-white/90 p-6 shadow-2xl backdrop-blur">
        <div className="text-center text-5xl">🏠</div>
        <h1 className="mt-2 text-center text-2xl font-bold text-[#7a3653]">Our Home</h1>
        <p className="mb-5 mt-1 text-center text-sm text-[#a5718a]">Just the two of us 💕</p>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#b07a92]" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mb-3 h-12 w-full rounded-2xl border border-[#f3cfdd] bg-white px-4 text-[16px] text-[#4a2338] outline-none focus:border-[#ff8fb3]" />
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#b07a92]" htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="mb-4 h-12 w-full rounded-2xl border border-[#f3cfdd] bg-white px-4 text-[16px] text-[#4a2338] outline-none focus:border-[#ff8fb3]" />
        {error && <p className="mb-3 text-center text-sm text-[#d0476f]">{error}</p>}
        <button type="submit" disabled={busy} className="h-12 w-full rounded-full bg-gradient-to-br from-[#ff8fb3] to-[#ff6f9c] text-base font-bold text-white shadow-lg disabled:opacity-60">
          {busy ? 'Opening the door…' : 'Come home'}
        </button>
      </form>
    </div>
  )
}
