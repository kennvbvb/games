import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from './supabaseClient'

export { isSupabaseConfigured }

/** Resolves the lazily-loaded client, or null when cloud accounts are off. */
function client(): Promise<SupabaseClient> | null {
  return getSupabase()
}

export async function getSession(): Promise<Session | null> {
  const pending = client()
  if (!pending) return null
  const { data } = await (await pending).auth.getSession()
  return data.session
}

export async function signUp(email: string, password: string): Promise<Session | null> {
  const pending = client()
  if (!pending) throw new Error('Cloud accounts are not configured')
  const { data, error } = await (await pending).auth.signUp({ email, password })
  if (error) throw error
  return data.session
}

export async function signIn(email: string, password: string): Promise<Session | null> {
  const pending = client()
  if (!pending) throw new Error('Cloud accounts are not configured')
  const { data, error } = await (await pending).auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut(): Promise<void> {
  const pending = client()
  if (!pending) return
  await (await pending).auth.signOut()
}
