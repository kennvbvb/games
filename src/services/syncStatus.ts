export type SyncStatus = 'guest' | 'saving' | 'synced' | 'error'

type Listener = (status: SyncStatus) => void

let current: SyncStatus = 'guest'
const listeners = new Set<Listener>()

export function getSyncStatus(): SyncStatus {
  return current
}

export function setSyncStatus(status: SyncStatus): void {
  if (status === current) return
  current = status
  for (const listener of listeners) listener(status)
}

/** Returns an unsubscribe function; call it in the scene's shutdown handler. */
export function onSyncStatus(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
