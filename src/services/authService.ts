import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabaseClient'

export { isSupabaseConfigured }

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signUp(email: string, password: string): Promise<Session | null> {
  if (!supabase) throw new Error('Cloud accounts are not configured')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data.session
}

export async function signIn(email: string, password: string): Promise<Session | null> {
  if (!supabase) throw new Error('Cloud accounts are not configured')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}
