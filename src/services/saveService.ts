import type { PlayerState } from '../types'
import { supabase } from './supabaseClient'

const LOCAL_KEY = 'incremental-rpg-save-v1'
let saveTimer: ReturnType<typeof setTimeout> | undefined

export function saveLocal(state: PlayerState): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
}

export function loadLocal(): PlayerState | null {
  const raw = localStorage.getItem(LOCAL_KEY)
  return raw ? (JSON.parse(raw) as PlayerState) : null
}

export function clearLocal(): void {
  localStorage.removeItem(LOCAL_KEY)
}

async function saveCloud(userId: string, state: PlayerState): Promise<void> {
  if (!supabase) throw new Error('Cloud accounts are not configured')
  const { error } = await supabase
    .from('saves')
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() })
  if (error) throw error
}

async function loadCloud(userId: string): Promise<PlayerState | null> {
  if (!supabase) throw new Error('Cloud accounts are not configured')
  const { data, error } = await supabase
    .from('saves')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.state as PlayerState | undefined) ?? null
}

/** Persist immediately: always mirrors to localStorage, and best-effort syncs to the cloud when signed in. */
export async function persist(state: PlayerState, userId: string | null): Promise<void> {
  saveLocal(state)
  if (userId) {
    try {
      await saveCloud(userId, state)
    } catch (err) {
      console.error('Cloud save failed, progress is still safe locally', err)
    }
  }
}

/** Debounced persist for frequent, low-priority state changes. */
export function scheduleSave(state: PlayerState, userId: string | null, delayMs = 2500): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void persist(state, userId)
  }, delayMs)
}

/** Loads cloud state when signed in (falling back to local on failure), otherwise loads local state. */
export async function loadState(userId: string | null): Promise<PlayerState | null> {
  if (userId) {
    try {
      const cloud = await loadCloud(userId)
      if (cloud) return cloud
    } catch (err) {
      console.error('Cloud load failed, falling back to local save', err)
    }
  }
  return loadLocal()
}
