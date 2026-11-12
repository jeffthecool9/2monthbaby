/**
 * Supabase hands out a new session object on every unlock and hourly token refresh.
 * The game must only be rebuilt when the signed-in *user* changes, so key on the user id.
 */
export function setupKey(session: { user: { id: string } } | null | undefined): string | null {
  return session?.user.id ?? null
}

export type LoadError = { kind: 'not-linked' | 'network'; message: string }

export function describeLoadError(err: unknown): LoadError {
  const code = (err as { code?: string } | null)?.code
  if (code === 'PGRST116') {
    return { kind: 'not-linked', message: 'This account isn’t linked to our home yet. Jeff needs to finish the setup step 🛠️' }
  }
  return { kind: 'network', message: 'Couldn’t reach our home. Check your connection and try again 💗' }
}
