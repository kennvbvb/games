import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

let client: Promise<SupabaseClient> | null = null

/**
 * Loads the Supabase SDK on first use rather than at startup: guests never sign
 * in, so for them it is ~120 kB that would only ever sit idle. The import is
 * memoised, so every caller shares one client and one network round trip.
 */
export function getSupabase(): Promise<SupabaseClient> | null {
  if (!isSupabaseConfigured) return null
  client ??= import('./supabaseSdk').then(({ createClient }) => createClient(url!, anonKey!))
  return client
}
